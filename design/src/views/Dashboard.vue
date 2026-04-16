<template>
  <div class="dashboard">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon temperature"><Sunny /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ latestData?.temperature || '--' }}°C</div>
              <div class="stat-label">当前温度</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon humidity"><Watermelon /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ latestData?.humidity || '--' }}%</div>
              <div class="stat-label">当前湿度</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon gas"><Warning /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ latestData?.gas_concentration || '--' }}ppm</div>
              <div class="stat-label">气体浓度</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon device"><Cpu /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ onlineDeviceCount }}/{{ devices?.length || 0 }}</div>
              <div class="stat-label">在线设备</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-row">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>环境数据趋势 (温/湿/气)</span>
              <el-select v-model="timeRange" size="small" style="width: 120px">
                <el-option label="最近1小时" value="1"></el-option>
                <el-option label="最近24小时" value="24"></el-option>
                <el-option label="最近7天" value="168"></el-option>
              </el-select>
            </div>
          </template>
          <div ref="tempChart" style="height: 300px;"></div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>环境数据概览</span>
            </div>
          </template>
          <div ref="overviewChart" style="height: 300px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时数据表格 -->
    <el-card class="data-table-card">
      <template #header>
        <div class="table-header">
          <span>实时数据流</span>
          <div>
            <el-button type="primary" size="small" @click="fetchRealtimeData">
              <el-icon><Refresh /></el-icon>刷新
            </el-button>
            <el-button size="small" @click="sendMockData" v-if="!hasRealData">
              生成测试数据
            </el-button>
          </div>
        </div>
      </template>
      
      <el-table :data="realtimeData" style="width: 100%" v-loading="isLoading">
        <el-table-column prop="device_id" label="设备ID" width="120"></el-table-column>
        <el-table-column prop="temperature" label="温度(°C)" width="100">
          <template #default="{ row }">
            <span :class="getTempClass(row.temperature)">{{ row.temperature }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="humidity" label="湿度(%)" width="100">
          <template #default="{ row }">
            <span :class="getHumidityClass(row.humidity)">{{ row.humidity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="gas_concentration" label="气体(ppm)" width="100">
          <template #default="{ row }">
            <span :class="getGasClass(row.gas_concentration)">{{ row.gas_concentration }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 报警通知 -->
    <el-card v-if="unreadAlarmCount > 0" class="alarm-notice">
      <el-alert
        title="有未处理的报警"
        type="warning"
        :description="`当前有 ${unreadAlarmCount} 条未处理报警`"
        show-icon
        :closable="false"
      >
        <template #action>
          <el-button type="warning" size="small" @click="$router.push('/alarm')">
            查看详情
          </el-button>
        </template>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { Sunny, Watermelon, Warning, Cpu, Refresh } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { useMonitorStore } from '@/stores/monitor';
import { ElMessage } from 'element-plus';
import api from '@/api';

const router = useRouter();
const monitorStore = useMonitorStore();
const {
  realtimeData,
  devices,
  latestData,
  onlineDeviceCount,
  unreadAlarmCount,
  isLoading
} = storeToRefs(monitorStore);
const { fetchRealtimeData, sendMockData } = monitorStore;

// 本地状态
const timeRange = ref('24');
const tempChart = ref(null);
const overviewChart = ref(null);
let tempChartInstance = null;
let overviewChartInstance = null;

// 从后端获取的动态阈值
const thresholds = ref({
  temperature: { min: 10, max: 30 },
  humidity: { min: 40, max: 80 },
  gas: { max: 50 }
});

// 计算属性
const hasRealData = computed(() => {
  const list = Array.isArray(realtimeData?.value) ? realtimeData.value : [];
  return list.length > 0 && (list[0]?.temperature ?? 0) > 0;
});

// 生命周期
onMounted(async () => {
  await initialize();
  setupCharts();
  startAutoRefresh();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
  if (tempChartInstance) {
    tempChartInstance.dispose();
  }
  if (overviewChartInstance) {
    overviewChartInstance.dispose();
  }
});

// 初始化
async function initialize() {
  await fetchThresholds();
  await fetchRealtimeData();
  await nextTick(); // 等待DOM更新
}

// 获取阈值
async function fetchThresholds() {
  try {
    const res = await api.alarm.getThresholds();
    if (res.success && res.data) {
      thresholds.value = res.data;
    }
  } catch (error) {
    console.error('获取阈值配置失败', error);
  }
}

// 设置图表
function setupCharts() {
  if (tempChart.value) {
    tempChartInstance = echarts.init(tempChart.value);
    updateTempChart();
  }
  
  if (overviewChart.value) {
    overviewChartInstance = echarts.init(overviewChart.value);
    updateOverviewChart();
  }
}

// 更新温度图表
function updateTempChart() {
  if (!tempChartInstance) return;
  
  const hours = parseInt(timeRange.value);
  const src = Array.isArray(realtimeData?.value) ? realtimeData.value : [];
  const data = src
    .slice(0, Math.min(src.length, hours))
    .reverse();
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let tip = `${params[0].axisValue}<br/>`;
        params.forEach(p => {
          let unit = p.seriesName === '温度' ? '°C' : p.seriesName === '湿度' ? '%' : 'ppm';
          tip += `${p.marker} ${p.seriesName}: ${p.value}${unit}<br/>`;
        });
        return tip;
      }
    },
    legend: {
      data: ['温度', '湿度', '气体']
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => formatTime(d.created_at, 'HH:mm')),
      boundaryGap: false
    },
    yAxis: [
      {
        type: 'value',
        name: '温度/湿度',
        min: 0,
        max: 100,
        position: 'left'
      },
      {
        type: 'value',
        name: '气体(ppm)',
        min: 0,
        max: 500,
        position: 'right'
      }
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        yAxisIndex: 0,
        data: data.map(d => d.temperature),
        smooth: true,
        lineStyle: {
          color: '#e6a23c'
        },
        itemStyle: {
          color: '#e6a23c'
        }
      },
      {
        name: '湿度',
        type: 'line',
        yAxisIndex: 0,
        data: data.map(d => d.humidity),
        smooth: true,
        lineStyle: {
          color: '#409eff'
        },
        itemStyle: {
          color: '#409eff'
        }
      },
      {
        name: '气体',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.gas_concentration),
        smooth: true,
        lineStyle: {
          color: '#f56c6c'
        },
        itemStyle: {
          color: '#f56c6c'
        }
      }
    ]
  };
  
  tempChartInstance.setOption(option);
}

