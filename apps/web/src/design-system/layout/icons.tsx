import type { ReactNode, SVGProps } from 'react';

export type MedsIconName =
  | 'dashboard'
  | 'calendar'
  | 'championship'
  | 'circuit'
  | 'sessions'
  | 'sources'
  | 'sync'
  | 'tasks'
  | 'edit'
  | 'duplicates'
  | 'warning'
  | 'statistics'
  | 'history'
  | 'logs'
  | 'users'
  | 'key'
  | 'backup'
  | 'migration'
  | 'settings'
  | 'menu'
  | 'clock'
  | 'bell'
  | 'chevron'
  | 'logout'
  | 'gauge';

const paths: Record<MedsIconName, ReactNode> = {
  dashboard: <><path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  championship: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M6 6H4a3 3 0 0 0 3 3M18 6h2a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6"/></>,
  circuit: <><path d="M5 18c-3-3-1-8 3-8h4c3 0 3-4 0-4H9"/><circle cx="6" cy="18" r="2"/><circle cx="9" cy="6" r="2"/><path d="M8 18h10a3 3 0 0 0 0-6h-2"/></>,
  sessions: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  sources: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></>,
  sync: <><path d="M20 7h-5V2M4 17h5v5"/><path d="M18.5 9A7 7 0 0 0 6 6L4 7M5.5 15A7 7 0 0 0 18 18l2-1"/></>,
  tasks: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  edit: <><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/><path d="m14 6 3 3"/></>,
  duplicates: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  warning: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  statistics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></>,
  logs: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  users: <><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
  key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/></>,
  backup: <><path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3M9 13h6"/></>,
  migration: <><path d="M5 5h14v14H5z"/><path d="m9 12 3-3 3 3M12 9v7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6a7 7 0 0 0-1.7 1L5 6 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5L5 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h5l.5-3a7 7 0 0 0 1.7-1l2.3 1 2-3.5L19 13a7 7 0 0 0 0-1Z"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M15 4h5v16h-5"/></>,
  gauge: <><path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 12 4-4M7 16h10"/></>,
};

export function MedsIcon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: MedsIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
