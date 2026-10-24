"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { useMotionSettings } from "@/components/motion-settings-provider";

const COUNTRIES = [
  { name: "India", code: "IN", dial: "+91" },
  { name: "United States", code: "US", dial: "+1" },
  { name: "United Kingdom", code: "GB", dial: "+44" },
  { name: "Canada", code: "CA", dial: "+1" },
  { name: "Australia", code: "AU", dial: "+61" },
  { name: "United Arab Emirates", code: "AE", dial: "+971" },
  { name: "Saudi Arabia", code: "SA", dial: "+966" },
  { name: "Pakistan", code: "PK", dial: "+92" },
  { name: "Bangladesh", code: "BD", dial: "+880" },
  { name: "Nepal", code: "NP", dial: "+977" },
  { name: "Sri Lanka", code: "LK", dial: "+94" },
  { name: "Singapore", code: "SG", dial: "+65" },
  { name: "Malaysia", code: "MY", dial: "+60" },
  { name: "Indonesia", code: "ID", dial: "+62" },
  { name: "Philippines", code: "PH", dial: "+63" },
  { name: "Thailand", code: "TH", dial: "+66" },
  { name: "Japan", code: "JP", dial: "+81" },
  { name: "South Korea", code: "KR", dial: "+82" },
  { name: "China", code: "CN", dial: "+86" },
  { name: "Germany", code: "DE", dial: "+49" },
  { name: "France", code: "FR", dial: "+33" },
  { name: "Italy", code: "IT", dial: "+39" },
  { name: "Spain", code: "ES", dial: "+34" },
  { name: "Netherlands", code: "NL", dial: "+31" },
  { name: "Switzerland", code: "CH", dial: "+41" },
  { name: "New Zealand", code: "NZ", dial: "+64" },
  { name: "South Africa", code: "ZA", dial: "+27" },
  { name: "Nigeria", code: "NG", dial: "+234" },
  { name: "Kenya", code: "KE", dial: "+254" },
  { name: "Brazil", code: "BR", dial: "+55" },
  { name: "Mexico", code: "MX", dial: "+52" },
  { name: "Argentina", code: "AR", dial: "+54" },
  { name: "Turkey", code: "TR", dial: "+90" },
  { name: "Russia", code: "RU", dial: "+7" },
  { name: "Afghanistan", code: "AF", dial: "+93" },
  { name: "Algeria", code: "DZ", dial: "+213" },
  { name: "Austria", code: "AT", dial: "+43" },
  { name: "Bahrain", code: "BH", dial: "+973" },
  { name: "Belgium", code: "BE", dial: "+32" },
  { name: "Cambodia", code: "KH", dial: "+855" },
  { name: "Chile", code: "CL", dial: "+56" },
  { name: "Colombia", code: "CO", dial: "+57" },
  { name: "Denmark", code: "DK", dial: "+45" },
  { name: "Egypt", code: "EG", dial: "+20" },
  { name: "Ethiopia", code: "ET", dial: "+251" },
  { name: "Finland", code: "FI", dial: "+358" },
  { name: "Ghana", code: "GH", dial: "+233" },
  { name: "Greece", code: "GR", dial: "+30" },
  { name: "Hong Kong", code: "HK", dial: "+852" },
  { name: "Ireland", code: "IE", dial: "+353" },
  { name: "Israel", code: "IL", dial: "+972" },
  { name: "Jamaica", code: "JM", dial: "+1" },
  { name: "Kuwait", code: "KW", dial: "+965" },
  { name: "Morocco", code: "MA", dial: "+212" },
  { name: "Myanmar", code: "MM", dial: "+95" },
  { name: "Norway", code: "NO", dial: "+47" },
  { name: "Oman", code: "OM", dial: "+968" },
  { name: "Peru", code: "PE", dial: "+51" },
  { name: "Poland", code: "PL", dial: "+48" },
  { name: "Portugal", code: "PT", dial: "+351" },
  { name: "Qatar", code: "QA", dial: "+974" },
  { name: "Sweden", code: "SE", dial: "+46" },
  { name: "Taiwan", code: "TW", dial: "+886" },
  { name: "Tanzania", code: "TZ", dial: "+255" },
  { name: "Ukraine", code: "UA", dial: "+380" },
  { name: "Vietnam", code: "VN", dial: "+84" },
  { name: "Zimbabwe", code: "ZW", dial: "+263" },
] as const;

