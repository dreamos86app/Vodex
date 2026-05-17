/**
 * DreamOS86 — Orchestration framing.
 *
 * The user's goal: feel like multiple specialist agents are collaborating.
 * The honest reality: we have one streaming AI SDK call per request.
 *
 * Resolution: prompt the model to structure its single response as a
 * sequence of NAMED PHASES, each prefixed with a parseable header. The
 * client then renders those phases as labeled "agent" cards as the stream
 * arrives — no fake parallelism, no fabricated agent activity.
 *
 * This is a real architectural pattern (see Anthropic's "Building
 * effective agents" and OpenAI's structured-output guidance). It produces
 * output the user can verify visually because every phase is grounded in
 * the actual response text.
 */

export type AgentRole =
  | "architect"      // overall plan, scope, tradeoffs
  | "frontend"       // UI/UX/components/animations
  | "backend"        // APIs/services/business logic
  | "design"         // visual identity, design system
  | "motion"         // animations, transitions, interactions
  | "database"       // schema, migrations, RLS
  | "security"       // authn/authz, data isolation, secret handling
  | "deployment"     // build, env, CDN, domain
  | "refactor"       // code health, dead code, consolidation
  | "performance"   // loading, bundle, queries, caching
  | "ux";            // copy, empty states, error states, accessibility

export interface AgentDefinition {
  role: AgentRole;
  label: string;
  brief: string;
  /** Lucide icon name (resolved on the client) */
  icon: string;
  /** Tailwind text/bg color hint */
  accent: string;
}

export const AGENTS: Record<AgentRole, AgentDefinition> = {
  architect: {
    role: "architect",
    label: "Architect",
    brief: "Plans scope, dependencies, file changes, and tradeoffs.",
    icon: "Compass",
    accent: "text-blue-500",
  },
  frontend: {
    role: "frontend",
    label: "Frontend",
    brief: "Components, layouts, state, and rendering.",
    icon: "LayoutGrid",
    accent: "text-violet-500",
  },
  backend: {
    role: "backend",
    label: "Backend",
    brief: "Route handlers, services, and integrations.",
    icon: "Server",
    accent: "text-emerald-500",
  },
  design: {
    role: "design",
    label: "Design system",
    brief: "Tokens, typography, spacing, and visual identity.",
    icon: "Palette",
    accent: "text-pink-500",
  },
  motion: {
    role: "motion",
    label: "Motion",
    brief: "Transitions, gestures, and micro-interactions.",
    icon: "Wand2",
    accent: "text-amber-500",
  },
  database: {
    role: "database",
    label: "Database",
    brief: "Tables, RLS policies, and migrations.",
    icon: "Database",
    accent: "text-cyan-500",
  },
  security: {
    role: "security",
    label: "Security",
    brief: "Auth, secrets, and data isolation.",
    icon: "ShieldCheck",
    accent: "text-red-500",
  },
  deployment: {
    role: "deployment",
    label: "Deployment",
    brief: "Build, env vars, domains, and rollout.",
    icon: "Rocket",
    accent: "text-indigo-500",
  },
  refactor: {
    role: "refactor",
    label: "Refactor",
    brief: "Dead-code removal and consolidation.",
    icon: "Recycle",
    accent: "text-lime-600",
  },
  performance: {
    role: "performance",
    label: "Performance",
    brief: "Bundle, queries, and caching.",
    icon: "Gauge",
    accent: "text-orange-500",
  },
  ux: {
    role: "ux",
    label: "UX",
    brief: "Copy, accessibility, and empty/error states.",
    icon: "MessageSquare",
    accent: "text-teal-500",
  },
};

/** Marker the model emits to delimit a phase header. Parseable, simple. */
export const PHASE_MARKER = /^##\s+\[([a-z]+)\]\s+(.+)$/;

/**
 * Build the system prompt for orchestration.
 * Three modes: discuss (conversational), edit (surgical), build (full-system generation).
 */
