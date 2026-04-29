import request from '@/utils/request'

export interface UploadPromptResponse {
  success: boolean
  message: string
  session_id: string
  file_id: string
}

export interface UploadEssaysResponse {
  success: boolean
  message: string
  uploaded_count: number
  file_ids: string[]
}

export interface ProcessBatchResponse {
  success: boolean
  message: string
  task_id: string
}

export interface TaskStatus {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  total: number
  current: number
  message: string
  results?: Array<{
    student_name: string
    status: 'success' | 'failed'
    record_id?: number
    error?: string
  }>
}

/**
 * 上传作文要求图片
 */
export function uploadPrompt(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<UploadPromptResponse>('/grading/upload-prompt', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 批量上传学生作文图片
 */
export function uploadEssays(sessionId: string, files: File[]) {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })
  return request.post<UploadEssaysResponse>(`/grading/upload-essays/${sessionId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 开始批量处理任务
 */
export function processBatch(sessionId: string) {
  return request.post<ProcessBatchResponse>(`/grading/process-batch/${sessionId}`)
}

/**
 * 查询任务状态
 */
export function getTaskStatus(taskId: string) {
  return request.get<TaskStatus>(`/grading/status/${taskId}`)
}

