import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressInfo } from 'net';
import { Job } from './job.entity';
import { JobsModule } from './jobs.module';

type JobResponse = {
  id: string;
  title: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  version: number;
};

describe('Jobs API', () => {
  let app: INestApplication;
  let baseUrl: string;

  const api = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    });

  const createJob = async (body: Record<string, unknown> = { title: 'Import feed', type: 'import' }) => {
    const response = await api('/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      response,
      body: (await response.json()) as JobResponse,
    };
  };

  const patchStatus = (job: JobResponse, status: JobResponse['status']) =>
    api(`/jobs/${job.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        expectedStatus: job.status,
        expectedVersion: job.version,
      }),
    });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Job],
          synchronize: true,
          dropSchema: true,
        }),
        JobsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a valid job as pending', async () => {
    const { response, body } = await createJob({ title: '  Generate report  ', type: '  reporting  ' });

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      title: 'Generate report',
      type: 'reporting',
      status: 'pending',
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });

  it.each([
    ['missing title', { type: 'import' }],
    ['whitespace-only title', { title: '   ', type: 'import' }],
    ['missing type', { title: 'Import feed' }],
    ['whitespace-only type', { title: 'Import feed', type: '   ' }],
    ['client-provided status', { title: 'Import feed', type: 'import', status: 'running' }],
  ])('rejects invalid create body: %s', async (_name, body) => {
    const response = await api('/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
  });

  it('allows pending to running', async () => {
    const { body: job } = await createJob();
    const response = await patchStatus(job, 'running');
    const updated = (await response.json()) as JobResponse;

    expect(response.status).toBe(200);
    expect(updated.status).toBe('running');
  });

  it('allows running to completed', async () => {
    const { body: job } = await createJob();
    const running = (await (await patchStatus(job, 'running')).json()) as JobResponse;
    const response = await patchStatus(running, 'completed');
    const updated = (await response.json()) as JobResponse;

    expect(response.status).toBe(200);
    expect(updated.status).toBe('completed');
  });

  it('allows running to failed', async () => {
    const { body: job } = await createJob();
    const running = (await (await patchStatus(job, 'running')).json()) as JobResponse;
    const response = await patchStatus(running, 'failed');
    const updated = (await response.json()) as JobResponse;

    expect(response.status).toBe(200);
    expect(updated.status).toBe('failed');
  });

  it.each([
    ['pending to failed', async () => (await createJob()).body, 'failed'],
    ['pending to completed', async () => (await createJob()).body, 'completed'],
    [
      'running to pending',
      async () => {
        const { body: job } = await createJob();
        return (await (await patchStatus(job, 'running')).json()) as JobResponse;
      },
      'pending',
    ],
    [
      'completed to running',
      async () => {
        const { body: job } = await createJob();
        const running = (await (await patchStatus(job, 'running')).json()) as JobResponse;
        return (await (await patchStatus(running, 'completed')).json()) as JobResponse;
      },
      'running',
    ],
    [
      'failed to running',
      async () => {
        const { body: job } = await createJob();
        const running = (await (await patchStatus(job, 'running')).json()) as JobResponse;
        return (await (await patchStatus(running, 'failed')).json()) as JobResponse;
      },
      'running',
    ],
  ] as const)('rejects invalid transition: %s', async (_name, arrange, status) => {
    const job = await arrange();
    const response = await patchStatus(job, status);

    expect(response.status).toBe(409);
  });

  it('returns 400 for an invalid status value', async () => {
    const { body: job } = await createJob();
    const response = await api(`/jobs/${job.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paused' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 when updating a non-existing job', async () => {
    const response = await api('/jobs/00000000-0000-4000-8000-000000000000/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'running' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 404 when deleting a non-existing job', async () => {
    const response = await api('/jobs/00000000-0000-4000-8000-000000000000', {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });

  it('allows only one concurrent pending to running update to succeed', async () => {
    const { body: job } = await createJob();

    const [first, second] = await Promise.all([patchStatus(job, 'running'), patchStatus(job, 'running')]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([200, 409]);
  });
});
