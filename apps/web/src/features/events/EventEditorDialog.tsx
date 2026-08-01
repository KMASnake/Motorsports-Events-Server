import type { FormEvent } from 'react';
import type { Championship, Circuit, EventFormState } from './eventTypes';

interface Props {
  open: boolean;
  editing: boolean;
  saving: boolean;
  value: EventFormState;
  championships: Championship[];
  circuits: Circuit[];
  error: string | null;
  onChange: (value: EventFormState) => void;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function EventEditorDialog({ open, editing, saving, value, championships, circuits, error, onChange, onNameChange, onClose, onSubmit }: Props) {
  if (!open) return null;
  return <div className="lot3-modal-backdrop" onMouseDown={() => !saving && onClose()}>
    <section className="lot3-modal lot4-modal" role="dialog" aria-modal="true" aria-labelledby="event-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>LOT 4 · CALENDRIER</small><h2 id="event-editor-title">{editing ? 'Modifier l’événement' : 'Nouvel événement'}</h2></div><button onClick={onClose} aria-label="Fermer">×</button></header>
      <form onSubmit={onSubmit}>
        {error && <div className="events-form-error" role="alert">{error}</div>}
        <div className="lot3-form-grid">
          <label className="wide">Nom public *<input required minLength={2} value={value.name} onChange={(event) => onNameChange(event.target.value)} /></label>
          <label>Slug technique *<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={value.slug} onChange={(event) => onChange({ ...value, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label>
          <label>Catégorie facultative<input value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} placeholder="Ex. Grand Prix, Rallye…" /></label>
          <label>Championnat *<select required value={value.championship_id} onChange={(event) => onChange({ ...value, championship_id: event.target.value })}><option value="">Sélectionner</option>{championships.filter((item) => item.active || item.id === value.championship_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Circuit facultatif<select value={value.circuit_id} onChange={(event) => { const circuit = circuits.find((item) => item.id === event.target.value); onChange({ ...value, circuit_id: event.target.value, timezone: circuit?.timezone ?? value.timezone }); }}><option value="">Non défini</option>{circuits.map((item) => <option key={item.id} value={item.id}>{item.name}{item.country_code ? ` · ${item.country_code}` : ''}</option>)}</select></label>
          <label>Début *<input required type="datetime-local" value={value.starts_at} onChange={(event) => onChange({ ...value, starts_at: event.target.value })} /></label>
          <label>Fin<input type="datetime-local" min={value.starts_at} value={value.ends_at} onChange={(event) => onChange({ ...value, ends_at: event.target.value })} /></label>
          <label>Fuseau horaire *<input required value={value.timezone} onChange={(event) => onChange({ ...value, timezone: event.target.value })} /></label>
          <label>Statut<select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as EventFormState['status'] })}><option value="draft">Brouillon</option><option value="scheduled">À venir</option><option value="completed">Terminé</option><option value="cancelled">Annulé</option><option value="postponed">Reporté</option></select></label>
          <label className="wide">Description administrative facultative<textarea rows={4} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label>
        </div>
        <fieldset><legend>Publication</legend><label className="lot3-check"><input type="checkbox" checked={value.published} onChange={(event) => onChange({ ...value, published: event.target.checked })} /><span><b>Publier dans l’API clients</b><small>Les brouillons restent masqués même si cette option est cochée.</small></span></label></fieldset>
        <fieldset><legend>Fournisseur — métadonnée d’administration</legend><div className="lot3-form-grid inset"><label>Mode de gestion<select value={value.origin} onChange={(event) => onChange({ ...value, origin: event.target.value as EventFormState['origin'] })}><option value="manual">Manuel</option><option value="provider">Synchronisé</option><option value="mixed">Hybride</option></select></label><div className="lot4-admin-note">Cette information n’est jamais exposée dans l’API publique.</div></div></fieldset>
        <footer><button type="button" onClick={onClose}>Annuler</button><button className="danger" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer l’événement'}</button></footer>
      </form>
    </section>
  </div>;
}
