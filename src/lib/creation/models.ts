/**
 * DreamOS86 — Creation model registry.
 *
 * The IDs match what /api/chat understands (see src/app/api/chat/route.ts).
 * Ratings are bounded 1–5 and reflect real, public benchmarks.  Don't
 * inflate them — the user trusts these numbers.
 */

export type Rating1to5 = 1 | 2 | 3 | 4 | 5;

export type ModelSpecialization =
  | "architecture"  // System design, trade-off reasoning, planning
  | "frontend"      // UI/UX, component generation, design
  | "backend"       // APIs, services, database, auth
  | "fullstack"     // Strong across all layers
  | "analysis"      // Large-context ingestion, research, audit
  | "speed"         // Rapid iteration, discussion, quick edits
  | "reasoning"     // Deep thinking, novel problems, optimization
  | "multimodal";   // Vision, image-to-code, asset analysis

export interface CreationModel {
  /** Must match /api/chat MODEL_CREDITS keys */
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google" | "deepseek";
  /** One-line tagline shown under the name */
  tagline: string;
  /** Realistic 1–5 ratings */
  ratings: {
    intelligence: Rating1to5;
    reasoning: Rating1to5;
    frontend: Rating1to5;
    backend: Rating1to5;
    speed: Rating1to5;
    cost: Rating1to5; // 5 = cheapest, 1 = priciest
    orchestration: Rating1to5;
  };
  multimodal: boolean;
  contextK: number; // thousands of tokens
  /** Credits per generation — must match /api/chat MODEL_CREDITS */
  credits: number;
  /** Primary specialization — drives auto-routing in Build mode */
  specialization: ModelSpecialization;
  /** Role in multi-model orchestration chains */
  orchestrationRole: string;
  /** When to reach for it */
  idealFor: string[];
  /** Honest weaknesses */
  weaknesses: string[];
  /** Hex color used for accent dots */
  accent: string;
}

