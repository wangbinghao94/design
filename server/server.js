require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const aiAnalysisService = require('./services/aiAnalysisService');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 数据库连接配置 - 修改这里！
const db = mysql.createConnection({
  host: 'localhost',     
  port: 3306,           
  user: 'root',
  password: 'root',
  database: 'cowshed_monitor'
});

// 连接数据库
db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('✅ 已连接到MySQL数据库');
});

// 全局变量
let alarmThresholds = {
  temperature: { min: 10, max: 30 },
  humidity: { min: 40, max: 80 },
  gas: { max: 50 },
  co2: { max: 1000 } // 二氧化碳阈值，单位ppm
};

// 获取报警阈值
app.get('/api/thresholds', (req, res) => {
  res.json({
    success: true,
    data: alarmThresholds
  });
});

// 设置报警阈值
app.put('/api/thresholds', (req, res) => {
  const { temperature, humidity, gas, co2 } = req.body;
  if (temperature) alarmThresholds.temperature = temperature;
  if (humidity) alarmThresholds.humidity = humidity;
  if (gas) alarmThresholds.gas = gas;
  if (co2) alarmThresholds.co2 = co2;
  
  res.json({
    success: true,
    message: '报警阈值更新成功',
    data: alarmThresholds
  });
});

// 1. 接收ESP32传感器数据
app.post('/api/sensor-data', (req, res) => {
  const { device_id, temperature, humidity, gas_concentration, co2 } = req.body;
  console.log('📡 收到传感器数据:', { device_id, temperature, humidity, gas_concentration, co2 });

  // 验证数据
  if (!device_id) {
    return res.status(400).json({ success: false, error: '缺少设备ID' });
  }

  // 如果前端没有发送co2，则生成模拟CO2值
  const simulatedCO2 = co2 !== undefined ? co2 : generateSimulatedCO2(temperature, humidity, gas_concentration);
  
  // 插入传感器数据
  const sensorQuery = `
    INSERT INTO sensor_data (device_id, temperature, humidity, gas_concentration, co2) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(sensorQuery, [device_id, temperature, humidity, gas_concentration, simulatedCO2], (err, result) => {
    if (err) {
      console.error('插入传感器数据失败:', err);
      return res.status(500).json({ success: false, error: '数据存储失败' });
    }

    // 更新设备在线状态
    const deviceQuery = `
      UPDATE device 
      SET online = 1, last_active_time = NOW() 
      WHERE device_id = ?
    `;
    
    db.query(deviceQuery, [device_id], (deviceErr) => {
      if (deviceErr) {
        console.warn('更新设备状态失败:', deviceErr);
      }
    });

    // 检查报警
    checkAlarms(device_id, temperature, humidity, gas_concentration, simulatedCO2);

    res.json({ 
      success: true, 
      message: '数据接收成功',
      data_id: result.insertId,
      timestamp: new Date().toLocaleString(),
      note: co2 === undefined ? 'CO2为模拟值' : 'CO2为实测值'
    });
  });
});

// 模拟CO2生成函数
function generateSimulatedCO2(temperature, humidity, gasConcentration) {
  // 基础CO2浓度（牛舍正常范围800-1500ppm）
  const baseCO2 = 1000;
  
  // 温度影响：温度每升高1°C，CO2增加15ppm
  const tempFactor = (temperature - 25) * 15;
  
  // 湿度影响：湿度每升高1%，CO2增加8ppm
  const humidityFactor = (humidity - 60) * 8;
  
  // 气体浓度影响：如果有氨气浓度，也作为参考
  const gasFactor = gasConcentration ? gasConcentration * 0.1 : 0;
  
  // 随机波动 ±50ppm
  const randomFactor = (Math.random() * 100 - 50);
  
  // 计算最终CO2值
  let co2 = baseCO2 + tempFactor + humidityFactor + gasFactor + randomFactor;
  
  // 确保在合理范围内（600-2500ppm）
  co2 = Math.max(600, Math.min(2500, co2));
  
  // 保留两位小数
  return parseFloat(co2.toFixed(2));
}

// 2. 获取最新数据
app.get('/api/realtime', (req, res) => {
  const deviceId = req.query.device_id || 'ESP32_001';
  const limit = parseInt(req.query.limit) || 5;

  const query = `
    SELECT * FROM sensor_data 
    WHERE device_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `;

  db.query(query, [deviceId, limit], (err, results) => {
    if (err) {
      console.error('获取实时数据失败:', err);
      return res.status(500).json({ success: false, error: '获取数据失败' });
    }
    
    res.json({ 
      success: true, 
      data: results,
      count: results.length
    });
  });
});

// 3. 获取历史数据
app.get('/api/history', (req, res) => {
  const { device_id, start_time, end_time, limit = 100 } = req.query;
  const deviceId = device_id || 'ESP32_001';

  let query = `
    SELECT * FROM sensor_data 
    WHERE device_id = ? 
  `;
  const params = [deviceId];

  if (start_time) {
    query += ' AND created_at >= ?';
    params.push(start_time);
  }
  if (end_time) {
    query += ' AND created_at <= ?';
    params.push(end_time);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('获取历史数据失败:', err);
      return res.status(500).json({ success: false, error: '获取历史数据失败' });
    }
    
    res.json({ 
      success: true, 
      data: results,
      count: results.length
    });
  });
});

// 4. 获取设备列表
app.get('/api/devices', (req, res) => {
  const query = 'SELECT * FROM device ORDER BY created_at DESC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('获取设备列表失败:', err);
      return res.status(500).json({ success: false, error: '获取设备列表失败' });
    }
    
    res.json({ 
      success: true, 
      devices: results,
      onlineCount: results.filter(d => d.online).length
    });
  });
});

// 4.1 更新设备信息
app.put('/api/devices/:id', (req, res) => {
  const deviceId = req.params.id;
  const { name, location } = req.body;
  
  const query = `
    UPDATE device 
    SET name = ?, location = ?
    WHERE device_id = ?
  `;
  
  db.query(query, [name, location, deviceId], (err, result) => {
    if (err) {
      console.error('更新设备信息失败:', err);
      return res.status(500).json({ success: false, error: '更新设备信息失败' });
    }
    
    res.json({ 
      success: true, 
      message: '设备信息更新成功'
    });
  });
});

// 5. 获取报警记录
app.get('/api/alarms', (req, res) => {
  const { status, limit = 50 } = req.query;
  
  let query = 'SELECT * FROM alarm_log ORDER BY created_at DESC LIMIT ?';
  const params = [parseInt(limit)];
  
  if (status !== undefined) {
    query = 'SELECT * FROM alarm_log WHERE status = ? ORDER BY created_at DESC LIMIT ?';
    params.unshift(parseInt(status));
  }
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('获取报警记录失败:', err);
      return res.status(500).json({ success: false, error: '获取报警记录失败' });
    }
    
    res.json({ 
      success: true, 
      alarms: results,
      unreadCount: results.filter(a => a.status === 0).length
    });
  });
});

// 6. 更新报警状态
app.put('/api/alarms/:id', (req, res) => {
  const alarmId = req.params.id;
  const { status } = req.body;
  
  if (status === undefined) {
    return res.status(400).json({ success: false, error: '缺少状态参数' });
  }
  
  const query = `
    UPDATE alarm_log 
    SET status = ?, processed_at = NOW() 
    WHERE id = ?
  `;
  
  db.query(query, [status, alarmId], (err, result) => {
    if (err) {
      console.error('更新报警状态失败:', err);
      return res.status(500).json({ success: false, error: '更新失败' });
    }
    
    res.json({ 
      success: true, 
      message: '报警状态更新成功',
      affectedRows: result.affectedRows
    });
  });
});

// 7. 获取统计数据
app.get('/api/statistics', (req, res) => {
  const deviceId = req.query.device_id || 'ESP32_001';
  const today = new Date().toISOString().split('T')[0];
  
  const queries = {
    todayCount: `
      SELECT COUNT(*) as count FROM sensor_data 
      WHERE device_id = ? AND DATE(created_at) = ?
    `,
    avgData: `
      SELECT 
        AVG(temperature) as avg_temp,
        AVG(humidity) as avg_humidity,
        AVG(gas_concentration) as avg_gas,
        AVG(co2) as avg_co2
      FROM sensor_data 
      WHERE device_id = ? AND DATE(created_at) = ?
    `,
    alarmCount: `
      SELECT COUNT(*) as count FROM alarm_log 
      WHERE DATE(created_at) = ? AND status = 0
    `
  };
  
  // 并行查询
  db.query(queries.todayCount, [deviceId, today], (err1, result1) => {
    db.query(queries.avgData, [deviceId, today], (err2, result2) => {
      db.query(queries.alarmCount, [today], (err3, result3) => {
        if (err1 || err2 || err3) {
          console.error('获取统计数据失败:', err1 || err2 || err3);
          return res.status(500).json({ success: false, error: '获取统计失败' });
        }
        
        res.json({
          success: true,
          data: {
            todayDataCount: result1[0]?.count || 0,
            avgTemperature: result2[0]?.avg_temp ? parseFloat(result2[0].avg_temp).toFixed(1) : 0,
            avgHumidity: result2[0]?.avg_humidity ? parseFloat(result2[0].avg_humidity).toFixed(1) : 0,
            avgGas: result2[0]?.avg_gas ? parseFloat(result2[0].avg_gas).toFixed(1) : 0,
            avgCo2: result2[0]?.avg_co2 ? parseFloat(result2[0].avg_co2).toFixed(1) : 0,
            unreadAlarmCount: result3[0]?.count || 0
          }
        });
      });
    });
  });
});

// 8. 模拟数据接口（用于测试）
app.post('/api/mock-data', (req, res) => {
  const { count = 10 } = req.body;
  const deviceId = 'ESP32_001';
  
  const insertPromises = [];
  for (let i = 0; i < count; i++) {
    const temp = 20 + Math.random() * 10; // 20-30度
    const humidity = 50 + Math.random() * 30; // 50-80%
    const gas = 20 + Math.random() * 30; // 20-50 ppm
    const co2 = generateSimulatedCO2(temp, humidity, gas);
    const timeOffset = i * 3600000; // 每1小时一条
    
    const query = `
      INSERT INTO sensor_data (device_id, temperature, humidity, gas_concentration, co2, created_at) 
      VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? SECOND))
    `;
    
    insertPromises.push(new Promise((resolve, reject) => {
      // 每条数据间隔10秒
      db.query(query, [deviceId, temp.toFixed(1), humidity.toFixed(1), gas.toFixed(1), co2, i * 10], (err) => {
        if (err) reject(err);
        else resolve();
      });
    }));
  }
  
  Promise.all(insertPromises)
    .then(() => {
      res.json({ 
        success: true, 
        message: `成功插入 ${count} 条模拟数据` 
      });
    })
    .catch(err => {
      console.error('插入模拟数据失败:', err);
      res.status(500).json({ success: false, error: '插入模拟数据失败' });
    });
});

// 9. AI 生成周报
app.get('/api/analysis/weekly-report', async (req, res) => {
  const { device_id, start_date, end_date } = req.query;
  
  if (!device_id || !start_date || !end_date) {
    return res.status(400).json({ success: false, error: '缺少必要参数 (device_id, start_date, end_date)' });
  }
  
  try {
    const report = await aiAnalysisService.generateWeeklyReport(db, device_id, start_date, end_date);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('AI周报生成路由错误:', error);
    res.status(500).json({ success: false, error: '生成报告失败' });
  }
});

// 10. AI 报警异常分析
app.post('/api/analysis/abnormality', async (req, res) => {
  const { alarm_id } = req.body;
  
  if (!alarm_id) {
    return res.status(400).json({ success: false, error: '缺少报警记录ID (alarm_id)' });
  }
  
  try {
    // 1. 获取报警记录详情
    const getAlarmQuery = 'SELECT * FROM alarm_log WHERE id = ?';
    db.query(getAlarmQuery, [alarm_id], async (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ success: false, error: '未找到指定的报警记录' });
      }
      
      const currentAlarm = results[0];
      
      // 2. 调用 AI 分析服务
      const analysisResult = await aiAnalysisService.analyzeAbnormality(db, currentAlarm, alarmThresholds);
      
      // 3. (可选) 将分析结果保存到数据库
      // 如果 alarm_log 表加了 ai_analysis 字段，可以写回数据库
      const updateQuery = 'UPDATE alarm_log SET ai_analysis = ? WHERE id = ?';
      db.query(updateQuery, [analysisResult, alarm_id], (updateErr) => {
        if (updateErr) console.error('保存AI分析结果失败', updateErr);
      });
      
      res.json({
        success: true,
        data: analysisResult
      });
    });
    
  } catch (error) {
    console.error('AI报警分析路由错误:', error);
    res.status(500).json({ success: false, error: '异常分析失败' });
  }
});

// 报警检查函数
function checkAlarms(deviceId, temp, humidity, gas, co2) {
  const alarms = [];

  // 温度报警
  if (temp !== undefined) {
    if (temp < alarmThresholds.temperature.min) {
      alarms.push({
        device_id: deviceId,
        alarm_type: 'temperature_low',
        alarm_value: temp,
        threshold: alarmThresholds.temperature.min,
        message: `⚠️ 温度过低: ${parseFloat(temp).toFixed(1)}°C (低于${alarmThresholds.temperature.min}°C)`
      });
    } else if (temp > alarmThresholds.temperature.max) {
      alarms.push({
        device_id: deviceId,
        alarm_type: 'temperature_high',
        alarm_value: temp,
        threshold: alarmThresholds.temperature.max,
        message: `🔥 温度过高: ${parseFloat(temp).toFixed(1)}°C (高于${alarmThresholds.temperature.max}°C)`
      });
    }
  }

  // 湿度报警
  if (humidity !== undefined) {
    if (humidity < alarmThresholds.humidity.min) {
      alarms.push({
        device_id: deviceId,
        alarm_type: 'humidity_low',
        alarm_value: humidity,
        threshold: alarmThresholds.humidity.min,
        message: `💧 湿度过低: ${parseFloat(humidity).toFixed(1)}% (低于${alarmThresholds.humidity.min}%)`
      });
    } else if (humidity > alarmThresholds.humidity.max) {
      alarms.push({
        device_id: deviceId,
        alarm_type: 'humidity_high',
        alarm_value: humidity,
        threshold: alarmThresholds.humidity.max,
        message: `💦 湿度过高: ${parseFloat(humidity).toFixed(1)}% (高于${alarmThresholds.humidity.max}%)`
      });
    }
  }

  // 气体浓度报警
  if (gas !== undefined && gas > alarmThresholds.gas.max) {
    alarms.push({
      device_id: deviceId,
      alarm_type: 'gas_high',
      alarm_value: gas,
      threshold: alarmThresholds.gas.max,
      message: `☠️ 气体浓度过高: ${parseFloat(gas).toFixed(1)}ppm (高于${alarmThresholds.gas.max}ppm)`
    });
  }

  // 二氧化碳报警
  if (co2 !== undefined && co2 > alarmThresholds.co2.max) {
    alarms.push({
      device_id: deviceId,
      alarm_type: 'co2_high',
      alarm_value: co2,
      threshold: alarmThresholds.co2.max,
      message: `😷 二氧化碳浓度过高: ${parseFloat(co2).toFixed(1)}ppm (高于${alarmThresholds.co2.max}ppm)`
    });
  }

  // 插入报警记录
  alarms.forEach(alarm => { 
    const query = `
      INSERT INTO alarm_log (device_id, alarm_type, alarm_value, threshold, message) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.query(query, [
      alarm.device_id,
      alarm.alarm_type,
      alarm.alarm_value,
      alarm.threshold,
      alarm.message
    ], (err) => {
      if (err) console.error('插入报警记录失败:', err);
      else console.log('🔔 生成报警:', alarm.message);
    });
  });
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '牛舍监控系统后端运行正常',
    timestamp: new Date().toLocaleString(),
    version: '1.0.0',
    database: 'connected'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('🚀 后端服务器已启动');
  console.log(`📡 监听地址: http://localhost:${PORT}`);
  console.log('📊 可用接口:');
  console.log(`  POST   /api/sensor-data     - 接收传感器数据`);
  console.log(`  GET    /api/realtime        - 获取实时数据`);
  console.log(`  GET    /api/history         - 获取历史数据`);
  console.log(`  GET    /api/devices         - 获取设备列表`);
  console.log(`  GET    /api/alarms          - 获取报警记录`);
  console.log(`  PUT    /api/alarms/:id      - 更新报警状态`);
  console.log(`  GET    /api/statistics      - 获取统计数据`);
  console.log(`  POST   /api/mock-data       - 插入模拟数据`);
  console.log(`  GET    /api/health          - 健康检查`);
  console.log('\n🔧 硬件ESP32请发送数据到:');
  console.log(`  POST http://localhost:${PORT}/api/sensor-data`);
  console.log('\n🖥️ 前端Vue请访问:');
  console.log('  http://localhost:5173 (或你的Vue开发服务器地址)');
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});