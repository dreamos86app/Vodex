import { CORE_TEMPLATES } from "@/lib/templates/template-archetypes";

export function getTemplateFilePlan(templateId: string): string[] {
  const t = CORE_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return ["app/page.tsx", "app/layout.tsx", "components/app-shell.tsx"];
  return [
    "app/layout.tsx",
    "app/page.tsx",
    ...t.defaultRoutes.map((r) => `app${r === "/" ? "" : r}/page.tsx`.replace("[id]", "[slug]")),
    ...t.defaultComponents.map((c) => `components/${c.toLowerCase().replace(/\s+/g, "-")}.tsx`),
    "lib/mock-data.ts",
    "lib/types.ts",
  ];
}
