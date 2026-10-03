/**
 * The UI icons, copied as plain SVG from Lucide (https://lucide.dev, ISC); many of them
 * derive from Feather (MIT). Both notices ship with the app in
 * public/licenses/lucide-icons.txt.
 *
 * Plain SVG rather than lucide-react, whose runtime cost more than the icons before the
 * first frame (ADR 0010). Decorative by default: the control around an icon carries
 * its name.
 */
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function icon(paths: ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const ArrowLeft = icon(
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);
export const ArrowRight = icon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);
export const ChevronDown = icon(
  <>
    <path d="m6 9 6 6 6-6" />
  </>,
);
export const ChevronsLeft = icon(
  <>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </>,
);
export const ChevronsRight = icon(
  <>
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </>,
);
export const ExternalLink = icon(
  <>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
);
export const MapPin = icon(
  <>
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </>,
);
export const Menu = icon(
  <>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h16" />
  </>,
);
export const PanelLeftClose = icon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </>,
);
export const Pause = icon(
  <>
    <rect x="14" y="3" width="5" height="18" rx="1" />
    <rect x="5" y="3" width="5" height="18" rx="1" />
  </>,
);
export const Play = icon(
  <>
    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  </>,
);
export const Route = icon(
  <>
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="3" />
  </>,
);
export const Search = icon(
  <>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </>,
);
export const Settings = icon(
  <>
    <path d="M20 7h-9" />
    <path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </>,
);
export const X = icon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);
export const ZoomIn = icon(
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="11" x2="11" y1="8" y2="14" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </>,
);
export const BookOpen = icon(
  <>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </>,
);
export const Camera = icon(
  <>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </>,
);
export const Printer = icon(
  <>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </>,
);
export const Ellipsis = icon(
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>,
);
export const Gauge = icon(
  <>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </>,
);
export const Maximize = icon(
  <>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </>,
);
export const Castle = icon(
  <>
    <path d="M10 5V3" />
    <path d="M14 5V3" />
    <path d="M15 21v-3a3 3 0 0 0-6 0v3" />
    <path d="M18 3v8" />
    <path d="M18 5H6" />
    <path d="M22 11H2" />
    <path d="M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9" />
    <path d="M6 3v8" />
  </>,
);
export const Ruler = icon(
  <>
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </>,
);
