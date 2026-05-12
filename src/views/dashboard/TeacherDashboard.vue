<template>
  <div class="teacher-dashboard">
    <section class="dashboard-hero">
      <div class="hero-copy">
        <h1 class="dashboard-title">👋 {{ greetingText }}，{{ userName }}老师</h1>
        <p class="hero-subtitle">
          {{ greetingMessage }}
        </p>
      </div>
 
      <div class="hero-actions">
        <button class="primary-action primary-action--publish" type="button" @click="createAssignment">
          <el-icon class="primary-action__icon"><Plus /></el-icon>
          <strong>发布作业</strong>
          <span>创建作业并发送给班级</span>
        </button>
        <button class="primary-action primary-action--review" type="button" @click="viewAllSubmissions">
          <el-icon class="primary-action__icon"><DocumentChecked /></el-icon>
          <strong>批改作业</strong>
          <span>查看提交并写评语</span>
        </button>
      </div>
    </section>

    <section class="class-progress-card">
      <div class="section-header">
        <div>
          <h2 class="section-title">班级作业提交情况</h2>
          <p class="section-subtitle">
            按班级汇总已发布作业的提交率，优先处理提交率低或待批改多的班级。
          </p>
        </div>
        <el-button type="primary" plain @click="viewClassSubmissionDetails">
          查看班级详情
        </el-button>
      </div>

      <div class="class-progress-list" v-loading="loading">
        <button
          v-for="item in classSubmissionData"
          :key="item.classId"
          class="class-progress-item"
          type="button"
          @click="viewMyClasses"
        >
          <div class="class-progress-main">
            <div class="class-progress-title-row">
              <h3 class="class-name">{{ item.name }}</h3>
              <strong class="class-percent" :class="getRateClass(item.value)">
                {{ item.value }}%
              </strong>
            </div>
            <div class="progress-bar" aria-hidden="true">
              <div
                class="progress-fill"
                :class="getRateClass(item.value)"
                :style="{ width: `${Math.min(item.value, 100)}%` }"
              ></div>
            </div>
            <div class="class-progress-meta">
              <span>{{ item.submittedCount }}/{{ item.expectedSubmissions }} 份已提交</span>
              <span>{{ item.assignmentCount }} 份作业</span>
              <span>{{ item.totalStudents }} 名学生</span>
            </div>
          </div>
        </button>

        <div v-if="!loading && classSubmissionData.length === 0" class="empty-state">
          暂无班级作业数据，先新建作业或创建班级。
        </div>
      </div>
    </section>

    <div class="tables-grid-two">
      <div class="table-card">
        <div class="table-header">
          <h3 class="table-title">我的作业</h3>
          <el-button type="primary" size="small" @click="viewAllAssignments">
            查看全部
          </el-button>
        </div>
        <el-table
          :data="(pendingTasks?.assignments || []).slice(0, 5)"
          style="width: 100%"
          :loading="loading"
          empty-text="暂无需要关注的作业"
          table-layout="fixed"
        >
          <el-table-column
            prop="title"
            label="作业名"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="classCount"
            label="班级"
            width="70"
            align="center"
          >
            <template #default="{ row }"> {{ row.classCount }}班 </template>
          </el-table-column>
          <el-table-column
            prop="submissionRate"
            label="提交率"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              <span class="table-rate" :class="{ 'table-rate--low': row.submissionRate < 60 }">
                {{ row.submissionRate }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="getAssignmentStatusType(row.status)" size="small">
                {{ getAssignmentStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="endDate"
            label="截止时间"
            width="110"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="deadline" :class="{ 'deadline--urgent': isUrgent(row.endDate) }">
                {{ formatDateTime(row.endDate) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="76" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewAssignment(row.id)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3 class="table-title">待批改提交</h3>
          <div class="table-header-right">
            <el-tag v-if="teacherStats?.pendingReviews" type="warning" size="small">
              {{ teacherStats.pendingReviews }} 份待批改
            </el-tag>
            <el-button type="primary" size="small" @click="viewAllSubmissions">
              查看更多
            </el-button>
          </div>
        </div>
        <el-table
          :data="(pendingTasks?.submissions || []).slice(0, 5)"
          style="width: 100%"
          :loading="loading"
          empty-text="暂无待处理提交"
          table-layout="fixed"
        >
          <el-table-column
            prop="studentName"
            label="学生"
            width="80"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="assignmentTitle"
            label="作业"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column prop="aiScore" label="AI分" width="70" align="center">
            <template #default="{ row }">
              <span v-if="row.aiScore" class="ai-score">{{ row.aiScore }}分</span>
              <span v-else class="no-score">--</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="82" align="center">
            <template #default="{ row }">
              <el-tag :type="getSubmissionStatusType(row.status)" size="small">
                {{ getSubmissionStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="submittedAt"
            label="提交时间"
            width="92"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatRelativeTime(row.submittedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="76" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="reviewSubmission(row.assignmentId)">
                批改
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Plus, DocumentChecked } from "@element-plus/icons-vue";
import { formatDateTime, formatRelativeTime, isUrgent } from "@/utils/date";
import { getTeacherPendingTasks } from "@/api/dashboard";

const store = useStore();
const router = useRouter();

const pendingTasks = ref<any>(null);

const loading = computed(() => store.getters["dashboard/isLoading"]("teacher"));
const teacherStats = computed(() => store.getters["dashboard/teacherStats"]);
const userName = computed(() => store.getters["user/userName"] || "教师");

const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 5) return "凌晨好";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
});

const greetingMessage = computed(() => {
  const hour = new Date().getHours();
  const pendingCount = teacherStats.value?.pendingReviews || 0;
  const assignmentText = pendingCount
    ? `今天有 ${pendingCount} 份作业等待您的审阅。`
    : "今天暂无待批改作业。";

  if (hour < 5) return `凌晨还在批改卷子，辛苦了，注意身体。${assignmentText}`;
  if (hour < 11) return `${assignmentText}开启高效教学的一天吧。`;
  if (hour < 14) return `中午也别忘了休息一下。${assignmentText}`;
  if (hour < 18) return `${assignmentText}处理完关键任务，就能更从容收尾。`;
  return `晚上好，辛苦一天了。${assignmentText}`;
});

const classSubmissionData = computed(() => {
  if (!teacherStats.value?.classSubmissionStats) return [];

  return teacherStats.value.classSubmissionStats
    .map((item) => ({
      classId: item.classId,
      name: item.className,
      value: Math.min(100, Math.round((item.submissionRate || 0) * 10) / 10),
      totalStudents: item.totalStudents || 0,
      submittedCount: item.submittedCount || 0,
      assignmentCount: item.assignmentCount || 0,
      expectedSubmissions: item.expectedSubmissions || 0,
    }))
    .sort((a, b) => a.value - b.value);
});

const loadPendingTasks = async () => {
  try {
    pendingTasks.value = await getTeacherPendingTasks();
  } catch (error) {
    console.error("加载待处理任务失败:", error);
  }
};

const viewMyClasses = () => {
  router.push("/teacher/classes");
};

const createAssignment = () => {
  router.push("/teacher/assignmentsEdit");
};

const viewAllAssignments = () => {
  router.push("/teacher/assignments");
};

const viewAllSubmissions = () => {
  router.push("/teacher/assignments");
};

const viewAssignment = (assignmentId: string) => {
  router.push(`/teacher/assignments/detail?id=${assignmentId}`);
};

const reviewSubmission = (assignmentId: string) => {
  if (assignmentId) {
    router.push(
      `/teacher/assignments/detail?id=${assignmentId}&openFirstPending=true`
    );
  } else {
    router.push("/teacher/assignments");
  }
};

const viewClassSubmissionDetails = () => {
  router.push("/teacher/classes?tab=submission-stats");
};

const getRateClass = (rate: number) => {
  if (rate >= 90) return "rate-excellent";
  if (rate >= 70) return "rate-good";
  if (rate >= 50) return "rate-normal";
  return "rate-poor";
};

const getAssignmentStatusType = (status: string) => {
  const typeMap: Record<
    string,
    "success" | "warning" | "info" | "primary" | "danger"
  > = {
    draft: "info",
    published: "success",
    terminated: "danger",
  };
  return typeMap[status] || "info";
};

const getAssignmentStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    draft: "草稿",
    published: "发布中",
    terminated: "已终止",
  };
  return textMap[status] || status;
};

const getSubmissionStatusType = (status: string) => {
  const typeMap: Record<
    string,
    "success" | "warning" | "info" | "primary" | "danger"
  > = {
    submitted: "warning",
    ai_reviewed: "primary",
    teacher_reviewed: "success",
  };
  return typeMap[status] || "info";
};

const getSubmissionStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    submitted: "已提交",
    ai_reviewed: "AI批改",
    teacher_reviewed: "教师批改",
  };
  return textMap[status] || status;
};

