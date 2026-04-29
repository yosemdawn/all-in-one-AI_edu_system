<template>
  <div class="dashboard">
    <h2 class="page-title">📊 数据概览</h2>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon student">👨‍🎓</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalStudents }}</div>
              <div class="stat-label">学生总数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon record">📝</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalRecords }}</div>
              <div class="stat-label">批阅记录</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon active">✅</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.activeStudents }}</div>
              <div class="stat-label">活跃学生</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon avg">⭐</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.avgScore }}</div>
              <div class="stat-label">平均分数</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近批阅记录 -->
    <el-card class="recent-records" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>📋 最近批阅记录</span>
          <el-button type="primary" link @click="viewAllRecords">查看全部</el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="recentRecords"
        style="width: 100%"
        stripe
      >
        <el-table-column prop="student_name" label="学生姓名" width="120" />
        <el-table-column prop="essay_id" label="作文ID" width="100" />
        <el-table-column prop="score" label="分数" width="80">
          <template #default="{ row }">
            <el-tag :type="getScoreType(row.score)">{{ row.score }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="advantages" label="优点" show-overflow-tooltip />
        <el-table-column prop="graded_at" label="批阅时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.graded_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row.id)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getUserList } from '@/api/users'
import { getAllRecords } from '@/api/records'
import type { GradingRecord } from '@/types'

const router = useRouter()

const loading = ref(false)
const stats = ref({
  totalStudents: 0,
  totalRecords: 0,
  activeStudents: 0,
  avgScore: '0'
})
const recentRecords = ref<GradingRecord[]>([])

const loadStats = async () => {
  loading.value = true
  try {
    // 获取学生统计
    const usersRes = await getUserList({ role: 'student' })
    stats.value.totalStudents = usersRes.total
    stats.value.activeStudents = usersRes.users.filter(u => u.is_active).length

    // 获取批阅记录统计
    const recordsRes = await getAllRecords(0, 10)
    stats.value.totalRecords = recordsRes.total
    recentRecords.value = recordsRes.records

    // 计算平均分
    if (recordsRes.records.length > 0) {
      const totalScore = recordsRes.records.reduce((sum, r) => sum + r.score, 0)
      stats.value.avgScore = (totalScore / recordsRes.records.length).toFixed(1)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载数据失败')
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
  return new Date(dateStr).toLocaleString('zh-CN')
}

const viewAllRecords = () => {
  router.push('/admin/records')
}

const viewDetail = (recordId: number) => {
  router.push(`/admin/records?id=${recordId}`)
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard {
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
}

.stat-icon.student {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.record {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.active {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.avg {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
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

.recent-records {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