export const CREATION_MODELS: CreationModel[] = [
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    tagline: "Architectural reasoning + frontier code quality",
    ratings: { intelligence: 5, reasoning: 5, frontend: 5, backend: 5, speed: 3, cost: 3, orchestration: 5 },
    multimodal: true,
    contextK: 200,
    credits: 3,
    specialization: "architecture",
    orchestrationRole: "Lead architect — plans system structure, routes, and multi-agent strategy",
    idealFor: ["Full app architecture", "Complex refactors", "Frontend system design", "Multi-file edits"],
    weaknesses: ["Slower than Haiku", "Higher cost than mini-class models"],
    accent: "#c08660",
  },
  {
    id: "claude-opus-4",
    name: "Claude Opus 4",
    provider: "anthropic",
    tagline: "Maximum reasoning depth — for the hardest problems",
    ratings: { intelligence: 5, reasoning: 5, frontend: 5, backend: 5, speed: 2, cost: 1, orchestration: 5 },
    multimodal: true,
    contextK: 200,
    credits: 10,
    specialization: "reasoning",
    orchestrationRole: "Deep reasoner — used for system-critical decisions, novel architecture, and validation",
    idealFor: ["Hardest architectural problems", "Deep reasoning chains", "End-to-end system planning", "Security audits"],
    weaknesses: ["Slow — best for planning phases", "Expensive — use intentionally"],
    accent: "#c08660",
  },
  {
    id: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    tagline: "Fast, cheap, surprisingly capable",
    ratings: { intelligence: 3, reasoning: 3, frontend: 4, backend: 3, speed: 5, cost: 5, orchestration: 3 },
    multimodal: false,
    contextK: 200,
    credits: 1,
    specialization: "speed",
    orchestrationRole: "Rapid executor — handles quick edits, discussion turns, and high-frequency tasks",
    idealFor: ["Quick component edits", "Live discussion", "Bug triage", "Iteration loops"],
    weaknesses: ["Weaker on novel architecture", "Less reliable for large refactors"],
    accent: "#c08660",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    tagline: "Strong all-rounder with excellent vision",
    ratings: { intelligence: 5, reasoning: 4, frontend: 4, backend: 4, speed: 4, cost: 3, orchestration: 4 },
    multimodal: true,
    contextK: 128,
    credits: 4,
    specialization: "multimodal",
    orchestrationRole: "Visual intelligence — converts designs, screenshots, and images into working UI",
    idealFor: ["Image-to-UI generation", "Design reference translation", "Vision-driven edits", "Mixed reasoning + speed"],
    weaknesses: ["Smaller context than Claude/Gemini", "Occasional reasoning inconsistencies"],
    accent: "#10a37f",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "openai",
    tagline: "Fastest OpenAI model — high-volume tasks",
    ratings: { intelligence: 3, reasoning: 3, frontend: 3, backend: 3, speed: 5, cost: 5, orchestration: 2 },
    multimodal: true,
    contextK: 128,
    credits: 1,
    specialization: "speed",
    orchestrationRole: "Bulk processor — handles high-frequency, low-complexity orchestration subtasks",
    idealFor: ["Bulk discussion turns", "Rapid iteration", "Cheap lookups", "Non-critical generation"],
    weaknesses: ["Limited deep reasoning", "Not for full system architecture"],
    accent: "#10a37f",
  },
  {
    id: "gemini-2-5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    tagline: "1M context — ingests entire codebases",
    ratings: { intelligence: 5, reasoning: 5, frontend: 4, backend: 4, speed: 3, cost: 2, orchestration: 4 },
    multimodal: true,
    contextK: 1000,
    credits: 5,
    specialization: "analysis",
    orchestrationRole: "Context specialist — analyzes entire repos, long docs, and multi-file systems at once",
    idealFor: ["Whole-codebase analysis", "Large PDF ingestion", "Full repo refactors", "Deep context tasks"],
    weaknesses: ["Verbose output", "Slower for short, simple tasks"],
    accent: "#4285f4",
  },
  {
    id: "gemini-2-0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    tagline: "Fast multimodal with 1M context window",
    ratings: { intelligence: 3, reasoning: 3, frontend: 3, backend: 3, speed: 5, cost: 5, orchestration: 3 },
    multimodal: true,
    contextK: 1000,
    credits: 1,
    specialization: "speed",
    orchestrationRole: "Fast multimodal executor — cheap long-context tasks with vision support",
    idealFor: ["Cheap multimodal analysis", "Long-context discussion", "Quick summarization", "Vision + speed"],
    weaknesses: ["Lower reasoning ceiling", "Not for novel architecture problems"],
    accent: "#4285f4",
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    provider: "deepseek",
    tagline: "Frontier reasoning at near-zero cost",
    ratings: { intelligence: 4, reasoning: 5, frontend: 4, backend: 5, speed: 3, cost: 5, orchestration: 4 },
    multimodal: false,
    contextK: 64,
    credits: 1,
    specialization: "backend",
    orchestrationRole: "Backend specialist — excels at API design, data modeling, and server-side logic",
    idealFor: ["Backend architecture", "API design", "Database schema", "Cost-sensitive deep tasks"],
    weaknesses: ["No vision", "Smaller context than Claude/Gemini", "Frontend weaker than Anthropic"],
    accent: "#7c3aed",
  },
];

export const DEFAULT_MODEL_ID = "claude-3-5-sonnet";

export function getModel(id: string): CreationModel {
  return CREATION_MODELS.find((m) => m.id === id) ?? CREATION_MODELS[0];
}

/** Three creation modes */
export type CreationMode = "discuss" | "edit" | "build";

export const MODE_META: Record<
  CreationMode,
  { label: string; description: string; hint: string; icon: string }
> = {
  discuss: {
    label: "Discuss",
    description:
      "Architecture, planning, debugging, research. Pick your model, have a real conversation.",
    hint: "Describe what you're thinking. Plan, explore, or diagnose.",
    icon: "MessageCircle",
  },
  edit: {
    label: "Edit",
    description:
      "Scope a prompt to a specific section, component, page, or layer. Precise, surgical edits.",
    hint: "Choose a scope, then describe the change.",
    icon: "Pencil",
  },
  build: {
    label: "Build",
    description:
      "Generate entire systems. Routes, backend, schemas, UI, animations, and runtime flows — all at once.",
    hint: "Describe the app you want. DreamOS86 builds the entire thing.",
    icon: "Zap",
  },
};
