import { TeacherToolsService } from './teacher-tools.service';

function leanResult<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

describe('TeacherToolsService submission sync', () => {
  const assignment = {
    _id: { toString: () => 'assignment-1' },
    title: 'Weekly Writing',
    classes: [{ id: 'class-1', name: 'Class 1' }],
  };

  function createService(options?: {
    existingSubmission?: Record<string, unknown> | null;
  }) {
    const createdSubmission = {
      id: 'submission-created',
      submissionCount: 1,
      submittedAt: new Date(),
    };
    const assignmentModel = {
      findById: jest.fn().mockReturnValue(leanResult(assignment)),
    };
    const submissionModel = {
      findOne: jest.fn().mockResolvedValue(options?.existingSubmission ?? null),
      create: jest.fn().mockResolvedValue(createdSubmission),
    };
    const membershipModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TeacherToolsService(
      {} as never,
      {} as never,
      membershipModel as never,
      assignmentModel as never,
      submissionModel as never,
      { envelope: jest.fn((data) => ({ code: 200, data })) } as never,
      {} as never,
      {} as never,
      undefined,
    );

    return { service, assignmentModel, submissionModel, membershipModel };
  }

  const baseTask = {
    id: 'tool-task-1',
    type: 'essay_batch',
    assignmentId: 'assignment-1',
    classId: 'class-1',
    className: 'Class 1',
    config: { syncToSubmissions: true },
  };

  const matchedItem = {
    fileName: 'essay.jpg',
    filePath: 'C:/tmp/essay.jpg',
    status: 'completed',
    matchedStudent: {
      status: 'matched',
      studentId: 'student-1',
      studentName: 'Alice',
      studentNumber: 'S001',
      classId: 'class-1',
    },
    essayText: 'This is the recognized essay.',
    score: 88,
    summaryComment: 'Clear structure.',
    rawContent: '{"score":88}',
  };

  it('creates a submission for a matched student when no submission exists', async () => {
    const { service, submissionModel, membershipModel } = createService();

    const result = await (service as any).syncItemToSubmission(
      baseTask,
      matchedItem,
    );

    expect(result.status).toBe('created');
    expect(submissionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 'assignment-1',
        studentId: 'student-1',
        status: 'ai_reviewed',
        isDraft: false,
        aiScore: 88,
      }),
    );
    expect(membershipModel.findOneAndUpdate).toHaveBeenCalledWith(
      { classId: 'class-1', studentId: 'student-1' },
      expect.any(Object),
    );
  });

  it('does not overwrite an existing submitted record by default', async () => {
    const existingSubmission = {
      id: 'submission-existing',
      status: 'submitted',
      isDraft: false,
      aiReviewMetadata: null,
    };
    const { service, submissionModel } = createService({ existingSubmission });

    const result = await (service as any).syncItemToSubmission(
      baseTask,
      matchedItem,
    );

    expect(result).toEqual({
      status: 'skipped',
      reason: 'existing_submission',
      submissionId: 'submission-existing',
    });
    expect(submissionModel.create).not.toHaveBeenCalled();
  });

  it('never overwrites teacher reviewed submissions', async () => {
    const existingSubmission = {
      id: 'submission-reviewed',
      status: 'teacher_reviewed',
      isDraft: false,
      aiReviewMetadata: null,
    };
    const { service, submissionModel } = createService({ existingSubmission });

    const result = await (service as any).syncItemToSubmission(
      {
        ...baseTask,
        config: {
          syncToSubmissions: true,
          overwriteExistingSubmissions: true,
        },
      },
      matchedItem,
    );

    expect(result).toEqual({
      status: 'skipped',
      reason: 'teacher_reviewed',
      submissionId: 'submission-reviewed',
    });
    expect(submissionModel.create).not.toHaveBeenCalled();
  });
});
