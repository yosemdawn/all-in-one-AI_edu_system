<template>
  <section :class="['assignment-panel', { 'assignment-panel--mobile': mobile }]">
    <div v-if="!selectedClass" class="assignment-panel__empty">
      <el-empty description="请选择班级查看作业" :image-size="120">
        <template #description>
          <p class="assignment-panel__empty-text">先从上方选择一个班级，再查看对应的作业和提交状态。</p>
        </template>
      </el-empty>
    </div>

    <template v-else>
      <div class="assignment-panel__header">
        <div class="assignment-panel__title-block">
          <div class="assignment-panel__title-row">
            <h2 class="assignment-panel__title">{{ selectedClass.name }}</h2>
            <el-button
              type="danger"
              plain
              :icon="Delete"
              :size="mobile ? 'small' : 'default'"
              @click="handleLeaveClassClick"
            >
              退出班级
            </el-button>
          </div>

          <div class="assignment-panel__meta">
            <span>教师：{{ selectedClass.teacherName || "未设置" }}</span>
            <span>人数：{{ selectedClass.studentCount || 0 }}/{{ selectedClass.maxStudents || 60 }}</span>
            <span>邀请码：{{ selectedClass.code }}</span>
          </div>

          <div class="assignment-panel__stats">
            <el-tag type="primary" size="small">总计 {{ classStatistics.totalAssignments }}</el-tag>
            <el-tag type="success" size="small">已提交 {{ classStatistics.submittedCount }}</el-tag>
            <el-tag type="warning" size="small">待办 {{ classStatistics.todoCount }}</el-tag>
            <el-tag type="info" size="small">草稿 {{ classStatistics.draftCount }}</el-tag>
            <el-tag type="danger" size="small">过期 {{ classStatistics.expiredCount }}</el-tag>
            <el-tag size="small">已批改 {{ classStatistics.reviewedCount }}</el-tag>
          </div>
        </div>
      </div>

      <div class="assignment-panel__toolbar">
        <div class="assignment-panel__filters">
          <el-radio-group v-model="assignmentFilter" :size="mobile ? 'small' : 'default'">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="todo">待办</el-radio-button>
            <el-radio-button value="draft">草稿</el-radio-button>
            <el-radio-button value="completed">已提交</el-radio-button>
            <el-radio-button value="expired">已过期</el-radio-button>
          </el-radio-group>
        </div>

        <div class="assignment-panel__search">
          <el-input
            v-model="assignmentSearchKeyword"
            placeholder="搜索作业"
            clearable
            @keyup.enter="handleAssignmentSearch"
            @clear="handleAssignmentClearSearch"
          />
          <el-button :icon="Search" :loading="assignmentSearchLoading" @click="handleAssignmentSearch" />
        </div>
      </div>

      <div class="assignment-panel__content">
        <div v-if="assignmentLoading" class="assignment-panel__loading">
          <el-skeleton v-for="i in 3" :key="i" animated>
            <template #template>
              <div class="assignment-panel__skeleton"></div>
            </template>
          </el-skeleton>
        </div>

        <div v-else-if="assignments.length > 0" class="assignment-list">
          <el-card
            v-for="assignment in assignments"
            :key="assignment._id || assignment.id"
            :class="[
              'assignment-card',
              { 'assignment-card--disabled': assignment.hasSubmittedInOtherClass },
            ]"
            :body-style="{ padding: mobile ? '14px' : '18px' }"
            @click="handleAssignmentClick(assignment)"
          >
            <div class="assignment-card__top">
              <div class="assignment-card__main">
                <div class="assignment-card__title-row">
                  <h3 class="assignment-card__title">{{ assignment.title }}</h3>
                  <div class="assignment-card__badges">
                    <el-tag
                      v-if="assignment.hasSubmitted"
                      type="success"
                      size="small"
                      effect="light"
                    >
                      已提交
                    </el-tag>
                    <el-tag
                      v-else-if="assignment.hasSubmittedInOtherClass"
                      type="danger"
                      size="small"
                      effect="light"
                    >
                      其他班级已提交
                    </el-tag>
                    <el-tag
                      v-else-if="assignment.hasDraft"
                      type="info"
                      size="small"
                      effect="light"
                    >
                      有草稿
                    </el-tag>
                    <el-tag v-else type="warning" size="small" effect="light">
                      待提交
                    </el-tag>

                    <el-tag
                      v-if="assignment.hasSubmitted && assignment.submissionStatus"
                      :type="getReviewStatusType(assignment.submissionStatus)"
                      size="small"
                      effect="light"
                    >
                      {{ getReviewStatusText(assignment.submissionStatus) }}
                    </el-tag>

                    <el-tag
                      v-if="isAssignmentExpired(assignment)"
                      type="danger"
                      size="small"
                      effect="light"
                    >
                      已过期
                    </el-tag>
                    <el-tag
                      v-else
                      :type="getAssignmentStatusType(assignment.status)"
                      size="small"
                      effect="light"
                    >
                      {{ getAssignmentStatusText(assignment.status) }}
                    </el-tag>
                  </div>
                </div>

                <div class="assignment-card__meta">
                  <span>开始：{{ formatDate(assignment.startDate, mobile ? "datetime" : "full") }}</span>
                  <span>截止：{{ formatDate(assignment.endDate, mobile ? "datetime" : "full") }}</span>
                </div>

                <div
                  v-if="assignment.hasSubmittedInOtherClass && assignment.otherClassSubmission"
                  class="assignment-card__warning"
                >
                  已在“{{ assignment.otherClassSubmission.className }}”提交，
                  {{
                    assignment.otherClassSubmission.submittedAt
                      ? formatDate(assignment.otherClassSubmission.submittedAt, "datetime")
                      : "请切换到对应班级查看"
                  }}
                </div>
              </div>

              <el-icon
                class="assignment-card__icon"
                :size="mobile ? 18 : 22"
                :color="getAssignmentIconColor(assignment)"
              >
                <component :is="getAssignmentIcon(assignment)" />
              </el-icon>
            </div>
          </el-card>
        </div>

        <div v-else class="assignment-panel__empty">
          <el-empty description="该班级暂无作业" :image-size="120">
            <template #description>
              <p class="assignment-panel__empty-text">老师还没有向这个班级发布作业。</p>
            </template>
          </el-empty>
        </div>
      </div>

      <div v-if="assignments.length > 0" class="assignment-panel__pagination">
        <el-pagination
          :current-page="assignmentPageState.page"
          :page-size="assignmentPageState.limit"
          :page-sizes="mobile ? [5, 10, 20] : [5, 10, 20, 50]"
          :layout="mobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
          :total="assignmentPageState.total"
          background
          small
          @size-change="handleAssignmentSizeChange"
          @current-change="handleAssignmentPageChange"
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { inject, reactive, ref, watch, type Ref } from "vue";
import { ElMessage } from "element-plus";
import { Delete, Search } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import {
  getMyAssignments,
  getMyAssignmentStatistics,
} from "../../../../api/assignments";
import { useAssignmentManagement } from "../composables/useAssignmentManagement";
import { useClassManagement } from "../composables/useClassManagement";

