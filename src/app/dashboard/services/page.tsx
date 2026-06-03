import { AppShell } from "@/components/app-shell";
import { ServiceBrowser } from "@/components/service-browser";

export default function ServicesPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Browse services</h1>
        <p className="mt-1 text-sm text-neutral-600">Search, filter by category, and place orders.</p>
      </div>
      <ServiceBrowser />
    </AppShell>
  );
}
