// Missing revisions belong to records created before versioned submissions.
export function revisionFilter(revision: number) {
  return revision === 0
    ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
    : { revision };
}

export const unreviewedFilter = {
  status: { $ne: 'teacher_reviewed' },
  teacherScore: null,
  teacherReviewedAt: null,
};
