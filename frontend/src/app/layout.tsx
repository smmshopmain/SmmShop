import React from "react";
import type { Metadata } from "next";
import { MotionSettingsProvider } from "@/components/motion-settings-provider";
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
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full text-neutral-950">
        <MotionSettingsProvider>
          <React.Suspense fallback={null}>{children}</React.Suspense>
        </MotionSettingsProvider>
      </body>
    </html>
  );
}