interface Props {
  mobile?: boolean;
}

defineProps<Props>();

const router = useRouter();

const { formatDate, handleLeaveClass } = useClassManagement();
const {
  getAssignmentStatusType,
  getAssignmentStatusText,
  isAssignmentExpired,
  getAssignmentIcon,
  getAssignmentIconColor,
} = useAssignmentManagement();

const selectedClass = inject<Ref<any>>("selectedClass")!;
const setSelectedClass = inject<(classItem: any) => void>("setSelectedClass")!;
const refreshClassList = inject<() => void>("refreshClassList")!;

const assignmentLoading = ref(false);
const assignmentSearchLoading = ref(false);
const assignments = ref<any[]>([]);
const assignmentSearchKeyword = ref("");
const assignmentFilter = ref("all");
const assignmentPageState = reactive({
  page: 1,
  limit: 10,
  total: 0,
});

const classStatistics = ref({
  totalAssignments: 0,
  submittedCount: 0,
  todoCount: 0,
  draftCount: 0,
  expiredCount: 0,
  reviewedCount: 0,
});

const loadClassStatistics = async (classId: string) => {
  if (!classId) return;
  try {
    classStatistics.value = await getMyAssignmentStatistics(classId);
  } catch (error) {
    console.error("加载班级统计失败:", error);
  }
};

const loadAssignments = async (
  classId: string,
  search?: string,
  businessStatus?: string
) => {
  if (!classId) return;

  assignmentLoading.value = true;
  try {
    const response = await getMyAssignments({
      classId,
      page: assignmentPageState.page,
      pageSize: assignmentPageState.limit,
      sort: "startDate",
      order: "desc",
      ...(search ? { search } : {}),
      ...(businessStatus && businessStatus !== "all" ? { businessStatus } : {}),
    });

    assignments.value = response.items || [];
    assignmentPageState.total = response.total || 0;
    await loadClassStatistics(classId);
  } catch (error) {
    console.error("加载作业列表失败:", error);
    ElMessage.error("加载作业列表失败");
  } finally {
    assignmentLoading.value = false;
    assignmentSearchLoading.value = false;
  }
};

const handleAssignmentSizeChange = (limit: number) => {
  assignmentPageState.limit = limit;
  assignmentPageState.page = 1;
  void loadAssignments(
    selectedClass.value?._id,
    assignmentSearchKeyword.value.trim(),
    assignmentFilter.value
  );
};

