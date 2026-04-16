<template>
  <div id="app" :class="[theme]">
    <template v-if="route.name !== 'Login'">
      <!-- 顶部导航栏 -->
      <el-header class="app-header" height="60px">
        <div class="header-content">
          <!-- 左侧：Logo和系统名称 -->
          <div class="header-left">
            <div class="logo-container">
              <el-icon class="logo-icon"><Monitor /></el-icon>
              <h1 class="system-name">牛舍环境监控系统</h1>
            </div>
          </div>

          <!-- 中间：导航菜单 -->
          <div class="header-center">
            <el-menu
              mode="horizontal"
              :default-active="activeMenu"
              @select="handleMenuSelect"
              :ellipsis="false"
              class="nav-menu"
            >
              <el-menu-item index="dashboard">
                <el-icon><DataLine /></el-icon>
                <span>实时监控</span>
              </el-menu-item>
              <el-menu-item index="history">
                <el-icon><Histogram /></el-icon>
                <span>历史数据</span>
              </el-menu-item>
              <el-menu-item index="alarm">
                <el-icon><Bell /></el-icon>
                <span>报警管理</span>
                <el-badge v-if="unreadAlarms > 0" :value="unreadAlarms" class="badge" />
              </el-menu-item>
              <el-menu-item index="devices">
                <el-icon><Cpu /></el-icon>
                <span>设备管理</span>
              </el-menu-item>
              <!-- <el-sub-menu index="more">
                <template #title>
                  <el-icon><MoreFilled /></el-icon>
                  <span>更多</span>
                </template>
                <el-menu-item index="settings">
                  <el-icon><Setting /></el-icon>
                  <span>系统设置</span>
                </el-menu-item>
                <el-menu-item index="help">
                  <el-icon><QuestionFilled /></el-icon>
                  <span>使用帮助</span>
                </el-menu-item>
                <el-menu-item index="about">
                  <el-icon><InfoFilled /></el-icon>
                  <span>关于系统</span>
                </el-menu-item>
              </el-sub-menu> -->
            </el-menu>
          </div>

          <!-- 右侧：用户操作区 -->
          <div class="header-right">
            <!-- 主题切换 -->
            <el-tooltip :content="theme === 'light' ? '切换深色主题' : '切换浅色主题'">
              <el-button
                circle
                :icon="theme === 'light' ? Moon : Sunny"
                @click="toggleTheme"
                class="theme-toggle"
              />
            </el-tooltip>

            <!-- 全屏切换 -->
            <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏显示'">
              <el-button
                circle
                :icon="isFullscreen ? FullScreen : Crop"
                @click="toggleFullscreen"
                class="fullscreen-toggle"
              />
            </el-tooltip>

            <!-- 系统状态指示器 -->
            <div class="status-indicators">
              <el-tooltip content="后端连接状态">
                <el-badge
                  :is-dot="backendConnected"
                  :type="backendConnected ? 'success' : 'danger'"
                >
                  <el-icon :class="{ connected: backendConnected }">
                    <Connection />
                  </el-icon>
                </el-badge>
              </el-tooltip>

              <el-tooltip :content="`${connectedDevices} 个设备在线`">
                <el-badge :value="connectedDevices" :max="99" type="primary">
                  <el-icon><Cpu /></el-icon>
                </el-badge>
              </el-tooltip>
            </div>

            <!-- 用户信息 -->
            <el-dropdown @command="handleUserCommand" trigger="click">
              <div class="user-info">
                <el-avatar :size="36" :src="userAvatar" class="user-avatar">
                  {{ userAvatar ? '' : userInfo.name?.charAt(0) }}
                </el-avatar>
                <span class="user-name">{{ userInfo.name }}</span>
                <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">
                    <el-icon><User /></el-icon>
                    个人中心
                  </el-dropdown-item>
                  <el-dropdown-item command="settings">
                    <el-icon><Setting /></el-icon>
                    账户设置
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="app-main">
        <!-- 面包屑导航 -->
        <div class="breadcrumb" v-if="breadcrumb.length > 0">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="(item, index) in breadcrumb" :key="index">
              <span v-if="item.path">
                <router-link :to="item.path">{{ item.title }}</router-link>
              </span>
              <span v-else>{{ item.title }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- 路由视图 -->
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>

      <!-- 页脚 -->
      <el-footer class="app-footer" height="50px">
        <div class="footer-content">
          <div class="footer-left">
            <span>© 2025 牛舍环境监控系统</span>
            <el-divider direction="vertical" />
            <span>毕业设计 - 物联网工程专业</span>
            <el-divider direction="vertical" />
            <el-link href="https://github.com/your-repo" target="_blank" type="info" :icon="Link">
              项目源码
            </el-link>
          </div>
          <div class="footer-right">
            <el-tag size="small" type="info"> 版本: {{ appVersion }} </el-tag>
            <el-divider direction="vertical" />
            <span>最后更新: {{ lastUpdateTime }}</span>
          </div>
        </div>
      </el-footer>

      <!-- 全局通知按钮（右下角悬浮） -->
      <div class="global-notifications">
        <el-badge
          :value="notificationCount"
          :max="99"
          :hidden="notificationCount === 0"
          class="notification-badge"
        >
          <el-button
            circle
            :icon="Bell"
            @click="showNotificationDrawer = true"
            class="notification-button"
          />
        </el-badge>
      </div>

      <!-- 通知抽屉 -->
      <el-drawer v-model="showNotificationDrawer" title="系统通知" direction="rtl" size="350px">
        <div class="notification-content">
          <el-empty v-if="notifications.length === 0" description="暂无通知" />
          <div v-else class="notification-list">
            <div
              v-for="(notification, index) in notifications"
              :key="index"
              class="notification-item"
              :class="{ unread: !notification.read }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-header">
                <el-icon :class="`type-${notification.type}`" class="notification-icon">
                  <component :is="getNotificationIcon(notification.type)" />
                </el-icon>
                <span class="notification-title">{{ notification.title }}</span>
                <el-tag v-if="notification.level" :type="notification.level" size="small">
                  {{ notification.level === 'warning' ? '警告' : '严重' }}
                </el-tag>
                <span class="notification-time">{{ notification.time }}</span>
              </div>
              <div class="notification-body">
                {{ notification.content }}
              </div>
            </div>
          </div>
        </div>
      </el-drawer>
    </template>
    <template v-else>
      <router-view v-slot="{ Component }">
        <transition name="fade-transform" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Monitor,
  DataLine,
  Histogram,
  Bell,
  Cpu,
  MoreFilled,
  Setting,
  QuestionFilled,
  InfoFilled,
  Moon,
  Sunny,
  FullScreen,
  Crop,
  Connection,
  ArrowDown,
  User,
  SwitchButton,
  Link,
  Warning,
  CircleCheck,
  CircleClose,
} from '@element-plus/icons-vue'

