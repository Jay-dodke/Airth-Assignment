import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CircleAlert, Clock3, Loader2, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const STATUSES = ['pending', 'running', 'completed', 'failed'] as const;

type JobStatus = (typeof STATUSES)[number];

type Job = {
  id: string;
  title: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  version: number;
};

const nextStatuses: Record<JobStatus, JobStatus[]> = {
  pending: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};

const statusLabels: Record<JobStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(getErrorMessage(body, `Request failed with ${response.status}`));
  }

  return response.json() as Promise<T>;
}

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyJobIds, setBusyJobIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await request<Job[]>('/jobs'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const counts = useMemo(
    () =>
      STATUSES.reduce(
        (acc, status) => ({ ...acc, [status]: jobs.filter((job) => job.status === status).length }),
        {} as Record<JobStatus, number>,
      ),
    [jobs],
  );

  const visibleJobs = filter === 'all' ? jobs : jobs.filter((job) => job.status === filter);
  const activeJobs = counts.pending + counts.running;
  const latestJob = jobs[0];

  const createJob = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await request<Job>('/jobs', {
        method: 'POST',
        body: JSON.stringify({ title, type }),
      });
      setJobs((current) => [created, ...current]);
      setTitle('');
      setType('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create job');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (job: Job, status: JobStatus) => {
    setError(null);
    setBusyJobIds((current) => [...current, job.id]);
    try {
      const updated = await request<Job>(`/jobs/${job.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          expectedStatus: job.status,
          expectedVersion: job.version,
        }),
      });
      setJobs((current) => current.map((item) => (item.id === job.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update job');
      void loadJobs();
    } finally {
      setBusyJobIds((current) => current.filter((id) => id !== job.id));
    }
  };

  const deleteJob = async (job: Job) => {
    setError(null);
    setBusyJobIds((current) => [...current, job.id]);
    try {
      await request(`/jobs/${job.id}`, { method: 'DELETE' });
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete job');
    } finally {
      setBusyJobIds((current) => current.filter((id) => id !== job.id));
    }
  };

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Activity size={16} />
            Operations dashboard
          </span>
          <h1>Job Queue</h1>
          <p>Track the queue, move jobs through their lifecycle, and keep failed work visible.</p>
        </div>
        <div className="hero-actions">
          <div className="latest-job">
            <Clock3 size={16} />
            <span>{latestJob ? new Date(latestJob.createdAt).toLocaleString() : 'No recent jobs'}</span>
          </div>
          <button className="icon-button" onClick={loadJobs} title="Refresh jobs" type="button">
            <RefreshCw size={18} />
          </button>
        </div>
      </section>

      <section className="summary-grid" aria-label="Queue summary">
        <div className="summary-card">
          <span>Total jobs</span>
          <strong>{jobs.length}</strong>
        </div>
        <div className="summary-card accent-running">
          <span>Active</span>
          <strong>{activeJobs}</strong>
        </div>
        <div className="summary-card accent-completed">
          <span>Completed</span>
          <strong>{counts.completed}</strong>
        </div>
        <div className="summary-card accent-failed">
          <span>Failed</span>
          <strong>{counts.failed}</strong>
        </div>
      </section>

      <section className="workspace">
        <aside className="side-panel">
          <div className="panel-heading">
            <span>Create job</span>
            <strong>New</strong>
          </div>
          <form className="create-form" onSubmit={createJob}>
            <label>
              Job title
              <input
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Generate daily report"
                required
                value={title}
              />
            </label>
            <label>
              Type
              <input
                maxLength={60}
                onChange={(event) => setType(event.target.value)}
                placeholder="reporting"
                required
                value={type}
              />
            </label>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}
              Create job
            </button>
          </form>
        </aside>

        <section className="queue-panel">
          <div className="filter-bar" aria-label="Job filters">
            <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')} type="button">
              All <strong>{jobs.length}</strong>
            </button>
            {STATUSES.map((status) => (
              <button
                className={filter === status ? `selected ${status}` : status}
                key={status}
                onClick={() => setFilter(status)}
                type="button"
              >
                {statusLabels[status]} <strong>{counts[status]}</strong>
              </button>
            ))}
          </div>

          {error && (
            <div className="error" role="alert">
              <CircleAlert size={18} />
              {error}
            </div>
          )}

          <div className="jobs">
            {loading ? (
              <div className="empty">
                <Loader2 className="spin" />
                Loading jobs
              </div>
            ) : visibleJobs.length === 0 ? (
              <div className="empty">No jobs to show.</div>
            ) : (
              visibleJobs.map((job) => {
                const isBusy = busyJobIds.includes(job.id);

                return (
                  <article className="job-row" key={job.id}>
                    <div className="job-main">
                      <span className={`status-dot ${job.status}`} />
                      <div>
                        <h2>{job.title}</h2>
                        <p>
                          {job.type} | {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${job.status}`}>{statusLabels[job.status]}</span>
                    <div className="actions">
                      {nextStatuses[job.status].map((status) => (
                        <button disabled={isBusy} key={status} onClick={() => updateStatus(job, status)} type="button">
                          {isBusy ? <Loader2 className="spin" size={15} /> : <Play size={15} />}
                          {statusLabels[status]}
                        </button>
                      ))}
                      <button
                        className="danger"
                        disabled={isBusy}
                        onClick={() => deleteJob(job)}
                        title="Delete job"
                        type="button"
                      >
                        {isBusy ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
