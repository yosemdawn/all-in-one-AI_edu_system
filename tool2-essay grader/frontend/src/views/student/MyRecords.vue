<template>
  <div class="my-records">
    <h2 class="page-title">📝 我的批阅记录</h2>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">📚</div>
            <div class="stat-info">
              <div class="stat-value">{{ total }}</div>
              <div class="stat-label">总批阅数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">⭐</div>
            <div class="stat-info">
              <div class="stat-value">{{ avgScore }}</div>
              <div class="stat-label">平均分数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">🏆</div>
            <div class="stat-info">
              <div class="stat-value">{{ highestScore }}</div>
              <div class="stat-label">最高分数</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 记录列表 -->
    <el-card class="table-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>批阅记录列表</span>
          <el-button type="primary" @click="loadRecords" :loading="loading">
            刷新
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="records"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="essay_id" label="作文ID" width="120" />
        <el-table-column prop="score" label="分数" width="100">
          <template #default="{ row }">
            <el-tag :type="getScoreType(row.score)" size="large">
              {{ row.score }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="advantages" label="优点" show-overflow-tooltip min-width="150" />
        <el-table-column prop="disadvantages" label="不足" show-overflow-tooltip min-width="150" />
        <el-table-column prop="suggestions" label="建议" show-overflow-tooltip min-width="150" />
        <el-table-column prop="graded_at" label="批阅时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.graded_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadRecords"
        @current-change="loadRecords"
        style="margin-top: 20px; justify-content: center;"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="批阅详情" width="800px">
      <el-descriptions v-if="currentRecord" :column="2" border>
        <el-descriptions-item label="记录ID">{{ currentRecord.id }}</el-descriptions-item>
        <el-descriptions-item label="作文ID">{{ currentRecord.essay_id }}</el-descriptions-item>
        <el-descriptions-item label="学生姓名">{{ currentRecord.student?.username || '-' }}</el-descriptions-item>
        <el-descriptions-item label="分数">
          <el-tag :type="getScoreType(currentRecord.score)" size="large">
            {{ currentRecord.score }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="优点" :span="2">
          <div v-html="formatFieldHTML(currentRecord.advantages)"></div>
        </el-descriptions-item>
        <el-descriptions-item label="不足" :span="2">
          <div v-html="formatFieldHTML(currentRecord.disadvantages)"></div>
        </el-descriptions-item>
        <el-descriptions-item label="建议" :span="2">
          <div v-if="isSuggestionsArray(currentRecord.suggestions)">
            <div v-for="(item, index) in parseSuggestions(currentRecord.suggestions)" :key="index" style="margin-bottom: 15px; padding: 10px; background: #f5f7fa; border-radius: 4px;">
              <div style="margin-bottom: 5px;"><strong>{{ index + 1 }}. 原句：</strong>{{ item.original_sentence }}</div>
              <div style="margin-bottom: 5px; color: #67c23a;"><strong>修改建议：</strong>{{ item.revised_sentence }}</div>
              <div style="color: #909399;"><strong>原因：</strong>{{ item.reason }}</div>
            </div>
          </div>
          <div v-else>{{ currentRecord.suggestions }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="批阅人">{{ currentRecord.graded_by }}</el-descriptions-item>
        <el-descriptions-item label="批阅时间">
          {{ formatDate(currentRecord.graded_at) }}
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button type="primary" @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getMyRecords, getRecordDetail } from '@/api/records'
import type { GradingRecord } from '@/types'

const loading = ref(false)
const records = ref<GradingRecord[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const detailDialogVisible = ref(false)
const currentRecord = ref<GradingRecord | null>(null)

const avgScore = computed(() => {
  if (records.value.length === 0) return '0'
  const sum = records.value.reduce((acc, r) => acc + r.score, 0)
  return (sum / records.value.length).toFixed(1)
})

const highestScore = computed(() => {
  if (records.value.length === 0) return '0'
  return Math.max(...records.value.map(r => r.score))
})

const loadRecords = async () => {
  loading.value = true
  try {
    const skip = (currentPage.value - 1) * pageSize.value
    const limit = pageSize.value

    const res = await getMyRecords(skip, limit)
    records.value = res.records
    total.value = res.total
  } catch (error: any) {
    ElMessage.error(error.message || '加载记录失败')
  } finally {
    loading.value = false
  }
}

const getScoreType = (score: number) => {
  if (score >= 90) return 'success'
  if (score >= 80) return 'primary'
  if (score >= 60) return 'warning'
  return 'danger'
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return dateStr
  }
}

// 格式化字段为HTML（用于详情页）
const formatFieldHTML = (field: any) => {
  if (!field) return '-'
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field)
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => `<div style="margin-bottom: 5px;">${index + 1}. ${item}</div>`).join('')
      }
      return field.replace(/\n/g, '<br>')
    } catch {
      return field.replace(/\n/g, '<br>')
    }
  }
  return String(field)
}

// 检查建议是否为数组格式
const isSuggestionsArray = (suggestions: any) => {
  if (!suggestions) return false
  if (typeof suggestions === 'string') {
    try {
      const parsed = JSON.parse(suggestions)
      return Array.isArray(parsed) && parsed.length > 0 && parsed[0].original_sentence
    } catch {
      return false
    }
  }
  return false
}

// 解析建议数组
const parseSuggestions = (suggestions: any) => {
  if (!suggestions) return []
  if (typeof suggestions === 'string') {
    try {
      return JSON.parse(suggestions)
    } catch {
      return []
    }
  }
  return suggestions
}

const viewDetail = async (record: GradingRecord) => {
  try {
    const response = await getRecordDetail(record.id)
    // 后端返回的是 { record: {...} } 格式
    currentRecord.value = (response as any).record || response
    detailDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '加载详情失败')
  }
}

onMounted(() => {
  loadRecords()
})
</script>

<style scoped>
.my-records {
  padding: 20px;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #303133;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  margin-bottom: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  margin-right: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.table-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-text {
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>

