<template>
  <div class="student-dashboard">
    <section class="dashboard-hero">
      <div class="hero-copy">
        <h1 class="dashboard-title">{{ studentGreetingName }}，{{ greetingText }}</h1>
        <p class="hero-subtitle">{{ greetingMessage }}</p>
      </div>

      <div class="hero-actions">
        <button class="primary-action primary-action--submit" type="button" @click="goSubmitAssignment">
          <el-icon class="primary-action__icon"><Plus /></el-icon>
          <strong>交作业</strong>
          <span>{{ submitActionText }}</span>
        </button>
        <button class="primary-action primary-action--review" type="button" @click="goReviewResults">
          <el-icon class="primary-action__icon"><DocumentChecked /></el-icon>
          <strong>查看批阅结果</strong>
          <span>{{ reviewActionText }}</span>
        </button>
      </div>
    </section>

    <section class="summary-strip" v-loading="loading">
      <div class="summary-item">
        <span class="summary-label">待交作业</span>
        <strong>{{ studentStats?.pendingAssignments || 0 }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">已提交</span>
        <strong>{{ studentStats?.completedSubmissions || 0 }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">平均得分</span>
        <strong>{{ studentStats?.averageScore || 0 }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">按时率</span>
        <strong>{{ studentStats?.onTimeRate || 0 }}%</strong>
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="work-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">待完成作业</h2>
            <p class="section-subtitle">优先处理快到截止时间的作业。</p>
          </div>
          <el-tag v-if="pendingAssignments.length" type="warning" size="small">
            {{ pendingAssignments.length }} 个待交
          </el-tag>
        </div>

        <div v-loading="loading" class="assignment-list">
          <button
            v-for="item in pendingAssignments.slice(0, 5)"
            :key="item.assignmentId"
            class="assignment-item"
            type="button"
            @click="goToAssignment(item.assignmentId, item.classId)"
          >
            <div class="assignment-main">
              <h3>{{ item.title }}</h3>
              <span>{{ item.className || "未分班级" }}</span>
            </div>
            <div class="assignment-meta" :class="{ 'assignment-meta--urgent': isUrgent(item.endDate) }">
              <el-icon><Clock /></el-icon>
              {{ formatDateTime(item.endDate) }}
            </div>
          </button>

          <div v-if="!loading && pendingAssignments.length === 0" class="empty-state">
            暂时没有待交作业，可以看看最新批阅反馈。
          </div>
        </div>
      </section>

      <section class="work-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">最近批阅</h2>
            <p class="section-subtitle">看完反馈再改，下一次会更稳。</p>
          </div>
          <el-tag v-if="reviewedSubmissions.length" type="success" size="small">
            {{ reviewedSubmissions.length }} 条反馈
          </el-tag>
        </div>

        <div v-loading="loading" class="review-list">
          <button
            v-for="item in reviewedSubmissions.slice(0, 5)"
            :key="item.id"
            class="review-item"
            type="button"
            @click="goToReviewedSubmission(item)"
          >
            <div class="review-main">
              <h3>{{ item.assignmentTitle || "未命名作业" }}</h3>
              <span>{{ formatDateTime(item.submittedAt) }}</span>
            </div>
            <div class="review-score">
              {{ resolveScore(item) }}
              <small>分</small>
            </div>
          </button>

          <div v-if="!loading && reviewedSubmissions.length === 0" class="empty-state">
            还没有批阅结果，提交后老师或 AI 批改完成会出现在这里。
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Clock, DocumentChecked, Plus } from "@element-plus/icons-vue";
import { formatDateTime, isUrgent } from "@/utils/date";
import type { StudentStatsResponse } from "@/api/dashboard";

type PendingAssignment = StudentStatsResponse["pendingAssignmentsList"][number];
type RecentSubmission = StudentStatsResponse["recentSubmissions"][number];

const store = useStore();
const router = useRouter();

const loading = computed(() => store.getters["dashboard/isLoading"]("student"));
const studentStats = computed<StudentStatsResponse | null>(
  () => store.getters["dashboard/studentStats"] || null,
);
const userName = computed(() => store.getters["user/userName"] || "");
const studentGreetingName = computed(() =>
  userName.value ? `${userName.value}同学` : "同学",
);

const pendingAssignments = computed<PendingAssignment[]>(
  () => studentStats.value?.pendingAssignmentsList || [],
);

const reviewedSubmissions = computed<RecentSubmission[]>(() =>
  (studentStats.value?.recentSubmissions || []).filter((item) =>
    ["ai_reviewed", "teacher_reviewed"].includes(item.status),
  ),
);

const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
});

