export function formatHeartbeatAge(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

export type PreviewWorkerStatusPayload = {
  connected: boolean;
  lastHeartbeatAt: string | null;
  workerCount: number;
  pendingJobs: number;
  runningJobs: number;
  failedJobs24h: number;
  completedJobs24h: number;
  queueAgeSeconds: number;
  workerIds: string[];
  workers: Array<{
    workerId: string;
    lastHeartbeatAt: string;
    version: string | null;
    host: string | null;
    status: string | null;
    ageSeconds: number;
  }>;
};
