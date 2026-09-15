# Airth Assignment - Mini Job Queue Dashboard

A full-stack job queue dashboard built with React, TypeScript, NestJS, TypeORM, and SQLite. The application lets users create jobs, view queue status, filter jobs by state, advance jobs through controlled lifecycle transitions, and delete jobs from the queue.

The project is intentionally small, but it includes practical backend safeguards such as DTO validation, server-side transition rules, and optimistic concurrency checks to prevent stale UI updates from overwriting newer job state.

## Features

- Create jobs with a trimmed, validated title and type.
- View all jobs sorted by newest first.
- Filter jobs by `pending`, `running`, `completed`, or `failed`.
- Advance jobs only through valid backend-enforced status transitions.
- Delete jobs from the dashboard.
- Refresh the dashboard manually.
- Validate API request bodies with NestJS validation pipes.
- Persist data locally with SQLite.
- Detect stale status updates with an atomic conditional update, `expectedStatus`, `expectedVersion`, and a TypeORM version column.
- Check backend availability with `GET /health`.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, TypeScript |
| UI Icons | lucide-react |
| Backend | NestJS 10, TypeScript |
| Database | SQLite |
| ORM | TypeORM |
| Validation | class-validator, class-transformer |
| Dev Tooling | concurrently, ESLint, Jest |

## Project Structure

```text
Airth/
|-- backend/
|   |-- src/
|   |   |-- jobs/
|   |   |   |-- dto/
|   |   |   |   |-- create-job.dto.ts
|   |   |   |   `-- update-job-status.dto.ts
|   |   |   |-- job.entity.ts
|   |   |   |-- job-status.ts
|   |   |   |-- jobs.controller.ts
|   |   |   |-- jobs.module.ts
|   |   |   `-- jobs.service.ts
|   |   |-- app.module.ts
|   |   `-- main.ts
|   `-- package.json
|-- frontend/
|   |-- src/
|   |   |-- main.tsx
|   |   |-- styles.css
|   |   `-- vite-env.d.ts
|   `-- package.json
|-- package.json
`-- README.md
```

## How It Works

The frontend is a Vite React app that talks to the backend through a small fetch helper. By default it calls `http://localhost:3001`, or the value of `VITE_API_BASE_URL` when configured.

The backend exposes a `jobs` resource through NestJS. Jobs are stored in a SQLite database using TypeORM. Each job has a UUID, title, type, status, creation timestamp, and version number.

Status changes are enforced on the backend, not only in the UI. This means direct API calls cannot bypass the lifecycle rules.

## Job Lifecycle

Allowed statuses:

- `pending`
- `running`
- `completed`
- `failed`

Allowed transitions:

| Current status | Allowed next statuses |
| --- | --- |
| `pending` | `running` |
| `running` | `completed`, `failed` |
| `completed` | None |
| `failed` | None |

`completed` and `failed` are terminal states.

## Concurrency Handling

The status update endpoint uses an atomic conditional database update. A status change succeeds only when:

- The job exists.
- The requested transition is valid.
- The current status is an allowed source status.
- The optional `expectedStatus` still matches the stored status.
- The optional `expectedVersion` still matches the stored version.

The frontend sends both `expectedStatus` and `expectedVersion`. If another browser tab or API client updates the same job first, the second update returns `409 Conflict` and the frontend reloads the latest jobs.

For example, if two browser tabs both try to change the same job from `pending` to `running`, only one database update can match `WHERE id = :id AND status IN ('pending')`. The first request succeeds, increments the version, and changes the status. The second request affects zero rows and receives `409 Conflict`.

This prevents lost updates without requiring a background worker, distributed lock, or external queue service.

## Prerequisites

- Node.js 20 or newer is recommended.
- npm 10 or newer is recommended.

## Installation

Install frontend and backend dependencies from the repository root:

```bash
npm run install:all
```

## Running Locally

Start both the NestJS API and Vite frontend:

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

## Available Scripts

Root scripts:

| Command | Description |
| --- | --- |
| `npm run install:all` | Installs backend and frontend dependencies. |
| `npm run dev` | Starts backend and frontend together. |
| `npm run build` | Builds backend and frontend. |
| `npm test` | Runs backend tests. |
| `npm run lint` | Runs backend and frontend lint commands. |

Backend scripts:

