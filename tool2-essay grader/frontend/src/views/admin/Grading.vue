<template>
  <div class="grading">
    <h2 class="page-title">✍️ 批阅作文</h2>

    <!-- 步骤条 -->
    <el-card class="steps-card" shadow="hover">
      <el-steps :active="currentStep" align-center finish-status="success">
        <el-step title="上传作文要求" description="上传并预览作文要求" />
        <el-step title="批量上传作文" description="批量上传学生作文图片" />
        <el-step title="开始批阅" description="AI自动批阅，等待结果" />
        <el-step title="查看结果" description="查看成绩和批阅详情" />
      </el-steps>
    </el-card>

    <!-- 步骤1: 上传作文要求 -->
    <el-card v-if="currentStep === 0" class="step-card" shadow="hover">
      <template #header>
        <span>📄 第一步：上传作文要求</span>
      </template>

      <el-upload
        v-model:file-list="promptFileList"
        class="upload-demo"
        drag
        :auto-upload="false"
        :limit="1"
        accept="image/*"
        :on-change="handlePromptChange"
        :on-remove="handlePromptRemove"
        list-type="picture"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          将作文要求图片拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">支持 JPG、PNG 格式，文件大小不超过 10MB</div>
        </template>
      </el-upload>

      <!-- 图片预览 -->
      <div v-if="promptPreviewUrl" class="image-preview">
        <h4>📸 作文要求预览</h4>
        <el-image :src="promptPreviewUrl" fit="contain" style="max-width: 100%; max-height: 400px;" />
      </div>

      <div class="step-actions">
        <el-button
          type="primary"
          :loading="uploading"
          @click="handleUploadPrompt"
          :disabled="promptFileList.length === 0"
        >
          下一步
        </el-button>
      </div>
    </el-card>

    <!-- 步骤2: 上传学生作文 -->
    <el-card v-if="currentStep === 1" class="step-card" shadow="hover">
      <template #header>
        <span>📚 第二步：批量上传学生作文（最多50份）</span>
      </template>

      <div class="upload-info">
        <el-alert
          title="请确保每张作文图片左上角写有学生姓名，以便系统识别并正确发送批阅结果"
          type="info"
          :closable="false"
          show-icon
        />
      </div>

      <el-upload
        v-model:file-list="essayFileList"
        class="upload-demo"
        drag
        multiple
        :auto-upload="false"
        :limit="50"
        accept="image/*"
        :on-change="handleEssaysChange"
        :on-remove="handleEssayRemove"
        list-type="picture-card"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          将学生作文图片拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            已选择: {{ essayFileList.length }} 份作文（最多50份）
          </div>
        </template>
      </el-upload>

      <!-- 已上传作文预览 -->
      <div v-if="essayFileList.length > 0" class="essay-preview">
        <h4>📸 已上传作文预览</h4>
        <div class="preview-grid">
          <div
            v-for="(file, index) in essayFileList"
            :key="file.uid"
            class="preview-item"
          >
            <el-image
              :src="getImageUrl(file)"
              fit="cover"
              style="width: 100%; height: 120px;"
            />
            <div class="preview-item-name">
              作文 {{ index + 1 }}
            </div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <el-button @click="currentStep = 0">上一步</el-button>
        <el-button
          type="primary"
          :loading="uploading"
          @click="handleUploadEssays"
          :disabled="essayFileList.length === 0"
        >
          下一步
        </el-button>
      </div>
    </el-card>

    <!-- 步骤3: 开始批阅 -->
    <el-card v-if="currentStep === 2" class="step-card" shadow="hover">
      <template #header>
        <span>🚀 第三步：开始AI批阅</span>
      </template>

      <div class="confirm-info">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="作文要求">✅ 已上传</el-descriptions-item>
          <el-descriptions-item label="学生作文">
            {{ essayFileList.length }} 份
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <el-result
        icon="info"
        title="准备开始批阅"
        sub-title="AI将自动识别学生姓名，完成批阅后将结果发送到对应学生账号"
      >
        <template #extra>
          <el-button
            type="primary"
            size="large"
            :loading="processing"
            @click="startProcessing"
          >
            {{ processing ? '批阅进行中...' : '开始批阅' }}
          </el-button>
        </template>
      </el-result>
    </el-card>

    <!-- 步骤4: 批阅进度和结果 -->
    <el-card v-if="currentStep === 3" class="step-card" shadow="hover">
      <template #header>
        <span>📊 第四步：批阅进度</span>
      </template>

      <div class="progress-section">
        <el-progress
          :percentage="taskProgress"
          :status="taskProgressStatus"
          :stroke-width="20"
          striped
          striped-flow
        />

        <div class="progress-info">
          <div class="progress-status">
            <el-tag :type="taskTagType" size="large">
              {{ taskStatusText }}
            </el-tag>
          </div>
          <p class="progress-message">{{ taskMessage }}</p>
          <p v-if="taskStatus === 'processing'" class="progress-detail">
            正在批阅：第 {{ taskCurrent }} / {{ taskTotal }} 份
          </p>
        </div>

        <!-- 批阅结果统计 -->
        <div v-if="taskStatus === 'completed'" class="results-summary">
          <el-alert
            :title="`批阅完成！共处理 ${taskTotal} 份作文`"
            type="success"
            :closable="false"
            show-icon
          />
          <el-statistic
            :value="successCount"
            title="成功批阅"
          >
            <template #suffix>
              / {{ taskTotal }} 份
            </template>
          </el-statistic>
        </div>

        <!-- 详细结果列表 -->
        <div v-if="taskResults.length > 0" class="results-section">
          <div class="results-header">
            <h3>📋 批阅结果详情</h3>
            <el-button
              type="primary"
              size="small"
              @click="viewRecords"
            >
              查看所有记录
            </el-button>
          </div>

          <div class="results-grid">
            <el-card
              v-for="result in taskResults"
              :key="result.student_name"
              class="result-card"
              :class="result.status === 'success' ? 'success' : 'failed'"
              shadow="hover"
            >
              <div class="result-header">
                <el-avatar :size="40" class="student-avatar">
                  {{ result.student_name?.charAt(0) }}
                </el-avatar>
                <div class="student-info">
                  <div class="student-name">{{ result.student_name || '未知学生' }}</div>
                  <el-tag
                    :type="result.status === 'success' ? 'success' : 'danger'"
                    size="small"
                  >
                    {{ result.status === 'success' ? '批阅成功' : '批阅失败' }}
                  </el-tag>
                </div>
              </div>

              <div v-if="result.status === 'success'" class="result-content">
                <div class="score-display">
                  <div class="score-label">成绩</div>
                  <div class="score-value">{{ result.score || '待查' }}</div>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  plain
                  @click="viewRecordDetail(result.grading_record_id)"
                >
                  查看详情
                </el-button>
              </div>

              <div v-else class="result-error">
                <el-alert
                  :title="result.error || '批阅失败'"
                  type="error"
                  :closable="false"
                  show-icon
                />
              </div>
            </el-card>
          </div>
        </div>
      </div>

      <div class="step-actions" v-if="taskStatus !== 'processing'">
        <el-button @click="resetForm">重新批阅</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import {
  uploadPrompt as uploadPromptApi,
  uploadEssays as uploadEssaysApi,
  processBatch,
  getTaskStatus
} from '@/api/grading'

