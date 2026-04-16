import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/index'

export const useMonitorStore = defineStore('monitor', () => {
  // 状态
  const realtimeData = ref([])
  const historyData = ref([])
  const devices = ref([])
  const alarms = ref([])
  const statistics = ref(null)
  const selectedDevice = ref('ESP32_001')
  const isLoading = ref(false)

  // 计算属性
  const latestData = computed(() => {
    return realtimeData.value[0] || null
  })

  const unreadAlarmCount = computed(() => {
    return alarms.value.filter((alarm) => alarm.status === 0).length
  })

  const onlineDeviceCount = computed(() => {
    return devices.value.filter((device) => device.online).length
  })

  // 异步actions
  async function fetchRealtimeData() {
    try {
      const response = await api.sensor.getRealtime(selectedDevice.value)
      if (response.success) {
        realtimeData.value = response.data
      }
      return response
    } catch (error) {
      console.error('获取实时数据失败:', error)
      throw error
    }
  }

  async function fetchHistoryData(params = {}) {
    try {
      isLoading.value = true
      const response = await api.sensor.getHistory({
        device_id: selectedDevice.value,
        ...params,
      })
      if (response.success) {
        historyData.value = response.data
      }
      return response
    } catch (error) {
      console.error('获取历史数据失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function fetchDevices() {
    try {
      const response = await api.device.getDevices()
      if (response.success) {
        devices.value = response.devices
      }
      return response
    } catch (error) {
      console.error('获取设备列表失败:', error)
      throw error
    }
  }

  async function fetchAlarms(status = null) {
    try {
      const response = await api.alarm.getAlarms(status)
      if (response.success) {
        alarms.value = response.alarms
      }
      return response
    } catch (error) {
      console.error('获取报警记录失败:', error)
      throw error
    }
  }

  async function fetchStatistics() {
    try {
      const response = await api.statistics.getStatistics(selectedDevice.value)
      if (response.success) {
        statistics.value = response.data
      }
      return response
    } catch (error) {
      console.error('获取统计数据失败:', error)
      throw error
    }
  }

  async function updateAlarmStatus(alarmId, status) {
    try {
      const response = await api.alarm.updateAlarm(alarmId, status)
      if (response.success) {
        // 更新本地状态
        const index = alarms.value.findIndex((alarm) => alarm.id === alarmId)
        if (index !== -1) {
          alarms.value[index].status = status
          alarms.value[index].processed_at = new Date()
        }
      }
      return response
    } catch (error) {
      console.error('更新报警状态失败:', error)
      throw error
    }
  }

  // 发送模拟数据（测试用）
  async function sendMockData() {
    try {
      const response = await api.system.insertMockData(5)
      if (response.success) {
        // 刷新数据
        await Promise.all([fetchRealtimeData(), fetchStatistics()])
      }
      return response
    } catch (error) {
      console.error('发送模拟数据失败:', error)
      throw error
    }
  }

  // 初始化
  async function initialize() {
    try {
      await Promise.all([fetchRealtimeData(), fetchDevices(), fetchStatistics()])
    } catch (error) {
      console.error('初始化失败:', error)
    }
  }

  return {
    // 状态
    realtimeData,
    historyData,
    devices,
    alarms,
    statistics,
    selectedDevice,
    isLoading,

    // 计算属性
    latestData,
    unreadAlarmCount,
    onlineDeviceCount,

    // actions
    fetchRealtimeData,
    fetchHistoryData,
    fetchDevices,
    fetchAlarms,
    fetchStatistics,
    updateAlarmStatus,
    sendMockData,
    initialize,
  }
})
