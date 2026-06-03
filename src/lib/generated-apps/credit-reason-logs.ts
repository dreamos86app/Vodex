/** Canonical credit event reasons for auditing. */
export const CREDIT_REASON = {
  runtime_ai_action: "runtime_ai_action",
  generated_app_email: "generated_app_email",
  generated_app_notification: "generated_app_notification",
  generated_app_media: "generated_app_media",
  generated_app_integration_test: "generated_app_integration_test",
  app_icon_generation: "app_icon_generation",
  build_generation: "build_generation",
  edit_generation: "edit_generation",
} as const;

export type CreditReason = (typeof CREDIT_REASON)[keyof typeof CREDIT_REASON];
