const OpenAI = require('openai');

class HunyuanAIService {
  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://tokenhub.tencentmaas.com/v1',
      apiKey: process.env.TOKENHUB_API_KEY || 'sk-placeholder', // 从环境变量读取
    });
  }

  // 封装 db.query 为 Promise 方便 async/await 调用
  async queryDb(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  /**
   * 生成牛舍环境周报
   * @param {Object} db 数据库连接对象
   * @param {string} deviceId 设备ID (牛舍ID)
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @returns {Promise<string>} AI生成的分析报告
   */
  async generateWeeklyReport(db, deviceId, startDate, endDate) {
    try {
      // 1. 从数据库获取历史数据
      const query = `
        SELECT 
          DATE(created_at) as date,
          ROUND(AVG(temperature), 2) as avg_temp,
          ROUND(AVG(humidity), 2) as avg_humidity,
          ROUND(AVG(gas_concentration), 2) as avg_gas,
          ROUND(AVG(co2), 2) as avg_co2,
          MAX(temperature) as max_temp,
          MIN(temperature) as min_temp
        FROM sensor_data 
        WHERE device_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      const data = await this.queryDb(db, query, [deviceId, startDate, endDate]);
      
      if (data.length === 0) {
        return '暂无该时间段的数据，无法生成分析报告。';
      }

      // 2. 构造AI提示词
      const prompt = this.buildWeeklyReportPrompt(data, startDate, endDate);
      
      // 3. 调用腾讯混元模型
      const response = await this.client.chat.completions.create({
        model: 'hunyuan-2.0-thinking-20251109',
        messages: [
          {
            role: 'system',
            content: '你是畜牧业养殖专家，精通牛舍环境管理与动物福利。请用专业、有条理的语言撰写分析报告，使用中文回复。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,  // 较低的温度保证报告稳定性
        max_tokens: 1500,
      });

      return response.choices[0].message.content;
      
    } catch (error) {
      console.error('生成AI报告失败：', error);
      return '生成分析报告时发生错误，请稍后重试。错误信息：' + error.message;
    }
  }

  /**
   * 构建周报提示词
   */
  buildWeeklyReportPrompt(data, startDate, endDate) {
    const dataSummary = data.map(day => 
      `日期：${day.date}，平均温度：${day.avg_temp}°C，平均湿度：${day.avg_humidity}%，平均有害气体：${day.avg_gas}ppm，平均二氧化碳：${day.avg_co2}ppm，温度范围：${day.min_temp}-${day.max_temp}°C`
    ).join('\n');
    
    return `请根据以下牛舍环境监测数据，生成一份专业的分析报告。

**监测周期**：${startDate} 至 ${endDate}
**数据概览**（按日统计）：
${dataSummary}

**报告要求**：
1. **整体评估**：用1-2句话概括该时间段的环境整体情况
2. **趋势分析**：分析温度、湿度、有害气体及二氧化碳浓度的变化趋势
3. **风险识别**：指出潜在的环境风险点
4. **具体建议**：给出3条可操作的改进建议
5. **未来预测**：基于趋势预测未来几天的可能变化

**格式要求**：
- 使用清晰的标题和段落（Markdown格式）
- 重点数据用**加粗**标出
- 建议部分用编号列表
- 总字数在800字左右`;
  }

  /**
   * 实时异常分析
   * @param {Object} db 数据库连接对象
   * @param {Object} currentAlarm 当前报警记录
   * @param {Object} alarmThresholds 报警阈值配置
   * @returns {Promise<string>} 异常分析结果
   */
  async analyzeAbnormality(db, currentAlarm, alarmThresholds) {
    try {
      // 提取报警时间前的近期数据 (3小时前)
      const query = `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
          ROUND(AVG(temperature), 2) as avg_temp,
          ROUND(AVG(humidity), 2) as avg_humidity,
          ROUND(AVG(gas_concentration), 2) as avg_gas,
          ROUND(AVG(co2), 2) as avg_co2
        FROM sensor_data
        WHERE device_id = ? 
          AND created_at >= DATE_SUB(?, INTERVAL 3 HOUR) 
          AND created_at <= ?
        GROUP BY hour
        ORDER BY hour
      `;
      const recentData = await this.queryDb(db, query, [
        currentAlarm.device_id, 
        currentAlarm.created_at, 
        currentAlarm.created_at
      ]);

      const prompt = `检测到牛舍环境数据异常报警，请分析可能原因并提供处理建议。

**当前报警信息**：
- 报警类型：${currentAlarm.alarm_type}
- 异常数值：${currentAlarm.alarm_value}
- 触发阈值：${currentAlarm.threshold}
- 报警详情：${currentAlarm.message}
- 时间：${currentAlarm.created_at}

**当前系统安全阈值配置**：
- 温度范围：${alarmThresholds.temperature.min}°C - ${alarmThresholds.temperature.max}°C
- 湿度范围：${alarmThresholds.humidity.min}% - ${alarmThresholds.humidity.max}%
- 有害气体上限：${alarmThresholds.gas.max}ppm
- 二氧化碳上限：${alarmThresholds.co2.max}ppm

**近期数据趋势**（报警前3小时，每小时平均值）：
${recentData.length > 0 ? recentData.map(d => 
  `时间：${d.hour}，温度：${d.avg_temp}°C，湿度：${d.avg_humidity}%，有害气体：${d.avg_gas}ppm，CO2：${d.avg_co2}ppm`
).join('\n') : '暂无近期数据'}

**请从以下方面分析**：
1. 可能的根本原因（按可能性排序）
2. 对牛只健康的潜在影响
3. 紧急处理措施
4. 长期预防建议

请用简洁的专业语言回答（Markdown格式），每点不超过3句话。`;

      const response = await this.client.chat.completions.create({
        model: 'hunyuan-2.0-thinking-20251109',
        messages: [
          {
            role: 'system',
            content: '你是兽医与畜牧环境管理专家，请快速准确地分析牛舍环境异常。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,  // 低温度保证分析准确性
        max_tokens: 800,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('AI分析异常失败：', error);
      return 'AI分析服务暂时不可用，请稍后重试或手动检查环境参数。错误信息：' + error.message;
    }
  }
}

module.exports = new HunyuanAIService();
