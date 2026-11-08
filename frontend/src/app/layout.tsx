import React from "react";
import type { Metadata } from "next";
import {
  DEFAULT_MOTION_SETTINGS,
  MotionSettingsProvider,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialMotionSettings = DEFAULT_MOTION_SETTINGS;

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
