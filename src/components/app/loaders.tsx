"use client";

import dynamic from "next/dynamic";

/**
 * These screens read browser-only state (the session, the wallet),
 * so they render on the client only — no hydration mismatch, no flash of an
 * empty state before the data is known.
 */
function Skeleton() {
  return (
    <div className="mx-auto max-w-[62rem] animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-14 w-2/3 rounded-2xl bg-cream-deep" />
      <div className="h-6 w-1/2 rounded-xl bg-cream-deep" />
      <div className="h-64 rounded-[24px] bg-cream-deep" />
    </div>
  );
}

export const UploadFlowLoader = dynamic(() => import("./UploadFlow"), { ssr: false, loading: Skeleton });
export const DashboardLoader = dynamic(() => import("./Dashboard"), { ssr: false, loading: Skeleton });
export const AdminLoader = dynamic(() => import("./AdminReview"), { ssr: false, loading: Skeleton });
