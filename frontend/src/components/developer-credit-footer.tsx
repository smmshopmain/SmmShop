import { Clock3, Code2, ExternalLink, Mail, MapPin, Phone, Send } from "lucide-react";
import Link from "next/link";

export type DeveloperCreditSettings = {
  enabled: boolean;
  label: string;
  name: string;
  url: string;
};

export type SiteFooterLink = {
  label: string;
  href: string;
};

export type SiteFooterSettings = {
  enabled: boolean;
  brandName: string;
  tagline: string;
  description: string;
  quickLinksTitle: string;
  quickLinks: SiteFooterLink[];
  supportLinksTitle: string;
  supportLinks: SiteFooterLink[];
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  whatsappUrl: string;
  address: string;
  businessHours: string;
  copyrightText: string;
};

export const DEFAULT_DEVELOPER_CREDIT: DeveloperCreditSettings = {
  enabled: false,
  label: "Developed by",
  name: "",
  url: "",
};

export const DEFAULT_SITE_FOOTER: SiteFooterSettings = {
  enabled: true,
  brandName: "SMM Panel",
  tagline: "Your social growth workspace",
  description: "Manage services, orders, wallet, and support from one simple place.",
  quickLinksTitle: "Quick links",
  quickLinks: [
    { label: "Home", href: "/" },
    { label: "Sign in", href: "/login" },
    { label: "Create account", href: "/register" },
  ],
  supportLinksTitle: "Customer support",
  supportLinks: [
    { label: "Help & support", href: "/dashboard/tickets" },
    { label: "My orders", href: "/dashboard/orders" },
    { label: "My account", href: "/dashboard/profile" },
  ],
  contactTitle: "Contact",
  contactEmail: "",
  contactPhone: "",
  whatsappUrl: "",
  address: "",
  businessHours: "",
  copyrightText: "All rights reserved.",
};

function FooterAnchor({ link }: { link: SiteFooterLink }) {
  const external = /^https?:\/\//i.test(link.href);
  return (
    <a
      href={link.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="site-footer-link inline-flex items-center gap-1.5 text-sm transition-colors"
    >
      {link.label}
      {external && <ExternalLink aria-hidden="true" className="size-3.5" />}
    </a>
  );
}

export function DeveloperCreditFooter({
  settings,
  developerCredit,
}: {
  settings: SiteFooterSettings;
  developerCredit: DeveloperCreditSettings;
}) {
  if (!settings.enabled) return null;

  const quickLinks = settings.quickLinks.filter((link) => link.label.trim() && link.href.trim());
  const supportLinks = settings.supportLinks.filter((link) => link.label.trim() && link.href.trim());
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer px-5 pb-24 pt-12 sm:px-8 sm:pt-14 lg:pb-0">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_1fr_1fr] lg:gap-12">
          <section className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="site-footer-mark grid size-11 place-items-center rounded-2xl text-sm font-extrabold">
                {settings.brandName.trim().slice(0, 2).toUpperCase()}
              </span>
              <span>
                <span className="site-footer-heading block text-base font-bold">{settings.brandName}</span>
                {settings.tagline && <span className="site-footer-muted mt-0.5 block text-xs">{settings.tagline}</span>}
              </span>
            </Link>
            {settings.description && (
              <p className="site-footer-muted mt-4 text-sm leading-6">{settings.description}</p>
            )}
          </section>

          {quickLinks.length > 0 && (
            <nav aria-label={settings.quickLinksTitle}>
              <h2 className="site-footer-kicker text-[11px] font-bold uppercase tracking-[0.16em]">
                {settings.quickLinksTitle}
              </h2>
              <ul className="mt-4 grid gap-3">
                {quickLinks.map((link, index) => (
                  <li key={`${link.href}-${index}`}><FooterAnchor link={link} /></li>
                ))}
              </ul>
            </nav>
          )}

          {supportLinks.length > 0 && (
            <nav aria-label={settings.supportLinksTitle}>
              <h2 className="site-footer-kicker text-[11px] font-bold uppercase tracking-[0.16em]">
                {settings.supportLinksTitle}
              </h2>
              <ul className="mt-4 grid gap-3">
                {supportLinks.map((link, index) => (
                  <li key={`${link.href}-${index}`}><FooterAnchor link={link} /></li>
                ))}
              </ul>
            </nav>
          )}

          <section>
            <h2 className="site-footer-kicker text-[11px] font-bold uppercase tracking-[0.16em]">
              {settings.contactTitle}
            </h2>
            <ul className="site-footer-muted mt-4 grid gap-3 text-sm">
              {settings.contactEmail && (
                <li>
                  <a className="site-footer-link inline-flex items-center gap-2 transition-colors" href={`mailto:${settings.contactEmail}`}>
                    <Mail aria-hidden="true" className="size-4 shrink-0" />{settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.contactPhone && (
                <li>
                  <a className="site-footer-link inline-flex items-center gap-2 transition-colors" href={`tel:${settings.contactPhone}`}>
                    <Phone aria-hidden="true" className="size-4 shrink-0" />{settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.whatsappUrl && (
                <li>
                  <a className="site-footer-link inline-flex items-center gap-2 transition-colors" href={settings.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <Send aria-hidden="true" className="size-4 shrink-0" />WhatsApp
                  </a>
                </li>
              )}
              {settings.address && (
                <li className="inline-flex items-start gap-2">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className="whitespace-pre-line">{settings.address}</span>
                </li>
              )}
              {settings.businessHours && (
                <li className="inline-flex items-start gap-2">
                  <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className="whitespace-pre-line">{settings.businessHours}</span>
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className="site-footer-bottom flex flex-col gap-3 border-t py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="site-footer-muted">© {year} {settings.brandName}.{settings.copyrightText && ` ${settings.copyrightText}`}</p>
          {developerCredit.enabled && developerCredit.name.trim() && (
            <p className="inline-flex flex-wrap items-center gap-1.5">
              <Code2 aria-hidden="true" className="size-3.5" />
              <span className="site-footer-muted">{developerCredit.label}</span>
              {developerCredit.url ? (
                <a href={developerCredit.url} target="_blank" rel="noopener noreferrer" className="site-footer-credit inline-flex items-center gap-1 font-semibold transition-colors">
                  {developerCredit.name}<ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ) : (
                <span className="site-footer-credit font-semibold">{developerCredit.name}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
