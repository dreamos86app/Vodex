export type IntegrationConnectionMode =
  | "disconnected"
  | "connected_mock"
  | "connected_sandbox"
  | "connected_live"
  | "error";

export type IntegrationTestStatus =
  | "ok"
  | "mock_ok"
  | "sandbox_ok"
  | "live_ok"
  | "missing_required_fields"
  | "invalid_credentials"
  | "webhook_unverified"
  | "error";
