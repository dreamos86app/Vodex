import { CORE_TEMPLATES } from "@/lib/templates/template-archetypes";

export function getTemplateUiPatterns(templateId: string): string[] {
  return CORE_TEMPLATES.find((t) => t.id === templateId)?.uiPatterns ?? ["app shell", "responsive grid"];
}

export function listAllUiPatterns() {
  return CORE_TEMPLATES.map((t) => ({ id: t.id, patterns: t.uiPatterns }));
}
