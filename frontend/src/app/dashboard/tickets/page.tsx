import { AppShell } from "@/components/app-shell";
import { SupportDesk } from "@/components/support-desk";

export default function TicketsPage() {
  return (
    <AppShell>
      <SupportDesk mode="user" />
    </AppShell>
  );
}
