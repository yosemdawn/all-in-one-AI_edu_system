<template>
  <div class="review-results">
    <el-card v-if="showReviewTabs" class="review-card">
      <el-tabs v-model="activeTab" tab-position="left" class="review-tabs">
        <el-tab-pane name="ai" :disabled="!showAiPane">
          <template #label>
            <div class="tab-label">
              <el-icon><Monitor /></el-icon>
              <span>AI批改</span>
              <el-tag
                v-if="aiReview && typeof aiReview.score === 'number'"
                type="primary"
                size="small"
                class="ml-2"
              >
                {{ aiReview.score }}分
              </el-tag>
              <el-tag
                v-else-if="showAiReviewError"
                type="danger"
                size="small"
                class="ml-2"
                effect="plain"
              >
                失败
              </el-tag>
              <el-tag
                v-else-if="showAiReviewSkipped"
                type="warning"
                size="small"
                class="ml-2"
                effect="plain"
              >
                已跳过
              </el-tag>
              <el-tag
                v-else-if="showAiReviewProcessing"
                type="info"
                size="small"
                class="ml-2"
                effect="plain"
              >
                批改中
              </el-tag>
            </div>
          </template>

          <div v-if="showAiReviewError" class="review-pane">
            <el-alert
              title="AI批改失败"
              :description="aiErrorMessage"
              type="error"
              show-icon
              :closable="false"
            />
            <div v-if="aiErrorTime || aiModelUsed" class="meta-block">
              <div v-if="aiErrorTime">失败时间：{{ formatDate(aiErrorTime) }}</div>
              <div v-if="aiModelUsed">使用模型：{{ aiModelUsed }}</div>
            </div>
          </div>

          <div v-else-if="showAiReviewSkipped" class="review-pane">
            <el-alert
              title="AI批改未执行"
              :description="aiSkippedMessage"
              type="warning"
              show-icon
              :closable="false"
            />
          </div>

          <div
            v-else-if="aiReview && (aiReview.content || typeof aiReview.score === 'number')"
            class="review-pane"
          >
            <div class="meta-block">
              <div v-if="aiReview.reviewedAt">
                批改时间：{{ formatDate(aiReview.reviewedAt) }}
              </div>
              <div v-if="aiModelUsed">使用模型：{{ aiModelUsed }}</div>
            </div>
            <div
              class="review-content"
              v-html="formatReviewContent(aiReview.content || '')"
            />
          </div>

          <div v-else class="pending-pane">
            <img
              src="@/assets/image/ai_loading.gif"
              alt="AI批改中"
              class="loading-image"
            />
            <h4>AI 正在批改中</h4>
            <p>
              {{ pollingHint }}
            </p>
          </div>
        </el-tab-pane>

        <el-tab-pane name="teacher" :disabled="!teacherReview">
          <template #label>
            <div class="tab-label">
              <el-icon><User /></el-icon>
              <span>教师批改</span>
              <el-tag
                v-if="teacherReview && typeof teacherReview.score === 'number'"
                type="success"
                size="small"
                class="ml-2"
              >
                {{ teacherReview.score }}分
              </el-tag>
              <el-tag
                v-else
                type="warning"
                size="small"
                class="ml-2"
                effect="plain"
              >
                待批改
              </el-tag>
            </div>
          </template>

          <div v-if="teacherReview" class="review-pane">
            <div class="meta-block">
              批改时间：{{ formatDate(teacherReview.reviewedAt) }}
            </div>
            <div
              class="review-content"
              v-html="formatReviewContent(teacherReview.content || '')"
            />
          </div>

          <div v-else class="pending-pane">
            <el-empty description="等待教师批改" :image-size="80" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <template v-else>
      <el-card
        v-if="showTeacherPendingTip"
        class="tip-card border-orange-200"
      >
        <div class="tip-row warning">
          <el-icon><Clock /></el-icon>
          <span>教师尚未评分，请耐心等待。</span>
        </div>
      </el-card>

      <el-card v-else-if="showOverdueTip" class="tip-card border-orange-200">
        <div class="tip-row warning">
          <el-icon><Clock /></el-icon>
          <span>作业已过期，不再进行 AI 批改，请等待教师人工批改。</span>
        </div>
      </el-card>

      <el-card v-else-if="showNoReviewTip" class="tip-card border-gray-200">
        <div class="tip-row neutral">
          <el-icon><InfoFilled /></el-icon>
          <span>作业尚未批改，请等待 AI 或教师评阅。</span>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Clock,
  InfoFilled,
  Monitor,
  User,
} from "@element-plus/icons-vue";
import type { AiReview, TeacherReview } from "../../../../api/submissions";
import { checkAiSupport } from "../../../../config/ai-config";
import { useSubmissionUtils } from "../composables";

interface Props {
  aiReview?: AiReview | null;
  teacherReview?: TeacherReview | null;
  submissionStatus?: string;
  assignment?: any;
  isPolling?: boolean;
  pollingCount?: number;
}

