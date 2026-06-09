/**
 * Provider connection capabilities — honest one-click OAuth vs manual setup.
 */
export type IntegrationConnectionMode =
  | "vodex_managed_toggle"
  | "oauth_connect"
  | "api_key"
  | "webhook"
  | "manual_config"
  | "coming_soon";

export type ProviderCapability = {
  id: string;
  displayName: string;
  connectionMode: IntegrationConnectionMode;
  vodexManaged: boolean;
  userBringsKeys: boolean;
  planGate: "free" | "starter" | "pro" | null;
  docsUrl: string;
  testConnection: boolean;
  bestFor?: string;
};

export const PAYMENT_PROVIDER_CAPABILITIES: Record<string, ProviderCapability> = {
  stripe: {
    id: "stripe",
    displayName: "Stripe",
    connectionMode: "api_key",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://stripe.com/docs",
    testConnection: true,
    bestFor: "Web subscriptions & checkout",
  },
  paddle: {
    id: "paddle",
    displayName: "Paddle",
    connectionMode: "api_key",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://developer.paddle.com",
    testConnection: true,
    bestFor: "Merchant of record",
  },
  paypal: {
    id: "paypal",
    displayName: "PayPal Business",
    connectionMode: "manual_config",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://developer.paypal.com",
    testConnection: true,
    bestFor: "PayPal checkout",
  },
  lemon_squeezy: {
    id: "lemon_squeezy",
    displayName: "Lemon Squeezy",
    connectionMode: "api_key",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://docs.lemonsqueezy.com",
    testConnection: true,
    bestFor: "Indie SaaS billing",
  },
  revenuecat: {
    id: "revenuecat",
    displayName: "RevenueCat",
    connectionMode: "api_key",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://www.revenuecat.com/docs",
    testConnection: true,
    bestFor: "Mobile in-app subscriptions",
  },
};

export const AUTH_PROVIDER_CAPABILITIES: Record<
  string,
  ProviderCapability & { managedByVodex?: boolean }
> = {
  email: {
    id: "email",
    displayName: "Gmail / Email",
    connectionMode: "vodex_managed_toggle",
    vodexManaged: true,
    userBringsKeys: false,
    planGate: null,
    docsUrl: "https://vodex.dev/docs/auth/email",
    testConnection: false,
    managedByVodex: true,
  },
  google: {
    id: "google",
    displayName: "Google",
    connectionMode: "oauth_connect",
    vodexManaged: true,
    userBringsKeys: false,
    planGate: null,
    docsUrl: "https://vodex.dev/docs/auth/google",
    testConnection: true,
    managedByVodex: true,
  },
  github: {
    id: "github",
    displayName: "GitHub",
    connectionMode: "oauth_connect",
    vodexManaged: true,
    userBringsKeys: false,
    planGate: null,
    docsUrl: "https://vodex.dev/docs/auth/github",
    testConnection: true,
    managedByVodex: true,
  },
  apple: {
    id: "apple",
    displayName: "Apple",
    connectionMode: "manual_config",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://vodex.dev/docs/auth/apple",
    testConnection: false,
    managedByVodex: false,
  },
  microsoft: {
    id: "microsoft",
    displayName: "Microsoft",
    connectionMode: "coming_soon",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://vodex.dev/docs/auth/microsoft",
    testConnection: false,
    managedByVodex: false,
  },
  discord: {
    id: "discord",
    displayName: "Discord",
    connectionMode: "coming_soon",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://vodex.dev/docs/auth/discord",
    testConnection: false,
    managedByVodex: false,
  },
  facebook: {
    id: "facebook",
    displayName: "Facebook",
    connectionMode: "coming_soon",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://vodex.dev/docs/auth/facebook",
    testConnection: false,
    managedByVodex: false,
  },
  phone: {
    id: "phone",
    displayName: "Phone",
    connectionMode: "manual_config",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://vodex.dev/docs/auth/phone",
    testConnection: false,
  },
  custom_oauth: {
    id: "custom_oauth",
    displayName: "Custom OAuth",
    connectionMode: "manual_config",
    vodexManaged: false,
    userBringsKeys: true,
    planGate: "starter",
    docsUrl: "https://vodex.dev/docs/auth/custom-oauth",
    testConnection: false,
  },
};

export function connectionModeLabel(mode: IntegrationConnectionMode): string {
  switch (mode) {
    case "oauth_connect":
      return "OAuth";
    case "api_key":
      return "API key";
    case "vodex_managed_toggle":
      return "Managed";
    case "webhook":
      return "Webhook";
    case "manual_config":
      return "Manual setup";
    case "coming_soon":
      return "Coming soon";
    default:
      return "Setup";
  }
}
