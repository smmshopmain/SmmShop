import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMM Reseller Panel",
  description: "Production-ready SMM reseller platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-neutral-950">
        <React.Suspense fallback={null}>{children}</React.Suspense>
      </body>
    </html>
  );
}
