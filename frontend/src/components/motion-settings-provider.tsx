"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiJson } from "@/lib/client-api";
import { DEFAULT_ENABLED_LOADING_ANIMATIONS, LOADING_ANIMATIONS } from "@/lib/loading-animations";

export type MotionSettings = {
  designPreset: "default" | "studio" | "orbit" | "atelier" | "pulse" | "midnight";
  animationsEnabled: boolean;
  entranceEnabled: boolean;
  floatingEnabled: boolean;
  hoverEnabled: boolean;
  animationColor: string;
  animationSpeed: number;
  loadingAnimationsEnabled: boolean;
  loadingAnimationMode: "random" | "specific";
  selectedLoadingAnimation: string;
  enabledLoadingAnimations: string[];
};

export const DESIGN_MOTION_COLORS: Record<MotionSettings["designPreset"], string> = {
  default: "#0f766e",
  studio: "#0f8a82",
  orbit: "#7048ef",
  atelier: "#b94e35",
  pulse: "#67e8d0",
  midnight: "#818cf8",
};

const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  designPreset: "default",
  animationsEnabled: true,
  entranceEnabled: true,
  floatingEnabled: true,
  hoverEnabled: true,
  animationColor: DESIGN_MOTION_COLORS.default,
  animationSpeed: 1,
  loadingAnimationsEnabled: true,
  loadingAnimationMode: "random",
  selectedLoadingAnimation: "service-orbit",
  enabledLoadingAnimations: DEFAULT_ENABLED_LOADING_ANIMATIONS,
};

export { DEFAULT_MOTION_SETTINGS };

const MotionSettingsContext = createContext<{
  settings: MotionSettings;
  setSettings: (settings: MotionSettings) => void;
}>({
  settings: DEFAULT_MOTION_SETTINGS,
  setSettings: () => {},
});

export function useMotionSettings() {
  return useContext(MotionSettingsContext);
}

function applyMotionSettings(settings: MotionSettings) {
  const root = document.documentElement;
  const speed = Math.max(0.5, Math.min(2, settings.animationSpeed));
  root.dataset.motion = settings.animationsEnabled ? "on" : "off";
  root.dataset.design = settings.designPreset;
  root.dataset.motionEntrance = settings.entranceEnabled ? "on" : "off";
  root.dataset.motionFloating = settings.floatingEnabled ? "on" : "off";
  root.dataset.motionHover = settings.hoverEnabled ? "on" : "off";
  root.dataset.loadingAnimations = settings.animationsEnabled && settings.loadingAnimationsEnabled ? "on" : "off";
  root.style.setProperty("--motion-accent", settings.animationColor);
  root.style.setProperty("--motion-speed", String(speed));
  root.style.setProperty("--motion-page-duration", `${520 / speed}ms`);
  root.style.setProperty("--motion-menu-duration", `${240 / speed}ms`);
  root.style.setProperty("--motion-float-duration", `${6000 / speed}ms`);
  root.style.setProperty("--motion-glow-duration", `${2800 / speed}ms`);
  root.style.setProperty("--motion-hover-duration", `${180 / speed}ms`);
  root.style.setProperty("--loading-duration", `${1400 / speed}ms`);
}

export function normalizeMotionSettings(value: Partial<MotionSettings>): MotionSettings {
  const validIds = new Set(LOADING_ANIMATIONS.map(({ id }) => id));
  const configuredIds = Array.isArray(value.enabledLoadingAnimations)
    ? [...new Set(value.enabledLoadingAnimations.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
    : DEFAULT_ENABLED_LOADING_ANIMATIONS;
  const enabledLoadingAnimations = configuredIds.length > 0
    ? configuredIds
    : DEFAULT_ENABLED_LOADING_ANIMATIONS;
  const requestedSelection = value.selectedLoadingAnimation;
  const designPreset = typeof value.designPreset === "string"
    && Object.hasOwn(DESIGN_MOTION_COLORS, value.designPreset)
    ? value.designPreset
    : DEFAULT_MOTION_SETTINGS.designPreset;

  return {
    ...DEFAULT_MOTION_SETTINGS,
    ...value,
    designPreset,
    animationColor: DESIGN_MOTION_COLORS[designPreset],
    loadingAnimationMode: value.loadingAnimationMode === "specific" ? "specific" : "random",
    selectedLoadingAnimation: typeof requestedSelection === "string" && enabledLoadingAnimations.includes(requestedSelection)
      ? requestedSelection
      : enabledLoadingAnimations[0],
    enabledLoadingAnimations,
  };
}

export function MotionSettingsProvider({
  children,
  initialSettings = DEFAULT_MOTION_SETTINGS,
}: {
  children: ReactNode;
  initialSettings?: MotionSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    let mounted = true;
    apiJson("/api/settings")
      .then((result) => {
        if (!mounted || !result?.appearance) return;
        setSettings(normalizeMotionSettings(result.appearance));
      })
      .catch((error: unknown) => {
        console.error("Unable to refresh site appearance settings; keeping the server-rendered settings.", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    applyMotionSettings(settings);
  }, [settings]);

  return (
    <MotionSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </MotionSettingsContext.Provider>
  );
}