onMounted(async () => {
  try {
    await Promise.all([
      store.dispatch("dashboard/fetchTeacherDashboard"),
      loadPendingTasks(),
    ]);
  } catch (error) {
    ElMessage.error("加载看板数据失败");
  }
});
</script>

<style scoped>
.teacher-dashboard {
  min-height: 100%;
  padding: 24px;
  background: #f6f7fb;
  overflow-x: hidden;
}

.dashboard-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 18px;
  padding: 22px 24px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.hero-copy {
  min-width: 0;
  width: 100%;
}

.dashboard-title {
  margin: 0;
  color: #111827;
  font-size: 32px;
  font-weight: 800;
  line-height: 1.2;
}

.hero-subtitle {
  margin: 10px 0 0;
  color: #5b6472;
  font-size: 18px;
  line-height: 1.5;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  width: 100%;
}

.primary-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  width: min(360px, 100%);
  min-height: 150px;
  padding: 24px;
  color: #ffffff;
  text-align: left;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.primary-action:hover {
  filter: brightness(1.02);
  transform: translateY(-2px);
}

.primary-action--publish {
  background: #16a34a;
  box-shadow: 0 14px 28px rgba(22, 163, 74, 0.24);
}

.primary-action--review {
  background: #2563eb;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.24);
}

