import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from './jobs/jobs.module';
import { Job } from './jobs/job.entity';
import { AppController } from './app.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH ?? 'jobs.sqlite',
      entities: [Job],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    JobsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
