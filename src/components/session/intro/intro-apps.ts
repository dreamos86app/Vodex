import type { ComponentType } from "react";
import {
  IntroFashionScreen,
  IntroFoodDeliveryScreen,
  IntroVideoEditorScreen,
  IntroFinanceScreen,
  type IntroScreenLayout,
} from "@/components/session/intro-v3-app-screens";
import { APP_ENTRANCE_S } from "@/components/session/intro/intro-constants";

export type IntroAppAccent = "nova" | "bite" | "frame" | "apex";

export type IntroAppConfig = {
  id: string;
  label: string;
  accent: IntroAppAccent;
  enterAt: number;
  Screen: ComponentType<{ layout: IntroScreenLayout }>;
  desktop: { x: string; y: string; rotate: number; scale: number; z: number };
  mobile: { x: string; y: string; rotate: number; scale: number; z: number };
  entrance: {
    fromX: string;
    fromY: string;
    fromRotate: number;
    glow: string;
  };
};

export const INTRO_CINEMATIC_APPS: IntroAppConfig[] = [
  {
    id: "nova",
    label: "NOVA",
    accent: "nova",
    enterAt: APP_ENTRANCE_S.nova,
    Screen: IntroFashionScreen,
    desktop: { x: "-32%", y: "-28%", rotate: -6, scale: 0.94, z: 12 },
    mobile: { x: "-36%", y: "-30%", rotate: -4, scale: 0.88, z: 12 },
    entrance: { fromX: "-120%", fromY: "0%", fromRotate: -14, glow: "purple" },
  },
  {
    id: "bite",
    label: "bite.",
    accent: "bite",
    enterAt: APP_ENTRANCE_S.bite,
    Screen: IntroFoodDeliveryScreen,
    desktop: { x: "32%", y: "-26%", rotate: 5, scale: 0.92, z: 14 },
    mobile: { x: "36%", y: "-28%", rotate: 4, scale: 0.86, z: 14 },
    entrance: { fromX: "120%", fromY: "0%", fromRotate: 12, glow: "orange" },
  },
  {
    id: "frame",
    label: "FRAME AI",
    accent: "frame",
    enterAt: APP_ENTRANCE_S.frame,
    Screen: IntroVideoEditorScreen,
    desktop: { x: "-30%", y: "30%", rotate: 4, scale: 0.9, z: 16 },
    mobile: { x: "-34%", y: "32%", rotate: 3, scale: 0.84, z: 16 },
    entrance: { fromX: "-80%", fromY: "90%", fromRotate: 8, glow: "cyan" },
  },
  {
    id: "apex",
    label: "Apex Finance",
    accent: "apex",
    enterAt: APP_ENTRANCE_S.apex,
    Screen: IntroFinanceScreen,
    desktop: { x: "30%", y: "28%", rotate: -5, scale: 0.93, z: 18 },
    mobile: { x: "34%", y: "30%", rotate: -4, scale: 0.87, z: 18 },
    entrance: { fromX: "80%", fromY: "90%", fromRotate: -10, glow: "green" },
  },
];
