<template>
  <div class="dashboard-big-screen">
    <!-- 顶部标题区 -->
    <div class="screen-header">
      <h1 class="screen-title">牛舍环境实时监控与可视化中心</h1>
      <div class="screen-time">{{ currentTime }}</div>
    </div>

    <div class="screen-content">
      <!-- 左侧：实时统计数据卡片 -->
      <div class="screen-left">
        <div class="panel-box">
          <div class="panel-title">当前环境概览</div>
          <div class="panel-content stat-grid">
            <div class="stat-item">
              <el-icon class="stat-icon temperature"><Sunny /></el-icon>
              <div class="stat-info">
                <div class="stat-value">
                  {{ latestData?.temperature || '--' }}<span class="unit">°C</span>
                </div>
                <div class="stat-label">温度</div>
              </div>
            </div>

            <div class="stat-item">
              <el-icon class="stat-icon humidity"><Watermelon /></el-icon>
              <div class="stat-info">
                <div class="stat-value">
                  {{ latestData?.humidity || '--' }}<span class="unit">%</span>
                </div>
                <div class="stat-label">湿度</div>
              </div>
            </div>

            <div class="stat-item">
              <el-icon class="stat-icon gas"><Warning /></el-icon>
              <div class="stat-info">
                <div class="stat-value">
                  {{ latestData?.gas_concentration || '--' }}<span class="unit">ppm</span>
                </div>
                <div class="stat-label">有害气体</div>
              </div>
            </div>

            <div class="stat-item">
              <el-icon class="stat-icon co2"><Odometer /></el-icon>
              <div class="stat-info">
                <div class="stat-value">
                  {{ latestData?.co2 || '--' }}<span class="unit">ppm</span>
                </div>
                <div class="stat-label">二氧化碳</div>
              </div>
            </div>

            <div class="stat-item device-item">
              <el-icon class="stat-icon device"><Cpu /></el-icon>
              <div class="stat-info">
                <div class="stat-value">
                  {{ onlineDeviceCount }}<span class="unit">/{{ devices?.length || 0 }}</span>
                </div>
                <div class="stat-label">在线设备</div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-box mt-20">
          <div class="panel-title">环境状态饼图</div>
          <div class="panel-content">
            <div ref="overviewChart" class="chart-container"></div>
          </div>
        </div>
      </div>

      <!-- 中间：核心趋势图 -->
      <div class="screen-center">
        <div class="panel-box center-panel">
          <div class="panel-title flex-between">
            <span>环境数据趋势 (温/湿/气)</span>
            <el-select v-model="timeRange" size="small" class="dark-select">
              <el-option label="最近1小时" value="1"></el-option>
              <el-option label="最近24小时" value="24"></el-option>
              <el-option label="最近7天" value="168"></el-option>
            </el-select>
          </div>
          <div class="panel-content">
            <div ref="tempChart" class="chart-container-large"></div>
          </div>
        </div>

        <!-- 报警通知跑马灯（可选） -->
        <div v-if="unreadAlarmCount > 0" class="alarm-marquee mt-20">
          <el-icon class="alarm-icon"><Bell /></el-icon>
          <span class="alarm-text"
            >系统检测到 {{ unreadAlarmCount }} 条未处理报警，请及时前往处理！</span
          >
          <el-button type="danger" size="small" plain @click="$router.push('/alarm')"
            >去处理</el-button
          >
        </div>
      </div>

      <!-- 右侧：实时数据流 -->
      <div class="screen-right">
        <div class="panel-box">
          <div class="panel-title flex-between">
            <span>实时数据流</span>
            <div>
              <el-button type="primary" size="small" class="dark-btn" @click="fetchRealtimeData">
                <el-icon><Refresh /></el-icon>
              </el-button>
              <el-button size="small" class="dark-btn" @click="sendMockData" v-if="!hasRealData">
                测试
              </el-button>
            </div>
          </div>
          <div class="panel-content table-container">
            <el-table
              :data="realtimeData"
              style="width: 100%"
              v-loading="isLoading"
              class="dark-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="temperature" label="温度(°C)" width="80">
                <template #default="{ row }">
                  <span :class="getTempClass(row.temperature)">{{ row.temperature }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="humidity" label="湿度(%)" width="80">
                <template #default="{ row }">
                  <span :class="getHumidityClass(row.humidity)">{{ row.humidity }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="co2" label="CO2" width="70">
                <template #default="{ row }">
                  <span :class="getCo2Class(row.co2)">{{ row.co2 }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="时间" min-width="120">
                <template #default="{ row }">
                  {{ formatTime(row.created_at, 'MM-DD HH:mm') }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="70">
                <template #default="{ row }">
                  <span :class="getStatusType(row)">
                    {{ getStatusText(row) }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Sunny, Watermelon, Warning, Cpu, Refresh, Odometer, Bell } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useMonitorStore } from '@/stores/monitor'
import { ElMessage } from 'element-plus'
import api from '@/api'

const router = useRouter()
const monitorStore = useMonitorStore()
const { realtimeData, devices, latestData, onlineDeviceCount, unreadAlarmCount, isLoading } =
  storeToRefs(monitorStore)
const { fetchRealtimeData, sendMockData } = monitorStore

// 本地状态
const currentTime = ref('')
const timeRange = ref('24')
const tempChart = ref(null)
const overviewChart = ref(null)
let tempChartInstance = null
let overviewChartInstance = null

// 从后端获取的动态阈值
const thresholds = ref({
  temperature: { min: 10, max: 30 },
  humidity: { min: 40, max: 80 },
  gas: { max: 50 },
  co2: { max: 1000 },
})

// 计算属性
const hasRealData = computed(() => {
  const list = Array.isArray(realtimeData?.value) ? realtimeData.value : []
  return list.length > 0 && (list[0]?.temperature ?? 0) > 0
})

// 生命周期
onMounted(async () => {
  await initialize()
  setupCharts()
  startAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
  if (tempChartInstance) {
    tempChartInstance.dispose()
  }
  if (overviewChartInstance) {
    overviewChartInstance.dispose()
  }
})

// 初始化
async function initialize() {
  await fetchThresholds()
  await fetchRealtimeData()
  await nextTick() // 等待DOM更新
}

// 获取阈值
async function fetchThresholds() {
  try {
    const res = await api.alarm.getThresholds()
    if (res.success && res.data) {
      thresholds.value = res.data
    }
  } catch (error) {
    console.error('获取阈值配置失败', error)
  }
}

// 设置图表
function setupCharts() {
  if (tempChart.value) {
    tempChartInstance = echarts.init(tempChart.value)
    updateTempChart()
  }

  if (overviewChart.value) {
    overviewChartInstance = echarts.init(overviewChart.value)
    updateOverviewChart()
  }
}

// 更新温度图表
function updateTempChart() {
  if (!tempChartInstance) return

  const hours = parseInt(timeRange.value)
  const src = Array.isArray(realtimeData?.value) ? realtimeData.value : []
  const data = src.slice(0, Math.min(src.length, hours)).reverse()

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 20, 40, 0.8)',
      borderColor: '#00d8ff',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        let tip = `${params[0].axisValue}<br/>`
        params.forEach((p) => {
          let unit = p.seriesName === '温度' ? '°C' : p.seriesName === '湿度' ? '%' : 'ppm'
          tip += `${p.marker} ${p.seriesName}: ${p.value}${unit}<br/>`
        })
        return tip
      },
    },
    legend: {
      data: ['温度', '湿度', '有害气体', 'CO2'],
      textStyle: { color: '#a0b3d6' },
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => formatTime(d.created_at, 'HH:mm')),
      boundaryGap: false,
      axisLabel: { color: '#a0b3d6' },
      axisLine: { lineStyle: { color: '#1b2a47' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '温/湿',
        min: 0,
        max: 100,
        position: 'left',
        nameTextStyle: { color: '#a0b3d6' },
        axisLabel: { color: '#a0b3d6' },
        splitLine: { lineStyle: { color: '#1b2a47', type: 'dashed' } },
      },
      {
        type: 'value',
        name: '气体/CO2',
        min: 0,
        max: 2000,
        position: 'right',
        nameTextStyle: { color: '#a0b3d6' },
        axisLabel: { color: '#a0b3d6' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        yAxisIndex: 0,
        data: data.map((d) => d.temperature),
        smooth: true,
        lineStyle: { color: '#ffb020', width: 3 },
        itemStyle: { color: '#ffb020' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 176, 32, 0.3)' },
            { offset: 1, color: 'rgba(255, 176, 32, 0.05)' },
          ]),
        },
      },
      {
        name: '湿度',
        type: 'line',
        yAxisIndex: 0,
        data: data.map((d) => d.humidity),
        smooth: true,
        lineStyle: { color: '#00d8ff', width: 3 },
        itemStyle: { color: '#00d8ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 216, 255, 0.3)' },
            { offset: 1, color: 'rgba(0, 216, 255, 0.05)' },
          ]),
        },
      },
      {
        name: '有害气体',
        type: 'line',
        yAxisIndex: 1,
        data: data.map((d) => d.gas_concentration),
        smooth: true,
        lineStyle: { color: '#ff4d4f', width: 3 },
        itemStyle: { color: '#ff4d4f' },
      },
      {
        name: 'CO2',
        type: 'line',
        yAxisIndex: 1,
        data: data.map((d) => d.co2),
        smooth: true,
        lineStyle: { color: '#8a2be2', width: 3 },
        itemStyle: { color: '#8a2be2' },
      },
    ],
  }

  tempChartInstance.setOption(option)
}

