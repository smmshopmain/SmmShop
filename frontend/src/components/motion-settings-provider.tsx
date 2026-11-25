"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiJson } from "@/lib/client-api";
import {
  DEFAULT_MOTION_SETTINGS,
  normalizeMotionSettings,
  type MotionSettings,
} from "@/lib/motion-settings";
import { DEFAULT_SITE_BRAND, type SiteBrandSettings } from "@/lib/site-brand";

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

const SiteBrandContext = createContext<SiteBrandSettings>(DEFAULT_SITE_BRAND);
const FeatureSettingsContext = createContext({
  apiEnabled: false,
  aiEnabled: false,
  loaded: false,
});

export function useMotionSettings() {
  return useContext(MotionSettingsContext);
}

export function useSiteBrand() {
  return useContext(SiteBrandContext);
}

export function useFeatureSettings() {
  return useContext(FeatureSettingsContext);
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
  const [siteBrand, setSiteBrand] = useState(DEFAULT_SITE_BRAND);
  const [featureSettings, setFeatureSettings] = useState({
    apiEnabled: false,
    aiEnabled: false,
    loaded: false,
  });
  const previousBrandName = useRef(DEFAULT_SITE_BRAND.brandName);

  useEffect(() => {
    let mounted = true;
    async function refreshSiteSettings() {
      try {
        const result = await apiJson("/api/settings", { cache: "no-store" });
        if (!mounted) return;
        if (result?.appearance) setSettings(normalizeMotionSettings(result.appearance));
        if (result?.siteFooter && typeof result.siteFooter === "object") {
          setSiteBrand({
            brandName: typeof result.siteFooter.brandName === "string" && result.siteFooter.brandName.trim()
              ? result.siteFooter.brandName.trim()
              : DEFAULT_SITE_BRAND.brandName,
            brandLogoUrl: typeof result.siteFooter.brandLogoUrl === "string"
              ? result.siteFooter.brandLogoUrl
              : "",
            tagline: typeof result.siteFooter.tagline === "string"
              ? result.siteFooter.tagline
              : DEFAULT_SITE_BRAND.tagline,
          });
        }
        setFeatureSettings({
          apiEnabled: result?.apiEnabled === true,
          aiEnabled: result?.ai?.enabled === true,
          loaded: true,
        });
      } catch (error) {
        console.error("Unable to refresh site settings; keeping the current settings.", error);
        if (mounted) setFeatureSettings((current) => ({ ...current, loaded: true }));
      }
    }

    void refreshSiteSettings();
    const interval = window.setInterval(refreshSiteSettings, 120_000);
    window.addEventListener("focus", refreshSiteSettings);
    window.addEventListener("api-settings-updated", refreshSiteSettings);
    window.addEventListener("ai-settings-updated", refreshSiteSettings);
    window.addEventListener("brand-settings-updated", refreshSiteSettings);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSiteSettings);
      window.removeEventListener("api-settings-updated", refreshSiteSettings);
      window.removeEventListener("ai-settings-updated", refreshSiteSettings);
      window.removeEventListener("brand-settings-updated", refreshSiteSettings);
    };
  }, []);

  useEffect(() => {
    applyMotionSettings(settings);
  }, [settings]);

  useEffect(() => {
    const title = document.title;
    const updatedTitle = title.replaceAll(previousBrandName.current, siteBrand.brandName);
    document.title = updatedTitle === title
      ? title.replaceAll("SMM Panel", siteBrand.brandName)
      : updatedTitle;
    previousBrandName.current = siteBrand.brandName;
  }, [siteBrand.brandName]);

  return (
    <MotionSettingsContext.Provider value={{ settings, setSettings }}>
      <SiteBrandContext.Provider value={siteBrand}>
        <FeatureSettingsContext.Provider value={featureSettings}>
          {children}
        </FeatureSettingsContext.Provider>
      </SiteBrandContext.Provider>
    </MotionSettingsContext.Provider>
  );
}
