/**
 * File: index.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Vue Router configuration with routes for user authentication, trading, positions,
 *              statistics, transactions, groups, fund flow, and admin panel. Includes navigation
 *              guards for authentication and admin access.
 * Version History:
 *   v1.0 - Initial version
 */

import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue')
  },
  {
    path: '/admin-login',
    name: 'AdminLogin',
    component: () => import('../views/admin-login.vue')
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trade',
    name: 'Trade',
    component: () => import('../views/Trade.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/positions',
    name: 'Positions',
    component: () => import('../views/Positions.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/Statistics.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('../views/Transactions.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/group',
    name: 'Group',
    component: () => import('../views/Group.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue')
  },
  {
    path: '/fund-flow',
    name: 'FundFlow',
    component: () => import('../views/FundFlow.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/admin/Admin.vue'),
    meta: { requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from) => {
  const token = localStorage.getItem('token')
  const adminToken = localStorage.getItem('adminToken')

  if (to.meta.requiresAdmin) {
    if (!adminToken) {
      return '/admin-login'
    }
  } else if (to.meta.requiresAuth && !token) {
    return '/login'
  }
})

// Clear tokens when leaving authenticated routes to force re-authentication on return
router.afterEach((to, from) => {
  // Clear admin token when leaving admin routes
  if (from.path === '/admin' && to.path !== '/admin') {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminId')
  }
  
  // Clear regular user token when leaving authenticated routes
  const authRoutes = ['/home', '/trade', '/positions', '/statistics', '/transactions', '/group', '/fund-flow']
  if (authRoutes.includes(from.path) && !authRoutes.includes(to.path) && to.path !== '/login' && to.path !== '/register') {
    localStorage.removeItem('token')
  }
})

export default router