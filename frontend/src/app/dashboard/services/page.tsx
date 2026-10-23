import { AppShell } from "@/components/app-shell";
import { ServiceBrowser } from "@/components/service-browser";

export default function ServicesPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Find the right service for you</h1>
        <p className="mt-1 text-sm text-neutral-600">Explore your options, choose what fits, and get started in a few easy steps.</p>
      </div>
      <ServiceBrowser />
    </AppShell>
  );
}
