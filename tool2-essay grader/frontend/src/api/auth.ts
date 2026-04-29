/**
 * 认证相关API
 */
import request from '@/utils/request'
import type { LoginRequest, LoginResponse, User } from '@/types'

/**
 * 用户登录
 */
export function login(data: LoginRequest) {
  return request<LoginResponse>({
    url: '/auth/login',
    method: 'post',
    data
  })
}

/**
 * 用户登出
 */
export function logout() {
  return request({
    url: '/auth/logout',
    method: 'post'
  })
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  return request<User>({
    url: '/auth/me',
    method: 'get'
  })
}

/**
 * 验证token是否有效
 */
export function verifyToken() {
  return request({
    url: '/auth/verify',
    method: 'get'
  })
}