export function buildOrchestrationSystem(args: {
  mode: "discuss" | "edit" | "build";
  scope?: string | null;
  projectMemoryBlock?: string;
  hasProject: boolean;
}): string {
  const { mode, scope, projectMemoryBlock, hasProject } = args;

  // Build mode = full 7-phase system generation
  if (mode === "build") {
    const buildAgents: AgentRole[] = [
      "architect", "design", "database", "backend",
      "security", "frontend", "motion",
    ];
    const agentList = buildAgents
      .map((r) => `- [${r}] ${AGENTS[r].label} — ${AGENTS[r].brief}`)
      .join("\n");

    return [
      `You are DreamOS86 in BUILD mode. You are an AI operating system that generates entire application systems from scratch. You orchestrate 7 specialist agents simultaneously.`,
      "",
      `Active specialists:`,
      agentList,
      "",
      `Your response MUST follow this 7-phase structure. Each phase MUST start with:`,
      `## [<role>] <phase title>`,
      "",
      `Required phases in order:`,
      `1. ## [architect] App Architecture Plan — define routes, data flows, tech decisions, file structure`,
      `2. ## [design] Design System — color palette, typography, spacing, component patterns, dark/light`,
      `3. ## [database] Data Schema — tables, columns, relationships, RLS policies, indexes`,
      `4. ## [backend] API & Services — route handlers, Supabase queries, auth flows, integrations`,
      `5. ## [security] Security Model — auth gates, RLS rules, secret handling, permissions`,
      `6. ## [frontend] UI Generation — all page/component code with full styling and interactivity`,
      `7. ## [motion] Motion & Polish — animations, transitions, hover states, loading choreography`,
      "",
      `CRITICAL RULES for BUILD mode:`,
      `- Generate COMPLETE, PRODUCTION-READY code. No TODO comments, no skeleton components.`,
      `- Every file must have correct imports, proper TypeScript types, and full implementation.`,
      `- Use Next.js 15+ App Router, Tailwind CSS, Supabase, Framer Motion.`,
      `- Every database table needs RLS policies. Every route needs auth checks.`,
      `- After code, briefly explain the architectural WHY — help the user understand decisions.`,
      `- Make the UI beautiful: premium spacing, coherent typography, responsive layouts.`,
      hasProject
        ? `- There is an existing project. Build ON TOP of it — respect existing architecture.`
        : `- This is a new project. Build it from scratch, complete and deployable.`,
      "",
      projectMemoryBlock || "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Edit and discuss modes
  const relevantAgents: AgentRole[] =
    mode === "discuss"
      ? ["architect", "frontend", "backend", "database", "security", "ux"]
      : scope === "schema"
        ? ["architect", "database", "security"]
        : scope === "ui" || scope === "component" || scope === "page" || scope === "layout"
          ? ["architect", "frontend", "design", "motion", "ux"]
          : scope === "api"
            ? ["architect", "backend", "security"]
            : scope === "auth"
              ? ["architect", "backend", "security", "ux"]
              : scope === "animation"
                ? ["motion", "performance"]
                : scope === "workflow"
                  ? ["architect", "frontend", "backend", "ux"]
                  : ["architect", "frontend", "backend"];

  const agentList = relevantAgents
    .map((r) => `- [${r}] ${AGENTS[r].label} — ${AGENTS[r].brief}`)
    .join("\n");

  return [
    `You are DreamOS86, an AI-native software operating system. You orchestrate a panel of specialists. For this request, these specialists are active:`,
    "",
    agentList,
    "",
    `Respond as a sequence of phases. Each phase MUST start with:`,
    `## [<role>] <one-line phase title>`,
    `where <role> is one of the role keys above (lowercase, in brackets). Phase bodies use normal markdown.`,
    "",
    `Rules:`,
    `- Always start with a [architect] phase that lays out the plan in 2-5 bullets.`,
    `- End with the most relevant specialist's phase.`,
    `- Never claim actions were taken; describe what should be done and why.`,
    `- Be concrete: name files, function names, table columns. Show code in fenced blocks.`,
    `- ${mode === "edit" ? `EDIT MODE: scope changes strictly to: ${scope ?? "(no scope — ask the user first)"}. Leave unrelated code untouched.` : `DISCUSS MODE: explain trade-offs and ask clarifying questions when uncertain.`}`,
    hasProject
      ? `- There is an active project. Respect its prior architecture decisions.`
      : `- No active project yet. Help the user shape one before generating code.`,
    "",
    projectMemoryBlock || "",
  ]
    .filter(Boolean)
    .join("\n");
}
