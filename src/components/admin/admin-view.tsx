"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Users,
  Lock,
  ShieldCheck,
  Mail,
  Activity,
  Zap,
  HardDriveUpload,
  CreditCard,
  Shield,
  Trophy,
  Smartphone,
  PieChart,
} from "lucide-react";
import { CompetitiveScorePanel } from "@/components/admin/competitive-score-panel";
import { variants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AuthHealthPanel } from "@/components/admin/auth-health-panel";
import { DeploymentStatusPanel } from "@/components/admin/deployment-status-panel";
import { ContactRequestsPanel } from "@/components/admin/contact-requests-panel";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { AdminBillingPanel } from "@/components/admin/admin-billing-panel";
import { AdminCreditEconomyPanel } from "@/components/admin/admin-credit-economy-panel";
import { AdminAiUsagePanel } from "@/components/admin/admin-ai-usage-panel";
import { AdminAuditPanel, AdminStoragePanel } from "@/components/admin/admin-lazy-panels";
import { ActionUsagePanel } from "@/components/admin/action-usage-panel";
import { AdminMobileBuildsPanel } from "@/components/admin/admin-mobile-builds-panel";
import { AdminAppPaymentsPanel } from "@/components/admin/admin-app-payments-panel";
import { AdminSchemaHealthBanner } from "@/components/admin/admin-schema-health-banner";
import { AdminOnboardingInsightsPanel } from "@/components/admin/admin-onboarding-insights-panel";
import { AdminControlCenterPanel } from "@/components/admin/admin-control-center-panel";
import { SafeAdminPanel } from "@/components/admin/admin-panel-error-boundary";

export type AdminTab =
  | "onboarding"
  | "users"
  | "contacts"
  | "ai"
  | "action"
  | "mobile"
  | "storage"
  | "audit"
  | "auth"
  | "billing"
  | "competitive"
  | "status";

type Tab = AdminTab;

export function AdminView({ initialTab = "users" }: { initialTab?: AdminTab }) {
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "onboarding", label: "Onboarding", icon: PieChart },
    { id: "users", label: "Users", icon: Users },
    { id: "contacts", label: "Contacts", icon: Mail },
    { id: "ai", label: "AI usage", icon: Activity },
    { id: "action", label: "Action usage", icon: Zap },
    { id: "mobile", label: "Mobile builds", icon: Smartphone },
    { id: "storage", label: "Uploads", icon: HardDriveUpload },
    { id: "audit", label: "Audit log", icon: Shield },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "status", label: "Control Center", icon: ShieldCheck },
    { id: "auth", label: "System", icon: ShieldCheck },
    { id: "competitive", label: "Competitive", icon: Trophy },
  ];

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-6 pb-16"
      variants={variants.fadeUp}
      initial="hidden"
      animate="show"
    >
      <div className="mb-1 flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 ring-1 ring-destructive/20">
          <Lock className="size-4 text-destructive" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[18px] font-semibold text-foreground">Admin Panel</h1>
          <p className="text-[12px] text-muted-foreground">
            Owner-only — server enforced for the platform owner account
          </p>
        </div>
      </div>

      <AdminSchemaHealthBanner />

      <div className="flex w-full max-w-full flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" strokeWidth={1.75} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "onboarding" && (
        <SafeAdminPanel name="Onboarding">
          <AdminOnboardingInsightsPanel />
        </SafeAdminPanel>
      )}
      {activeTab === "users" && (
        <SafeAdminPanel name="Users">
          <AdminUsersPanel />
        </SafeAdminPanel>
      )}
      {activeTab === "contacts" && (
        <SafeAdminPanel name="Contacts">
          <ContactRequestsPanel />
        </SafeAdminPanel>
      )}
      {activeTab === "billing" && (
        <SafeAdminPanel name="Billing">
          <div className="space-y-6">
            <AdminCreditEconomyPanel />
            <AdminBillingPanel />
            <AdminAppPaymentsPanel />
          </div>
        </SafeAdminPanel>
      )}
      {activeTab === "ai" && (
        <SafeAdminPanel name="AI usage">
          <AdminAiUsagePanel />
        </SafeAdminPanel>
      )}
      {activeTab === "action" && (
        <SafeAdminPanel name="Action usage">
          <ActionUsagePanel />
        </SafeAdminPanel>
      )}
      {activeTab === "mobile" && (
        <SafeAdminPanel name="Mobile builds">
          <AdminMobileBuildsPanel />
        </SafeAdminPanel>
      )}
      {activeTab === "storage" && (
        <SafeAdminPanel name="Uploads">
          <AdminStoragePanel />
        </SafeAdminPanel>
      )}
      {activeTab === "audit" && (
        <SafeAdminPanel name="Audit log">
          <AdminAuditPanel />
        </SafeAdminPanel>
      )}

      {activeTab === "status" && (
        <SafeAdminPanel name="Control Center">
          <AdminControlCenterPanel />
        </SafeAdminPanel>
      )}

      {activeTab === "auth" && (
        <SafeAdminPanel name="System">
          <div className="max-w-2xl space-y-6">
            <DeploymentStatusPanel />
            <AuthHealthPanel />
          </div>
        </SafeAdminPanel>
      )}

      {activeTab === "competitive" && (
        <SafeAdminPanel name="Competitive">
          <CompetitiveScorePanel />
        </SafeAdminPanel>
      )}
    </motion.div>
  );
}
