import axios from 'axios';

// 创建axios实例
const apiClient = axios.create({
  baseURL: 'http://localhost:3000', // 后端API地址
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
    // 可以在这里添加token等
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

export default {
  // 传感器数据相关
  sensor: {
    // 发送传感器数据（硬件调用）
    sendData(data) {
      return apiClient.post('/api/sensor-data', data);
    },
    // 获取实时数据
    getRealtime(deviceId = 'ESP32_001', limit = 5) {
      return apiClient.get('/api/realtime', {
        params: { device_id: deviceId, limit }
      });
    },
    // 获取历史数据
    getHistory(params) {
      return apiClient.get('/api/history', { params });
    }
  },
  
  // 设备相关
  device: {
    // 获取设备列表
    getDevices() {
      return apiClient.get('/api/devices');
    },
    // 更新设备信息
    updateDevice(id, data) {
      return apiClient.put(`/api/devices/${id}`, data);
    }
  },
  
  // 报警相关
  alarm: {
    // 获取报警记录
    getAlarms(status = null, limit = 50) {
      const params = { limit };
      if (status !== null) params.status = status;
      return apiClient.get('/api/alarms', { params });
    },
    // 更新报警状态
    updateAlarm(id, status) {
      return apiClient.put(`/api/alarms/${id}`, { status });
    },
    // 获取报警阈值
    getThresholds() {
      return apiClient.get('/api/thresholds');
    },
    // 设置报警阈值
    setThresholds(data) {
      return apiClient.put('/api/thresholds', data);
    }
  },
  
  // 统计相关
  statistics: {
    // 获取统计数据
    getStatistics(deviceId = 'ESP32_001') {
      return apiClient.get('/api/statistics', {
        params: { device_id: deviceId }
      });
    }
  },
  
  // 系统相关
  system: {
    // 健康检查
    healthCheck() {
      return apiClient.get('/api/health');
    },
    // 插入模拟数据
    insertMockData(count = 10) {
      return apiClient.post('/api/mock-data', { count });
    }
  }
};