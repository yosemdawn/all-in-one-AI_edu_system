<template>
  <div class="task-progress" role="status" aria-live="polite">
    <div class="progress-heading">
      <strong>{{ stageLabel }}</strong>
      <span>已处理 {{ processed }} / {{ task.totalCount }} 张</span>
    </div>
    <el-progress
      :percentage="percentage"
      :status="barStatus"
      :stroke-width="10"
    />
    <p v-if="active && currentFile" class="current-file">
      第 {{ currentIndex }} 张：{{ currentFile }}
    </p>
    <div class="progress-counts">
      <span>成功 {{ task.successCount }} 张</span
      ><span>失败 {{ task.failureCount }} 张</span>
      <span v-if="elapsed">已用时 {{ elapsed }}</span>
    </div>
    <p v-if="active" class="progress-hint">
      {{
        task.status === "queued"
          ? "任务已接收，正在等待开始批阅。"
          : "百分比按已处理图片计算，当前图片完成后更新。"
      }}
    </p>
    <p v-if="slow" class="progress-hint">
      当前步骤耗时较长，仍在等待处理结果，请勿重复提交。
    </p>
    <p v-if="task.resultSummary?.error && !active" class="progress-error">
      {{ task.resultSummary.error }}
    </p>
    <p v-if="error" class="progress-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { ToolTask } from "@/api/teacher-tools";
import { progressPercent, taskStatusText } from "./shared";
const props = defineProps<{ task: ToolTask; error?: string }>();
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); });
onBeforeUnmount(() => clearInterval(timer));
const active = computed(() =>
  ["queued", "processing"].includes(props.task.status)
);
const processed = computed(() =>
  Math.min(props.task.totalCount, Math.max(0, props.task.processedCount))
);
const percentage = computed(() => progressPercent(props.task));
const currentItem = computed(() =>
  props.task.items?.find((item) => item.status === "processing")
);
const currentFile = computed(
  () => props.task.progress?.currentFileName || currentItem.value?.fileName
);
const currentIndex = computed(
  () =>
    props.task.progress?.currentIndex ||
    Math.min(props.task.totalCount, processed.value + 1)
);
const stageLabel = computed(() => {
  if (!active.value || props.task.status === "queued")
    return taskStatusText(props.task.status);
  const stages: Record<string, string> = {
    preparing: "正在准备批阅",
    requirements: "正在识别作文要求",
    recognizing: "正在识别答题卡",
    grading: "正在计算分数",
    reviewing: "正在批阅作文",
    saving: "正在保存批阅结果",
  };
  return stages[props.task.progress?.stage || ""] || "正在批阅";
});
const barStatus = computed(() =>
  props.task.status === "completed"
    ? "success"
    : props.task.status === "partial_failed"
    ? "warning"
    : ["failed", "cancelled"].includes(props.task.status)
    ? "exception"
    : undefined
);
const elapsed = computed(() => {
  const start = Date.parse(props.task.startedAt || props.task.createdAt || "");
  const end = active.value
    ? now.value
    : Date.parse(props.task.completedAt || props.task.updatedAt || "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
});
const slow = computed(
  () =>
    active.value &&
    props.task.status === "processing" &&
    now.value -
      Date.parse(
        props.task.progress?.stageStartedAt || props.task.updatedAt || ""
      ) >
      120000
);
</script>

<style scoped>
.task-progress {
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: #f5f8fc;
}
.progress-heading,
.progress-counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.progress-counts {
  justify-content: flex-start;
  gap: 24px;
  margin-top: 12px;
  margin-bottom: 0;
  font-size: 13px;
  color: #606266;
}
.current-file {
  overflow-wrap: anywhere;
  font-size: 14px;
}
.progress-hint {
  font-size: 13px;
  color: #606266;
  margin: 8px 0 0;
}
.progress-error {
  color: #b45309;
  font-size: 13px;
}
</style>