export function RequiredGooglePhoneModal({
  onComplete,
}: {
  onComplete: (phone: string) => void;
}) {
  const { settings } = useMotionSettings();
  const [countryCode, setCountryCode] = useState("");
  const [nationalNumber, setNationalNumber] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const country = COUNTRIES.find((item) => item.code === countryCode);
  const themeStyle = { "--required-phone-accent": settings.animationColor } as React.CSSProperties;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!country) {
      setError("Select your country to add its calling code.");
      return;
    }
    const phone = `${country.dial}${nationalNumber.replace(/^0+/, "")}`;
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError("Enter a valid mobile number for the selected country.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/auth/complete-google-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to save your mobile number.");
      onComplete(result.data?.phone ?? phone);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your mobile number. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="required-phone-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="required-phone-title" style={themeStyle}>
      <section className="required-phone-modal surface-card w-full max-w-md overflow-hidden rounded-3xl">
        <div className="required-phone-header px-6 pb-6 pt-7 sm:px-8">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl text-xl" aria-hidden="true">📱</div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]">One-time account setup</p>
          <h2 id="required-phone-title" className="mt-2 text-2xl font-extrabold tracking-tight">Add your mobile number</h2>
          <p className="mt-2 text-sm leading-6">
          A mobile number is required to finish setting up your Google account. Choose your country and enter your number to continue.
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 p-6 sm:p-8 sm:pt-6">
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Country
            <select
              required
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="required-phone-control h-12 rounded-xl border px-3 text-sm"
            >
              <option value="" disabled>Select your country</option>
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>{item.name} ({item.dial})</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Mobile number
            <span className="required-phone-control flex h-12 overflow-hidden rounded-xl border focus-within:ring-4">
              <span className="required-phone-code grid min-w-16 place-items-center border-r px-3 text-sm font-bold">{country?.dial ?? "--"}</span>
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                minLength={6}
                maxLength={14}
                pattern="[0-9]{6,14}"
                value={nationalNumber}
                onChange={(event) => setNationalNumber(event.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="Enter mobile number"
                className="required-phone-input min-w-0 flex-1 px-3 text-sm outline-none"
              />
            </span>
            <span className="text-xs font-normal text-neutral-500">{country ? `Country code ${country.dial} will be added automatically.` : "Select your country to add its calling code automatically."}</span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={saving} className="required-phone-submit mt-1 h-12 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Saving number…" : "Save and continue"}
          </button>
        </form>
      </section>
      <style jsx>{`
        .required-phone-overlay {
          background: color-mix(in srgb, var(--foreground) 62%, transparent);
        }
        .required-phone-modal {
          border: 1px solid color-mix(in srgb, var(--required-phone-accent) 30%, var(--foreground));
          background: var(--surface);
          color: var(--foreground);
          box-shadow: 0 28px 90px color-mix(in srgb, var(--foreground) 28%, transparent);
          animation: required-phone-enter 220ms ease-out both;
        }
        .required-phone-header {
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--required-phone-accent) 18%, var(--surface)),
            var(--surface)
          );
          border-bottom: 1px solid color-mix(in srgb, var(--required-phone-accent) 18%, var(--foreground));
        }
        .required-phone-header > div {
          color: var(--required-phone-accent);
          background: color-mix(in srgb, var(--required-phone-accent) 14%, var(--surface));
        }
        .required-phone-header > p:first-of-type {
          color: var(--required-phone-accent);
        }
        .required-phone-header h2 {
          color: var(--foreground);
        }
        .required-phone-header p:last-child {
          color: color-mix(in srgb, var(--foreground) 72%, transparent);
        }
        .required-phone-control {
          border-color: color-mix(in srgb, var(--foreground) 20%, transparent);
          background: var(--background);
          color: var(--foreground);
        }
        .required-phone-control:focus-within {
          border-color: var(--required-phone-accent);
          --tw-ring-color: color-mix(in srgb, var(--required-phone-accent) 18%, transparent);
        }
        .required-phone-code {
          border-color: color-mix(in srgb, var(--foreground) 15%, transparent);
          background: color-mix(in srgb, var(--required-phone-accent) 8%, var(--background));
          color: var(--required-phone-accent);
        }
        .required-phone-input {
          background: var(--background);
          color: var(--foreground);
        }
        .required-phone-submit {
          background: var(--required-phone-accent);
          color: white;
        }
        .required-phone-submit:hover:not(:disabled) {
          filter: brightness(0.92);
        }
        @keyframes required-phone-enter {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .required-phone-modal { animation: none; }
        }
      `}</style>
    </div>
  );
}
