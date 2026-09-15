export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export const allowedSourceStatusesFor = (nextStatus: JobStatus): JobStatus[] =>
  JOB_STATUSES.filter((status) => VALID_TRANSITIONS[status].includes(nextStatus));
