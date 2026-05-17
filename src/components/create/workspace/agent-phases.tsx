"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { AGENTS, PHASE_MARKER, type AgentRole } from "@/lib/creation/orchestration";
import { cn } from "@/lib/utils";

interface ParsedPhase {
  role: AgentRole;
  title: string;
  /** Body text from after the header up to (but not including) the next header */
  body: string;
}

/**
 * Parse a streaming markdown response into a sequence of agent phases.
 * Anything before the first phase header is treated as a "preamble" and
 * rendered above the phase cards.
 */
export function parsePhases(text: string): {
  preamble: string;
  phases: ParsedPhase[];
} {
  const lines = text.split("\n");
  const phases: ParsedPhase[] = [];
  const preambleLines: string[] = [];
  let current: ParsedPhase | null = null;
  let inPreamble = true;

  for (const line of lines) {
    const m = line.match(PHASE_MARKER);
    if (m) {
      const role = m[1] as AgentRole;
      const title = m[2].trim();
      if (!(role in AGENTS)) {
        // Unknown role — keep the line in the previous phase or preamble
        if (current) current.body += "\n" + line;
        else preambleLines.push(line);
        continue;
      }
      if (current) phases.push(current);
      current = { role, title, body: "" };
      inPreamble = false;
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else if (inPreamble) {
      preambleLines.push(line);
    }
  }
  if (current) phases.push(current);

  return {
    preamble: preambleLines.join("\n").trim(),
    phases,
  };
}

function getIcon(name: string): React.ElementType {
  const Icons = LucideIcons as unknown as Record<string, React.ElementType | undefined>;
  return Icons[name] ?? LucideIcons.Sparkles;
}

/**
 * Render a parsed orchestration response as labeled agent cards.
 *
 * Each card shows the agent's icon + label, the phase title, and the
 * body content. Phases animate in as the stream produces them.
 */
export function AgentPhases({
  text,
  streaming,
  className,
}: {
  text: string;
  streaming?: boolean;
  className?: string;
}) {
  const parsed = React.useMemo(() => parsePhases(text), [text]);

  // No phase markers found — render plain text (model didn't follow the
  // orchestration format, which is fine for short Discuss-mode answers).
  if (parsed.phases.length === 0) {
    return text ? (
      <div className={cn("whitespace-pre-wrap text-[13.5px] leading-relaxed", className)}>
        {text}
      </div>
    ) : null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {parsed.preamble && (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
          {parsed.preamble}
        </p>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {parsed.phases.map((phase, i) => {
            const agent = AGENTS[phase.role];
            const Icon = getIcon(agent.icon);
            const isLast = i === parsed.phases.length - 1;
            const isStreamingPhase = streaming && isLast;
            return (
              <motion.div
                key={`${i}-${phase.role}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden rounded-xl bg-background ring-1 ring-border"
              >
                <div className="flex items-center gap-2 border-b border-border bg-surface/40 px-3 py-2">
                  <div className={cn("flex size-6 items-center justify-center rounded-md bg-muted", agent.accent)}>
                    <Icon className="size-3.5" strokeWidth={1.75} />
                  </div>
                  <span className={cn("text-[11px] font-semibold tracking-[0.08em] uppercase", agent.accent)}>
                    {agent.label}
                  </span>
                  <span className="ml-1 truncate text-[12.5px] text-foreground">
                    {phase.title}
                  </span>
                  {isStreamingPhase && (
                    <span className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                      working
                    </span>
                  )}
                </div>
                <div className="prose-orch px-3 py-2 text-[13px] leading-relaxed text-foreground">
                  <PhaseBody body={phase.body} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Lightweight markdown rendering for phase bodies. Handles fenced code
 * blocks, inline code, and bullets — enough to make a streaming response
 * feel rich without pulling in a heavy markdown lib.
 */
function PhaseBody({ body }: { body: string }) {
  const parts = React.useMemo(() => parseBlocks(body), [body]);
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "code") {
          return (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[11.5px] leading-relaxed text-foreground ring-1 ring-border"
            >
              {p.lang && (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {p.lang}
                </div>
              )}
              <code>{p.content}</code>
            </pre>
          );
        }
        return (
          <p
            key={i}
            className="my-1 whitespace-pre-wrap"
            // Inline `code` and **bold** rendered inline:
            dangerouslySetInnerHTML={{ __html: renderInline(p.content) }}
          />
        );
      })}
    </>
  );
}

interface CodeBlock { kind: "code"; lang: string; content: string }
interface TextBlock { kind: "text"; content: string }
type Block = CodeBlock | TextBlock;

function parseBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  const lines = input.split("\n");
  let i = 0;
  let textBuf: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      if (textBuf.length) {
        blocks.push({ kind: "text", content: textBuf.join("\n").trim() });
        textBuf = [];
      }
      const lang = fence[1] || "";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      // Skip closing fence (if present)
      i += 1;
      blocks.push({ kind: "code", lang, content: codeLines.join("\n") });
    } else {
      textBuf.push(line);
      i += 1;
    }
  }
  if (textBuf.length) {
    const tail = textBuf.join("\n").trim();
    if (tail) blocks.push({ kind: "text", content: tail });
  }
  return blocks;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // `code`
  out = out.replace(
    /`([^`]+)`/g,
    "<code class=\"rounded bg-muted px-1 font-mono text-[12px]\">$1</code>",
  );
  // Bullets at the start of a line
  out = out.replace(/^- (.+)$/gm, "<span class=\"flex gap-2\"><span class=\"mt-2 size-1 shrink-0 rounded-full bg-accent\"></span><span>$1</span></span>");
  return out;
}