| Command | Description |
| --- | --- |
| `npm run start --prefix backend` | Starts the NestJS backend. |
| `npm run start:dev --prefix backend` | Starts the backend in watch mode. |
| `npm run build --prefix backend` | Builds the backend. |
| `npm test --prefix backend` | Runs Jest tests. |
| `npm run lint --prefix backend` | Runs ESLint with auto-fix for backend source files. |

Frontend scripts:

| Command | Description |
| --- | --- |
| `npm run dev --prefix frontend` | Starts the Vite development server. |
| `npm run build --prefix frontend` | Type-checks and builds the frontend. |
| `npm run preview --prefix frontend` | Serves the built frontend locally. |
| `npm run lint --prefix frontend` | Runs ESLint with auto-fix for frontend source files. |

## Environment Variables

Backend:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Port used by the NestJS API. |
| `DATABASE_PATH` | `jobs.sqlite` | SQLite database file path. |
| `CORS_ORIGIN` | Allows all origins | Comma-separated list of allowed frontend origins. |

Frontend:

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3001` | Base URL for the backend API. |

Example frontend environment file:

```env
VITE_API_BASE_URL=http://localhost:3001
```

Example backend environment values:

```env
PORT=3001
DATABASE_PATH=jobs.sqlite
CORS_ORIGIN=http://localhost:5173
```

In production, set `VITE_API_BASE_URL` to the deployed backend URL and set `CORS_ORIGIN` to the deployed frontend URL. Do not rely on the localhost fallback outside local development.

## API Reference

### Health Check

```http
GET /health
```

Returns:

```json
{
  "status": "ok"
}
```

### Create a Job

```http
POST /jobs
Content-Type: application/json
```

Request body:

```json
{
  "title": "Generate monthly report",
  "type": "report"
}
```

Validation:

- `title` is required, must be a string, and has a maximum length of 120 characters.
- `type` is required, must be a string, and has a maximum length of 60 characters.
- `title` and `type` are trimmed before validation and cannot be whitespace-only.
- `status` is not accepted when creating a job; new jobs are always created as `pending`.

### List Jobs

```http
GET /jobs
```

Returns jobs sorted by `createdAt` in descending order.

### Update Job Status

```http
PATCH /jobs/:id/status
Content-Type: application/json
```

Request body:

```json
{
  "status": "running",
  "expectedStatus": "pending",
  "expectedVersion": 1
}
```

Fields:

- `status` is required and must be one of `pending`, `running`, `completed`, or `failed`.
- `expectedStatus` is optional, but recommended for stale update detection.
- `expectedVersion` is optional, but recommended for optimistic concurrency.

Possible errors:

- `400 Bad Request` when the request body is malformed, contains unknown fields, or contains an invalid status value.
- `404 Not Found` when the job does not exist.
- `409 Conflict` when the transition is invalid or the job changed before the update was applied.

### Delete a Job

```http
DELETE /jobs/:id
```

Returns:

```json
{
  "id": "job-id",
  "deleted": true
}
```

## Data Model

```ts
type Job = {
  id: string;
  title: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  version: number;
};
```

## Production Notes

- SQLite is suitable for this assignment and simple local demos. PostgreSQL or another production database would be better for higher write concurrency.
- TypeORM `synchronize` is enabled outside production for fast local setup. When `NODE_ENV=production`, synchronization is disabled; production deployments should use migrations.
- Authentication and authorization are not included.
- Jobs are manually advanced from the dashboard. There is no background worker process.
- For deployment, host the backend on a Node-compatible platform with persistent storage and host the frontend on a static hosting platform.
- The atomic conditional status update is the main production-minded improvement in this implementation because it protects the state machine even when clients race or bypass the React UI.

## Suggested Deployment Setup

- Backend: Render, Railway, Fly.io, Azure App Service, or any Node.js host with persistent storage.
- Frontend: Vercel, Netlify, Azure Static Web Apps, or another static site host.
- Set `VITE_API_BASE_URL` in the frontend deployment to the deployed backend URL.
- Set `DATABASE_PATH`, `PORT`, and `CORS_ORIGIN` in the backend environment.

## Assignment Scope

This project focuses on a clear, testable implementation of a mini job queue dashboard. The main engineering decisions are:

- Keep the UI simple and operational.
- Centralize lifecycle rules on the backend.
- Use DTO validation to protect the API boundary.
- Use optimistic concurrency to avoid stale updates.
- Keep the persistence layer lightweight with SQLite for easy review and local execution.
