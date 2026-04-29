/**
 * 用户状态管理
 * 管理用户登录状态、token、用户信息
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { User, LoginRequest } from '@/types'
import { login as loginApi, logout as logoutApi, getCurrentUser } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref<string>('')
  const userInfo = ref<User | null>(null)
  const isLoggedIn = ref(false)

  // 计算属性
  const isAdmin = computed(() => userInfo.value?.role === 'admin')
  const isStudent = computed(() => userInfo.value?.role === 'student')
  const username = computed(() => userInfo.value?.username || '')

  /**
   * 登录
   */
  const login = async (loginData: LoginRequest) => {
    try {
      const response: any = await loginApi(loginData)
      
      // 保存token和用户信息
      token.value = response.access_token
      userInfo.value = response.user
      isLoggedIn.value = true
      
      // 持久化到localStorage
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('user_info', JSON.stringify(response.user))
      
      // 根据角色显示不同的欢迎消息
      const roleEmoji = response.user.role === 'admin' ? '👨‍💼' : '👨‍🎓'
      const roleName = response.user.role === 'admin' ? '管理员' : '同学'
      ElMessage.success(`${roleEmoji} 欢迎回来，${response.user.username}${roleName}！`)
      
      return response
    } catch (error) {
      ElMessage.error('❌ 登录失败，请检查用户名和密码')
      throw error
    }
  }

  /**
   * 登出
   */
  const logout = async () => {
    try {
      await logoutApi()
    } catch (error) {
      console.error('登出请求失败:', error)
    } finally {
      // 清除状态
      token.value = ''
      userInfo.value = null
      isLoggedIn.value = false
      
      // 清除localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('user_info')
      
      ElMessage.success('👋 已安全退出登录')
    }
  }

  /**
   * 检查认证状态（应用启动时调用）
   */
  const checkAuth = async () => {
    const savedToken = localStorage.getItem('access_token')
    const savedUserInfo = localStorage.getItem('user_info')
    
    if (savedToken && savedUserInfo) {
      token.value = savedToken
      userInfo.value = JSON.parse(savedUserInfo)
      isLoggedIn.value = true
      
      // 验证token是否仍然有效
      try {
        await getCurrentUser()
      } catch (error) {
        // token无效，清除状态
        logout()
      }
    }
  }

  /**
   * 更新用户信息
   */
  const updateUserInfo = (newUserInfo: User) => {
    userInfo.value = newUserInfo
    localStorage.setItem('user_info', JSON.stringify(newUserInfo))
  }

  return {
    // 状态
    token,
    userInfo,
    isLoggedIn,
    // 计算属性
    isAdmin,
    isStudent,
    username,
    // 方法
    login,
    logout,
    checkAuth,
    updateUserInfo
  }
})