"use client";

import {
  Sparkles,
  Megaphone,
  AlertTriangle,
  Gift,
  Rocket,
  Zap,
  Shield,
  Users,
  Heart,
  Wrench,
  Plug,
  Crown,
  CheckCircle2,
  MessagesSquare,
  Wand2,
  AppWindow,
  Orbit,
  Bell,
  Star,
  Flame,
  Globe,
  Code,
  CircleDollarSign,
  Calendar,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IconPresetId } from "@/lib/control-center/message-design-presets";
import { ICON_PRESETS } from "@/lib/control-center/message-design-presets";

const ICON_MAP: Record<IconPresetId, LucideIcon> = {
  vodex_welcome: Orbit,
  welcome_sparkle: Sparkles,
  megaphone: Megaphone,
  warning_triangle: AlertTriangle,
  gift: Gift,
  rocket: Rocket,
  credit_bolt: Zap,
  shield: Shield,
  workspace_users: Users,
  template_heart: Heart,
  wrench_status: Wrench,
  integration_plug: Plug,
  crown_pro: Crown,
  check_success: CheckCircle2,
  discord_community: MessagesSquare,
  ai_wand: Wand2,
  app_window: AppWindow,
  bell_alert: Bell,
  star_feature: Star,
  flame_hot: Flame,
  globe_world: Globe,
  code_brackets: Code,
  coin_dollar: CircleDollarSign,
  calendar_event: Calendar,
  thumbs_up: ThumbsUp,
};

export function MessageDesignIcon({
  preset,
  animated,
  size = "md",
}: {
  preset: IconPresetId;
  animated?: boolean;
  size?: "sm" | "md";
}) {
  const meta = ICON_PRESETS.find((p) => p.id === preset) ?? ICON_PRESETS[0]!;
  const Icon = ICON_MAP[preset] ?? Orbit;
  const wrap = size === "sm" ? "size-8 rounded-xl" : "size-9 rounded-xl";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center text-white shadow-md ring-1 ring-white/20",
        wrap,
        animated && "vodex-icon-animated",
      )}
      style={{
        background: `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 50%, #0f172a))`,
      }}
    >
      <Icon className="size-4" strokeWidth={1.85} />
    </div>
  );
}
