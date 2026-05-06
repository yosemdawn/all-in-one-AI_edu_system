import request, { downloadFile } from "@/utils/request";

export type ToolTaskType = "objective_grading" | "essay_batch";
export type ToolTaskStatus =
  | "queued"
  | "processing"
  | "completed"
  | "partial_failed"
  | "failed"
  | "cancelled";

export interface ToolTask {
  id: string;
  _id: string;
  type: ToolTaskType;
  title: string;
  classId?: string | null;
  className?: string | null;
  assignmentId?: string | null;
  assignmentTitle?: string | null;
  status: ToolTaskStatus;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  config: Record<string, any>;
  items: Array<Record<string, any>>;
  resultSummary: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ToolTaskListResponse {
  items: ToolTask[];
  total: number;
  page: number;
  limit: number;
}

export function parseObjectiveAnswers(text: string): Promise<{
  standardAnswers: Record<string, any>;
}> {
  return request({
    url: "/teacher/tools/objective-grading/parse-answers",
    method: "post",
    data: { text },
  });
}

export function parseObjectiveScoreConfig(text: string): Promise<{
  scoreConfig: Record<string, number>;
}> {
  return request({
    url: "/teacher/tools/objective-grading/parse-score-config",
    method: "post",
    data: { text },
  });
}

export function createObjectiveTask(formData: FormData): Promise<ToolTask> {
  return request({
    url: "/teacher/tools/objective-grading/tasks",
    method: "post",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
}

export function previewEssayRequirements(formData: FormData): Promise<{
  requirements: string;
}> {
  return request({
    url: "/teacher/tools/essay-batch/preview-requirements",
    method: "post",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
}

export function createEssayTask(formData: FormData): Promise<ToolTask> {
  return request({
    url: "/teacher/tools/essay-batch/tasks",
    method: "post",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
}

export function getToolTasks(params?: {
  type?: ToolTaskType;
  status?: ToolTaskStatus;
  page?: number;
  limit?: number;
}): Promise<ToolTaskListResponse> {
  return request({
    url: "/teacher/tools/tasks",
    method: "get",
    params,
  });
}

export function getToolTask(id: string): Promise<ToolTask> {
  return request({
    url: `/teacher/tools/tasks/${id}`,
    method: "get",
  });
}

export function cancelToolTask(id: string): Promise<ToolTask> {
  return request({
    url: `/teacher/tools/tasks/${id}/cancel`,
    method: "post",
  });
}

export function getToolTaskExportUrl(id: string) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseURL}/teacher/tools/tasks/${id}/export`;
}

export function downloadToolTask(id: string, filename?: string) {
  return downloadFile(
    `/teacher/tools/tasks/${id}/export`,
    undefined,
    filename || `tool-task-${id}.csv`
  );
}
