import request from "@/utils/request";
import type {
  AiRuleSnapshot,
  AssignmentType,
  OnlineQuestion,
  AssignmentMaterial,
  SubmissionFormat,
} from "@/types/assignments";

// 作业状态枚举
export enum AssignmentStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  TERMINATED = "terminated",
}

// 作业基础信息
export interface Assignment {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  classes: Array<{
    id: string;
    name: string;
  }>;
  aiRule?: AiRuleSnapshot | null;
  questionMaterial?: AssignmentMaterial;
  referenceAnswer?: AssignmentMaterial;
  gradingNotes?: string;
  assignmentType?: AssignmentType;
  onlineQuestions?: OnlineQuestion[];
  submissionFormat?: SubmissionFormat;
  allowAttachments?: boolean;
  startDate: string;
  endDate: string;
  status: AssignmentStatus;
  terminatedReason?: string;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

// 作业列表项（包含统计信息）
export interface AssignmentListItem extends Assignment {
  submissionCount: number;
  totalSubmissions: number;
  reviewedSubmissions: number;
  pendingSubmissions: number;
  totalStudents: number;
}

// 作业详情（教师端）
export interface AssignmentDetail extends Assignment {
  aiRule?: any;
  totalStudents?: number;
  submissionStats: {
    totalSubmissions: number;
    reviewedSubmissions: number;
    pendingSubmissions: number;
    draftSubmissions: number;
  };
}

// 学生提交记录（精简版）
export interface StudentSubmissionSummary {
  _id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classId: string;
  className: string;
  status: "draft" | "submitted" | "ai_reviewed" | "teacher_reviewed";
  submittedAt?: string;
  aiScore?: number;
  teacherScore?: number;
  teacherReviewedAt?: string;
  contentPreview?: string;
  wordCount?: number;
}

// 作业详情页面响应（包含提交列表）
export interface AssignmentWithSubmissions {
  assignment: AssignmentDetail;
  submissions: {
    items: StudentSubmissionSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AssignmentAnalytics {
  assignmentId: string;
  assignmentTitle: string;
  assignmentType: AssignmentType;
  totalStudents: number;
  submittedCount: number;
  unsubmittedCount: number;
  gradedCount: number;
  submissionRate: number;
  averageScore: number | null;
  scoreBands: Array<{
    label: string;
    min: number;
    max: number;
    count: number;
    rate: number;
  }>;
  classStats: Array<{
    classId: string;
    className: string;
    totalStudents: number;
    submittedCount: number;
    submissionRate: number;
    averageScore: number | null;
  }>;
  wrongQuestionDistribution: Array<{
    questionId: string;
    questionNumber: number;
    type: string;
    stem: string;
    maxScore: number;
    totalAnswered: number;
    correctCount: number;
    wrongCount: number;
    wrongRate: number;
    commonWrongAnswers: Array<{
      answer: string;
      count: number;
    }>;
  }>;
  summary: {
    completionSummary: string;
    scoreSummary: string;
    weakPoints: string[];
    teachingSuggestions: string[];
  };
  generatedAt: string;
}

// 查询参数
export interface AssignmentQueryParams {
  page?: number;
  pageSize?: number;
  title?: string;
  status?: AssignmentStatus;
  teacherName?: string;
  classId?: string;
  className?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// 作业详情查询参数
export interface AssignmentSubmissionsQueryParams {
  classId?: string;
  studentName?: string;
  studentNumber?: string;
  submissionStatus?: "draft" | "submitted" | "not_submitted";
  gradingStatus?:
    | "pending"
    | "draft"
    | "submitted"
    | "ai_reviewed"
    | "teacher_reviewed";
  page?: number;
  limit?: number;
}

// 列表响应
export interface AssignmentListResponse {
  items: AssignmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// 创建作业参数
export interface CreateAssignmentParams {
  title: string;
  description: string;
  classes: string[];
  startDate: string;
  endDate: string;
  aiRule?: AiRuleSnapshot | null;
  questionMaterial: AssignmentMaterial;
  referenceAnswer: AssignmentMaterial;
  gradingNotes: string;
  submissionFormat: SubmissionFormat;
  assignmentType: AssignmentType;
  onlineQuestions: OnlineQuestion[];
  allowAttachments?: boolean;
}

// 更新作业参数
export interface UpdateAssignmentParams
  extends Partial<CreateAssignmentParams> {
  status?: AssignmentStatus;
  terminatedReason?: string;
}

/**
 * 获取作业列表（教师端）
 */
export function getAssignmentList(
  params: AssignmentQueryParams
): Promise<AssignmentListResponse> {
  return request({
    url: "/teacher/assignments",
    method: "get",
    params,
  });
}

/**
 * 获取作业详情（教师端）
 */
export function getAssignmentDetail(id: string): Promise<AssignmentDetail> {
  return request({
    url: `/teacher/assignments/${id}`,
    method: "get",
  });
}

/**
 * 获取作业的学生提交情况（教师端）- 包含所有学生
 */
export function getAssignmentStudents(
  id: string,
  params?: AssignmentSubmissionsQueryParams
): Promise<any> {
  return request({
    url: `/teacher/assignments/${id}/students`,
    method: "get",
    params,
  });
}

export function getAssignmentAnalytics(
  id: string
): Promise<AssignmentAnalytics> {
  return request({
    url: `/teacher/assignments/${id}/analytics`,
    method: "get",
  });
}

/**
 * 创建作业
 */
export function createAssignment(
  params: CreateAssignmentParams
): Promise<Assignment> {
  return request({
    url: "/teacher/assignments",
    method: "post",
    data: params,
  });
}

/**
 * 更新作业
 */
export function updateAssignment(
  id: string,
  params: UpdateAssignmentParams
): Promise<Assignment> {
  return request({
    url: `/teacher/assignments/${id}/update`,
    method: "post",
    data: params,
  });
}

/**
 * 发布作业
 */
export function publishAssignment(id: string): Promise<Assignment> {
  return request({
    url: `/teacher/assignments/${id}/status`,
    method: "post",
    data: { status: AssignmentStatus.PUBLISHED },
  });
}

/**
 * 终止作业
 */
export function terminateAssignment(
  id: string,
  reason?: string
): Promise<Assignment> {
  return request({
    url: `/teacher/assignments/${id}/status`,
    method: "post",
    data: {
      status: AssignmentStatus.TERMINATED,
      terminatedReason: reason,
    },
  });
}

/**
 * 删除作业
 */
export function deleteAssignment(id: string): Promise<void> {
  return request({
    url: `/teacher/assignments/${id}/delete`,
    method: "post",
  });
}

/**
 * 获取我的作业列表（学生端）
 */
export function getMyAssignments(params?: any): Promise<any> {
  return request({
    url: "/student/assignments",
    method: "get",
    params,
  });
}

/**
 * 获取我的作业统计（学生端）
 */
export function getMyAssignmentStatistics(classId?: string): Promise<any> {
  return request({
    url: "/student/assignments/statistics",
    method: "get",
    params: classId ? { classId } : undefined,
  });
}

/**
 * 获取学生作业详情（学生端）
 */
export function getStudentAssignment(
  assignmentId: string,
  classId?: string
): Promise<any> {
  return request({
    url: `/student/assignments/${assignmentId}`,
    method: "get",
    params: classId ? { classId } : undefined,
  });
}

/**
 * 更新作业状态（兼容函数）
 */
export function updateAssignmentStatus(
  id: string,
  params: { status: AssignmentStatus; terminatedReason?: string }
) {
  if (params.status === AssignmentStatus.PUBLISHED) {
    return publishAssignment(id);
  } else if (params.status === AssignmentStatus.TERMINATED) {
    return terminateAssignment(id, params.terminatedReason);
  }
  return updateAssignment(id, params);
}

/**
 * 获取作业详情（兼容函数）
 */
export function getAssignment(id: string): Promise<Assignment> {
  return getAssignmentDetail(id);
}

// 兼容原有的 assignmentApi 对象导出
export const assignmentApi = {
  getAssignments: getAssignmentList,
  getAssignment: getAssignmentDetail,
  createAssignment,
  updateAssignment,
  updateAssignmentStatus: (
    id: string,
    params: { status: AssignmentStatus; terminatedReason?: string }
  ) => {
    if (params.status === AssignmentStatus.PUBLISHED) {
      return publishAssignment(id);
    } else if (params.status === AssignmentStatus.TERMINATED) {
      return terminateAssignment(id, params.terminatedReason);
    }
    return updateAssignment(id, params);
  },
  deleteAssignment,
  getAssignmentAnalytics,
};
