import React from "react";
import type { Metadata } from "next";
import {
  DEFAULT_MOTION_SETTINGS,
  MotionSettingsProvider,
  normalizeMotionSettings,
  type MotionSettings,
} from "@/components/motion-settings-provider";
import { CopyProtection } from "@/components/copy-protection";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SMM Panel | Social Growth, Simplified",
    template: "%s | SMM Panel",
  },
  description: "Manage social media services, orders, wallet, and support from one modern reseller workspace.",
};

async function loadInitialMotionSettings(): Promise<MotionSettings> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiBase) {
    console.error("Unable to load the site design before first render: NEXT_PUBLIC_API_URL is not configured.");
    return DEFAULT_MOTION_SETTINGS;
  }

  try {
    const response = await fetch(`${apiBase}/api/settings`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`Settings request failed with status ${response.status}.`);
    }

    const payload = await response.json() as {
      data?: { appearance?: Partial<MotionSettings> };
      appearance?: Partial<MotionSettings>;
    };
    const appearance = payload.data?.appearance ?? payload.appearance;
    if (!appearance) throw new Error("Appearance settings were missing from the settings response.");

    return normalizeMotionSettings(appearance);
  } catch (error) {
    console.error("Unable to load the site design before first render.", error);
    return DEFAULT_MOTION_SETTINGS;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialMotionSettings = await loadInitialMotionSettings();

  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
      data-design={initialMotionSettings.designPreset}
      data-motion={initialMotionSettings.animationsEnabled ? "on" : "off"}
      data-motion-entrance={initialMotionSettings.entranceEnabled ? "on" : "off"}
      data-motion-floating={initialMotionSettings.floatingEnabled ? "on" : "off"}
      data-motion-hover={initialMotionSettings.hoverEnabled ? "on" : "off"}
      data-loading-animations={initialMotionSettings.animationsEnabled && initialMotionSettings.loadingAnimationsEnabled ? "on" : "off"}
      style={{
        "--motion-accent": initialMotionSettings.animationColor,
        "--motion-speed": String(initialMotionSettings.animationSpeed),
      } as React.CSSProperties}
    >
      <body className="min-h-full text-neutral-950">
        <MotionSettingsProvider initialSettings={initialMotionSettings}>
          <CopyProtection />
          <React.Suspense fallback={null}>{children}</React.Suspense>
        </MotionSettingsProvider>
      </body>
    </html>
  );
}
