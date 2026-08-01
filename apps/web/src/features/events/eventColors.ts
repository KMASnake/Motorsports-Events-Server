import type { Championship, EventRow } from './eventTypes';

const disciplineColors: Record<string, string> = {
  'formula-1': '#1f6a2b', f1: '#1f6a2b', motogp: '#8f2528', moto2: '#7d3811',
  motoe: '#7d3811', wsbk: '#104d78', wssp: '#104d78', 'formula-e': '#54265d',
  wrc: '#154f79', indycar: '#6a2228', nascar: '#725213'
};

export function eventColor(event: EventRow, championships: Championship[]) {
  const championship = championships.find((item) => item.id === event.championship_id);
  return championship?.color || disciplineColors[event.championship_slug.toLowerCase()] || '#24485d';
}
