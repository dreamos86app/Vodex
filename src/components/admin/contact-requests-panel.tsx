"use client";

import * as React from "react";
import { Loader2, Mail, Copy, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { selectCls } from "@/components/settings/shared";
import { toast } from "@/lib/toast";
import { displayContactStatus } from "@/lib/contact/contact-types";

export type ContactRequestRow = {
  id: string;
  created_at: string;
  updated_at?: string;
  user_id: string | null;
  owner_user_id?: string | null;
  project_id?: string | null;
  app_slug?: string | null;
  name: string;
  email: string;
  subject?: string | null;
  company: string | null;
  reason: string | null;
  kind: string | null;
  plan_interest: string | null;
  message: string;
  status: string;
  source: string;
  priority?: string;
  email_status?: string;
  metadata?: Record<string, unknown>;
};

type Props = {
  apiBase?: string;
  title?: string;
  showEmailConfigBanner?: boolean;
};

export function ContactRequestsPanel({
  apiBase = "/api/admin/contact-requests",
  title = "Contact Center",
  showEmailConfigBanner = true,
}: Props) {
  const [requests, setRequests] = React.useState<ContactRequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mainSection, setMainSection] = React.useState<"gmail" | "contacts" | "reports">("contacts");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<ContactRequestRow | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [emailConfigured, setEmailConfigured] = React.useState<boolean | null>(null);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [dnsGuidance, setDnsGuidance] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (search.trim()) params.set("q", search.trim());
    const qs = params.toString();
    const res = await fetch(`${apiBase}${qs ? `?${qs}` : ""}`, { credentials: "include" });
    const json = (await res.json()) as {
      requests?: ContactRequestRow[];
      emailConfigured?: boolean;
      resendDiagnostics?: { message?: string | null; configured?: boolean };
      dnsGuidance?: string[];
    };
    if (res.ok) {
      setRequests(json.requests ?? []);
      if (typeof json.emailConfigured === "boolean") setEmailConfigured(json.emailConfigured);
      setResendMessage(json.resendDiagnostics?.message ?? null);
      if (json.dnsGuidance) setDnsGuidance(json.dnsGuidance);
    }
    setLoading(false);
  }, [apiBase, statusFilter, sourceFilter, priorityFilter, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function patchRequest(id: string, body: Record<string, unknown>) {
    setUpdatingId(id);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) {
        await load();
        const json = (await res.json()) as { request?: ContactRequestRow };
        if (json.request && selected?.id === id) setSelected(json.request);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function retryEmail(id: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_email", id }),
      });
      const json = (await res.json()) as { error?: string; emailStatus?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Retry failed");
        return;
      }
      toast.success(`Email ${json.emailStatus ?? "queued"}`);
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  const sectioned = requests.filter((r) => {
    const kind = (r.kind ?? "").toLowerCase();
    const source = (r.source ?? "").toLowerCase();
    if (mainSection === "reports") return kind === "report" || source.includes("report");
    if (mainSection === "gmail") {
      return source.includes("gmail") || source.includes("email_inbound") || source.includes("inbound");
    }
    return kind !== "report" && !source.includes("report") && !source.includes("gmail") && !source.includes("email_inbound");
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="text-[11px]">
          <RefreshCw className="mr-1 size-3" /> Refresh
        </Button>
      </div>

      {showEmailConfigBanner && emailConfigured === false ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <AlertTriangle className="size-3.5 text-amber-600" /> Email sending not configured
          </p>
          <p className="mt-1">
            {resendMessage ??
              "Set RESEND_API_KEY and EMAIL_FROM on the server. Requests are still saved."}
          </p>
          {dnsGuidance.length > 0 ? (
            <ul className="mt-2 list-disc pl-4 space-y-0.5">
              {dnsGuidance.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["gmail", "contacts", "reports"] as const).map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setMainSection(section)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize ring-1 transition",
              mainSection === section ? "bg-accent text-white ring-accent" : "ring-border text-muted-foreground hover:text-foreground",
            )}
          >
            {section}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name, email, message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-[12px]"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cn(selectCls, "text-[12px]")}>
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="replied">Replied</option>
          <option value="resolved">Resolved</option>
          <option value="archived">Archived</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={cn(selectCls, "text-[12px]")}>
          <option value="all">All sources</option>
          <option value="platform_contact">Platform</option>
          <option value="generated_app_contact">Generated app</option>
          <option value="sales">Sales</option>
          <option value="support">Support</option>
          <option value="contact_page">Contact page</option>
          <option value="pricing_modal">Pricing modal</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={cn(selectCls, "text-[12px]")}>
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2 min-h-[200px]">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Mail className="mb-2 size-8 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="text-[13px] text-muted-foreground">No contact requests match these filters</p>
            </div>
          ) : (
            sectioned.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className={cn(
                  "w-full rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-left ring-1 ring-border transition hover:ring-accent/30",
                  selected?.id === c.id && "ring-accent/50 bg-accent/[0.04]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                  <div className="flex gap-1">
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                      {displayContactStatus(c.status)}
                    </span>
                    {c.email_status && c.email_status !== "sent" ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                        email:{c.email_status}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-[12.5px] font-medium text-foreground">
                  {c.name} · <span className="text-muted-foreground">{c.email}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  {c.subject ?? c.reason ?? c.source}
                  {c.project_id ? ` · project ${c.project_id.slice(0, 8)}…` : ""}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl bg-surface p-4 ring-1 ring-border lg:sticky lg:top-4 lg:self-start">
          {!selected ? (
            <p className="text-[12px] text-muted-foreground">Select a request to view details and actions.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold">{selected.subject ?? selected.reason ?? "Contact request"}</p>
              <p className="text-[12px] text-muted-foreground">
                {selected.name} · {selected.email}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Source: {selected.source}
                {selected.app_slug ? ` · ${selected.app_slug}` : ""}
              </p>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed">{selected.message}</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  onClick={() => void navigator.clipboard.writeText(selected.email).then(() => toast.success("Email copied"))}
                >
                  <Copy className="mr-1 size-3" /> Copy email
                </Button>
                {selected.project_id ? (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" asChild>
                    <a href={`/apps/${selected.project_id}/dashboard`}>
                      <ExternalLink className="mr-1 size-3" /> Open project
                    </a>
                  </Button>
                ) : null}
                {(selected.email_status === "failed" || selected.email_status === "skipped_no_config") && (
                  <Button
                    size="sm"
                    variant="accent"
                    className="h-7 text-[10px]"
                    disabled={updatingId === selected.id}
                    onClick={() => void retryEmail(selected.id)}
                  >
                    Retry email
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {(["new", "open", "replied", "resolved", "archived"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={selected.status === s ? "accent" : "ghost"}
                    className="h-7 text-[10px] capitalize"
                    disabled={updatingId === selected.id}
                    onClick={() => void patchRequest(selected.id, { status: s })}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Input
                  placeholder="Internal note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-8 text-[12px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={!note.trim() || updatingId === selected.id}
                  onClick={() => {
                    void patchRequest(selected.id, { internal_note: note.trim() }).then(() => setNote(""));
                  }}
                >
                  Add note
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