const router = useRouter()

// 步骤控制
const currentStep = ref(0)
const uploading = ref(false)
const processing = ref(false)

// 文件列表
const promptFileList = ref<UploadFile[]>([])
const essayFileList = ref<UploadFile[]>([])

// 预览图片URL
const promptPreviewUrl = ref<string>('')

// 任务状态
const sessionId = ref<string>('')
const taskId = ref<string>('')
const taskStatus = ref<'pending' | 'processing' | 'completed' | 'failed'>('pending')
const taskProgress = ref<number>(0)
const taskMessage = ref<string>('正在准备批阅...')
const taskCurrent = ref<number>(0)
const taskTotal = ref<number>(0)
const taskResults = ref<any[]>([])

let pollTimer: number | null = null

// 计算属性
const taskProgressStatus = computed(() => {
  if (taskStatus.value === 'completed') return 'success'
  if (taskStatus.value === 'failed') return 'exception'
  return ''
})

const taskStatusText = computed(() => {
  switch (taskStatus.value) {
    case 'pending':
      return '等待开始'
    case 'processing':
      return '批阅中'
    case 'completed':
      return '批阅完成'
    case 'failed':
      return '批阅失败'
    default:
      return '未知状态'
  }
})

const taskTagType = computed(() => {
  switch (taskStatus.value) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'processing':
      return 'warning'
    default:
      return 'info'
  }
})

