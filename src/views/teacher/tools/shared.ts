export function taskStatusText(status: string) {
  const map: Record<string, string> = {
    queued: "排队中",
    processing: "处理中",
    completed: "已完成",
    partial_failed: "部分失败",
    failed: "失败",
    cancelled: "已取消",
  };
  return map[status] || status;
}

export function taskStatusType(status: string) {
  if (status === "completed") return "success";
  if (status === "partial_failed") return "warning";
  if (status === "failed" || status === "cancelled") return "danger";
  return "info";
}

export function progressPercent(task?: { totalCount: number; processedCount: number }) {
  if (!task || !task.totalCount) return 0;
  return Math.round((task.processedCount / task.totalCount) * 100);
}

export function safeJsonParse(value: string, fallback: any) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

