"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiJson } from "@/lib/client-api";

export type MotionSettings = {
  designPreset: "default" | "studio" | "midnight";
  animationsEnabled: boolean;
  entranceEnabled: boolean;
  floatingEnabled: boolean;
  hoverEnabled: boolean;
  animationColor: string;
  animationSpeed: number;
};

const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  designPreset: "default",
  animationsEnabled: true,
  entranceEnabled: true,
  floatingEnabled: true,
  hoverEnabled: true,
  animationColor: "#14b8a6",
  animationSpeed: 1,
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
  root.style.setProperty("--motion-accent", settings.animationColor);
  root.style.setProperty("--motion-page-duration", `${520 / speed}ms`);
  root.style.setProperty("--motion-menu-duration", `${240 / speed}ms`);
  root.style.setProperty("--motion-float-duration", `${6000 / speed}ms`);
  root.style.setProperty("--motion-glow-duration", `${2800 / speed}ms`);
  root.style.setProperty("--motion-hover-duration", `${180 / speed}ms`);
}

export function MotionSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_MOTION_SETTINGS);

  useEffect(() => {
    let mounted = true;
    apiJson("/api/settings")
      .then((result) => {
        if (!mounted || !result?.appearance) return;
        setSettings({
          ...DEFAULT_MOTION_SETTINGS,
          ...result.appearance,
        });
      })
      .catch(() => {
        if (mounted) setSettings(DEFAULT_MOTION_SETTINGS);
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
