import type { Metadata } from "next";
import "./globals.css";
import { SiteBrandProvider } from "@/components/site-brand";

export const metadata: Metadata = {
  title: "SMM Panel | Social Growth, Simplified",
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
        <SiteBrandProvider>{children}</SiteBrandProvider>
      </body>
    </html>
  );
}