// 更新概览图表
function updateOverviewChart() {
  if (!overviewChartInstance || !realtimeData.value) return

  const list = Array.isArray(realtimeData.value) ? realtimeData.value : []
  if (list.length === 0) return

  let normal = 0
  let warning = 0
  let danger = 0

  list.forEach((row) => {
    const type = getStatusType(row)
    if (type === 'danger') danger++
    else if (type === 'warning') warning++
    else normal++
  })

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 20, 40, 0.8)',
      borderColor: '#00d8ff',
      textStyle: { color: '#fff' },
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: ['正常', '警告', '危险'],
      textStyle: { color: '#a0b3d6' },
    },
    series: [
      {
        name: '环境状态(近实时数据)',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#0b132b',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '20',
            fontWeight: 'bold',
            color: '#fff',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 216, 255, 0.5)',
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          { value: normal, name: '正常' },
          { value: warning, name: '警告' },
          { value: danger, name: '危险' },
        ],
        color: ['#00d8ff', '#ffb020', '#ff4d4f'],
      },
    ],
  }

  overviewChartInstance.setOption(option)
}

// 工具函数
function getTempClass(temp) {
  if (temp >= thresholds.value.temperature.max) return 'danger'
  if (temp <= thresholds.value.temperature.min) return 'warning'
  return 'normal'
}

