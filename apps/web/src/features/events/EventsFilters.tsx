import type { Championship, EventFiltersState } from './eventTypes';
import { providerOptions } from './providerDisplay';

interface Props {
  value: EventFiltersState;
  championships: Championship[];
  onChange: (value: EventFiltersState) => void;
  onRefresh: () => void;
}

export function EventsFilters({ value, championships, onChange, onRefresh }: Props) {
  const set = (field: keyof EventFiltersState, next: string) => onChange({ ...value, [field]: next });
  return <div className="events-filters" aria-label="Filtres des événements">
    <input aria-label="Rechercher" value={value.search} onChange={(event) => set('search', event.target.value)} placeholder="⌕  Rechercher un événement…" />
    <select aria-label="Championnat" value={value.championship} onChange={(event) => set('championship', event.target.value)}>
      <option value="all">Tous les championnats</option>
      {championships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <select aria-label="Statut" value={value.status} onChange={(event) => set('status', event.target.value)}>
      <option value="all">Tous les statuts</option><option value="draft">Brouillon</option>
      <option value="scheduled">À venir</option><option value="completed">Terminé</option>
      <option value="cancelled">Annulé</option><option value="postponed">Reporté</option>
    </select>
    <select aria-label="Publication" value={value.publication} onChange={(event) => set('publication', event.target.value)}>
      <option value="all">Toute publication</option><option value="published">Publiés</option><option value="private">Non publiés</option>
    </select>
    <select aria-label="Fournisseur" value={value.provider} onChange={(event) => set('provider', event.target.value)}>
      <option value="all">Tous les fournisseurs</option>
      {providerOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <button onClick={() => onChange({ search: '', championship: 'all', status: 'all', publication: 'all', provider: 'all' })}>Réinitialiser</button>
    <button onClick={onRefresh} aria-label="Actualiser les événements">↻</button>
  </div>;
}
