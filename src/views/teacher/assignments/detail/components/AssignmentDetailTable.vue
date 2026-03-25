<template>
  <div class="assignment-detail-table">
    <div class="table-container">
      <el-table
        :data="submissionData"
        :height="maxHeight"
        border
        style="width: 100%"
        empty-text="暂无学生提交数据"
        :scroll-x="true"
      >
        <!-- 序号 -->
        <el-table-column type="index" label="序号" width="60" />

        <!-- 学生信息（头像+姓名+学号合并列） -->
        <el-table-column label="学生信息" width="200">
          <template #default="{ row }">
            <div class="student-info">
              <el-avatar :size="36" class="student-avatar">
                {{ row.studentName?.charAt(0) || "?" }}
              </el-avatar>
              <div class="student-details">
                <div class="student-name">
                  {{ row.studentName || "未知学生" }}
                </div>
                <div class="student-number">
                  {{ row.studentNumber || "无学号" }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 所属班级 -->
        <el-table-column
          label="所属班级"
          prop="className"
          width="120"
          show-overflow-tooltip
        />

        <!-- 提交状态 -->
        <el-table-column label="提交状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getSubmissionStatusType(row.status)"
              size="small"
              effect="light"
            >
              {{ getSubmissionStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 提交时间 -->
        <el-table-column label="提交时间" width="150" align="center">
          <template #default="{ row }">
            <div v-if="row.submittedAt" class="time-text">
              {{ formatDateTime(row.submittedAt) }}
            </div>
            <span v-else class="no-data">未提交</span>
          </template>
        </el-table-column>

        <!-- 内容预览 -->
        <el-table-column label="内容预览" show-overflow-tooltip>
          <template #default="{ row }">
            <div
              v-if="row.content"
              class="content-preview"
              :title="row.content"
            >
              {{ getContentPreview(row.content) }}
            </div>
            <span v-else class="no-data">无内容</span>
          </template>
        </el-table-column>

        <!-- 字数统计 -->
        <el-table-column label="字数统计" width="90" align="center">
          <template #default="{ row }">
            <div v-if="row.content">
              <span class="word-count">{{ getWordCount(row.content) }}</span>
              <span class="word-unit">字</span>
            </div>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <!-- 批改状态 -->
        <el-table-column label="批改状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getGradingStatusType(row.status)"
              size="small"
              effect="light"
            >
              {{ getGradingStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- AI评分 -->
        <el-table-column label="AI评分" width="80" align="center">
          <template #default="{ row }">
            <div v-if="row.aiScore !== null && row.aiScore !== undefined">
              <span class="score ai-score">{{ row.aiScore }}</span>
              <span class="score-unit">分</span>
            </div>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <!-- 教师评分 -->
        <el-table-column label="教师评分" width="90" align="center">
          <template #default="{ row }">
            <div
              v-if="row.teacherScore !== null && row.teacherScore !== undefined"
            >
              <span class="score teacher-score">{{ row.teacherScore }}</span>
              <span class="score-unit">分</span>
            </div>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <!-- 批改时间 -->
        <el-table-column label="批改时间" width="150" align="center">
          <template #default="{ row }">
            <div v-if="row.teacherReviewedAt" class="time-text">
              {{ formatDateTime(row.teacherReviewedAt) }}
            </div>
            <span v-else class="no-data">未批改</span>
          </template>
        </el-table-column>

        <!-- 批改教师 -->
        <el-table-column label="批改教师" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.teacherName">{{ row.teacherName }}</span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <!-- 批改作业（统一入口） -->
              <el-button
                v-if="canGrade(row.status)"
                link
                type="primary"
                size="small"
                @click="handleGradeSubmission(row)"
                :icon="Edit"
              >
                批改作业
              </el-button>

              <!-- 草稿状态显示 -->
              <span v-else-if="row.status === 'draft'" class="no-action">
                草稿状态
              </span>

              <!-- 未提交状态显示 -->
              <span v-else class="no-action"> 未提交 </span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 批改抽屉 -->
    <GradingDrawer
      :visible="gradingDrawerVisible"
      @update:visible="gradingDrawerVisible = $event"
      :submission-id="currentSubmissionId"
      :assignment-id="assignmentId"
      @graded="handleGraded"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, nextTick, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { View, Edit } from "@element-plus/icons-vue";
import GradingDrawer from "./GradingDrawer.vue";

// Props
interface Props {
  submissionData: any[];
  maxHeight?: string;
  assignmentId: string;
  autoOpenFirstPending?: boolean;
}

const props = defineProps<Props>();

// 批改抽屉状态
const gradingDrawerVisible = ref(false);
const currentSubmissionId = ref<string | null>(null);

// Router
const router = useRouter();

// 发射事件，用于刷新数据

// 批改作业（统一入口）
const handleGradeSubmission = (row: any) => {
  // 检查是否可以批改
  if (!canGrade(row.status)) {
    if (row.status === "draft") {
      ElMessage.warning("该学生作业仍为草稿状态，无法批改");
    } else if (row.status === "not_submitted") {
      ElMessage.warning("该学生尚未提交作业");
    } else {
      ElMessage.warning("当前状态无法批改");
    }
    return;
  }

  // 检查是否有有效的提交ID
  if (!row._id) {
    ElMessage.error("提交记录ID无效，无法批改");
    return;
  }

  console.log("批改作业 - submissionId:", row._id, "status:", row.status);
  currentSubmissionId.value = row._id;
  gradingDrawerVisible.value = true;
};

// 批改完成后刷新数据
const handleGraded = () => {
  emit("refresh");
};

// 判断是否可以批改
const canGrade = (status: string) => {
  return ["submitted", "ai_reviewed", "teacher_reviewed"].includes(status);
};

// 获取内容预览（前50字）
const getContentPreview = (content: string) => {
  if (!content) return "";
  return content.length > 50 ? content.substring(0, 50) + "..." : content;
};

// 获取字数统计
const getWordCount = (content: string) => {
  if (!content) return 0;
  return content.replace(/\s/g, "").length;
};

// 获取提交状态类型
const getSubmissionStatusType = (status: string) => {
  const types: Record<
    string,
    "success" | "info" | "warning" | "primary" | "danger"
  > = {
    draft: "warning",
    submitted: "success",
    ai_reviewed: "primary",
    teacher_reviewed: "success",
    not_submitted: "info",
  };
  return types[status] || "info";
};

// 获取提交状态文本
const getSubmissionStatusText = (status: string) => {
  const texts: Record<string, string> = {
    draft: "草稿",
    submitted: "已提交",
    ai_reviewed: "已提交",
    teacher_reviewed: "已提交",
    not_submitted: "未提交",
  };
  return texts[status] || "未知";
};

// 获取批改状态类型
const getGradingStatusType = (status: string) => {
  const types: Record<
    string,
    "success" | "info" | "warning" | "primary" | "danger"
  > = {
    teacher_reviewed: "success",
    ai_reviewed: "primary",
    submitted: "warning",
    draft: "info",
    not_submitted: "info",
  };
  return types[status] || "info";
};

// 获取批改状态文本
const getGradingStatusText = (status: string) => {
  const texts: Record<string, string> = {
    teacher_reviewed: "教师已批改",
    ai_reviewed: "AI已评",
    submitted: "待批改",
    draft: "草稿",
    not_submitted: "未提交",
  };
  return texts[status] || "未知";
};

// 格式化日期时间
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 定义事件
const emit = defineEmits<{
  refresh: [];
  autoOpened: [];
}>();

// 标记是否已经自动打开过（使用组件级别的标记）
const hasAutoOpenedOnce = ref(false);

// 监听自动打开第一个待批改作业（只在首次且未打开过时执行）
watch(
  [() => props.autoOpenFirstPending, () => props.submissionData],
  ([shouldOpen, submissionData]) => {
    if (
      shouldOpen &&
      submissionData &&
      submissionData.length > 0 &&
      !hasAutoOpenedOnce.value
    ) {
      // 等待数据加载完成后自动打开第一个待批改的作业
      nextTick(() => {
        // 查找第一个可以批改的提交记录
        const firstPendingSubmission = submissionData.find((item) =>
          canGrade(item.status)
        );

        if (firstPendingSubmission) {
          console.log(
            "自动打开第一个待批改作业 - submissionId:",
            firstPendingSubmission._id
          );
          currentSubmissionId.value = firstPendingSubmission._id;
          gradingDrawerVisible.value = true;
          hasAutoOpenedOnce.value = true; // 标记已经自动打开过
          emit("autoOpened"); // 通知父组件已自动打开
        } else {
          ElMessage.info("暂无待批改的作业");
          hasAutoOpenedOnce.value = true; // 即使没有可批改的也标记为已处理
          emit("autoOpened"); // 通知父组件
        }
      });
    }
  },
  { immediate: true }
);

// 组件卸载时重置标记，以便下次进入时能正常工作
onUnmounted(() => {
  hasAutoOpenedOnce.value = false;
});

// 组件名称
defineOptions({
  name: "AssignmentDetailTable",
});
</script>

<style scoped>
/* 表格容器样式 */
.assignment-detail-table {
  width: 100%;
  overflow: hidden;
}

.table-container {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

/* 学生信息样式 */
.student-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.student-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
}

.student-details {
  flex: 1;
  min-width: 0;
}

.student-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.2;
  margin-bottom: 2px;
}

.student-number {
  font-size: 12px;
  color: #6b7280;
  font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
}

/* 内容预览样式 */
.content-preview {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
  cursor: help;
  word-break: break-all;
}

/* 分数样式 */
.score {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.ai-score {
  color: #3b82f6;
}

.teacher-score {
  color: #1f2937;
}

.score-unit {
  font-size: 12px;
  color: #6b7280;
  margin-left: 2px;
}

/* 字数统计样式 */
.word-count {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.word-unit {
  font-size: 12px;
  color: #6b7280;
  margin-left: 2px;
}

/* 时间文本样式 */
.time-text {
  font-size: 12px;
  color: #374151;
  font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
  line-height: 1.2;
}

/* 无数据样式 */
.no-data {
  color: #9ca3af;
  font-size: 13px;
  font-style: italic;
}

/* 操作按钮样式 */
.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.no-action {
  color: #9ca3af;
  font-size: 12px;
  font-style: italic;
}

/* Element Plus 表格样式覆盖 */
:deep(.el-table) {
  font-size: 13px;
}

:deep(.el-table th) {
  background-color: #f8fafc;
  color: #374151;
  font-weight: 600;
  font-size: 13px;
}

:deep(.el-table td) {
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.el-table--border) {
  border: 1px solid #e5e7eb;
}

:deep(.el-table--border th) {
  border-right: 1px solid #e5e7eb;
}

:deep(.el-table--border td) {
  border-right: 1px solid #e5e7eb;
}

:deep(.el-table__row:hover > td) {
  background-color: #f8fafc;
}

/* 标签样式优化 */
:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
  font-size: 12px;
}

:deep(.el-tag--info) {
  background-color: #f0f9ff;
  color: #0369a1;
}

:deep(.el-tag--success) {
  background-color: #f0fdf4;
  color: #166534;
}

:deep(.el-tag--warning) {
  background-color: #fffbeb;
  color: #d97706;
}

:deep(.el-tag--primary) {
  background-color: #eff6ff;
  color: #1d4ed8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .student-info {
    gap: 8px;
  }

  .student-avatar {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .content-preview {
    max-width: 150px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 2px;
  }

  :deep(.el-table td) {
    padding: 8px 0;
  }

  :deep(.el-table) {
    font-size: 12px;
  }
}
</style>