// 路由相关
const route = useRoute()
const router = useRouter()

// 响应式数据
const theme = ref('light')
const isFullscreen = ref(false)
const showNotificationDrawer = ref(false)
const backendConnected = ref(true)
const connectedDevices = ref(1)
const unreadAlarms = ref(0)
const notificationCount = ref(3)

// 用户信息
const userInfo = ref({
  name: '王炳皓',
  avatar: '', // 可以设置头像URL
})

// 从localStorage加载用户信息
const loadUserInfo = () => {
  const savedInfo = localStorage.getItem('user_info')
  if (savedInfo) {
    try {
      const parsed = JSON.parse(savedInfo)
      userInfo.value.name = parsed.name || userInfo.value.name
    } catch (e) {
      console.error(e)
    }
  }
}

const userAvatar = computed(() => userInfo.value.avatar)

// 应用信息
const appVersion = ref('1.0.0')
const lastUpdateTime = ref('2025-03-10')

// 通知数据
const notifications = ref([
  {
    id: 1,
    type: 'warning',
    title: '温度异常',
    content: '1号牛舍温度超过30°C',
    time: '10分钟前',
    read: false,
    level: 'warning',
  },
  {
    id: 2,
    type: 'success',
    title: '设备上线',
    content: 'ESP32_001设备已连接',
    time: '1小时前',
    read: true,
  },
  {
    id: 3,
    type: 'error',
    title: '网络中断',
    content: '与服务器连接中断3分钟',
    time: '2小时前',
    read: false,
    level: 'danger',
  },
])

