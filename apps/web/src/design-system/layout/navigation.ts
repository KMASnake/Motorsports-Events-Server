import type { MedsIconName } from './icons';

export type NavigationItem = {
  path: string;
  label: string;
  icon: MedsIconName;
  badge?: number;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  { label: '', items: [{ path: '/', label: 'Tableau de bord', icon: 'dashboard' }] },
  {
    label: 'ÉVÉNEMENTS',
    items: [
      { path: '/events', label: 'Événements', icon: 'calendar' },
      { path: '/championships', label: 'Championnats', icon: 'championship' },
      { path: '/circuits', label: 'Circuits', icon: 'circuit' },
      { path: '/sessions', label: 'Sessions', icon: 'sessions' },
    ],
  },
  {
    label: 'PROVIDERS',
    items: [
      { path: '/sources', label: 'Sources', icon: 'sources' },
      { path: '/synchronizations', label: 'Synchronisations', icon: 'sync' },
      { path: '/tasks', label: 'Tâches planifiées', icon: 'tasks' },
    ],
  },
  {
    label: 'QUALITÉ DES DONNÉES',
    items: [
      { path: '/corrections', label: 'Corrections', icon: 'edit' },
      { path: '/duplicates', label: 'Doublons', icon: 'duplicates' },
      { path: '/conflicts', label: 'Conflits', icon: 'warning' },
      { path: '/alerts', label: 'Alertes', icon: 'warning' },
    ],
  },
  {
    label: 'ANALYSE',
    items: [
      { path: '/statistics', label: 'Statistiques', icon: 'statistics' },
      { path: '/history', label: 'Historique', icon: 'history' },
      { path: '/logs', label: 'Journaux', icon: 'logs' },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { path: '/users', label: 'Utilisateurs', icon: 'users' },
      { path: '/api-keys', label: 'Clés API', icon: 'key' },
      { path: '/backups', label: 'Sauvegardes', icon: 'backup' },
      { path: '/migrations', label: 'Migrations', icon: 'migration' },
      { path: '/settings', label: 'Paramètres', icon: 'settings' },
    ],
  },
];

export const ALL_NAVIGATION_ITEMS = NAVIGATION_SECTIONS.flatMap((section) => section.items);

export const PLACEHOLDER_NAVIGATION_ITEMS = ALL_NAVIGATION_ITEMS.filter(
  ({ path }) => !['/', '/events', '/championships', '/circuits', '/corrections', '/sources', '/synchronizations'].includes(path),
);