// 更新概览图表
function updateOverviewChart() {
  if (!overviewChartInstance || !realtimeData.value) return;
  
  const list = Array.isArray(realtimeData.value) ? realtimeData.value : [];
  if (list.length === 0) return;

  let normal = 0;
  let warning = 0;
  let danger = 0;

  list.forEach(row => {
    const type = getStatusType(row);
    if (type === 'danger') danger++;
    else if (type === 'warning') warning++;
    else normal++;
  });

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: ['正常', '警告', '危险']
    },
    series: [
      {
        name: '环境状态(近实时数据)',
        type: 'pie',
        radius: '50%',
        center: ['50%', '60%'],
        data: [
          { value: normal, name: '正常' },
          { value: warning, name: '警告' },
          { value: danger, name: '危险' }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        itemStyle: {
          color: (params) => {
            const colors = {
              0: '#67c23a',
              1: '#e6a23c',
              2: '#f56c6c'
            };
            return colors[params.dataIndex];
          }
        }
      }
    ]
  };
  
  overviewChartInstance.setOption(option);
}

// 工具函数
function getTempClass(temp) {
  if (temp >= thresholds.value.temperature.max) return 'danger';
  if (temp <= thresholds.value.temperature.min) return 'warning';
  return 'normal';
}

function getHumidityClass(humidity) {
  if (humidity >= thresholds.value.humidity.max) return 'danger';
  if (humidity <= thresholds.value.humidity.min) return 'warning';
  return 'normal';
}

function getGasClass(gas) {
  if (gas >= thresholds.value.gas.max) return 'danger';
  if (gas >= thresholds.value.gas.max * 0.8) return 'warning';
  return 'normal';
}

function getStatusType(row) {
  const { temperature, humidity, gas_concentration } = row;
  if (
    temperature >= thresholds.value.temperature.max ||
    humidity >= thresholds.value.humidity.max ||
    gas_concentration >= thresholds.value.gas.max
  ) {
    return 'danger';
  } else if (
    temperature <= thresholds.value.temperature.min ||
    humidity <= thresholds.value.humidity.min ||
    gas_concentration >= thresholds.value.gas.max * 0.8
  ) {
    return 'warning';
  }
  return 'success';
}

function getStatusText(row) {
  const type = getStatusType(row);
  return type === 'danger' ? '危险' : type === 'warning' ? '警告' : '正常';
}

function formatTime(timeStr, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!timeStr) return '--';
  const date = new Date(timeStr);
  return date.toLocaleString('zh-CN');
}

// 自动刷新
let refreshTimer = null;
function startAutoRefresh() {
  refreshTimer = setInterval(async () => {
    await fetchRealtimeData();
    updateTempChart();
  }, 10000); // 每10秒刷新一次
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 监听时间范围变化
watch(timeRange, () => {
  updateTempChart();
});

// 监听数据变化
watch(() => realtimeData.value, () => {
  updateTempChart();
  updateOverviewChart();
}, { deep: true });
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  height: 120px;
}

.stat-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.stat-icon {
  font-size: 48px;
  margin-right: 20px;
  flex-shrink: 0;
}

.stat-icon.temperature {
  color: #e6a23c;
}

.stat-icon.humidity {
  color: #409eff;
}

.stat-icon.gas {
  color: #f56c6c;
}

.stat-icon.device {
  color: #67c23a;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}

.charts-row {
  margin-bottom: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-table-card {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alarm-notice {
  margin-bottom: 20px;
}

/* 数据表格样式 */
:deep(.el-table) .danger {
  color: #f56c6c;
  font-weight: bold;
}

:deep(.el-table) .warning {
  color: #e6a23c;
  font-weight: bold;
}

:deep(.el-table) .normal {
  color: #67c23a;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stat-icon {
    font-size: 36px;
    margin-right: 12px;
  }
  
  .stat-value {
    font-size: 22px;
  }
  
  .charts-row .el-col {
    margin-bottom: 20px;
  }
}
</style>