const successCount = computed(() => {
  return taskResults.value.filter(r => r.status === 'success').length
})

// 文件处理
const handlePromptChange = (file: UploadFile) => {
  promptFileList.value = [file]
  // 生成预览URL
  if (file.raw) {
    promptPreviewUrl.value = URL.createObjectURL(file.raw)
  }
}

const handlePromptRemove = () => {
  promptFileList.value = []
  promptPreviewUrl.value = ''
}

const handleEssaysChange = (file: UploadFile, fileList: UploadFile[]) => {
  essayFileList.value = fileList
}

const handleEssayRemove = () => {
  // 无需额外处理，v-model 会自动更新
}

const getImageUrl = (file: UploadFile): string => {
  if (!file.raw) return ''
  return URL.createObjectURL(file.raw)
}

// API 调用
const handleUploadPrompt = async () => {
  if (promptFileList.value.length === 0) {
    ElMessage.warning('请先选择作文要求图片')
    return
  }

  uploading.value = true
  try {
    const file = promptFileList.value[0].raw as File
    const res = await uploadPromptApi(file)
    sessionId.value = res.session_id
    ElMessage.success('✅ 作文要求上传成功')
    currentStep.value = 1
  } catch (error: any) {
    console.error('上传作文要求失败:', error)
    ElMessage.error(error.message || '❌ 上传失败')
  } finally {
    uploading.value = false
  }
}

const handleUploadEssays = async () => {
  if (essayFileList.value.length === 0) {
    ElMessage.warning('请先选择学生作文图片')
    return
  }

  if (!sessionId.value) {
    ElMessage.error('会话ID不存在，请重新上传作文要求')
    return
  }

  uploading.value = true
  try {
    const files = essayFileList.value.map(f => f.raw as File)
    const res = await uploadEssaysApi(sessionId.value, files)
    ElMessage.success(`✅ 成功上传 ${res.uploaded_count} 份作文`)
    currentStep.value = 2
  } catch (error: any) {
    console.error('上传学生作文失败:', error)
    ElMessage.error(error.message || '❌ 上传失败')
  } finally {
    uploading.value = false
  }
}

const startProcessing = async () => {
  if (!sessionId.value) {
    ElMessage.error('会话ID不存在')
    return
  }

  processing.value = true
  try {
    const res = await processBatch(sessionId.value)
    taskId.value = res.task_id
    taskTotal.value = essayFileList.value.length
    taskCurrent.value = 0
    taskStatus.value = 'processing'
    taskMessage.value = 'AI批阅任务已启动...'
    ElMessage.success('🚀 AI批阅任务已启动')
    currentStep.value = 3
    startPolling()
  } catch (error: any) {
    console.error('启动批阅失败:', error)
    ElMessage.error(error.message || '❌ 启动批阅失败')
    taskStatus.value = 'failed'
    taskMessage.value = '批阅启动失败'
  } finally {
    processing.value = false
  }
}

const startPolling = () => {
  // 清除已存在的定时器
  stopPolling()

  pollTimer = window.setInterval(async () => {
    try {
      const status = await getTaskStatus(taskId.value)
      taskStatus.value = status.status
      taskMessage.value = status.message || getDefaultMessage(status.status)
      taskCurrent.value = status.current || 0
      taskTotal.value = status.total || essayFileList.value.length
      taskProgress.value = status.progress || 0

      if (status.results && status.results.length > 0) {
        taskResults.value = status.results
      }

      if (status.status === 'completed') {
        stopPolling()
        // 确保显示所有结果
        if (status.results) {
          taskResults.value = status.results
        }
        ElMessage.success('🎉 批阅完成！结果已发送到学生账号')
      } else if (status.status === 'failed') {
        stopPolling()
        ElMessage.error('❌ 批阅失败')
      }
    } catch (error) {
      console.error('轮询任务状态失败:', error)
      // 继续轮询，不停止
    }
  }, 2000) // 每2秒轮询一次
}

