/** Full runtime action catalog — Action Credits (not Build Credits). */

export const RUNTIME_ACTION_CATALOG = {
  database_crud: { floor: 0, label: "Database CRUD", category: "free" },
  contact_db_save: { floor: 0, label: "Contact DB save", category: "free" },
  contact_form_submit: { floor: 0, label: "Contact form save", category: "free" },
  webhook_call: { floor: 1, label: "Webhook call", category: "automation" },
  automation_run: { floor: 1, label: "Automation run", category: "automation" },
  automation_run_basic: { floor: 1, label: "Automation run (basic)", category: "automation" },
  file_upload: { floor: 0, label: "File upload", category: "file" },
  file_processing: { floor: 1, label: "File processing", category: "file" },
  data_extraction: { floor: 5, label: "Data extraction", category: "file" },
  email_send: { floor: 1, label: "Email send (legacy)", category: "email" },
  email_send_basic: { floor: 1, label: "Email send (basic)", category: "email" },
  email_send_notification: { floor: 1, label: "Email notification", category: "email" },
  email_send_transactional: { floor: 1, label: "Transactional email", category: "email" },
  email_bulk_or_sequence: { floor: 1, label: "Bulk/sequence email (per recipient)", category: "email" },
  llm_micro: { floor: 1, label: "LLM micro", category: "llm" },
  llm_small: { floor: 1, label: "LLM small", category: "llm" },
  llm_main: { floor: 3, label: "LLM main", category: "llm" },
  llm_generation: { floor: 5, label: "LLM generation (legacy)", category: "llm" },
  llm_generation_simple: { floor: 1, label: "LLM generation simple", category: "llm" },
  llm_generation_standard: { floor: 6, label: "LLM generation standard", category: "llm" },
  llm_generation_advanced: { floor: 11, label: "LLM generation advanced", category: "llm" },
  ai_agent_step: { floor: 5, label: "AI agent step", category: "llm" },
  ai_agent_message: { floor: 5, label: "AI agent message", category: "llm" },
  ai_workflow_step: { floor: 5, label: "AI workflow step", category: "llm" },
  image_generation: { floor: 3, label: "Image generation (legacy)", category: "image" },
  image_simple: { floor: 1, label: "Image simple", category: "image" },
  image_standard: { floor: 5, label: "Image standard", category: "image" },
  image_premium: { floor: 40, label: "Image premium (add-on only)", category: "image" },
  image_edit: { floor: 40, label: "Image edit (add-on only)", category: "image" },
  speech_generation: { floor: 1, label: "Speech generation", category: "media" },
  speech_transcription: { floor: 1, label: "Speech transcription", category: "media" },
  video_generation: { floor: 55, label: "Video draft generation", category: "media" },
  mobile_readiness_scan: { floor: 0, label: "Mobile readiness scan", category: "free" },
  mobile_wrapper_zip_local: { floor: 0, label: "Local wrapper export", category: "free" },
  android_build: { floor: 35, label: "Android cloud build (APK/AAB)", category: "mobile" },
  android_aab: { floor: 45, label: "Android AAB cloud build", category: "mobile" },
  ios_build: { floor: 52, label: "iOS cloud build", category: "mobile" },
  mobile_artifact_storage: { floor: 0.5, label: "Mobile artifact storage", category: "mobile" },
  app_icon_ai_generation: { floor: 8, label: "AI app icon", category: "image" },
  app_logo_generation: { floor: 12, label: "App logo generation", category: "image" },
  app_logo_regeneration: { floor: 12, label: "App logo regeneration", category: "image" },
  splash_ai_generation: { floor: 10, label: "AI splash screen", category: "image" },
  store_metadata_ai_generation: { floor: 1, label: "Store listing AI draft", category: "llm" },
  store_publish_attempt: { floor: 1, label: "Store publish attempt", category: "mobile" },
  zip_preview_build: { floor: 140, label: "ZIP preview runtime build", category: "file" },
} as const;

export type RuntimeActionType = keyof typeof RUNTIME_ACTION_CATALOG;

/** Map legacy action names to canonical catalog keys. */
export const RUNTIME_ACTION_ALIASES: Record<string, RuntimeActionType> = {
  email_send: "email_send_notification",
  llm_generation: "llm_generation_standard",
  image_generation: "image_standard",
  automation_run: "automation_run_basic",
};

export function resolveRuntimeActionType(actionType: string): RuntimeActionType {
  if (actionType in RUNTIME_ACTION_CATALOG) {
    return actionType as RuntimeActionType;
  }
  return RUNTIME_ACTION_ALIASES[actionType] ?? "llm_small";
}

export function isFreeRuntimeAction(actionType: string): boolean {
  const key = resolveRuntimeActionType(actionType);
  return RUNTIME_ACTION_CATALOG[key].floor <= 0;
}

export function floorForRuntimeAction(actionType: string): number {
  const key = resolveRuntimeActionType(actionType);
  return RUNTIME_ACTION_CATALOG[key].floor;
}
