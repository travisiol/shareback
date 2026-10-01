import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { DashboardLoader } from "@/components/app/loaders";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardLoader />
    </AppShell>
  );
}
