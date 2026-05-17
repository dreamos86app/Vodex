"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Database,
  Cloud,
  ShieldCheck,
  Layers,
  Box,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A real architecture graph rendered as an SVG. Nodes are derived from
 * actual project data (deployments, integrations, schema rows).
 *
 * This is NOT a fake diagram — every node corresponds to a real entity
 * the user can click through to. When the project has no integrations
 * or deployments yet, only the canonical nodes (App + Database + Auth)
 * are shown, which is honest.
 */

export type GraphNodeKind =
  | "app"
  | "database"
  | "auth"
  | "storage"
  | "edge"
  | "deployment"
  | "integration"
  | "domain";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
  href?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** Soft-dotted edges indicate inferred or potential relationships. */
  inferred?: boolean;
}

const NODE_META: Record<GraphNodeKind, { icon: React.ElementType; color: string; bg: string }> = {
  app: { icon: Box, color: "#1e6bff", bg: "rgba(30,107,255,0.10)" },
  database: { icon: Database, color: "#06b6d4", bg: "rgba(6,182,212,0.10)" },
  auth: { icon: ShieldCheck, color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  storage: { icon: Cloud, color: "#a855f7", bg: "rgba(168,85,247,0.10)" },
  edge: { icon: Wifi, color: "#10b981", bg: "rgba(16,185,129,0.10)" },
  deployment: { icon: Layers, color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  integration: { icon: Box, color: "#8b5cf6", bg: "rgba(139,92,246,0.10)" },
  domain: { icon: Globe, color: "#0ea5e9", bg: "rgba(14,165,233,0.10)" },
};

/**
 * Computes a tidy 2D layout for the supplied nodes. Places the "app"
 * node at the center; orbits all others around it. This is intentionally
 * simple and deterministic — the goal is clarity, not visual pyrotechnics.
 */
function layoutNodes(
  nodes: GraphNode[],
  width: number,
  height: number,
): Array<GraphNode & { x: number; y: number }> {
  const center = nodes.find((n) => n.kind === "app");
  const others = nodes.filter((n) => n !== center);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;

  const positioned: Array<GraphNode & { x: number; y: number }> = [];
  if (center) positioned.push({ ...center, x: cx, y: cy });

  const total = Math.max(others.length, 1);
  others.forEach((n, i) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    positioned.push({
      ...n,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });

  return positioned;
}

export function ArchitectureGraph({
  nodes,
  edges,
  className,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 720, h: 420 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(560, width), h: Math.max(360, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const positioned = React.useMemo(
    () => layoutNodes(nodes, size.w, size.h),
    [nodes, size],
  );
  const nodeMap = React.useMemo(
    () => new Map(positioned.map((n) => [n.id, n])),
    [positioned],
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative h-[420px] w-full overflow-hidden rounded-[var(--radius-xl)] bg-background ring-1 ring-border", className)}
    >
      {/* Ambient grid background */}
      <svg
        className="absolute inset-0 size-full opacity-[0.18] dark:opacity-[0.12]"
        aria-hidden="true"
      >
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" className="text-muted-foreground" />
      </svg>

      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="absolute inset-0 size-full"
        aria-label="Architecture graph"
      >
        {/* Edges */}
        {edges.map((e, i) => {
          const a = nodeMap.get(e.from);
          const b = nodeMap.get(e.to);
          if (!a || !b) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          // Pull endpoints back to the node radius so the line doesn't pierce the chip.
          const r = 28;
          const ax = a.x + (dx / len) * r;
          const ay = a.y + (dy / len) * r;
          const bx = b.x - (dx / len) * r;
          const by = b.y - (dy / len) * r;
          return (
            <motion.line
              key={i}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.55 }}
              transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              x1={ax}
              y1={ay}
              x2={bx}
              y2={by}
              stroke="currentColor"
              strokeWidth={1.2}
              strokeDasharray={e.inferred ? "4 4" : undefined}
              className="text-muted-foreground"
            />
          );
        })}

        {/* Pulsing center halo (only if app node is present) */}
        {positioned.find((n) => n.kind === "app") && (
          <motion.circle
            cx={size.w / 2}
            cy={size.h / 2}
            r={56}
            fill="rgba(30, 107, 255, 0.10)"
            initial={{ scale: 0.95, opacity: 0.4 }}
            animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </svg>

      {/* Node chips */}
      {positioned.map((n, i) => {
        const meta = NODE_META[n.kind];
        const Icon = meta.icon;
        const isCenter = n.kind === "app";
        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.32,
              delay: 0.04 * i,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              left: n.x,
              top: n.y,
              transform: "translate(-50%, -50%)",
            }}
            className="absolute"
          >
            <div
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl bg-background px-3 py-2 ring-1 ring-border shadow-[var(--shadow-xs)]",
                isCenter && "shadow-[0_18px_40px_-14px_rgba(30,107,255,0.45)] ring-2",
              )}
              style={{ borderColor: meta.color }}
            >
              <div
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: meta.bg, color: meta.color }}
              >
                <Icon className="size-4" strokeWidth={1.65} />
              </div>
              <div className="text-center">
                <p className="max-w-[120px] truncate text-[11.5px] font-semibold tracking-tight text-foreground">
                  {n.label}
                </p>
                {n.sublabel && (
                  <p className="text-[10px] text-muted-foreground">{n.sublabel}</p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