// 面包屑导航
const breadcrumb = computed(() => {
  const matched = route.matched.filter((record) => record.meta?.title)
  return matched.map((record) => ({
    title: record.meta.title,
    path: record.path,
  }))
})

// 当前激活的菜单
const activeMenu = computed(() => {
  return route.meta?.activeMenu || route.name
})

// 监听全屏变化
onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  // 检查后端连接状态
  checkBackendConnection()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

// 方法定义
const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  // 保存主题偏好到localStorage
  localStorage.setItem('theme', theme.value)
  // 应用到html元素
  document.documentElement.setAttribute('data-theme', theme.value)
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error(`全屏请求失败: ${err.message}`)
    })
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

const handleMenuSelect = (index) => {
  const routes = {
    dashboard: '/',
    history: '/history',
    alarm: '/alarm',
    devices: '/devices',
    settings: '/settings',
    help: '/help',
    about: '/about',
  }

  if (routes[index]) {
    router.push(routes[index])
  }
}

const handleUserCommand = (command) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      handleLogout()
      break
  }
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      // 清除用户信息
      localStorage.removeItem('token')
      // 跳转到登录页
      router.push('/login')
      ElMessage.success('已退出登录')
    })
    .catch(() => {
      // 用户取消
    })
}

const getNotificationIcon = (type) => {
  const icons = {
    warning: Warning,
    success: CircleCheck,
    error: CircleClose,
    info: InfoFilled,
  }
  return icons[type] || Bell
}

const handleNotificationClick = (notification) => {
  if (!notification.read) {
    notification.read = true
    notificationCount.value = Math.max(0, notificationCount.value - 1)
  }
  // 处理通知点击逻辑
  console.log('点击通知:', notification)
}

// 检查后端连接状态
const checkBackendConnection = async () => {
  try {
    // 这里可以调用一个简单的API来检查连接
    // 例如: const response = await fetch('http://localhost:3000/api/health')
    // backendConnected.value = response.ok
    backendConnected.value = true
  } catch (error) {
    backendConnected.value = false
    console.error('后端连接失败:', error)
  }
}

// 模拟实时数据更新
setInterval(() => {
  // 模拟设备连接状态变化
  if (Math.random() > 0.7) {
    connectedDevices.value = Math.floor(Math.random() * 5) + 1
  }

  // 模拟新通知
  if (Math.random() > 0.9) {
    const newNotification = {
      id: Date.now(),
      type: 'warning',
      title: '模拟报警',
      content: '这是系统生成的测试通知',
      time: '刚刚',
      read: false,
      level: 'warning',
    }
    notifications.value.unshift(newNotification)
    notificationCount.value++
    unreadAlarms.value++
  }
}, 10000)

// 初始化主题和用户信息
onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  theme.value = savedTheme
  document.documentElement.setAttribute('data-theme', savedTheme)
  loadUserInfo()
})

// 监听路由变化，可能用户刚登录
watch(
  () => route.path,
  () => {
    if (route.name !== 'Login') {
      loadUserInfo()
    }
  },
)
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--el-bg-color-page);
  transition:
    background-color 0.3s,
    color 0.3s;
}

/* 浅色主题变量 */
#app.light {
  --header-bg: #ffffff;
  --footer-bg: #f5f7fa;
  --border-color: #e4e7ed;
  --text-primary: #303133;
  --text-secondary: #606266;
}

/* 深色主题变量 */
#app.dark {
  --header-bg: #1f1f1f;
  --footer-bg: #141414;
  --border-color: #434343;
  --text-primary: #e5eaf3;
  --text-secondary: #cfd3dc;
}

