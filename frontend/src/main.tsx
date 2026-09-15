import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircleAlert, Loader2, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
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
  pending: ['running', 'failed'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed with ${response.status}`);
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
    }
  };

  const deleteJob = async (job: Job) => {
    setError(null);
    try {
      await request(`/jobs/${job.id}`, { method: 'DELETE' });
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete job');
    }
  };

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <h1>Job Queue</h1>
          <p>Track, advance, and resolve queued jobs.</p>
        </div>
        <button className="icon-button" onClick={loadJobs} title="Refresh jobs" type="button">
          <RefreshCw size={18} />
        </button>
      </section>

      <form className="create-form" onSubmit={createJob}>
        <input
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Job title"
          required
          value={title}
        />
        <input
          maxLength={60}
          onChange={(event) => setType(event.target.value)}
          placeholder="Type"
          required
          value={type}
        />
        <button disabled={saving} type="submit">
          {saving ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}
          Create
        </button>
      </form>

      <section className="stats">
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
            {status} <strong>{counts[status]}</strong>
          </button>
        ))}
      </section>

      {error && (
        <div className="error" role="alert">
          <CircleAlert size={18} />
          {error}
        </div>
      )}

      <section className="jobs">
        {loading ? (
          <div className="empty">
            <Loader2 className="spin" />
            Loading jobs
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="empty">No jobs to show.</div>
        ) : (
          visibleJobs.map((job) => (
            <article className="job-row" key={job.id}>
              <div>
                <h2>{job.title}</h2>
                <p>
                  {job.type} · {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`badge ${job.status}`}>{job.status}</span>
              <div className="actions">
                {nextStatuses[job.status].map((status) => (
                  <button key={status} onClick={() => updateStatus(job, status)} type="button">
                    <Play size={15} />
                    {status}
                  </button>
                ))}
                <button className="danger" onClick={() => deleteJob(job)} title="Delete job" type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
