import { CORE_TEMPLATES } from "@/lib/templates/template-archetypes";

export function getTemplateDataModel(templateId: string) {
  return CORE_TEMPLATES.find((t) => t.id === templateId)?.defaultDataModel ?? [];
}

export function listTemplateDataModels() {
  return CORE_TEMPLATES.map((t) => ({ id: t.id, tables: t.defaultDataModel }));
}