function getHumidityClass(humidity) {
  if (humidity >= thresholds.value.humidity.max) return 'danger'
  if (humidity <= thresholds.value.humidity.min) return 'warning'
  return 'normal'
}

function getGasClass(gas) {
  if (gas >= thresholds.value.gas.max) return 'danger'
  if (gas >= thresholds.value.gas.max * 0.8) return 'warning'
  return 'normal'
}

function getCo2Class(co2) {
  if (co2 >= thresholds.value.co2.max) return 'danger'
  if (co2 >= thresholds.value.co2.max * 0.8) return 'warning'
  return 'normal'
}

function getStatusType(row) {
  const { temperature, humidity, gas_concentration, co2 } = row
  if (
    temperature >= thresholds.value.temperature.max ||
    humidity >= thresholds.value.humidity.max ||
    gas_concentration >= thresholds.value.gas.max ||
    co2 >= thresholds.value.co2.max
  ) {
    return 'danger'
  } else if (
    temperature <= thresholds.value.temperature.min ||
    humidity <= thresholds.value.humidity.min ||
    gas_concentration >= thresholds.value.gas.max * 0.8 ||
    co2 >= thresholds.value.co2.max * 0.8
  ) {
    return 'warning'
  }
  return 'success'
}

function getStatusText(row) {
  const type = getStatusType(row)
  return type === 'danger' ? '危险' : type === 'warning' ? '警告' : '正常'
}

