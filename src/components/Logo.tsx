import Link from "next/link";

/** Receipt silhouette with a serrated lower edge and an S cut out of it. */
export function LogoMark({ className, tone = "forest" }: { className?: string; tone?: "forest" | "lime" }) {
  const fill = tone === "forest" ? "#1b2a4a" : "#ffc857";
  const cut = tone === "forest" ? "#fffdf8" : "#1b2a4a";
  return (
    <svg viewBox="0 0 40 46" className={className} aria-hidden="true">
      <g transform="skewX(-5) translate(4 0)">
        <path
          fill={fill}
          d="M5 2h28a3 3 0 0 1 3 3v37.5l-4.25-3.4-4.25 3.4-4.25-3.4-4.25 3.4-4.25-3.4-4.25 3.4L6.25 39.1 2 42.5V5a3 3 0 0 1 3-3Z"
        />
        <path
          fill="none"
          stroke={cut}
          strokeWidth="4.3"
          strokeLinecap="round"
          d="M24.6 14.4c-.5-2.6-2.7-4-5.7-4-3.3 0-5.6 1.8-5.6 4.6 0 2.9 2.5 3.9 5.7 4.8 3.3.9 6 2 6 5.2 0 2.9-2.5 4.9-6 4.9-3.3 0-5.6-1.6-6.2-4.4"
        />
      </g>
    </svg>
  );
}

export function Logo({ tone = "forest", href = "/" }: { tone?: "forest" | "lime"; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-lg" aria-label="shareback home">
      <LogoMark tone={tone} className="h-[2.9rem] w-auto" />
      <span
        className={`text-[1.85rem] font-extrabold tracking-[-0.035em] ${tone === "forest" ? "text-forest" : "text-paper"}`}
      >
        shareback
      </span>
    </Link>
  );
}
