"use client";

import * as React from "react";
import type { BuildJobEventRow } from "@/lib/build/build-job-events";

export type BuildJobPollState = {
  jobId: string;
  eventsUrl: string;
  status: string | null;
  events: BuildJobEventRow[];
  latest: BuildJobEventRow | null;
  progressPercent: number;
  error: string | null;
  done: boolean;
  reconnecting?: boolean;
};

const MAX_404_ATTEMPTS = 5;
/** Cap client-side event buffer to avoid React freeze during long builds. */
const MAX_CLIENT_EVENTS = 600;

export function useBuildJobProgress(
  job: { jobId: string; eventsUrl: string } | null,
  onTerminal?: (state: BuildJobPollState) => void,
) {
  const [state, setState] = React.useState<BuildJobPollState | null>(null);

  React.useEffect(() => {
    if (!job) {
      setState(null);
      return;
    }

    let cancelled = false;
    let afterCursor: string | null = null;
    let notFoundAttempts = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => void poll(), ms);
    };

    const poll = async () => {
      const url = afterCursor
        ? `${job.eventsUrl}?after=${encodeURIComponent(afterCursor)}`
        : job.eventsUrl;
      try {
        const res = await fetch(url, { credentials: "include" });
        const body = (await res.json()) as {
          ok?: boolean;
          setup_warning?: string;
          job?: {
            status?: string;
            progress?: number;
            error_message?: string | null;
          };
          events?: Array<{
            id: string;
            created_at: string;
            type: string;
            title: string;
            detail: string | null;
            file_path: string | null;
            progress_percent: number | null;
            metadata?: Record<string, unknown>;
          }>;
          error?: string;
          code?: string;
        };
        if (cancelled) return;

        if (res.status === 404 || body.code === "job_not_found") {
          notFoundAttempts += 1;
          setState((prev) => ({
            jobId: job.jobId,
            eventsUrl: job.eventsUrl,
            status: prev?.status ?? "starting",
            events: prev?.events ?? [],
            latest: prev?.latest ?? null,
            progressPercent: Math.max(prev?.progressPercent ?? 1, 1),
            error:
              notFoundAttempts >= MAX_404_ATTEMPTS
                ? "Build session ended — retry from the composer."
                : null,
            done: notFoundAttempts >= MAX_404_ATTEMPTS,
            reconnecting: notFoundAttempts < MAX_404_ATTEMPTS,
          }));
          if (notFoundAttempts >= MAX_404_ATTEMPTS) return;
          schedule(Math.min(8000, 400 * 2 ** notFoundAttempts));
          return;
        }

        if (!res.ok || body.ok === false) {
          setState((prev) =>
            prev
              ? { ...prev, error: body.error ?? "Could not load build progress", reconnecting: false }
              : {
                  jobId: job.jobId,
                  eventsUrl: job.eventsUrl,
                  status: "starting",
                  events: [],
                  latest: null,
                  progressPercent: 1,
                  error: body.error ?? "Could not load build progress",
                  done: false,
                  reconnecting: false,
                },
          );
          schedule(2000);
          return;
        }

        if (body.setup_warning && (body.events?.length ?? 0) === 0) {
          setState((prev) => ({
            jobId: job.jobId,
            eventsUrl: job.eventsUrl,
            status: body.job?.status ?? "starting",
            events: prev?.events ?? [],
            latest: prev?.latest ?? {
              id: "starting",
              created_at: new Date().toISOString(),
              job_id: job.jobId,
              project_id: "",
              user_id: "",
              type: "understanding_request",
              title: "Starting build…",
              detail: body.setup_warning ?? null,
              file_path: null,
              progress_percent: body.job?.progress ?? 1,
              metadata: {},
            },
            progressPercent: Math.max(body.job?.progress ?? 1, prev?.progressPercent ?? 1),
            error: null,
            done: false,
            reconnecting: false,
          }));
          schedule(2500);
          return;
        }

        notFoundAttempts = 0;
        const incoming = (body.events ?? []).map(
          (e): BuildJobEventRow => ({
            id: e.id,
            created_at: e.created_at,
            job_id: job.jobId,
            project_id: "",
            user_id: "",
            type: e.type as BuildJobEventRow["type"],
            title: e.title,
            detail: e.detail,
            file_path: e.file_path,
            progress_percent: e.progress_percent,
            metadata: (e.metadata ?? {}) as Record<string, unknown>,
          }),
        );

        if (incoming.length) {
          afterCursor = incoming[incoming.length - 1]!.created_at;
        }

        const jobStatus = body.job?.status ?? null;
        const isTerminal =
          jobStatus === "completed" ||
          jobStatus === "failed" ||
          incoming.some((e) => e.type === "completed" || e.type === "failed");

        setState((prev) => {
          const merged = [...(prev?.events ?? []), ...incoming];
          const capped =
            merged.length > MAX_CLIENT_EVENTS
              ? merged.slice(merged.length - MAX_CLIENT_EVENTS)
              : merged;
          const latest = capped[capped.length - 1] ?? null;
          const fromJob = body.job?.progress;
          const fromEvent = latest?.progress_percent;
          const progressPercent = Math.max(
            1,
            fromJob ?? fromEvent ?? (isTerminal ? 100 : Math.min(90, 5 + capped.length * 3)),
          );
          const next: BuildJobPollState = {
            jobId: job.jobId,
            eventsUrl: job.eventsUrl,
            status: jobStatus,
            events: capped,
            latest,
            progressPercent,
            error: body.job?.error_message ?? null,
            done: isTerminal,
            reconnecting: false,
          };
          if (isTerminal) onTerminal?.(next);
          return next;
        });

        const recentFileStream = incoming.some(
          (e) =>
            e.type === "writing_file" ||
            e.type === "editing_file" ||
            e.metadata?.extraction_stream === true,
        );
        if (!isTerminal) schedule(recentFileStream ? 320 : 600);
      } catch (err) {
        if (cancelled) return;
        setState((prev) =>
          prev
            ? {
                ...prev,
                error: err instanceof Error ? err.message : "Progress poll failed",
                reconnecting: true,
              }
            : {
                jobId: job.jobId,
                eventsUrl: job.eventsUrl,
                status: "starting",
                events: [],
                latest: null,
                progressPercent: 1,
                error: err instanceof Error ? err.message : "Progress poll failed",
                done: false,
                reconnecting: true,
              },
        );
        schedule(2000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [job?.jobId, job?.eventsUrl, onTerminal]);

  return state;
}
