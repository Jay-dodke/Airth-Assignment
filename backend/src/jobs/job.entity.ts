import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
import { JobStatus } from './job-status';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  title!: string;

  @Column({ length: 60 })
  type!: string;

  @Column({ default: 'pending' })
  status!: JobStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @VersionColumn()
  version!: number;
}
