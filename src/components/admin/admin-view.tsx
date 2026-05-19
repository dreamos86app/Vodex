"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Users,
  Zap,
  Shield,
  Search,
  Loader2,
  Check,
  AlertCircle,
  Lock,
  ShieldCheck,
  Mail,
  Activity,
  HardDriveUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AuthHealthPanel } from "@/components/admin/auth-health-panel";

type Tab = "users" | "contacts" | "ai" | "storage" | "audit" | "auth";

type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  plan_id: string;
  credits_remaining: number;
  created_at: string;
  avatar_url: string | null;
};

function GrantTokensForm({ userId, userName }: { userId: string; userName: string }) {
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [confirmOwner, setConfirmOwner] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<"success" | "error" | null>(null);

  async function grant() {
    if (!amount || !reason || !confirmOwner) return;
    setLoading(true);
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: parseInt(amount, 10), reason }),
    });
    setResult(res.ok ? "success" : "error");
    setLoading(false);
    if (res.ok) {
      setAmount("");
      setReason("");
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-background p-4 ring-1 ring-border">
      <p className="text-[12px] font-semibold text-foreground">Grant tokens to {userName}</p>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24"
          min="1"
          max="100000"
        />
        <Input
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="accent"
          size="sm"
          onClick={grant}
          disabled={loading || !amount || !reason || !confirmOwner}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Grant"}
        </Button>
      </div>
      <label className="flex items-start gap-2 text-[11.5px] text-muted-foreground">
        <input
          type="checkbox"
          checked={confirmOwner}
          onChange={(e) => setConfirmOwner(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Confirm as <strong className="text-foreground">dreamos86app@gmail.com</strong> — this
          changes live token balance.
        </span>
      </label>
      {result === "success" && (
        <p className="flex items-center gap-1 text-[12px] text-positive">
          <Check className="size-3.5" /> Tokens granted successfully
        </p>
      )}
      {result === "error" && (
        <p className="flex items-center gap-1 text-[12px] text-destructive">
          <AlertCircle className="size-3.5" /> Failed to grant tokens
        </p>
      )}
    </div>
  );
}

export type AdminTab = Tab;

export function AdminView({ initialTab = "users" }: { initialTab?: AdminTab }) {
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [users, setUsers] = React.useState<AdminUserRow[]>([]);
  const [contacts, setContacts] = React.useState<Record<string, unknown>[]>([]);
  const [aiEvents, setAiEvents] = React.useState<
    Array<{
      id: string;
      created_at: string;
      user_id: string;
      user_email: string;
      model_id: string;
      mode: string;
      tokens_charged: number;
      tokens_input: number | null;
      tokens_output: number | null;
      status: string;
      error_message: string | null;
      conversation_id: string | null;
      operation_id: string | null;
    }>
  >([]);
  const [storageEvents, setStorageEvents] = React.useState<
    Array<{ id: string; created_at: string; user_id: string; properties: Record<string, unknown> }>
  >([]);
  const [auditLogs, setAuditLogs] = React.useState<unknown[]>([]);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [grantTarget, setGrantTarget] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (activeTab !== "users") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const qs = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : "";
      const res = await fetch(`/api/admin/users${qs}`);
      const json = (await res.json()) as { users?: AdminUserRow[] };
      if (!cancelled) {
        if (res.ok) setUsers(json.users ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedSearch]);

  React.useEffect(() => {
    if (activeTab !== "contacts") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch("/api/admin/contact-requests");
      const json = (await res.json()) as { requests?: Record<string, unknown>[] };
      if (!cancelled) {
        if (res.ok) setContacts(json.requests ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== "ai") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch("/api/admin/ai-usage");
      const json = (await res.json()) as {
        events?: Array<{
          id: string;
          created_at: string;
          user_id: string;
          user_email: string;
          model_id: string;
          mode: string;
          tokens_charged: number;
          tokens_input: number | null;
          tokens_output: number | null;
          status: string;
          error_message: string | null;
          conversation_id: string | null;
          operation_id: string | null;
        }>;
      };
      if (!cancelled) {
        if (res.ok) setAiEvents(json.events ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== "storage") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch("/api/admin/storage-errors");
      const json = (await res.json()) as {
        events?: Array<{ id: string; created_at: string; user_id: string; properties: Record<string, unknown> }>;
      };
      if (!cancelled) {
        if (res.ok) setStorageEvents(json.events ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== "audit") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch("/api/admin/audit-logs");
      const json = (await res.json()) as { logs?: unknown[] };
      if (!cancelled) {
        if (res.ok) setAuditLogs(json.logs ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "contacts", label: "Contacts", icon: Mail },
    { id: "ai", label: "AI usage", icon: Activity },
    { id: "storage", label: "Uploads", icon: HardDriveUpload },
    { id: "audit", label: "Audit log", icon: Shield },
    { id: "auth", label: "Auth health", icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <motion.div variants={variants.fadeUp} initial="hidden" animate="show">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 ring-1 ring-destructive/20">
            <Lock className="size-4 text-destructive" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-foreground">Admin Panel</h1>
            <p className="text-[12px] text-muted-foreground">Restricted — enforced on the server for the product owner only</p>
          </div>
        </div>
      </motion.div>

      <div className="flex w-full max-w-full flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" strokeWidth={1.75} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search
              className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              placeholder="Search by email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 ring-border">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>User</span>
                <span>Plan</span>
                <span>Tokens</span>
                <span>Joined</span>
                <span>Actions</span>
              </div>
              {users.map((u) => (
                <div key={u.id}>
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-border/50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={u.full_name ?? u.email} src={u.avatar_url ?? undefined} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-foreground">{u.full_name ?? "—"}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-[12px] capitalize text-foreground">{u.plan_id}</span>
                    <span className="text-[12px] tabular-nums text-foreground">
                      {u.credits_remaining.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px]"
                      onClick={() =>
                        setGrantTarget(grantTarget?.id === u.id ? null : { id: u.id, name: u.full_name ?? u.email })
                      }
                    >
                      <Zap className="size-3.5 text-accent" strokeWidth={1.75} />
                      Grant
                    </Button>
                  </div>
                  {grantTarget?.id === u.id && (
                    <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
                      <GrantTokensForm userId={u.id} userName={grantTarget.name} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "contacts" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Mail className="mb-2 size-8 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="text-[13px] text-muted-foreground">No contact requests yet</p>
            </div>
          ) : (
            contacts.map((c, i) => (
              <div
                key={String((c.id as string | undefined) ?? `contact-${i}`)}
                className="rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border"
              >
                <pre className="max-h-40 overflow-auto text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(c, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "ai" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : aiEvents.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Activity className="mb-2 size-8 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="text-[13px] text-muted-foreground">No AI usage logged yet</p>
            </div>
          ) : (
            aiEvents.map((ev) => (
              <div key={ev.id} className="rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      ev.status === "success" ? "bg-positive/15 text-positive" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {ev.status}
                  </span>
                  <span className="text-[12px] font-medium text-foreground">{ev.model_id}</span>
                  <span className="text-[11px] text-muted-foreground">{ev.mode}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {ev.user_email}{" "}
                  <span className="font-mono text-muted-foreground/70">· {ev.user_id.slice(0, 8)}…</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                <p className="mt-2 text-[11px] text-foreground">
                  Charged{" "}
                  <span className="tabular-nums font-medium">{ev.tokens_charged}</span> tokens
                  {ev.tokens_input != null || ev.tokens_output != null ? (
                    <span className="text-muted-foreground">
                      {" "}
                      (in {ev.tokens_input ?? "—"} / out {ev.tokens_output ?? "—"})
                    </span>
                  ) : null}
                </p>
                {ev.error_message ? (
                  <p className="mt-1 text-[11px] text-destructive/90">{ev.error_message}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "storage" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : storageEvents.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <HardDriveUpload className="mb-2 size-8 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="text-[13px] text-muted-foreground">No storage errors recorded</p>
              <p className="mt-1 max-w-md text-[12px] text-muted-foreground/80">
                Failed avatar, workspace, group, or media uploads are logged here when the server can write analytics.
              </p>
            </div>
          ) : (
            storageEvents.map((ev) => (
              <div key={ev.id} className="rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border">
                <p className="text-[12px] text-foreground">
                  User <span className="font-mono text-[11px] text-muted-foreground">{ev.user_id}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                <pre className="mt-2 max-h-32 overflow-auto text-[11px] text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(ev.properties, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "auth" && (
        <div className="max-w-2xl">
          <AuthHealthPanel />
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Shield className="mb-2 size-8 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="text-[13px] text-muted-foreground">No audit events yet</p>
            </div>
          ) : (
            (
              auditLogs as Array<{
                id: string;
                action: string;
                created_at: string;
                actor_id?: string;
                target_id?: string;
                details: Record<string, unknown>;
              }>
            ).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <Shield className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground">{log.action}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(log.details).slice(0, 120)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
