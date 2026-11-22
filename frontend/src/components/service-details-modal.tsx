"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Info, RefreshCw, ShoppingCart, X } from "lucide-react";

export type ServiceDetailsItem = {
  providerServiceId: string;
  name: string;
  category: string;
  type?: string;
  sellingRate: number;
  min: number;
  max: number;
  refill?: boolean;
  cancel?: boolean;
};

function ServiceDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="min-w-0 rounded-xl border p-3"
      style={{
        borderColor: "var(--public-border, #dce7e7)",
        background: "color-mix(in srgb, var(--public-accent, #0f766e) 5%, var(--public-panel, #fff))",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--public-muted, #66747f)" }}>
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-semibold" style={{ color: "var(--public-ink, #14202a)" }}>
        {children}
      </div>
    </div>
  );
}

export function ServiceDetailsModal({
  service,
  onClose,
  onCreateOrder,
}: {
  service: ServiceDetailsItem;
  onClose: () => void;
  onCreateOrder: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const features = service.name.match(/\[([^\]]+)\]/g)?.map((feature) => feature.slice(1, -1).trim()).filter(Boolean) ?? [];

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-details-title"
        className="surface-card my-auto max-h-[min(90dvh,48rem)] w-full max-w-xl overflow-y-auto border shadow-2xl"
        style={{
          background: "var(--public-panel, #fff)",
          borderColor: "var(--public-border, #dce7e7)",
          borderRadius: "var(--theme-card-radius, 1.5rem)",
          color: "var(--public-ink, #14202a)",
        }}
      >
        <header
          className="flex items-start gap-3 border-b p-5 sm:p-6"
          style={{
            borderColor: "var(--public-border, #dce7e7)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--public-accent, #0f766e) 12%, var(--public-panel, #fff)), var(--public-panel, #fff))",
          }}
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl"
            style={{
              background: "color-mix(in srgb, var(--public-accent, #0f766e) 13%, var(--public-panel, #fff))",
              color: "var(--public-accent-strong, #115e59)",
            }}
          >
            <Info className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--public-accent-strong, #115e59)" }}>
              Service details
            </p>
            <h2 id="service-details-title" className="mt-1 break-words text-lg font-extrabold leading-snug sm:text-xl">
              {service.name}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--public-muted, #66747f)" }}>{service.category}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close service details"
            className="grid size-9 shrink-0 place-items-center rounded-lg border transition hover:brightness-95"
            style={{
              borderColor: "var(--public-border, #dce7e7)",
              background: "var(--public-panel, #fff)",
              color: "var(--public-muted, #66747f)",
            }}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <ServiceDetail label="Service ID">
            <code className="select-text break-all font-mono text-sm" data-copy-allowed>
              {service.providerServiceId || "Unavailable"}
            </code>
          </ServiceDetail>
          <ServiceDetail label="Service type">{service.type?.trim() || "Not specified"}</ServiceDetail>
          <ServiceDetail label="Price per 1,000">Rs.{service.sellingRate.toFixed(2)}</ServiceDetail>
          <ServiceDetail label="Minimum quantity">{service.min.toLocaleString()}</ServiceDetail>
          <ServiceDetail label="Maximum quantity">{service.max.toLocaleString()}</ServiceDetail>
          <ServiceDetail label="Refill">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="size-3.5" />
              {service.refill === true ? "Available" : service.refill === false ? "Not available" : "Not specified"}
            </span>
          </ServiceDetail>
          <ServiceDetail label="Cancellation">
            {service.cancel === true ? "Available" : service.cancel === false ? "Not available" : "Not specified"}
          </ServiceDetail>
        </div>

        {features.length > 0 && (
          <section className="px-5 pb-5 sm:px-6 sm:pb-6">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--public-muted, #66747f)" }}>
              Service features
            </h3>
            <ul className="flex flex-wrap gap-2">
              {features.map((feature, index) => (
                <li
                  key={`${feature}-${index}`}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{
                    borderColor: "var(--public-border, #dce7e7)",
                    background: "color-mix(in srgb, var(--public-accent, #0f766e) 8%, var(--public-panel, #fff))",
                    color: "var(--public-accent-strong, #115e59)",
                  }}
                >
                  {feature}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t p-5 sm:p-6" style={{ borderColor: "var(--public-border, #dce7e7)" }}>
          <button
            type="button"
            onClick={onCreateOrder}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition hover:brightness-95"
            style={{
              background: "var(--public-accent, #0f766e)",
              color: "var(--public-page, #f4f7f7)",
            }}
          >
            <ShoppingCart className="size-4" />
            Create order
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
