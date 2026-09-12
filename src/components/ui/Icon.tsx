import type { SVGProps } from 'react';

const paths: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11.2 12 4l9 7.2V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20v-8.8Z" />
      <path d="M9.5 21v-6.5h5V21" />
    </>
  ),
  cards: (
    <>
      <rect x="3.5" y="7" width="12" height="13.5" rx="1.8" transform="rotate(-8 9.5 13.75)" />
      <path d="M6.4 2.8h14.5v13.5" />
      <path d="M8.6 11.5l1.4.9 3.2-3.6" transform="rotate(-8 8.6 11.5)" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5V12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5.5" />
      <path d="M4.5 9.5V16c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V9.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
      <path d="M7 6V5.5A1.5 1.5 0 0 1 8.5 4H19" />
      <circle cx="7" cy="14" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.3-3.6 4.1-5 7.5-5s6.2 1.4 7.5 5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 15l3.5-4 3 2 5-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3M18.5 5.5 16.4 7.6M7.6 16.4 5.5 18.5M18.5 18.5l-2.1-2.1M7.6 7.6 5.5 5.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H4.5A1.5 1.5 0 0 0 3 7c0 2.5 2 4 5 4M16 5.5h3.5A1.5 1.5 0 0 1 21 7c0 2.5-2 4-5 4" />
      <path d="M12 14v3M8.5 20h7" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  login: (
    <>
      <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M11 17l-5-5 5-5M6 12h12" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3c.7 4.6 2.9 7.2 9 9-6.1 1.8-8.3 4.4-9 9-.7-4.6-2.9-7.2-9-9 6.1-1.8 8.3-4.4 9-9Z" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M4 14h16M12 10v10" />
      <path d="M12 10c-1.5-3-3.5-4.5-5-3.5S7 9 9 9.5c1.5.3 2.6.2 3 .5ZM12 10c1.5-3 3.5-4.5 5-3.5S17 9 15 9.5c-1.5.3-2.6.2-3 .5Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 4.5 5.6v6c0 4.9 3.2 8.4 7.5 9.6 4.3-1.2 7.5-4.7 7.5-9.6v-6Z" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M17.8 6.8a7.5 7.5 0 0 1 0 10.4" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" />
      <path d="M16 10l5 5M21 10l-5 5" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1.5" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.6 6.4A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.7 15.7 0 0 1-2.4 3.3M6.1 6.1A15.6 15.6 0 0 0 2.5 12S6 18 12 18c1.5 0 2.8-.4 4-1" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5 10-11" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronRight: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  crown: (
    <>
      <path d="M4 18h16" />
      <path d="M4 9.5l4 3 4-6.5 4 6.5 4-3V17H4Z" />
    </>
  ),
  flame: (
    <>
      <path d="M12 2.8c.8 2.6 3.4 4 4 6.7A5.2 5.2 0 0 1 12 20.5 5 5 0 0 1 7.6 15.6c.8-2.2 1.8-3 1.8-4.8A16 16 0 0 0 12 2.8Z" />
    </>
  ),
  bolt: <path d="M13 2.5 4.5 13.5H11l-1.5 8 8.5-11H12Z" />,
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  arrowUpRight: <path d="M6.5 17.5 17.5 6.5M17.5 6.5H9M17.5 6.5v8.5" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3.5V8h-4.5" />
    </>
  ),
  send: (
    <>
      <path d="m3 11.5 18-7.5-7.5 17-3-6.5Z" />
      <path d="M3 11.5 10.5 14.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5Z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17l9 5 9-5-9-5" />
    </>
  ),
  cup: (
    <>
      <rect x="4" y="4.5" width="11" height="6" rx="1.5" />
      <path d="M15 6h2a3 3 0 0 1 0 6h-2" />
      <path d="M9.5 13.5V16M7 19.5h5M9.5 16H7a2 2 0 0 1-2-2" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="8.5" r="4.5" />
      <path d="m8.6 12.2-1.6 7.3 5-2.5 5 2.5-1.6-7.3" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2.5-6.5 5 13L17 12h4" />
    </>
  ),
  transfer: (
    <>
      <path d="M17 8V4M17 4h3.5M17 4l3 3" />
      <path d="M7 16v4M7 20H3.5M7 20l-3-3" />
      <path d="M3.5 8h7l-2.5 3.5M20.5 16h-7l2.5-3.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.4" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4Z" />
      <path d="M12 10v4.5M12 17.2v.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0M15.4 4.9a3.4 3.4 0 1 1-.1 6.3M16.6 13.5a6.2 6.2 0 0 1 4.6 6" />
    </>
  ),
  play: <path d="M7.5 5.2 18 12 7.5 18.8z" strokeLinejoin="round" />,
  link: (
    <>
      <path d="M9.8 14.2a3.6 3.6 0 0 0 5.1.2l2.7-2.7a3.6 3.6 0 0 0-5-5.1l-1.3 1.3M14.2 9.8a3.6 3.6 0 0 0-5.1-.2l-2.7 2.7a3.6 3.6 0 0 0 5 5.1l1.3-1.3" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  viewBox = '0 0 24 24',
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}