import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      title: '实时监控',
      activeMenu: 'dashboard',
    },
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('@/views/History.vue'),
    meta: {
      title: '历史数据',
      activeMenu: 'history',
    },
  },
  {
    path: '/alarm',
    name: 'Alarm',
    component: () => import('@/views/Alarm.vue'),
    meta: {
      title: '报警管理',
      activeMenu: 'alarm',
    },
  },
  {
    path: '/devices',
    name: 'Devices',
    component: () => import('@/views/Devices.vue'),
    meta: {
      title: '设备管理',
      activeMenu: 'devices',
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      hideInMenu: true,
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '404',
      hideInMenu: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫：设置页面标题和登录拦截
router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 牛舍监控系统` : '牛舍监控系统'

  // 简单的登录验证拦截
  const isAuthenticated = !!localStorage.getItem('token')
  if (to.name !== 'Login' && !isAuthenticated) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
