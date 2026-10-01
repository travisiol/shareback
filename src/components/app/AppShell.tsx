"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "../Logo";
import { WalletButton } from "../WalletDialog";

const NAV = [
  { href: "/app", label: "Upload" },
  { href: "/app/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="shell flex min-h-[4.5rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
          <Logo />
          <nav aria-label="App" className="order-3 flex w-full gap-1 text-[1rem] font-bold sm:order-none sm:w-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`rounded-full px-4 py-2 transition-colors ${
                  pathname === item.href ? "bg-paper shadow-soft" : "text-moss hover:text-forest"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <WalletButton className="btn btn-forest btn-sm" />
        </div>
      </header>

      <main className="shell flex-1 py-[clamp(2rem,5vw,4rem)]">{children}</main>

      <footer className="shell border-t border-line py-6 text-[0.8125rem] leading-relaxed text-moss">
        Rewards are tokenized stock tokens, not conventional shares. They are funded by SHAREBACK&apos;s reward pool, not by
        the companies named. Amounts are fixed token quantities set per campaign — never a guaranteed return.
      </footer>
    </div>
  );
}
