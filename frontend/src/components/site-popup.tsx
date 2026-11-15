"use client";

import Image from "next/image";
import { ArrowRight, Megaphone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiJson, apiUrl } from "@/lib/client-api";

type SitePopupItem = {
  _id: string;
  title: string;
  kind: "announcement" | "advertisement";
  message: string;
  emoji: string;
  imageUrl?: string;
  linkType?: "none" | "internal" | "external";
  linkHref: string;
  linkLabel: string;
  startsAt: string;
  expiresAt: string;
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function readHiddenToday() {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(localStorage.getItem("site-popup-hidden-today") ?? "{}") as unknown;
    return stored && typeof stored === "object" && !Array.isArray(stored)
      ? stored as Record<string, string>
      : {};
  } catch (error) {
    console.error("Unable to read today's popup preferences.", error);
    return {};
  }
}

function readDismissedSession() {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(sessionStorage.getItem("site-popup-dismissed-session") ?? "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch (error) {
    console.error("Unable to read dismissed popup preferences.", error);
    return [];
  }
}

export function SitePopup() {
  const pathname = usePathname();
  const [popups, setPopups] = useState<SitePopupItem[]>([]);
  const [dismissedSession, setDismissedSession] = useState<string[]>(readDismissedSession);
  const [hideToday, setHideToday] = useState(false);
  const [hiddenToday, setHiddenToday] = useState<Record<string, string>>(readHiddenToday);
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    let active = true;
    async function loadPopups() {
      try {
        const result = await apiJson("/api/site-popups", { cache: "no-store" });
        if (!active) return;
        if (!result?.ok || !Array.isArray(result.popups)) {
          throw new Error(result?.message ?? "Unable to load current announcements.");
        }
        setPopups(result.popups as SitePopupItem[]);
      } catch (error) {
        console.error("Unable to load website announcements.", error);
      }
    }

    void loadPopups();
    const interval = window.setInterval(() => void loadPopups(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pathname]);

  const currentPopup = useMemo(() => {
    const today = todayKey();
    return popups.find((popup) =>
      !dismissedSession.includes(popup._id) && hiddenToday[popup._id] !== today,
    ) ?? null;
  }, [dismissedSession, hiddenToday, popups]);

  useEffect(() => {
    if (!currentPopup || pathname?.startsWith("/admin")) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") document.getElementById("site-popup-close")?.click();
      if (event.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [currentPopup, pathname]);

  function dismissCurrentPopup() {
    if (!currentPopup) return;
    if (hideToday) {
      try {
        const hidden = readHiddenToday();
        hidden[currentPopup._id] = todayKey();
        localStorage.setItem("site-popup-hidden-today", JSON.stringify(hidden));
        setHiddenToday(hidden);
      } catch (error) {
        console.error("Unable to save today's popup preference.", error);
      }
    }
    const nextDismissed = [...new Set([...dismissedSession, currentPopup._id])];
    try {
      sessionStorage.setItem("site-popup-dismissed-session", JSON.stringify(nextDismissed));
    } catch (error) {
      console.error("Unable to save dismissed popup preferences.", error);
    }
    setDismissedSession(nextDismissed);
    setHideToday(false);
  }

  if (!currentPopup || pathname?.startsWith("/admin")) return null;

  const PopupContent = (
    <>
      {currentPopup.imageUrl && (
        <Image
          src={apiUrl(currentPopup.imageUrl)}
          alt={`${currentPopup.title} announcement`}
          width={640}
          height={360}
          unoptimized
          className="mb-6 max-h-60 w-full rounded-2xl object-cover"
        />
      )}
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--motion-accent)_14%,white)] text-3xl" aria-hidden="true">
        {currentPopup.emoji || <Megaphone className="size-7" />}
      </span>
      <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[var(--motion-accent)]">
        {currentPopup.kind === "advertisement" ? "A special offer" : "A message for you"}
      </span>
      <span id="site-popup-title" className="mt-2 block text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
        {currentPopup.title}
      </span>
      <span className="mt-3 block whitespace-pre-line text-sm leading-6 text-neutral-600 sm:text-base">
        {currentPopup.message}
      </span>
      {currentPopup.linkHref && (
        <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--motion-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95">
          {currentPopup.linkLabel || "Explore now"} <ArrowRight className="size-4" />
        </span>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6" role="presentation">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-popup-title"
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-slate-950/25"
        style={{ borderTopColor: "var(--motion-accent)", borderTopWidth: "5px" }}
      >
        <button
          ref={closeButton}
          type="button"
          id="site-popup-close"
          onClick={dismissCurrentPopup}
          aria-label="Close announcement"
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-neutral-200 bg-white/90 text-neutral-600 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-950"
        >
          <X className="size-5" />
        </button>
        <div className="px-6 pb-5 pt-8 sm:px-9 sm:pb-7 sm:pt-10">
          {currentPopup.linkHref ? (
            <a
              href={currentPopup.linkHref}
              onClick={dismissCurrentPopup}
              className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--motion-accent)] focus-visible:ring-offset-4"
            >
              {PopupContent}
            </a>
          ) : (
            <div>
              {PopupContent}
            </div>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-neutral-600">
              <input
                type="checkbox"
                checked={hideToday}
                onChange={(event) => setHideToday(event.target.checked)}
                className="size-4 rounded accent-[var(--motion-accent)]"
              />
              Don&apos;t show this again today
            </label>
            <button type="button" onClick={dismissCurrentPopup} className="text-xs font-semibold text-neutral-500 transition hover:text-neutral-900">
              Maybe later
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
