<template>
  <div class="alarm-page">
    <el-tabs type="border-card">
      <!-- 报警记录 -->
      <el-tab-pane label="报警日志">
        <el-card class="filter-card">
          <div class="filter-header">
            <el-radio-group v-model="statusFilter" @change="fetchAlarms">
              <el-radio-button label="all">全部报警</el-radio-button>
              <el-radio-button :label="0">未处理</el-radio-button>
              <el-radio-button :label="1">已处理</el-radio-button>
            </el-radio-group>
            <el-button type="primary" @click="fetchAlarms" :loading="loading">
              <el-icon><Refresh /></el-icon>刷新
            </el-button>
          </div>
        </el-card>

        <el-card>
          <el-table
            :data="alarms"
            style="width: 100%"
            border
            v-loading="loading"
            :row-class-name="tableRowClassName"
          >
            <el-table-column prop="created_at" label="报警时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="device_id" label="设备ID" width="120" />
            <el-table-column label="报警类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getAlarmTypeTag(row.alarm_type)">
                  {{ getAlarmTypeName(row.alarm_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="报警详情" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 0 ? 'danger' : 'success'" effect="dark">
                  {{ row.status === 0 ? '未处理' : '已处理' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" plain @click="analyzeAlarm(row)">
                  <el-icon><Monitor /></el-icon> AI诊断
                </el-button>
                <el-button
                  v-if="row.status === 0"
                  type="success"
                  size="small"
                  @click="handleAlarm(row.id)"
                >
                  确认处理
                </el-button>
                <span v-else class="processed-time">
                  {{ formatTime(row.processed_at, 'MM-DD HH:mm') }} 处理
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 阈值设置 -->
      <el-tab-pane label="安全阈值设置">
        <el-card class="threshold-card" v-loading="thresholdLoading">
          <template #header>
            <div class="card-header">
              <span>环境参数报警阈值设置</span>
              <el-button type="primary" @click="saveThresholds">保存设置</el-button>
            </div>
          </template>

          <el-form :model="thresholds" label-width="120px" class="threshold-form">
            <el-divider content-position="left">温度设置 (°C)</el-divider>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="低温报警下限">
                  <el-input-number
                    v-model="thresholds.temperature.min"
                    :min="-20"
                    :max="thresholds.temperature.max - 1"
                    :step="1"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="高温报警上限">
                  <el-input-number
                    v-model="thresholds.temperature.max"
                    :min="thresholds.temperature.min + 1"
                    :max="60"
                    :step="1"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-divider content-position="left">湿度设置 (%)</el-divider>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="低湿报警下限">
                  <el-input-number
                    v-model="thresholds.humidity.min"
                    :min="0"
                    :max="thresholds.humidity.max - 1"
                    :step="5"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="高湿报警上限">
                  <el-input-number
                    v-model="thresholds.humidity.max"
                    :min="thresholds.humidity.min + 1"
                    :max="100"
                    :step="5"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-divider content-position="left">有害气体设置 (ppm)</el-divider>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="其他气体上限">
                  <el-input-number v-model="thresholds.gas.max" :min="10" :max="500" :step="5" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="CO2浓度上限">
                  <el-input-number
                    v-model="thresholds.co2.max"
                    :min="400"
                    :max="5000"
                    :step="100"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- AI 诊断对话框 -->
    <el-dialog
      v-model="analysisDialogVisible"
      title="AI 智能报警诊断"
      width="60%"
      :close-on-click-modal="false"
      class="analysis-dialog"
    >
      <div class="alarm-summary" v-if="currentAlarmData">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="报警时间">{{
            formatTime(currentAlarmData.created_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="设备ID">{{
            currentAlarmData.device_id
          }}</el-descriptions-item>
          <el-descriptions-item label="报警类型">
            <el-tag :type="getAlarmTypeTag(currentAlarmData.alarm_type)" size="small">
              {{ getAlarmTypeName(currentAlarmData.alarm_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="报警数值">
            <span class="text-danger">{{ currentAlarmData.alarm_value }}</span>
            (阈值: {{ currentAlarmData.threshold }})
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <el-divider content-position="left">AI 分析与建议</el-divider>

      <div v-loading="analysisLoading" class="analysis-content" v-html="formattedAnalysis"></div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="analysisDialogVisible = false">关闭</el-button>
          <el-button
            v-if="currentAlarmData && currentAlarmData.status === 0"
            type="success"
            @click="handleAlarmAndClose(currentAlarmData.id)"
          >
            采纳建议并标记处理
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { Refresh, Monitor } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

// 状态变量
const loading = ref(false)
const thresholdLoading = ref(false)
const alarms = ref([])
const statusFilter = ref('all') // all, 0, 1

// AI 分析相关
const analysisDialogVisible = ref(false)
const analysisLoading = ref(false)
const rawAnalysis = ref('')
const currentAlarmData = ref(null)

const formattedAnalysis = computed(() => {
  if (!rawAnalysis.value) return '暂无分析数据'
  let html = rawAnalysis.value
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n\d+\. /g, (match) => `<br/><strong>${match.trim()}</strong> `)
    .replace(/\n/g, '<br/>')
  return `<p>${html}</p>`
})

// 阈值数据
const thresholds = reactive({
  temperature: { min: 10, max: 30 },
  humidity: { min: 40, max: 80 },
  gas: { max: 50 },
  co2: { max: 1000 },
})

onMounted(() => {
  fetchAlarms()
  fetchThresholds()
})

// 获取报警记录
async function fetchAlarms() {
  loading.value = true
  try {
    const status = statusFilter.value === 'all' ? null : statusFilter.value
    const res = await api.alarm.getAlarms(status, 100) // 获取最近100条
    if (res.success) {
      alarms.value = res.alarms
    } else {
      ElMessage.error('获取报警记录失败')
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('网络请求异常')
  } finally {
    loading.value = false
  }
}

// 处理报警
async function handleAlarm(id) {
  try {
    await ElMessageBox.confirm('确认已处理该报警事件？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    loading.value = true
    const res = await api.alarm.updateAlarm(id, 1)
    if (res.success) {
      ElMessage.success('报警状态已更新')
      fetchAlarms() // 刷新列表

      // 更新全局 store 中的未读报警数
      // const monitorStore = useMonitorStore();
      // monitorStore.fetchRealtimeData();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
      ElMessage.error('处理失败')
    }
  } finally {
    loading.value = false
  }
}

// 采纳建议并关闭弹窗
async function handleAlarmAndClose(id) {
  loading.value = true
  try {
    const res = await api.alarm.updateAlarm(id, 1)
    if (res.success) {
      ElMessage.success('报警状态已更新')
      analysisDialogVisible.value = false
      fetchAlarms()
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('处理失败')
  } finally {
    loading.value = false
  }
}

// 获取AI分析
async function analyzeAlarm(row) {
  currentAlarmData.value = row
  analysisDialogVisible.value = true
  analysisLoading.value = true

  if (row.ai_analysis) {
    // 如果之前分析过，直接使用缓存的结果（前提是数据库加了该字段并且后端保存了）
    rawAnalysis.value = row.ai_analysis
    analysisLoading.value = false
    return
  }

  rawAnalysis.value = 'AI 正在接入腾讯混元大模型进行环境诊断，请稍候...'

  try {
    const res = await api.analysis.getAbnormalityAnalysis(row.id)
    if (res.success) {
      rawAnalysis.value = res.data
      row.ai_analysis = res.data // 本地缓存
    } else {
      rawAnalysis.value = 'AI 分析失败：' + (res.error || '未知错误')
    }
  } catch (error) {
    console.error('获取AI分析失败', error)
    rawAnalysis.value = '网络请求异常，无法完成智能诊断。'
  } finally {
    analysisLoading.value = false
  }
}

// 获取阈值
async function fetchThresholds() {
  thresholdLoading.value = true
  try {
    const res = await api.alarm.getThresholds()
    if (res.success && res.data) {
      Object.assign(thresholds, res.data)
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('获取阈值配置失败')
  } finally {
    thresholdLoading.value = false
  }
}

// 保存阈值
async function saveThresholds() {
  thresholdLoading.value = true
  try {
    const res = await api.alarm.setThresholds(thresholds)
    if (res.success) {
      ElMessage.success('报警阈值设置已保存')
    } else {
      ElMessage.error('保存失败')
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('保存请求异常')
  } finally {
    thresholdLoading.value = false
  }
}

// 工具函数
function formatTime(timeStr, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!timeStr) return '--'
  const date = new Date(timeStr)
  if (format === 'MM-DD HH:mm') {
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${m}-${d} ${h}:${min}`
  }
  return date.toLocaleString('zh-CN')
}

function getAlarmTypeName(type) {
  const map = {
    temperature_high: '温度过高',
    temperature_low: '温度过低',
    humidity_high: '湿度过高',
    humidity_low: '湿度过低',
    gas_high: '气体超标',
    co2_high: 'CO2超标',
  }
  return map[type] || '未知报警'
}

function getAlarmTypeTag(type) {
  if (type.includes('high') || type.includes('gas') || type.includes('co2')) return 'danger'
  return 'warning'
}

function tableRowClassName({ row }) {
  if (row.status === 0) {
    return 'warning-row'
  }
  return ''
}
</script>

<style scoped>
.alarm-page {
  padding: 20px;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.threshold-card {
  max-width: 800px;
  margin: 0 auto;
}

.threshold-form {
  padding: 20px 0;
}

.processed-time {
  font-size: 12px;
  color: #909399;
}

:deep(.el-table .warning-row) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}

.analysis-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
}

.alarm-summary {
  margin-bottom: 20px;
}

.analysis-content {
  min-height: 150px;
  max-height: 50vh;
  overflow-y: auto;
  line-height: 1.8;
  font-size: 15px;
  color: #333;
  padding: 15px 20px;
  background: #f9fafc;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.analysis-content :deep(strong) {
  color: #409eff;
}

.analysis-content :deep(p) {
  margin-bottom: 10px;
}
</style>