const handleAssignmentPageChange = (page: number) => {
  assignmentPageState.page = page;
  void loadAssignments(
    selectedClass.value?._id,
    assignmentSearchKeyword.value.trim(),
    assignmentFilter.value
  );
};

const handleAssignmentSearch = async () => {
  if (!selectedClass.value || assignmentSearchLoading.value) return;
  assignmentSearchLoading.value = true;
  assignmentPageState.page = 1;
  await loadAssignments(
    selectedClass.value._id,
    assignmentSearchKeyword.value.trim(),
    assignmentFilter.value
  );
};

const handleAssignmentClearSearch = async () => {
  if (!selectedClass.value) return;
  assignmentSearchKeyword.value = "";
  assignmentPageState.page = 1;
  await loadAssignments(selectedClass.value._id, "", assignmentFilter.value);
};

const getReviewStatusType = (status: string) => {
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

const getReviewStatusText = (status: string) => {
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

const goToAssignment = (assignment: any) => {
  void router.push({
    path: "/student/submissions",
    query: {
      assignmentId: assignment.id,
      classId: selectedClass.value._id,
    },
  });
};

const handleAssignmentClick = (assignment: any) => {
  if (assignment.hasSubmittedInOtherClass) {
    const className = assignment.otherClassSubmission?.className || "其他班级";
    ElMessage.warning(`该作业已在“${className}”提交，无法重复提交。`);
    return;
  }

  goToAssignment(assignment);
};

watch(assignmentFilter, () => {
  if (!selectedClass.value) return;
  assignmentPageState.page = 1;
  void loadAssignments(
    selectedClass.value._id,
    assignmentSearchKeyword.value.trim(),
    assignmentFilter.value
  );
});

watch(
  selectedClass,
  (classItem) => {
    if (!classItem) return;
    assignmentPageState.page = 1;
    assignmentSearchKeyword.value = "";
    void loadAssignments(classItem._id, "", assignmentFilter.value);
  },
  { immediate: true }
);

const handleLeaveClassClick = () => {
  if (!selectedClass.value?._id) {
    ElMessage.warning("请先选择要退出的班级");
    return;
  }

  void handleLeaveClass(selectedClass.value._id, () => {
    setSelectedClass(null);
    refreshClassList();
  });
};
</script>

<style scoped>
.assignment-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.assignment-panel__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.assignment-panel__empty-text {
  margin: 0;
  color: #6b7280;
}

.assignment-panel__header {
  padding: 18px 20px;
  border-bottom: 1px solid #eef2f7;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.assignment-panel__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.assignment-panel__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.assignment-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 12px;
}

.assignment-panel__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.assignment-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
}

.assignment-panel__filters {
  min-width: 0;
  overflow-x: auto;
}

.assignment-panel__search {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  width: 320px;
  flex-shrink: 0;
}

.assignment-panel__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  background: #f8fafc;
}

.assignment-panel__loading {
  display: grid;
  gap: 12px;
}

.assignment-panel__skeleton {
  height: 128px;
  border-radius: 16px;
  background: #e5e7eb;
}

.assignment-list {
  display: grid;
  gap: 12px;
}

.assignment-card {
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.assignment-card:hover {
  transform: translateY(-1px);
  border-color: #93c5fd;
  box-shadow: 0 8px 22px rgba(59, 130, 246, 0.1);
}

.assignment-card--disabled {
  cursor: not-allowed;
  opacity: 0.72;
  background: #f8fafc;
}

.assignment-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.assignment-card__main {
  min-width: 0;
  flex: 1;
}

.assignment-card__title-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.assignment-card__title {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 600;
  color: #111827;
}

.assignment-card__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.assignment-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 12px;
  color: #6b7280;
  font-size: 13px;
}

.assignment-card__warning {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  line-height: 1.6;
}

.assignment-card__icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.assignment-panel__pagination {
  padding: 12px 16px 16px;
  border-top: 1px solid #eef2f7;
  background: #fff;
  display: flex;
  justify-content: center;
}

@media (max-width: 768px) {
  .assignment-panel__header,
  .assignment-panel__toolbar,
  .assignment-panel__content {
    padding-left: 14px;
    padding-right: 14px;
  }

  .assignment-panel__title {
    font-size: 18px;
  }

  .assignment-panel__title-row,
  .assignment-panel__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .assignment-panel__toolbar {
    gap: 12px;
  }

  .assignment-panel__filters {
    padding-bottom: 4px;
  }

  .assignment-panel__search {
    width: 100%;
  }

  .assignment-card__top,
  .assignment-card__title-row {
    flex-direction: column;
  }

  .assignment-card__badges {
    justify-content: flex-start;
  }

  .assignment-card__meta {
    flex-direction: column;
    gap: 8px;
  }

  .assignment-panel__pagination :deep(.el-pagination) {
    width: 100%;
    justify-content: center;
  }
}
</style>
