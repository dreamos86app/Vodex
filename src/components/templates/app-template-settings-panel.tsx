"use client";

import * as React from "react";
import { Loader2, Image as ImageIcon, Eye } from "lucide-react";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { PublishTemplateModal } from "@/components/templates/publish-template-modal";
import { isPaidPlan } from "@/lib/billing/plan-features";

const CATEGORIES = ["SaaS", "Mobile", "AI", "Commerce", "Community", "Productivity", "Other"] as const;

export function AppTemplateSettingsPanel({
  projectId,
  planId,
  defaultTitle,
  hasFiles,
}: {
  projectId: string;
  planId?: string | null;
  defaultTitle: string;
  hasFiles: boolean;
}) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState<"public" | "private" | "featured">("public");
  const [allowClone, setAllowClone] = React.useState(true);
  const [allowRemix, setAllowRemix] = React.useState(true);
  const [category, setCategory] = React.useState<string>(CATEGORIES[0]);
  const [description, setDescription] = React.useState("");
  const [thumbnail, setThumbnail] = React.useState("");
  const canPublish = isPaidPlan(planId ?? "free") && hasFiles;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="app-template-settings">
      <div>
        <h2 className="text-[16px] font-semibold text-foreground">App Template</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Control how your app appears as a community template — separate from Explore app listing.
        </p>
      </div>

      <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-border/80">
        <p className="text-[12px] font-semibold text-foreground">Visibility</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["public", "Public"],
              ["private", "Private"],
              ["featured", "Featured candidate"],
            ] as const
          ).map(([id, label]) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-background px-3 py-2 ring-1 ring-border/60"
            >
              <input
                type="radio"
                name="template-visibility"
                checked={visibility === id}
                onChange={() => setVisibility(id)}
              />
              <span className="text-[12px]">{label}</span>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={allowClone} onChange={(e) => setAllowClone(e.target.checked)} />
          Allow cloning
        </label>
        <label className="flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={allowRemix} onChange={(e) => setAllowRemix(e.target.checked)} />
          Allow remixing
        </label>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border"
            placeholder="What builders will get when they use this template"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Thumbnail URL</label>
          <div className="mt-1 flex gap-2">
            <input
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border"
              placeholder="https://…"
            />
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
              <ImageIcon className="size-4 text-muted-foreground" />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={!canPublish}
            onClick={() => setModalOpen(true)}
            className="rounded-xl bg-accent px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {canPublish ? "Publish template" : "Upgrade to publish templates"}
          </button>
          <Link
            href={`/apps/${projectId}/builder?tab=preview`}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold ring-1 ring-border"
          >
            <Eye className="size-3.5" />
            Preview app
          </Link>
        </div>

        {!canPublish ? (
          <p className="text-[11px] text-muted-foreground">
            Paid plans with generated files can publish to{" "}
            <Link href="/templates?tab=community" className="text-accent hover:underline">
              Community Templates
            </Link>
            .
          </p>
        ) : null}
      </div>

      <PublishTemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        defaultTitle={defaultTitle}
      />
    </div>
  );
}
