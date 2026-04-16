<template>
  <div class="devices-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>设备管理</span>
          <el-button type="primary" @click="fetchDevices" :loading="loading">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
      </template>

      <!-- 统计信息 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-title">设备总数</div>
            <div class="stat-value">{{ devices.length }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item text-success">
            <div class="stat-title">在线设备</div>
            <div class="stat-value">{{ onlineCount }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item text-danger">
            <div class="stat-title">离线设备</div>
            <div class="stat-value">{{ devices.length - onlineCount }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 设备列表 -->
      <el-table
        :data="devices"
        style="width: 100%"
        border
        stripe
        v-loading="loading"
      >
        <el-table-column prop="device_id" label="设备ID" width="150" />
        <el-table-column prop="name" label="设备名称" width="150">
          <template #default="{ row }">
            {{ row.name || '--' }}
          </template>
        </el-table-column>
        <el-table-column prop="location" label="安装位置">
          <template #default="{ row }">
            {{ row.location || '未配置' }}
          </template>
        </el-table-column>
        <el-table-column label="在线状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'success' : 'info'" effect="dark">
              {{ row.online ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_active_time" label="最后活跃时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.last_active_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openEditDialog(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑设备弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="编辑设备配置"
      width="500px"
    >
      <el-form :model="editForm" :rules="rules" ref="editFormRef" label-width="100px">
        <el-form-item label="设备ID">
          <el-input v-model="editForm.device_id" disabled />
        </el-form-item>
        <el-form-item label="设备名称" prop="name">
          <el-input v-model="editForm.name" placeholder="请输入设备名称或别名" />
        </el-form-item>
        <el-form-item label="安装位置" prop="location">
          <el-input v-model="editForm.location" placeholder="如：1号牛舍A区" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitEdit" :loading="submitLoading">
            保存
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { Refresh, Edit } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '@/api';

// 状态
const loading = ref(false);
const devices = ref([]);
const onlineCount = ref(0);

// 编辑弹窗
const dialogVisible = ref(false);
const submitLoading = ref(false);
const editFormRef = ref(null);
const editForm = reactive({
  device_id: '',
  name: '',
  location: ''
});

const rules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }]
};

onMounted(() => {
  fetchDevices();
});

// 获取设备列表
async function fetchDevices() {
  loading.value = true;
  try {
    const res = await api.device.getDevices();
    if (res.success) {
      devices.value = res.devices;
      onlineCount.value = res.onlineCount;
    } else {
      ElMessage.error('获取设备列表失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('网络异常');
  } finally {
    loading.value = false;
  }
}

// 打开编辑弹窗
function openEditDialog(row) {
  editForm.device_id = row.device_id;
  editForm.name = row.name || '';
  editForm.location = row.location || '';
  dialogVisible.value = true;
}

// 提交编辑
async function submitEdit() {
  if (!editFormRef.value) return;
  
  await editFormRef.value.validate(async (valid) => {
    if (valid) {
      submitLoading.value = true;
      try {
        const res = await api.device.updateDevice(editForm.device_id, {
          name: editForm.name,
          location: editForm.location
        });
        
        if (res.success) {
          ElMessage.success('设备配置已更新');
          dialogVisible.value = false;
          fetchDevices(); // 刷新列表
        } else {
          ElMessage.error(res.error || '更新失败');
        }
      } catch (error) {
        console.error(error);
        ElMessage.error('网络异常');
      } finally {
        submitLoading.value = false;
      }
    }
  });
}

// 格式化时间
function formatTime(timeStr) {
  if (!timeStr) return '--';
  return new Date(timeStr).toLocaleString('zh-CN');
}
</script>

<style scoped>
.devices-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.stats-row {
  margin-bottom: 20px;
  text-align: center;
}

.stat-item {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.stat-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.text-success {
  color: #67c23a;
}
.text-success .stat-title {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}
.text-danger .stat-title {
  color: #f56c6c;
}
</style>
