import type { Metadata } from "next";
import { AdminLoader } from "@/components/app/loaders";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Review", robots: { index: false, follow: false } };

/**
 * The page is only a shell. Every list and every decision goes through
 * /api/admin/*, which checks the reviewer session on the server.
 */
export default function AdminPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="shell flex h-[4.5rem] items-center justify-between">
          <Logo />
          <span className="tag">Reviewer</span>
        </div>
      </header>
      <main className="shell flex-1 py-[clamp(2rem,5vw,4rem)]">
        <AdminLoader />
      </main>
    </div>
  );
}
