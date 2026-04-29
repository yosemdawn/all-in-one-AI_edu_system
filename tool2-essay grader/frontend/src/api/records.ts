import request from '@/utils/request'
import type { GradingRecord, RecordDetail } from '@/types'

export interface RecordListResponse {
  total: number
  records: GradingRecord[]
}

/**
 * 学生查看自己的批阅记录
 */
export function getMyRecords(skip: number = 0, limit: number = 100) {
  return request.get<RecordListResponse>('/records/my', {
    params: { skip, limit }
  })
}

/**
 * 管理员查看所有批阅记录
 */
export function getAllRecords(skip: number = 0, limit: number = 100) {
  return request.get<RecordListResponse>('/records/all', {
    params: { skip, limit }
  })
}

/**
 * 管理员查看指定学生的批阅记录
 */
export function getStudentRecords(username: string) {
  return request.get<RecordListResponse>(`/records/student/${username}`)
}

/**
 * 查看批阅记录详情
 */
export function getRecordDetail(recordId: number) {
  return request.get<RecordDetail>(`/records/${recordId}`)
}