function formatTime(timeStr, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!timeStr) return '--'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN')
}

// 自动刷新
let refreshTimer = null
let timeTimer = null
function startAutoRefresh() {
  refreshTimer = setInterval(async () => {
    await fetchRealtimeData()
    updateTempChart()
  }, 10000) // 每10秒刷新一次

  timeTimer = setInterval(() => {
    currentTime.value = formatTime(new Date())
  }, 1000)
  currentTime.value = formatTime(new Date())
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (timeTimer) {
    clearInterval(timeTimer)
    timeTimer = null
  }
}

// 监听时间范围变化
watch(timeRange, () => {
  updateTempChart()
})

// 监听数据变化
watch(
  () => realtimeData.value,
  () => {
    updateTempChart()
    updateOverviewChart()
  },
  { deep: true },
)
</script>

<style scoped>
.dashboard-big-screen {
  min-height: 100vh;
  background: #0b132b;
  background-image:
    linear-gradient(rgba(0, 216, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 216, 255, 0.05) 1px, transparent 1px);
  background-size: 30px 30px;
  color: #fff;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.screen-header {
  height: 80px;
  background: url('https://img.alicdn.com/tfs/TB1Jp1lX8Cw3KVjSZFuXXcAOpXa-1920-80.png') no-relative
    center center / 100% 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 10;
}

.screen-title {
  font-size: 32px;
  font-weight: bold;
  letter-spacing: 4px;
  color: #00d8ff;
  text-shadow: 0 0 10px rgba(0, 216, 255, 0.5);
  margin: 0;
}

.screen-time {
  position: absolute;
  right: 30px;
  top: 30px;
  font-size: 20px;
  font-family: 'Digital', monospace;
  color: #00d8ff;
  text-shadow: 0 0 5px rgba(0, 216, 255, 0.5);
}

.screen-content {
  flex: 1;
  display: flex;
  padding: 15px;
  gap: 15px;
  height: calc(100vh - 80px);
}

.screen-left,
.screen-right {
  width: 25%;
  display: flex;
  flex-direction: column;
}

.screen-center {
  width: 50%;
  display: flex;
  flex-direction: column;
}

