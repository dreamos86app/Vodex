"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Users,
  Lock,
  ShieldCheck,
  Mail,
  Activity,
  HardDriveUpload,
  CreditCard,
  Shield,
  Trophy,
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
import { AdminSchemaHealthBanner } from "@/components/admin/admin-schema-health-banner";

export type AdminTab =
  | "users"
  | "contacts"
  | "ai"
  | "storage"
  | "audit"
  | "auth"
  | "billing"
  | "competitive";

type Tab = AdminTab;

export function AdminView({ initialTab = "users" }: { initialTab?: AdminTab }) {
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "contacts", label: "Contacts", icon: Mail },
    { id: "ai", label: "AI usage", icon: Activity },
    { id: "storage", label: "Uploads", icon: HardDriveUpload },
    { id: "audit", label: "Audit log", icon: Shield },
    { id: "billing", label: "Billing", icon: CreditCard },
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
            Owner-only — server enforced for dreamos86app@gmail.com
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

      {activeTab === "users" && <AdminUsersPanel />}
      {activeTab === "contacts" && <ContactRequestsPanel />}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <AdminCreditEconomyPanel />
          <AdminBillingPanel />
        </div>
      )}
      {activeTab === "ai" && <AdminAiUsagePanel />}
      {activeTab === "storage" && <AdminStoragePanel />}
      {activeTab === "audit" && <AdminAuditPanel />}

      {activeTab === "auth" && (
        <div className="max-w-2xl space-y-6">
          <DeploymentStatusPanel />
          <AuthHealthPanel />
        </div>
      )}

      {activeTab === "competitive" && <CompetitiveScorePanel />}
    </motion.div>
  );
}