const props = defineProps<Props>();
const { formatDate } = useSubmissionUtils();
const activeTab = ref("ai");

const aiQueueStatus = computed(() => props.aiReview?.aiReviewMetadata?.queueStatus);
const aiModelUsed = computed(() => props.aiReview?.aiReviewMetadata?.modelUsed);
const aiErrorTime = computed(
  () =>
    props.aiReview?.aiReviewMetadata?.failedAt ||
    props.aiReview?.aiReviewMetadata?.errorTime
);
const aiErrorMessage = computed(
  () => props.aiReview?.aiReviewMetadata?.error || "AI 批改失败"
);
const aiSkippedMessage = computed(() => {
  const skippedReason = props.aiReview?.aiReviewMetadata?.skippedReason;
  if (skippedReason === "queue_disabled") {
    return "AI 批改队列未启用，请联系管理员检查 Redis 配置。";
  }
  return "当前提交未进入 AI 批改队列，请稍后重试或联系管理员。";
});

const showReviewTabs = computed(() => {
  return (
    !!props.submissionStatus &&
    props.submissionStatus !== "draft" &&
    props.submissionStatus !== "not_submitted"
  );
});

const showAiPane = computed(() => {
  return (
    props.submissionStatus === "submitted" ||
    props.submissionStatus === "ai_reviewed" ||
    props.submissionStatus === "ai_review_failed" ||
    !!props.aiReview
  );
});

const showAiReviewError = computed(() => {
  return (
    aiQueueStatus.value === "failed" ||
    !!props.aiReview?.aiReviewMetadata?.error
  );
});

const showAiReviewSkipped = computed(() => aiQueueStatus.value === "skipped");

const showAiReviewProcessing = computed(() => {
  if (!showAiPane.value) return false;
  if (showAiReviewError.value || showAiReviewSkipped.value) return false;
  if (props.aiReview?.content || typeof props.aiReview?.score === "number") {
    return false;
  }
  return (
    props.submissionStatus === "submitted" ||
    aiQueueStatus.value === "queued" ||
    aiQueueStatus.value === "processing"
  );
});

const pollingHint = computed(() => {
  if (props.isPolling) {
    return `系统正在刷新批改结果，当前第 ${props.pollingCount || 0} 次检查。`;
  }
  if (aiQueueStatus.value === "queued" || aiQueueStatus.value === "processing") {
    return "AI 任务已入队，结果生成后会自动显示。";
  }
  return "结果生成后会自动显示，请稍候。";
});

watch(
  () => [props.aiReview, props.teacherReview],
  ([aiReview, teacherReview]) => {
    if (aiReview) {
      activeTab.value = "ai";
      return;
    }
    if (teacherReview) {
      activeTab.value = "teacher";
      return;
    }
    activeTab.value = "ai";
  },
  { immediate: true }
);

const showTeacherPendingTip = computed(() => {
  return props.submissionStatus === "ai_reviewed" && !props.teacherReview;
});

const showOverdueTip = computed(() => {
  if (props.aiReview || props.teacherReview) {
    return false;
  }

  if (props.assignment && props.submissionStatus === "submitted") {
    const aiSupport = checkAiSupport(props.assignment);
    return !aiSupport.supported && aiSupport.reason.includes("过期");
  }

  return false;
});

const showNoReviewTip = computed(() => {
  return (
    !props.aiReview &&
    !props.teacherReview &&
    !!props.submissionStatus &&
    !showTeacherPendingTip.value &&
    !showOverdueTip.value
  );
});

const formatReviewContent = (content: string) => {
  if (!content) return "";

  return content
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
};

defineOptions({
  name: "ReviewResults",
});
</script>

<style scoped>
.review-results {
  height: 100%;
}

.review-card,
.tip-card {
  height: 100%;
}

.review-card :deep(.el-card__body) {
  height: 100%;
  padding: 0;
}

.review-tabs {
  height: 100%;
}

.review-tabs :deep(.el-tabs__header) {
  margin: 0;
  width: 200px;
  border-right: 1px solid #e5e7eb;
  background: #f8fafc;
}

.review-tabs :deep(.el-tabs__content) {
  height: 100%;
}

.review-pane {
  padding: 24px;
}

.pending-pane {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 24px;
  text-align: center;
  color: #6b7280;
}

.loading-image {
  width: 72px;
  height: 72px;
  border-radius: 16px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.meta-block {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f8fafc;
  color: #6b7280;
  line-height: 1.8;
}

.review-content {
  line-height: 1.8;
  white-space: pre-wrap;
  color: #1f2937;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tip-row.warning {
  color: #d97706;
}

.tip-row.neutral {
  color: #6b7280;
}

@media (max-width: 768px) {
  .review-tabs :deep(.el-tabs__header) {
    width: 148px;
  }
}

@media (max-width: 480px) {
  .review-tabs {
    display: block;
  }

  .review-tabs :deep(.el-tabs__header) {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }
}
</style>