const greetingMessage = computed(() => {
  const pendingCount = pendingAssignments.value.length;
  if (pendingCount > 0) {
    return `今天有 ${pendingCount} 个作业待完成，先把最重要的一件事推进掉。`;
  }
  if (reviewedSubmissions.value.length > 0) {
    return "今天没有待交作业，可以看看批阅结果，把反馈变成下一次的进步。";
  }
  return "今天节奏不错，先浏览作业列表，遇到新任务就及时处理。";
});

const submitActionText = computed(() => {
  const first = pendingAssignments.value[0];
  return first ? `继续：${first.title}` : "查看可提交的作业";
});

const reviewActionText = computed(() => {
  const first = reviewedSubmissions.value[0];
  return first ? `查看：${first.assignmentTitle || "最近反馈"}` : "查看已提交作业";
});

const goSubmitAssignment = () => {
  const first = pendingAssignments.value[0];
  if (first) {
    goToAssignment(first.assignmentId, first.classId);
    return;
  }
  router.push("/student/assignments");
};

const goReviewResults = () => {
  const first = reviewedSubmissions.value[0];
  if (first) {
    goToReviewedSubmission(first);
    return;
  }
  router.push("/student/assignments");
};

const goToAssignment = (assignmentId: string, classId: string) => {
  router.push({
    path: "/student/submissions",
    query: { assignmentId, classId },
  });
};

const goToReviewedSubmission = (submission: RecentSubmission) => {
  if (submission.assignmentId && submission.classId) {
    goToAssignment(submission.assignmentId, submission.classId);
    return;
  }
  router.push("/student/assignments");
};

const resolveScore = (submission: RecentSubmission) => {
  const score = submission.teacherScore ?? submission.aiScore;
  return score ?? "--";
};

onMounted(async () => {
  try {
    await store.dispatch("dashboard/fetchStudentDashboard");
  } catch (error) {
    ElMessage.error("加载学习看板失败");
  }
});
</script>

<style scoped>
.student-dashboard {
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
  margin-bottom: 16px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.hero-copy {
  width: 100%;
  min-width: 0;
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

.primary-action--submit {
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

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-item {
  min-width: 0;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.summary-label {
  display: block;
  color: #6b7280;
  font-size: 13px;
}

.summary-item strong {
  display: block;
  margin-top: 8px;
  color: #111827;
  font-size: 28px;
  line-height: 1;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.work-card {
  min-width: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.section-title {
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

.assignment-list,
.review-list {
  display: grid;
  gap: 10px;
  min-height: 160px;
}

.assignment-item,
.review-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 14px;
  text-align: left;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.assignment-item:hover,
.review-item:hover {
  border-color: #93c5fd;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.assignment-main,
.review-main {
  min-width: 0;
}

.assignment-main h3,
.review-main h3 {
  margin: 0;
  overflow: hidden;
  color: #111827;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignment-main span,
.review-main span {
  display: block;
  margin-top: 5px;
  color: #6b7280;
  font-size: 12px;
}

.assignment-meta {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  color: #4b5563;
  font-size: 13px;
}

.assignment-meta--urgent {
  color: #dc2626;
  font-weight: 700;
}

.review-score {
  flex: 0 0 auto;
  min-width: 64px;
  color: #2563eb;
  font-size: 26px;
  font-weight: 800;
  text-align: right;
}

.review-score small {
  margin-left: 2px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  padding: 18px;
  color: #6b7280;
  text-align: center;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .student-dashboard {
    padding: 16px;
  }

  .dashboard-title {
    font-size: 22px;
  }

  .hero-subtitle {
    font-size: 15px;
  }

  .hero-actions,
  .primary-action {
    width: 100%;
  }

  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .section-header {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .summary-strip {
    grid-template-columns: 1fr;
  }

  .assignment-item,
  .review-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .assignment-meta,
  .review-score {
    width: 100%;
    text-align: left;
  }
}
</style>
