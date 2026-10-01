import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { UploadFlowLoader } from "@/components/app/loaders";

export const metadata: Metadata = { title: "Scan your receipt" };

export default function UploadPage() {
  return (
    <AppShell>
      <UploadFlowLoader />
    </AppShell>
  );
}
