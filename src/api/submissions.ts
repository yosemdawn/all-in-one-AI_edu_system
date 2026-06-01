import request from "@/utils/request";

export interface Attachment {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
}

export interface AiReviewMetadata {
  queueStatus?:
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | "skipped";
  skippedReason?: string;
  queuedAt?: string;
  processingStartedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  errorTime?: string;
  modelUsed?: string;
  tokenUsed?: number;
}

export interface SubmitAssignmentParams {
  assignmentId: string;
  classId: string;
  content?: string;
  attachments?: Attachment[];
  onlineAnswers?: Array<{
    questionId: string;
    answer: string;
  }>;
  isDraft?: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  teacherName: string;
  aiRule: any;
  assignmentType?: "normal" | "online";
  onlineQuestions?: Array<{
    id: string;
    type: "single_choice" | "fill_blank";
    stem: string;
    options?: string[];
    score?: number;
  }>;
  status: "draft" | "published" | "terminated";
  terminatedReason?: string;
}

export interface Submission {
  id: string;
  content: string;
  attachments: Attachment[];
  status:
    | "draft"
    | "submitted"
    | "ai_reviewed"
    | "teacher_reviewed"
    | "ai_review_failed";
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  isDraft: boolean;
  submissionCount: number;
  aiScore?: number | null;
  aiReviewContent?: string | null;
  aiReviewMetadata?: AiReviewMetadata | null;
  onlineAnswers?: Array<{
    questionId: string;
    answer: string;
  }>;
  objectiveResult?: Record<string, any> | null;
}

export interface AiReview {
  content: string;
  score: number;
  reviewedAt: string;
  aiReviewMetadata?: AiReviewMetadata;
}

export interface TeacherReview {
  content: string;
  score: number;
  reviewedAt: string;
}

export interface MySubmissionDetail {
  assignment: Assignment;
  submission: Submission | null;
  aiReview: AiReview | null;
  teacherReview: TeacherReview | null;
}

export interface SubmitAssignmentResponse {
  id: string;
  assignmentId: string;
  studentId: string;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  isDraft: boolean;
  submissionCount: number;
}

export interface DeleteSubmissionParams {
  submissionId: string;
}

export class SubmissionsApi {
  static async submit(params: SubmitAssignmentParams) {
    console.log("Submitting assignment:", params);

    const result = await request<SubmitAssignmentResponse>({
      url: "/students/submissions/submit",
      method: "POST",
      data: params,
    });

    console.log("Submit response:", result);
    return result;
  }

  static async getMySubmission(assignmentId: string) {
    console.log("Fetching submission detail:", assignmentId);

    const result = await request<MySubmissionDetail>({
      url: `/students/submissions/my/${assignmentId}`,
      method: "GET",
    });

    console.log("Submission detail response:", result);
    return result;
  }

  static async deleteSubmission(params: DeleteSubmissionParams) {
    return request<{ success: boolean; message: string; resourceId: string }>({
      url: "/students/submissions/delete",
      method: "POST",
      data: params,
    });
  }

  static async saveDraft(params: Omit<SubmitAssignmentParams, "isDraft">) {
    return this.submit({ ...params, isDraft: true });
  }

  static async submitFinal(params: Omit<SubmitAssignmentParams, "isDraft">) {
    return this.submit({ ...params, isDraft: false });
  }
}

export default SubmissionsApi;
