import type { Metadata, Viewport } from "next";
import { DM_Mono, Outfit } from "next/font/google";
import { WalletDialog } from "@/components/WalletDialog";
import { BRAND } from "@/config/brand";
import "./globals.css";

// Both families are downloaded at build time and served from this origin.
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });
const receiptMono = DM_Mono({
  variable: "--font-receipt",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "shareback — You bought it. Now own a piece.", template: "%s · shareback" },
  description: BRAND.description,
};

export const viewport: Viewport = { themeColor: "#f3efe6" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${receiptMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <WalletDialog />
      </body>
    </html>
  );
}