.app-header {
  background-color: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 200px;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: opacity 0.3s;
}

.logo-container:hover {
  opacity: 0.8;
}

.logo-icon {
  font-size: 28px;
  color: #409eff;
}

.system-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  white-space: nowrap;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.nav-menu {
  border-bottom: none;
  background: transparent;
  flex: 1;
  justify-content: center;
}

.nav-menu :deep(.el-menu-item) {
  font-weight: 500;
  transition: all 0.3s;
}

.nav-menu :deep(.el-menu-item.is-active) {
  border-bottom-color: #409eff;
  background-color: rgba(64, 158, 255, 0.1);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 300px;
  justify-content: flex-end;
}

.theme-toggle,
.fullscreen-toggle {
  border: 1px solid var(--border-color);
  background: transparent;
}

.theme-toggle:hover,
.fullscreen-toggle:hover {
  background-color: var(--el-fill-color-light);
}

.status-indicators {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  height: 40px;
}

.status-indicators .connected {
  color: #67c23a;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: var(--el-fill-color-light);
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-name {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.dropdown-arrow {
  color: var(--text-secondary);
  font-size: 12px;
  transition: transform 0.3s;
}

.user-info:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.app-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

.breadcrumb {
  margin-bottom: 20px;
  padding: 0 10px;
}

.breadcrumb :deep(.el-breadcrumb) {
  font-size: 14px;
}

.breadcrumb :deep(.el-breadcrumb__inner) {
  color: var(--text-secondary);
}

.breadcrumb :deep(.el-breadcrumb__inner a) {
  color: var(--text-secondary);
  text-decoration: none;
}

.breadcrumb :deep(.el-breadcrumb__inner a:hover) {
  color: #409eff;
}

.app-footer {
  background-color: var(--footer-bg);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: var(--text-secondary);
  font-size: 13px;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.footer-left,
.footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-left span,
.footer-right span {
  white-space: nowrap;
}

.global-notifications {
  position: fixed;
  right: 30px;
  bottom: 30px;
  z-index: 2000;
}

.notification-button {
  width: 56px;
  height: 56px;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s;
}

.notification-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.notification-badge :deep(.el-badge__content) {
  top: 5px;
  right: 5px;
}

/* 通知抽屉样式 */
.notification-content {
  padding: 20px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  cursor: pointer;
  transition: all 0.3s;
  background-color: var(--el-bg-color);
}

.notification-item:hover {
  background-color: var(--el-fill-color-light);
  transform: translateX(-4px);
}

.notification-item.unread {
  border-left: 4px solid #409eff;
  background-color: rgba(64, 158, 255, 0.05);
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.notification-icon {
  font-size: 18px;
}

.notification-icon.type-warning {
  color: #e6a23c;
}

.notification-icon.type-success {
  color: #67c23a;
}

.notification-icon.type-error {
  color: #f56c6c;
}

.notification-icon.type-info {
  color: #909399;
}

.notification-title {
  font-weight: 600;
  flex: 1;
  color: var(--text-primary);
}

.notification-time {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.notification-body {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 过渡动画 */
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .header-content {
    flex-wrap: wrap;
  }

  .header-left,
  .header-right {
    min-width: auto;
  }

  .system-name {
    font-size: 18px;
  }

  .user-name {
    display: none;
  }
}

@media (max-width: 768px) {
  .app-main {
    padding: 15px;
  }

  .system-name {
    font-size: 16px;
  }

  .header-right {
    gap: 10px;
  }

  .status-indicators {
    display: none;
  }

  .footer-content {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .footer-left,
  .footer-right {
    flex-wrap: wrap;
    justify-content: center;
  }

  .global-notifications {
    right: 15px;
    bottom: 15px;
  }

  .notification-button {
    width: 48px;
    height: 48px;
  }
}
</style>

<style>
/* 全局样式 */
html,
body {
  margin: 0;
  padding: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--el-bg-color-page);
}

::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-placeholder);
}
</style>
