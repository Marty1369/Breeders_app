// Single stroke-icon set (Lucide-style, ~2.1px stroke) for all app chrome.
// Replaces the glyph/emoji icons the prototype used in nav/header (spec §1.3).
// Hand-rolled inline SVGs — no runtime dependency, matches the existing
// Eye/EyeOff pattern in components/ui.

import type { SVGProps } from 'react';

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

function Svg({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </Svg>
  );
}

export function PawIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6.5" cy="10" r="1.8" />
      <circle cx="10.5" cy="6.5" r="1.8" />
      <circle cx="15" cy="6.5" r="1.8" />
      <circle cx="18.5" cy="10.5" r="1.8" />
      <path d="M8.5 15.5c1-2 2.2-3 4-3s3 1 4 3c1 1.9.4 3.6-1.4 4-1 .2-1.7-.3-2.6-.3s-1.6.5-2.6.3c-1.8-.4-2.4-2.1-1.4-4Z" />
    </Svg>
  );
}

export function DogIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 5.2 8 3.5v3.2" />
      <path d="M14 5.2 16 3.5v3.2" />
      <path d="M5.5 8.5C6.8 7 9.2 6 12 6s5.2 1 6.5 2.5c1 1.2 1.5 3 1.5 5.5V19a1 1 0 0 1-1 1h-3v-3l-4 1-4-1v3H5a1 1 0 0 1-1-1v-5c0-2.5.5-4.3 1.5-5.5Z" />
      <path d="M10 12.5h.01M14 12.5h.01" />
    </Svg>
  );
}

export function BuildingIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M14 10h4a2 2 0 0 1 2 2v9" />
      <path d="M8 8h2M8 12h2M8 16h2M2 21h20" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M16 5.2A3.2 3.2 0 0 1 16 11.4" />
      <path d="M17.5 15c2.2.4 3.7 2.1 4.2 5" />
    </Svg>
  );
}

export function CoinsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
      <path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.5-2-2.7-4.8-3" />
    </Svg>
  );
}

export function FileIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </Svg>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </Svg>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m15 5-7 7 7 7" />
    </Svg>
  );
}

export function ChevronsUpDownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
    </Svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function RepeatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M17 3l3 3-3 3" />
      <path d="M20 6H8a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
    </Svg>
  );
}

export function ScaleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v3" />
      <circle cx="12" cy="7" r="1.3" />
      <path d="M5 8h14l-2.5 10.5a1 1 0 0 1-1 .8h-7a1 1 0 0 1-1-.8Z" />
      <path d="M9 12l3 2 3-2" />
    </Svg>
  );
}

export function ListIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </Svg>
  );
}

export function CrossIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 3.5h4a1 1 0 0 1 1 1V9h4.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H15v4.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V15H4.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1H9V4.5a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function HeartPulseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 5.5a4.3 4.3 0 0 0-7-1.3A4.3 4.3 0 0 0 5 5.5c-1.6 1.8-1.3 4.5.7 6.5l6.3 6 6.3-6c2-2 2.3-4.7.7-6.5Z" />
      <path d="M6.5 11.5h2.2l1.3-2.4 1.8 4 1.3-1.6h3.4" />
    </Svg>
  );
}
