import { ref, onUnmounted } from "vue";
import { ElNotification } from "element-plus";
import type { AiReviewMetadata } from "@/api/submissions";
import { checkAiSupport } from "@/config/ai-config";

type CurrentStatusGetter = () => {
  status?: string;
  hasAiReview?: boolean;
  hasAiError?: boolean;
  aiReviewMetadata?: AiReviewMetadata;
  assignment?: any;
};

export function useAiReviewPolling() {
  const isPolling = ref(false);
  const pollingCount = ref(0);

  let pollingTimer: ReturnType<typeof setTimeout> | null = null;

  const getPollingInterval = (count: number): number => {
    if (count < 10) return 3000;
    if (count < 22) return 5000;
    if (count < 40) return 8000;
    return 15000;
  };

  const shouldContinuePolling = (
    submissionStatus?: string,
    hasAiReview?: boolean,
    assignment?: any,
    aiReviewMetadata?: AiReviewMetadata,
    maxCount = 60
  ): boolean => {
    const queueStatus = aiReviewMetadata?.queueStatus;

    if (hasAiReview || queueStatus === "completed") {
      return false;
    }

    if (queueStatus === "failed" || queueStatus === "skipped") {
      return false;
    }

    if (
      submissionStatus !== "submitted" &&
      submissionStatus !== "ai_review_queued"
    ) {
      return false;
    }

    if (assignment) {
      try {
        const aiSupport = checkAiSupport(assignment);
        if (!aiSupport.supported) {
          return false;
        }
      } catch (error) {
        console.warn("Unable to check AI support, keep polling.", error);
      }
    }

    if (pollingCount.value >= maxCount) {
      return false;
    }

    return true;
  };

  const startPolling = (
    loadDataFn: () => Promise<void>,
    getCurrentStatus: CurrentStatusGetter
  ) => {
    if (isPolling.value) {
      stopPolling();
    }

    isPolling.value = true;
    pollingCount.value = 0;

    const poll = async () => {
      try {
        await loadDataFn();

        const {
          status,
          hasAiReview,
          hasAiError,
          aiReviewMetadata,
          assignment,
        } = getCurrentStatus();

        pollingCount.value += 1;

        if (hasAiError) {
          stopPolling();
          return;
        }

        if (
          !shouldContinuePolling(
            status,
            hasAiReview,
            assignment,
            aiReviewMetadata
          )
        ) {
          if (hasAiReview) {
            ElNotification({
              title: "AI批改完成",
              message: "作业已完成 AI 批改，请查看结果。",
              type: "success",
              duration: 5000,
              position: "top-right",
            });
          }

          stopPolling();
          return;
        }

        pollingTimer = setTimeout(poll, getPollingInterval(pollingCount.value));
      } catch (error) {
        console.error("AI polling failed:", error);
        const interval = Math.max(
          getPollingInterval(pollingCount.value) * 2,
          10000
        );
        pollingTimer = setTimeout(poll, interval);
      }
    };

    pollingTimer = setTimeout(poll, 2000);
  };

  const stopPolling = () => {
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
    isPolling.value = false;
    pollingCount.value = 0;
  };

  const handleVisibilityChange = (
    loadDataFn: () => Promise<void>,
    getCurrentStatus: CurrentStatusGetter
  ) => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (isPolling.value) {
          stopPolling();
        }
        return;
      }

      const { status, hasAiReview, aiReviewMetadata } = getCurrentStatus();
      if (
        shouldContinuePolling(status, hasAiReview, undefined, aiReviewMetadata)
      ) {
        startPolling(loadDataFn, getCurrentStatus);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  };

  onUnmounted(() => {
    stopPolling();
  });

  return {
    isPolling,
    pollingCount,
    startPolling,
    stopPolling,
    handleVisibilityChange,
    shouldContinuePolling,
  };
}