const getDefaultMessage = (status: string): string => {
  switch (status) {
    case 'processing':
      return 'AI正在努力批阅中...'
    case 'completed':
      return '批阅完成！'
    case 'failed':
      return '批阅失败，请检查错误信息'
    default:
      return '准备中...'
  }
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const viewRecords = () => {
  router.push('/admin/records')
}

const viewRecordDetail = (recordId: number) => {
  router.push({
    path: '/admin/records',
    query: { recordId }
  })
}

const resetForm = () => {
  // 停止轮询
  stopPolling()

  // 清理预览URL
  if (promptPreviewUrl.value) {
    URL.revokeObjectURL(promptPreviewUrl.value)
  }

  // 重置状态
  currentStep.value = 0
  promptFileList.value = []
  essayFileList.value = []
  promptPreviewUrl.value = ''
  sessionId.value = ''
  taskId.value = ''
  taskStatus.value = 'pending'
  taskProgress.value = 0
  taskMessage.value = '正在准备批阅...'
  taskCurrent.value = 0
  taskTotal.value = 0
  taskResults.value = []
}

// 组件卸载时清理
import { onUnmounted } from 'vue'
onUnmounted(() => {
  stopPolling()
  if (promptPreviewUrl.value) {
    URL.revokeObjectURL(promptPreviewUrl.value)
  }
})
</script>

<style scoped>
.grading {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #303133;
  font-weight: 600;
}

.steps-card {
  margin-bottom: 30px;
  border-radius: 8px;
}

.step-card {
  margin-bottom: 30px;
  border-radius: 8px;
}

.upload-demo {
  margin-bottom: 20px;
}

.image-preview {
  margin: 20px 0;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  text-align: center;
}

.image-preview h4 {
  margin: 0 0 15px 0;
  color: #606266;
  font-size: 16px;
}

.upload-info {
  margin-bottom: 20px;
}

.essay-preview {
  margin-top: 25px;
}

.essay-preview h4 {
  margin: 0 0 15px 0;
  color: #606266;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.preview-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.3s;
  background-color: #fff;
}

.preview-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.preview-item-name {
  padding: 8px;
  text-align: center;
  font-size: 13px;
  color: #606266;
  background-color: #f8f9fa;
}

.step-actions {
  margin-top: 25px;
  text-align: center;
}

.step-actions .el-button {
  margin: 0 10px;
  min-width: 100px;
}

.confirm-info {
  margin-bottom: 25px;
}

.progress-section {
  padding: 20px;
}

.progress-info {
  margin-top: 25px;
  text-align: center;
}

.progress-status {
  margin-bottom: 15px;
}

.progress-message {
  font-size: 16px;
  color: #303133;
  margin: 10px 0;
}

.progress-detail {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.results-summary {
  margin: 25px 0;
  padding: 20px;
  background-color: #f0f9ff;
  border-radius: 8px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-header h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.result-card {
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;
}

.result-card.success {
  border-color: #67c23a;
}

.result-card.failed {
  border-color: #f56c6c;
}

.result-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-4px);
}

.result-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.student-avatar {
  background-color: #409eff;
  color: white;
  margin-right: 12px;
  font-weight: bold;
}

.student-info {
  flex: 1;
}

.student-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.result-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-display {
  text-align: center;
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.score-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.score-value {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
}

.result-error {
  margin-top: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .results-grid {
    grid-template-columns: 1fr;
  }

  .grading {
    padding: 10px;
  }

  .step-actions .el-button {
    margin: 5px;
  }
}

/* 状态颜色调整 */
:deep(.el-progress-bar__inner) {
  transition: all 0.3s ease;
}

:deep(.el-progress-bar__outer) {
  border-radius: 10px;
}
</style>

