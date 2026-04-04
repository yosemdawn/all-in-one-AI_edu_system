import { computed, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import SubmissionsApi, {
  type AiReview,
  type Attachment,
  type MySubmissionDetail,
  type SubmitAssignmentParams,
} from "@/api/submissions";
import { checkAiSupport } from "@/config/ai-config";
import { useAiReviewPolling } from "./useAiReviewPolling";

type SubmissionLimitInfo = {
  type: "info" | "warning";
  title: string;
  message: string;
} | null;

export function useSubmissionManagement() {
  const route = useRoute();
  const router = useRouter();

  const loading = ref(true);
  const submitting = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const submissionData = ref<MySubmissionDetail | null>(null);

  const {
    isPolling,
    pollingCount,
    startPolling,
    stopPolling,
    handleVisibilityChange,
  } = useAiReviewPolling();

  const assignmentId = computed(() => {
    return (route.query.assignmentId || route.params.assignmentId) as string;
  });

  const classId = computed(() => {
    return (route.query.classId || route.params.classId) as string;
  });

  const resolveAiQueueStatus = (aiReview?: AiReview | null) =>
    aiReview?.aiReviewMetadata?.queueStatus;

  const hasCompletedAiReview = (aiReview?: AiReview | null) =>
    !!(
      aiReview &&
      (aiReview.content ||
        typeof aiReview.score === "number" ||
        resolveAiQueueStatus(aiReview) === "completed")
    );

  const hasAiErrorState = (aiReview?: AiReview | null) =>
    !!(
      aiReview &&
      (aiReview.aiReviewMetadata?.error ||
        resolveAiQueueStatus(aiReview) === "failed")
    );

  const hasAiSkippedState = (aiReview?: AiReview | null) =>
    resolveAiQueueStatus(aiReview) === "skipped";

  const isSubmitted = computed(() => {
    return submissionData.value?.submission?.status === "teacher_reviewed";
  });

  const canSaveDraft = computed(() => {
    const status = submissionData.value?.submission?.status;
    return !status || status === "draft";
  });

  const canSubmit = computed(() => {
    const submission = submissionData.value?.submission;
    if (!submission) return true;

    if (submission.status === "teacher_reviewed") {
      return false;
    }

    return (submission.submissionCount || 0) < 2;
  });

  const submissionLimitInfo = computed<SubmissionLimitInfo>(() => {
    const submission = submissionData.value?.submission;
    if (!submission) return null;

    if (submission.status === "teacher_reviewed") {
      return {
        type: "info",
        title: "作业已被教师批改，当前不可再次提交",
        message: "",
      };
    }

    const submissionCount = submission.submissionCount || 0;
    if (submissionCount >= 2) {
      return {
        type: "warning",
        title: "提交次数已达上限",
        message: `你已提交 ${submissionCount} 次，最多只能提交 2 次。`,
      };
    }

    if (submissionCount > 0) {
      return {
        type: "info",
        title: "提交次数提醒",
        message: `你已提交 ${submissionCount} 次，还可以提交 ${
          2 - submissionCount
        } 次。`,
      };
    }

    return null;
  });

  const showSubmissionForm = computed(() => {
    return submissionData.value?.submission?.status !== "teacher_reviewed";
  });

  const showSubmittedContent = computed(() => {
    return submissionData.value?.submission?.status === "teacher_reviewed";
  });

  const isOverdue = computed(() => {
    const dueDate = submissionData.value?.assignment?.dueDate;
    if (!dueDate) return false;
    return Date.now() > new Date(dueDate).getTime();
  });

  const statusTagType = computed(() => {
    const status = submissionData.value?.submission?.status;
    const statusMap: Record<
      string,
      "success" | "warning" | "info" | "primary" | "danger"
    > = {
      draft: "info",
      submitted: "warning",
      ai_reviewed: "primary",
      teacher_reviewed: "success",
      ai_review_failed: "danger",
    };

    return statusMap[status || ""] || "info";
  });

  const statusText = computed(() => {
    const status = submissionData.value?.submission?.status;
    const statusMap: Record<string, string> = {
      draft: "草稿",
      submitted: "已提交",
      ai_reviewed: "AI已批改",
      teacher_reviewed: "教师已批改",
      ai_review_failed: "AI批改失败",
    };

    return statusMap[status || ""] || "未知状态";
  });

  const getCurrentStatus = () => {
    const aiReview = submissionData.value?.aiReview;

    return {
      status: submissionData.value?.submission?.status,
      hasAiReview: hasCompletedAiReview(aiReview),
      hasAiError: hasAiErrorState(aiReview),
      aiReviewMetadata: aiReview?.aiReviewMetadata || undefined,
      assignment: submissionData.value?.assignment,
    };
  };

  const loadData = async () => {
    if (!assignmentId.value) {
      ElMessage.error("缺少作业 ID");
      router.back();
      return;
    }

    if (!classId.value) {
      ElMessage.error("缺少班级 ID");
      router.back();
      return;
    }

    try {
      loading.value = true;
      submissionData.value = await SubmissionsApi.getMySubmission(
        assignmentId.value
      );
    } catch (error) {
      console.error("Failed to load submission detail:", error);
      ElMessage.error("加载作业数据失败");
    } finally {
      loading.value = false;
    }
  };

  const checkCanAiReview = (
    assignment: any,
    submissionStatus: string | undefined,
    hasAiReview: boolean,
    aiQueueStatus?: string
  ) => {
    if (hasAiReview) {
      return { canReview: false, reason: "AI 批改已完成" };
    }

    if (aiQueueStatus === "failed") {
      return { canReview: false, reason: "AI 批改失败" };
    }

    if (aiQueueStatus === "skipped") {
      return { canReview: false, reason: "AI 批改已跳过" };
    }

    if (
      submissionStatus !== "submitted" &&
      submissionStatus !== "ai_review_queued"
    ) {
      return { canReview: false, reason: `当前状态为 ${submissionStatus}` };
    }

    const aiSupport = checkAiSupport(assignment);
    if (!aiSupport.supported) {
      return { canReview: false, reason: aiSupport.reason };
    }

    return { canReview: true, reason: "AI 批改条件满足" };
  };

  const checkAndStartPolling = () => {
    const { status, hasAiReview, hasAiError, aiReviewMetadata } =
      getCurrentStatus();
    const assignment = submissionData.value?.assignment;
    const aiReview = submissionData.value?.aiReview;

    if (hasAiError) {
      const errorMessage = aiReview?.aiReviewMetadata?.error || "AI 批改失败";
      ElMessage.error(`AI 批改失败：${errorMessage}`);
      return;
    }

    if (hasAiSkippedState(aiReview)) {
      const message =
        aiReviewMetadata?.skippedReason === "queue_disabled"
          ? "AI 批改队列未启用，请联系管理员检查 Redis 配置"
          : "当前提交未进入 AI 批改队列";
      ElMessage.warning(message);
      return;
    }

    const canAiReview = checkCanAiReview(
      assignment,
      status,
      hasAiReview,
      aiReviewMetadata?.queueStatus
    );

    if (canAiReview.canReview) {
      startPolling(loadData, getCurrentStatus);
    }
  };

  const buildSubmitParams = (
    content: string,
    attachments: Attachment[],
    isDraft: boolean
  ): SubmitAssignmentParams => {
    const params: SubmitAssignmentParams = {
      assignmentId: assignmentId.value,
      classId: classId.value,
      content,
      isDraft,
    };

    if (attachments.length > 0) {
      params.attachments = attachments;
    }

    return params;
  };

  const handleSubmit = async (content: string, attachments: Attachment[]) => {
    try {
      const isResubmit =
        !!submissionData.value?.submission &&
        submissionData.value.submission.status !== "draft";

      await ElMessageBox.confirm(
        isResubmit
          ? "确认重新提交作业吗？这会覆盖之前的提交内容。"
          : "确认提交作业吗？",
        "确认提交",
        {
          confirmButtonText: "确认提交",
          cancelButtonText: "取消",
          type: "warning",
        }
      );

      submitting.value = true;
      await SubmissionsApi.submit(buildSubmitParams(content, attachments, false));
      ElMessage.success(isResubmit ? "作业重新提交成功" : "作业提交成功");

      await loadData();
      checkAndStartPolling();
    } catch (error: any) {
      if (error !== "cancel") {
        console.error("Failed to submit assignment:", error);
        ElMessage.error(error.message || "提交作业失败");
      }
    } finally {
      submitting.value = false;
    }
  };

  const handleSaveDraft = async (
    content: string,
    attachments: Attachment[]
  ) => {
    if (!canSaveDraft.value) {
      ElMessage.warning("作业已提交，无法保存草稿");
      return;
    }

    if (!content.trim()) {
      ElMessage.warning("请先输入作业内容");
      return;
    }

    try {
      saving.value = true;
      await SubmissionsApi.submit(buildSubmitParams(content, attachments, true));
      ElMessage.success("草稿保存成功");
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadData();
    } catch (error: any) {
      console.error("Failed to save draft:", error);
      ElMessage.error(error.message || "保存草稿失败");
    } finally {
      saving.value = false;
    }
  };

  const handleDelete = async () => {
    const submissionId = submissionData.value?.submission?.id;
    if (!submissionId) return;

    try {
      await ElMessageBox.confirm(
        "确认删除这份草稿吗？删除后不可恢复。",
        "确认删除",
        {
          confirmButtonText: "确认删除",
          cancelButtonText: "取消",
          type: "warning",
        }
      );

      deleting.value = true;
      await SubmissionsApi.deleteSubmission({ submissionId });
      ElMessage.success("草稿删除成功");
      await loadData();
    } catch (error: any) {
      if (error !== "cancel") {
        console.error("Failed to delete draft:", error);
        ElMessage.error(error.message || "删除草稿失败");
      }
    } finally {
      deleting.value = false;
    }
  };

  const cleanupVisibilityListener = handleVisibilityChange(
    loadData,
    getCurrentStatus
  );

  onUnmounted(() => {
    stopPolling();
    cleanupVisibilityListener();
  });

  return {
    loading,
    submitting,
    saving,
    deleting,
    submissionData,
    isPolling,
    pollingCount,
    assignmentId,
    classId,
    isSubmitted,
    canSaveDraft,
    canSubmit,
    submissionLimitInfo,
    showSubmissionForm,
    showSubmittedContent,
    isOverdue,
    statusTagType,
    statusText,
    loadData,
    handleSubmit,
    handleSaveDraft,
    handleDelete,
    checkAndStartPolling,
    stopPolling,
  };
}
