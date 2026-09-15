import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { Job } from './job.entity';
import { allowedSourceStatusesFor } from './job-status';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
  ) {}

  create(dto: CreateJobDto) {
    return this.jobsRepository.save(
      this.jobsRepository.create({
        title: dto.title.trim(),
        type: dto.type.trim(),
        status: 'pending',
      }),
    );
  }

  findAll() {
    return this.jobsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, dto: UpdateJobStatusDto) {
    const existing = await this.jobsRepository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException('Job not found');
    }

    const allowedSources = allowedSourceStatusesFor(dto.status);
    if (allowedSources.length === 0) {
      throw new ConflictException(`No job can transition to "${dto.status}" from another status`);
    }

    if (dto.expectedStatus && !allowedSources.includes(dto.expectedStatus)) {
      throw new ConflictException(`Invalid transition from "${dto.expectedStatus}" to "${dto.status}"`);
    }

    const sourceStatuses = dto.expectedStatus ? [dto.expectedStatus] : allowedSources;
    const query = this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({
        status: dto.status,
        version: () => 'version + 1',
      })
      .where('id = :id', { id })
      .andWhere('status IN (:...sourceStatuses)', { sourceStatuses });

    if (dto.expectedVersion !== undefined) {
      query.andWhere('version = :expectedVersion', { expectedVersion: dto.expectedVersion });
    }

    const result = await query.execute();
    if (result.affected !== 1) {
      const latest = await this.jobsRepository.findOneBy({ id });
      if (latest && !allowedSources.includes(latest.status)) {
        throw new ConflictException({
          message: `Invalid transition from "${latest.status}" to "${dto.status}"`,
          current: latest,
          allowedTransitions: allowedSources,
        });
      }

      throw new ConflictException({
        message: `Job status changed from "${existing.status}" to "${latest?.status ?? 'unknown'}" before this update could be applied`,
        current: latest,
        allowedTransitions: allowedSources,
      });
    }

    return this.jobsRepository.findOneByOrFail({ id });
  }

  async remove(id: string) {
    const result = await this.jobsRepository.delete({ id });
    if (result.affected !== 1) {
      throw new NotFoundException('Job not found');
    }

    return { id, deleted: true };
  }
}
