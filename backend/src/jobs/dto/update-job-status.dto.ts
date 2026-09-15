import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { JOB_STATUSES, JobStatus } from '../job-status';

export class UpdateJobStatusDto {
  @IsIn(JOB_STATUSES)
  status!: JobStatus;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  expectedStatus?: JobStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
