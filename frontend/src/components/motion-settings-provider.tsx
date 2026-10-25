"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiJson } from "@/lib/client-api";
import {
  DEFAULT_MOTION_SETTINGS,
  normalizeMotionSettings,
  type MotionSettings,
} from "@/lib/motion-settings";

export {
  DEFAULT_MOTION_SETTINGS,
  DESIGN_MOTION_COLORS,
  normalizeMotionSettings,
  type MotionSettings,
} from "@/lib/motion-settings";

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
