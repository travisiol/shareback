import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M4 14v4.5A2.5 2.5 0 0 0 6.500 21h11a2.500 2.500 0 0 0 2.500-2.500V14" />
  </svg>
);
export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12h16M13.500 5.500 20 12l-6.500 6.500" />
  </svg>
);
export const ArrowLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12H4M10.500 5.500 4 12l6.500 6.500" />
  </svg>
);
export const BagIcon = (p: IconProps) => (
  <svg {...base(p)} viewBox="0 0 48 60">
    <path d="M6 20h36l3 34a3 3 0 0 1-3 3.200H6A3 3 0 0 1 3 54l3-34Z" />
    <path d="M15 26V13a9 9 0 0 1 18 0v13" />
  </svg>
);
export const ReceiptIcon = (p: IconProps) => (
  <svg {...base(p)} viewBox="0 0 48 60">
    <path d="M6 6a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v50l-6-4.500-6 4.500-6-4.500-6 4.500-6-4.500-6 4.500V6Z" />
    <path d="M15 17h18M15 26h18M15 35h18" />
  </svg>
);
export const BarsIcon = (p: IconProps) => (
  <svg {...base(p)} viewBox="0 0 48 60">
    <path d="M3 40h12v16H3zM18 26h12v30H18zM33 6h12v50H33z" />
  </svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.500 4.500 4.500L19 7.500" />
  </svg>
);
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const CameraIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8.500A2.500 2.500 0 0 1 6.500 6h1.700l1.300-2h5l1.300 2h1.700A2.500 2.500 0 0 1 20 8.500v8A2.500 2.500 0 0 1 17.500 19h-11A2.500 2.500 0 0 1 4 16.500v-8Z" />
    <circle cx="12" cy="12.500" r="3.200" />
  </svg>
);
export const FileIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.600v.100" />
  </svg>
);
export const WalletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7.500A2.500 2.500 0 0 1 6.500 5H17v3M4 7.500v9A2.500 2.500 0 0 0 6.500 19H18a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H6.500A2.500 2.500 0 0 1 4 7.500Z" />
    <path d="M16.500 13.500h.100" />
  </svg>
);
export const TrendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m3 16 5.500-5.500 4 3L20 7M15 7h5v5" />
  </svg>
);
export const ExternalIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 5h5v5M19 5l-8 8M11 6H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-4" />
  </svg>
);
