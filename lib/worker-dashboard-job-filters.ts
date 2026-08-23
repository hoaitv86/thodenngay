export const WORKER_DASHBOARD_JOB_FILTER_PARAM = "dashboardFilter";
export const WORKER_DASHBOARD_JOBS_SESSION_KEY = "tdn:worker-dashboard-jobs";

export type WorkerDashboardJobFilter = "todo" | "today" | "month";

export type WorkerDashboardJobDateFields = {
  created_at?: string | null;
  scheduled_at?: string | null;
};

export function parseWorkerDashboardJobFilter(value: string | null): WorkerDashboardJobFilter | null {
  if (value === "todo" || value === "today" || value === "month") return value;
  return null;
}

export function getWorkerDashboardJobDate(job: WorkerDashboardJobDateFields) {
  const dateValue = job.created_at || job.scheduled_at;
  if (!dateValue) return null;

  const createdDate = new Date(dateValue);
  return Number.isNaN(createdDate.getTime()) ? null : createdDate;
}

function getDayStart(now: Date) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return todayStart;
}

function getMonthStart(now: Date) {
  const todayStart = getDayStart(now);
  return new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
}

export function filterWorkerDashboardJobs<T extends WorkerDashboardJobDateFields>(
  jobs: T[],
  filter: WorkerDashboardJobFilter,
  now = new Date(),
) {
  if (filter === "todo") return jobs;

  const start = filter === "today" ? getDayStart(now) : getMonthStart(now);
  return jobs.filter((job) => {
    const jobDate = getWorkerDashboardJobDate(job);
    return jobDate ? jobDate >= start : false;
  });
}
