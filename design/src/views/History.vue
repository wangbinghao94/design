<template>
  <div class="history-page">
    <el-card class="filter-card">
      <template #header>
        <div class="card-header">
          <span>历史数据查询</span>
          <div class="actions">
            <el-button type="primary" @click="fetchData" :loading="loading">
              <el-icon><Search /></el-icon>查询
            </el-button>
            <el-button type="success" @click="exportCSV" :disabled="!tableData.length">
              <el-icon><Download /></el-icon>导出CSV
            </el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="form" class="filter-form">
        <el-form-item label="设备选择">
          <el-select v-model="form.device_id" placeholder="请选择设备">
            <el-option
              v-for="device in devices"
              :key="device.device_id"
              :label="device.name || device.device_id"
              :value="device.device_id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            :shortcuts="shortcuts"
          />
        </el-form-item>

        <el-form-item label="数据条数">
          <el-input-number v-model="form.limit" :min="10" :max="1000" :step="50" />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 历史曲线图 -->
    <el-card class="chart-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>历史数据趋势图</span>
          <el-radio-group v-model="chartType" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="temperature">温度</el-radio-button>
            <el-radio-button label="humidity">湿度</el-radio-button>
            <el-radio-button label="gas">气体</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div ref="historyChartRef" class="chart-container"></div>
    </el-card>

    <!-- 历史数据表格 -->
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>历史数据记录</span>
          <span class="total-count">共 {{ total }} 条记录</span>
        </div>
      </template>

      <el-table
        :data="paginatedData"
        style="width: 100%"
        border
        stripe
        v-loading="loading"
        height="400"
      >
        <el-table-column prop="created_at" label="采集时间" width="200" sortable>
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="device_id" label="设备ID" width="150" />
        <el-table-column prop="temperature" label="温度(°C)" sortable>
          <template #default="{ row }">
            <span :class="getTempClass(row.temperature)">{{ row.temperature }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="humidity" label="湿度(%)" sortable>
          <template #default="{ row }">
            <span :class="getHumidityClass(row.humidity)">{{ row.humidity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="gas_concentration" label="气体浓度(ppm)" sortable>
          <template #default="{ row }">
            <span :class="getGasClass(row.gas_concentration)">{{ row.gas_concentration }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="tableData.length"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { Search, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import api from '@/api';

// 状态变量
const loading = ref(false);
const devices = ref([{ device_id: 'ESP32_001', name: '1号牛舍' }]);
const tableData = ref([]);
const total = ref(0);

// 分页
const currentPage = ref(1);
const pageSize = ref(20);

// 图表
const historyChartRef = ref(null);
let chartInstance = null;
const chartType = ref('all');

// 表单数据
const form = reactive({
  device_id: 'ESP32_001',
  timeRange: [],
  limit: 200
});

// 日期快捷选项
const shortcuts = [
  {
    text: '最近1小时',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000);
      return [start, end];
    },
  },
  {
    text: '最近24小时',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24);
      return [start, end];
    },
  },
  {
    text: '最近7天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
      return [start, end];
    },
  },
];

// 计算分页后的数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return tableData.value.slice(start, end);
});

// 初始化
onMounted(async () => {
  // 设置默认时间为最近24小时
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24);
  
  // 格式化为本地时间字符串 YYYY-MM-DD HH:mm:ss
  const formatObj = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 19).replace('T', ' ');
  };
  
  form.timeRange = [formatObj(start), formatObj(end)];

  await loadDevices();
  await fetchData();
  
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (chartInstance) {
    chartInstance.dispose();
  }
});

function handleResize() {
  if (chartInstance) {
    chartInstance.resize();
  }
}

// 加载设备列表
async function loadDevices() {
  try {
    const res = await api.device.getDevices();
    if (res.success && res.devices.length > 0) {
      devices.value = res.devices;
      if (!devices.value.find(d => d.device_id === form.device_id)) {
        form.device_id = devices.value[0].device_id;
      }
    }
  } catch (error) {
    console.error('获取设备列表失败', error);
  }
}

// 获取历史数据
async function fetchData() {
  loading.value = true;
  try {
    const params = {
      device_id: form.device_id,
      limit: form.limit
    };
    
    if (form.timeRange && form.timeRange.length === 2) {
      params.start_time = form.timeRange[0];
      params.end_time = form.timeRange[1];
    }

    const res = await api.sensor.getHistory(params);
    if (res.success) {
      // API返回的数据通常是按时间倒序的，为了画图，我们需要正序
      tableData.value = res.data;
      total.value = res.count;
      currentPage.value = 1;
      
      initChart();
    } else {
      ElMessage.error(res.error || '获取历史数据失败');
    }
  } catch (error) {
    console.error('获取历史数据异常', error);
    ElMessage.error('网络请求异常');
  } finally {
    loading.value = false;
  }
}

