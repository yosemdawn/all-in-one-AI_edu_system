/**
 * 用户相关类型定义
 */

export interface User {
  id: number
  username: string
  role: 'admin' | 'student'
  email?: string
  class_name?: string
  is_active: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

/**
 * 批阅记录相关类型
 */

export interface GradingRecord {
  id: number
  essay_id: number
  student_id?: number
  student_name?: string
  score?: number
  advantages?: string
  disadvantages?: string
  suggestions?: string
  graded_by: string
  graded_at: string
  essay_text?: string
  requirements?: string
  submitted_at?: string
}

export interface RecordDetail extends GradingRecord {
  student: {
    id: number
    username: string
    email?: string
    class_name?: string
  }
  image_path?: string
  raw_result?: string
}

/**
 * API响应类型
 */

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface RecordListResponse {
  total: number
  records: GradingRecord[]
}

/**
 * 学生管理相关类型
 */

export interface StudentImportItem {
  username: string
  email?: string
  class_name?: string
}

export interface BatchImportRequest {
  students: StudentImportItem[]
  default_password?: string
}

export interface UserListResponse {
  total: number
  users: User[]
}