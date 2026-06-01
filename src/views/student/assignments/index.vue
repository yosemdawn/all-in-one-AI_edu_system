<template>
  <div class="student-assignments-page">
    <PageHeader title="我的作业">
      <template #actions>
        <div class="student-assignments-page__actions">
          <el-select
            v-model="queryParams.businessStatus"
            placeholder="状态筛选"
            @change="handleFilterChange"
          >
            <el-option label="全部" value="all" />
            <el-option label="待完成" value="todo" />
            <el-option label="已提交" value="completed" />
            <el-option label="草稿" value="draft" />
            <el-option label="已过期" value="expired" />
          </el-select>
          <el-button :loading="loading" @click="loadData">刷新</el-button>
        </div>
      </template>
    </PageHeader>

    <el-card v-if="!loading" class="stats-card">
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总数</span>
          <span class="stat-value">{{ statistics.totalAssignments }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">已提交</span>
          <span class="stat-value">{{ statistics.submittedCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">待办</span>
          <span class="stat-value">{{ statistics.todoCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">草稿</span>
          <span class="stat-value">{{ statistics.draftCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">过期</span>
          <span class="stat-value text-danger">{{ statistics.expiredCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">已批改</span>
          <span class="stat-value">{{ statistics.reviewedCount }}</span>
        </div>
      </div>
    </el-card>

    <div v-loading="loading" class="assignment-body">
      <el-empty v-if="!loading && assignments.length === 0" description="暂无作业信息" />

      <div v-else-if="isMobile" class="assignment-card-list">
        <el-card
          v-for="assignment in assignments"
          :key="assignment.id"
          class="assignment-card"
          :body-style="{ padding: '14px' }"
        >
          <div class="assignment-card__header">
            <div class="assignment-card__header-main">
              <h3 class="assignment-card__title">{{ assignment.title }}</h3>
              <p class="assignment-card__class">{{ assignment.className }}</p>
            </div>
            <el-button type="primary" size="small" @click="viewAssignment(assignment)">
              {{ getActionText(assignment) }}
            </el-button>
          </div>

          <div class="assignment-card__meta">
            <span>教师：{{ assignment.teacherName || "-" }}</span>
            <span>截止：{{ formatDate(assignment.endDate) }}</span>
          </div>

          <div class="assignment-card__tags">
            <el-tag :type="getSubmissionStatusType(assignment)">
              {{ getSubmissionStatusText(assignment) }}
            </el-tag>
            <el-tag
              v-if="assignment.hasSubmitted"
              :type="getReviewStatusType(assignment.submissionStatus)"
            >
              {{ getReviewStatusText(assignment.submissionStatus) }}
            </el-tag>
            <el-tag :type="assignment.isExpired ? 'danger' : 'success'" size="small">
              {{ assignment.isExpired ? "已过期" : "进行中" }}
            </el-tag>
            <el-tag
              v-if="assignment.assignmentType === 'online'"
              type="primary"
              size="small"
              effect="plain"
            >
              在线作业
            </el-tag>
          </div>
        </el-card>
      </div>

      <AdaptiveTableContainer
        v-else
        :loading="loading"
        loading-text="加载中..."
        :recalculate-trigger="recalculateTrigger"
      >
        <template #table="{ tableHeight }">
          <el-table
            :data="assignments"
            :style="{ width: '100%', height: tableHeight }"
            :max-height="tableHeight"
          >
            <el-table-column prop="title" label="作业标题" min-width="220" />
            <el-table-column prop="className" label="班级" width="120" />
            <el-table-column prop="teacherName" label="教师" width="110" />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag
                  :type="row.assignmentType === 'online' ? 'primary' : 'info'"
                  size="small"
                  effect="plain"
                >
                  {{ row.assignmentType === "online" ? "在线" : "普通" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="endDate" label="截止时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.endDate) }}
              </template>
            </el-table-column>
            <el-table-column label="提交状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getSubmissionStatusType(row)">
                  {{ getSubmissionStatusText(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="批改状态" width="120">
              <template #default="{ row }">
                <el-tag
                  v-if="row.hasSubmitted"
                  :type="getReviewStatusType(row.submissionStatus)"
                >
                  {{ getReviewStatusText(row.submissionStatus) }}
                </el-tag>
                <span class="text-gray-400">-</span>
              </template>
            </el-table-column>
            <el-table-column label="作业状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.isExpired ? 'danger' : 'success'" size="small">
                  {{ row.isExpired ? "已过期" : "进行中" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="viewAssignment(row)">
                  {{ getActionText(row) }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </AdaptiveTableContainer>
    </div>

    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        :current-page="queryParams.page"
        :page-size="queryParams.pageSize"
        :page-sizes="isMobile ? [10, 20] : [10, 20, 50]"
        :layout="isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import {
  getMyAssignments,
  getMyAssignmentStatistics,
} from "../../../api/assignments";
import AdaptiveTableContainer from "@/components/AdaptiveTableContainer.vue";
import PageHeader from "@/components/PageHeader.vue";
import type { StudentAssignmentListItem } from "../../../types/assignments";

const router = useRouter();
const store = useStore();

const isMobile = computed(() => store.getters["app/isMobile"]);
const loading = ref(false);
const assignments = ref<StudentAssignmentListItem[]>([]);
const total = ref(0);
const recalculateTrigger = ref(0);

const queryParams = reactive({
  page: 1,
  pageSize: 10,
  businessStatus: "all" as "all" | "todo" | "completed" | "draft" | "expired",
});

const statistics = ref({
  totalAssignments: 0,
  submittedCount: 0,
  todoCount: 0,
  draftCount: 0,
  expiredCount: 0,
  reviewedCount: 0,
});

const loadAssignments = async () => {
  try {
    loading.value = true;
    const data = await getMyAssignments({
      ...queryParams,
      businessStatus:
        queryParams.businessStatus === "all"
          ? undefined
          : queryParams.businessStatus,
    });
    assignments.value = data.items || [];
    total.value = data.total || 0;
    recalculateTrigger.value += 1;
  } catch (error) {
    console.error("加载作业列表失败:", error);
    ElMessage.error("加载作业列表失败");
  } finally {
    loading.value = false;
  }
};

const loadStatistics = async () => {
  try {
    statistics.value = await getMyAssignmentStatistics();
  } catch (error) {
    console.error("加载作业统计失败:", error);
  }
};

const loadData = async () => {
  await Promise.all([loadAssignments(), loadStatistics()]);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getSubmissionStatusType = (row: StudentAssignmentListItem) => {
  if (row.hasDraft && !row.hasSubmitted) return "warning";
  if (row.hasSubmitted) return "success";
  if (row.isExpired) return "danger";
  return "info";
};

const getSubmissionStatusText = (row: StudentAssignmentListItem) => {
  if (row.hasDraft && !row.hasSubmitted) return "草稿";
  if (row.hasSubmitted) return "已提交";
  if (row.isExpired) return "未提交";
  return "待提交";
};

const getReviewStatusType = (status?: string) => {
  switch (status) {
    case "teacher_reviewed":
      return "success";
    case "ai_reviewed":
      return "warning";
    case "submitted":
      return "info";
    default:
      return "info";
  }
};

const getReviewStatusText = (status?: string) => {
  switch (status) {
    case "teacher_reviewed":
      return "教师已批改";
    case "ai_reviewed":
      return "AI 已批改";
    case "submitted":
      return "待批改";
    default:
      return "待批改";
  }
};

const getActionText = (row: StudentAssignmentListItem) => {
  if (row.hasSubmitted) return "查看详情";
  if (row.hasDraft) return "继续编辑";
  return "开始作业";
};

const viewAssignment = (assignment: StudentAssignmentListItem) => {
  if (assignment.assignmentType === "online") {
    void router.push({
      path: "/student/online-assignment",
      query: {
        assignmentId: assignment.id,
        classId: assignment.classId,
      },
    });
    return;
  }

  if (assignment.hasSubmitted || assignment.hasDraft) {
    void router.push({
      path: "/student/submissions",
      query: {
        assignmentId: assignment.id,
        classId: assignment.classId,
      },
    });
    return;
  }

  void router.push({
    path: "/student/assignments/detail",
    query: {
      assignmentId: assignment.id,
      classId: assignment.classId,
    },
  });
};

const handleFilterChange = () => {
  queryParams.page = 1;
  void loadAssignments();
};

const handleSizeChange = (size: number) => {
  queryParams.pageSize = size;
  queryParams.page = 1;
  void loadAssignments();
};

const handleCurrentChange = (page: number) => {
  queryParams.page = page;
  void loadAssignments();
};

onMounted(() => {
  void loadData();
});
</script>

<style scoped>
.student-assignments-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.student-assignments-page__actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.student-assignments-page__actions :deep(.el-select) {
  width: 160px;
}

.stats-card {
  border-radius: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 14px 10px;
  border-radius: 12px;
  background: #f8fafc;
}

.stat-label {
  display: block;
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 12px;
}

.stat-value {
  display: block;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  color: #111827;
}

.text-danger {
  color: #dc2626;
}

.assignment-body {
  min-height: 280px;
}

.assignment-card-list {
  display: grid;
  gap: 12px;
}

.assignment-card {
  border-radius: 14px;
}

.assignment-card__header {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
}

.assignment-card__header-main {
  min-width: 0;
  flex: 1;
}

.assignment-card__title {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 600;
  color: #111827;
}

.assignment-card__class {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.assignment-card__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  color: #6b7280;
  font-size: 13px;
}

.assignment-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

@media (max-width: 768px) {
  .student-assignments-page {
    gap: 12px;
  }

  .student-assignments-page__actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .student-assignments-page__actions :deep(.el-select) {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-item {
    padding: 12px 8px;
  }

  .stat-value {
    font-size: 18px;
  }

  .assignment-card__header {
    flex-direction: column;
  }

  .assignment-card__header .el-button {
    width: 100%;
  }
}
</style>