// 初始化/更新图表
function initChart() {
  if (!historyChartRef.value) return;
  
  if (!chartInstance) {
    chartInstance = echarts.init(historyChartRef.value);
  }

  // 图表数据需要按时间正序
  const chartData = [...tableData.value].reverse();
  const times = chartData.map(item => formatTime(item.created_at, 'MM-DD HH:mm'));
  
  const series = [];
  const yAxis = [];
  const legend = [];
  const colors = ['#e6a23c', '#409eff', '#f56c6c'];

  if (chartType.value === 'all' || chartType.value === 'temperature') {
    legend.push('温度');
    series.push({
      name: '温度',
      type: 'line',
      data: chartData.map(item => item.temperature),
      smooth: true,
      yAxisIndex: yAxis.length,
      itemStyle: { color: colors[0] }
    });
    yAxis.push({
      type: 'value',
      name: '温度(°C)',
      position: 'left',
      axisLine: { show: true, lineStyle: { color: colors[0] } }
    });
  }

  if (chartType.value === 'all' || chartType.value === 'humidity') {
    legend.push('湿度');
    series.push({
      name: '湿度',
      type: 'line',
      data: chartData.map(item => item.humidity),
      smooth: true,
      yAxisIndex: yAxis.length,
      itemStyle: { color: colors[1] }
    });
    yAxis.push({
      type: 'value',
      name: '湿度(%)',
      position: chartType.value === 'all' ? 'right' : 'left',
      offset: 0,
      axisLine: { show: true, lineStyle: { color: colors[1] } }
    });
  }

  if (chartType.value === 'all' || chartType.value === 'gas') {
    legend.push('气体浓度');
    series.push({
      name: '气体浓度',
      type: 'line',
      data: chartData.map(item => item.gas_concentration),
      smooth: true,
      yAxisIndex: yAxis.length,
      itemStyle: { color: colors[2] }
    });
    yAxis.push({
      type: 'value',
      name: '气体(ppm)',
      position: 'right',
      offset: chartType.value === 'all' ? 50 : 0,
      axisLine: { show: true, lineStyle: { color: colors[2] } }
    });
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: legend
    },
    grid: {
      left: '3%',
      right: chartType.value === 'all' ? '10%' : '4%',
      bottom: '10%',
      containLabel: true
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        type: 'slider',
        start: 0,
        end: 100
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times
    },
    yAxis: yAxis,
    series: series
  };

  chartInstance.setOption(option, true);
}

// 监听图表类型切换
watch(chartType, () => {
  initChart();
});

// 导出CSV
function exportCSV() {
  if (tableData.value.length === 0) {
    ElMessage.warning('没有可导出的数据');
    return;
  }

  const headers = ['设备ID', '温度(°C)', '湿度(%)', '气体浓度(ppm)', '采集时间'];
  const rows = tableData.value.map(item => [
    item.device_id,
    item.temperature,
    item.humidity,
    item.gas_concentration,
    formatTime(item.created_at)
  ]);

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // 加上 BOM 以支持中文
  csvContent += headers.join(',') + '\n';
  rows.forEach(row => {
    csvContent += row.join(',') + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const filename = `牛舍环境历史数据_${form.device_id}_${new Date().getTime()}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  ElMessage.success('数据导出成功');
}

// 工具函数
function formatTime(timeStr, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!timeStr) return '--';
  const date = new Date(timeStr);
  if (format === 'MM-DD HH:mm') {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${m}-${d} ${h}:${min}`;
  }
  return date.toLocaleString('zh-CN');
}

function getTempClass(temp) {
  if (temp >= 28) return 'text-danger';
  if (temp <= 12) return 'text-warning';
  return 'text-success';
}

function getHumidityClass(humidity) {
  if (humidity >= 75) return 'text-danger';
  if (humidity <= 45) return 'text-warning';
  return 'text-success';
}

function getGasClass(gas) {
  if (gas >= 40) return 'text-danger';
  if (gas >= 30) return 'text-warning';
  return 'text-success';
}
</script>

<style scoped>
.history-page {
  padding: 20px;
}

.filter-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chart-card {
  margin-bottom: 20px;
}

.chart-container {
  height: 400px;
  width: 100%;
}

.table-card {
  margin-bottom: 20px;
}

.total-count {
  font-size: 14px;
  color: #606266;
  font-weight: normal;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 文字颜色状态 */
.text-danger { color: #f56c6c; font-weight: bold; }
.text-warning { color: #e6a23c; font-weight: bold; }
.text-success { color: #67c23a; }
</style>