.panel-box {
  background: rgba(13, 20, 40, 0.8);
  border: 1px solid rgba(0, 216, 255, 0.3);
  box-shadow: 0 0 15px rgba(0, 216, 255, 0.1) inset;
  border-radius: 8px;
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* 四个角的科幻边框装饰 */
.panel-box::before,
.panel-box::after {
  content: '';
  position: absolute;
  width: 15px;
  height: 15px;
  border: 2px solid #00d8ff;
  transition: all 0.3s;
}
.panel-box::before {
  top: -1px;
  left: -1px;
  border-right: none;
  border-bottom: none;
  border-top-left-radius: 8px;
}
.panel-box::after {
  bottom: -1px;
  right: -1px;
  border-left: none;
  border-top: none;
  border-bottom-right-radius: 8px;
}

.panel-title {
  height: 45px;
  line-height: 45px;
  padding: 0 20px;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  border-bottom: 1px solid rgba(0, 216, 255, 0.2);
  background: linear-gradient(90deg, rgba(0, 216, 255, 0.2) 0%, transparent 100%);
  border-top-left-radius: 8px;
}

.panel-content {
  flex: 1;
  padding: 15px;
  overflow: hidden;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 15px;
}

.stat-item {
  background: rgba(0, 216, 255, 0.05);
  border: 1px solid rgba(0, 216, 255, 0.1);
  border-radius: 6px;
  padding: 15px;
  display: flex;
  align-items: center;
  transition: all 0.3s;
}

.stat-item:hover {
  background: rgba(0, 216, 255, 0.1);
  border-color: rgba(0, 216, 255, 0.5);
  box-shadow: 0 0 10px rgba(0, 216, 255, 0.2);
  transform: translateY(-2px);
}

.device-item {
  grid-column: 1 / 3;
  justify-content: center;
}

.stat-icon {
  font-size: 40px;
  margin-right: 15px;
}

.stat-icon.temperature {
  color: #ffb020;
}
.stat-icon.humidity {
  color: #00d8ff;
}
.stat-icon.gas {
  color: #ff4d4f;
}
.stat-icon.co2 {
  color: #8a2be2;
}
.stat-icon.device {
  color: #52c41a;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 26px;
  font-weight: bold;
  font-family: 'Digital', monospace;
  color: #fff;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
}

.unit {
  font-size: 14px;
  color: #a0b3d6;
  margin-left: 5px;
}

.stat-label {
  font-size: 14px;
  color: #a0b3d6;
  margin-top: 5px;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 250px;
}

.chart-container-large {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mt-20 {
  margin-top: 20px;
}

/* 深色表单组件 */
.dark-select :deep(.el-input__wrapper) {
  background-color: rgba(13, 20, 40, 0.8);
  box-shadow: 0 0 0 1px rgba(0, 216, 255, 0.3) inset;
}
.dark-select :deep(.el-input__inner) {
  color: #00d8ff;
}

.dark-btn {
  background-color: rgba(0, 216, 255, 0.1);
  border: 1px solid rgba(0, 216, 255, 0.5);
  color: #00d8ff;
}
.dark-btn:hover {
  background-color: rgba(0, 216, 255, 0.3);
  color: #fff;
}

/* 深色透明表格 */
.table-container {
  padding: 0;
  overflow-y: auto;
}

.dark-table {
  background-color: transparent !important;
  --el-table-border-color: rgba(0, 216, 255, 0.1);
  --el-table-header-bg-color: rgba(0, 216, 255, 0.1);
  --el-table-header-text-color: #00d8ff;
  --el-table-text-color: #a0b3d6;
  --el-table-row-hover-bg-color: rgba(0, 216, 255, 0.1);
}

:deep(.el-table tr),
:deep(.el-table th.el-table__cell) {
  background-color: transparent !important;
}
:deep(.el-table__body tr:nth-child(2n)) {
  background-color: rgba(255, 255, 255, 0.02) !important;
}

:deep(.el-table) .danger {
  color: #ff4d4f;
  font-weight: bold;
  text-shadow: 0 0 5px rgba(255, 77, 79, 0.5);
}
:deep(.el-table) .warning {
  color: #ffb020;
  font-weight: bold;
  text-shadow: 0 0 5px rgba(255, 176, 32, 0.5);
}
:deep(.el-table) .normal {
  color: #00d8ff;
}

/* 跑马灯报警 */
.alarm-marquee {
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.3);
  border-radius: 8px;
  padding: 15px 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 0 10px rgba(255, 77, 79, 0.2) inset;
}

.alarm-icon {
  font-size: 24px;
  color: #ff4d4f;
  margin-right: 15px;
  animation: flash 1s infinite alternate;
}

.alarm-text {
  flex: 1;
  color: #ff4d4f;
  font-size: 16px;
  font-weight: bold;
}

@keyframes flash {
  0% {
    opacity: 1;
    text-shadow: 0 0 10px #ff4d4f;
  }
  100% {
    opacity: 0.3;
    text-shadow: none;
  }
}

/* 响应式回退 */
@media (max-width: 1200px) {
  .screen-content {
    flex-direction: column;
    height: auto;
    overflow-y: auto;
  }
  .screen-left,
  .screen-right,
  .screen-center {
    width: 100%;
    min-height: 500px;
  }
}
</style>
