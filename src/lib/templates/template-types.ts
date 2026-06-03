export type TemplateCategory =
  | "saas"
  | "ai"
  | "marketplace"
  | "social"
  | "finance"
  | "productivity"
  | "portfolio"
  | "mobile"
  | "community"
  | "enterprise";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  gradient: string;
  accent: string;
  tags: string[];
  complexity: "simple" | "medium" | "advanced";
  popular?: boolean;
  new?: boolean;
  prompt: string;
}