.primary-action__icon {
  margin-bottom: 14px;
  font-size: 28px;
}

.primary-action strong {
  font-size: 28px;
  line-height: 1.2;
}

.primary-action span {
  margin-top: 10px;
  font-size: 15px;
  opacity: 0.9;
}

.class-progress-card,
.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.class-progress-card {
  padding: 22px;
  margin-bottom: 16px;
}

.section-header,
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-title,
.table-title {
  margin: 0;
  color: #111827;
  font-size: 18px;
  font-weight: 700;
}

.section-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.class-progress-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-height: 120px;
}

.class-progress-item {
  display: block;
  width: 100%;
  padding: 16px;
  text-align: left;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.class-progress-item:hover {
  border-color: #93c5fd;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.class-progress-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 14px;
}

.class-name {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.class-percent {
  flex: 0 0 auto;
  font-size: 28px;
  line-height: 1;
}

.progress-bar {
  height: 10px;
  margin-top: 14px;
  overflow: hidden;
  background: #e5e7eb;
  border-radius: 999px;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.25s ease;
}

.class-progress-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  color: #6b7280;
  font-size: 12px;
}

.rate-excellent {
  color: #16a34a;
}

.progress-fill.rate-excellent {
  background: #16a34a;
}

.rate-good {
  color: #2563eb;
}

.progress-fill.rate-good {
  background: #2563eb;
}

.rate-normal {
  color: #d97706;
}

.progress-fill.rate-normal {
  background: #f59e0b;
}

.rate-poor {
  color: #dc2626;
}

.progress-fill.rate-poor {
  background: #ef4444;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}

.tables-grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.table-card {
  min-width: 0;
  padding: 20px;
  overflow: hidden;
}

.table-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-card :deep(.el-table) {
  overflow: hidden;
}

.table-card :deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

.table-rate {
  color: #16a34a;
  font-weight: 700;
}

.table-rate--low,
.deadline--urgent {
  color: #dc2626;
}

.deadline {
  color: #4b5563;
  font-size: 13px;
}

.ai-score {
  color: #2563eb;
  font-weight: 700;
}

.no-score {
  color: #9ca3af;
}

@media (max-width: 1200px) {
  .class-progress-list,
  .tables-grid-two {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .teacher-dashboard {
    padding: 16px;
  }

  .dashboard-title {
    font-size: 22px;
  }

  .section-header,
  .table-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-actions,
  .primary-action {
    width: 100%;
  }

  .class-percent {
    font-size: 24px;
  }
}
</style>
