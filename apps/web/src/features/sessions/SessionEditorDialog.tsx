import type { FormEvent } from 'react';
import type { SessionFormState } from './sessionTypes';
import { statusLabels } from './sessionUtils';

interface Props {
  open: boolean; editing: boolean; saving: boolean; value: SessionFormState;
  suggestions: string[]; error: string | null;
  onChange: (value: SessionFormState) => void; onClose: () => void; onSubmit: (event: FormEvent) => void;
}

export function SessionEditorDialog({ open, editing, saving, value, suggestions, error, onChange, onClose, onSubmit }: Props) {
  if (!open) return null;
  return <div className="lot3-modal-backdrop" onMouseDown={() => !saving && onClose()}>
    <section className="lot3-modal session-editor" role="dialog" aria-modal="true" aria-labelledby="session-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>LOT 4.3 · SESSION</small><h2 id="session-editor-title">{editing ? 'Modifier la session' : 'Nouvelle session'}</h2></div><button onClick={onClose} aria-label="Fermer">×</button></header>
      <form onSubmit={onSubmit}>
        {error && <div className="events-form-error" role="alert">{error}</div>}
        <div className="lot3-form-grid">
          <label className="wide">Intitulé de session *
            <input required minLength={1} maxLength={160} list="session-title-suggestions" autoComplete="off" value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} placeholder="FP1, Qualifications, Warm-up…" />
            <datalist id="session-title-suggestions">{suggestions.map((title) => <option value={title} key={title} />)}</datalist>
            <small>Choisissez une suggestion ou saisissez immédiatement un nouvel intitulé.</small>
          </label>
          <label>Début *<input required type="datetime-local" value={value.starts_at} onChange={(event) => onChange({ ...value, starts_at: event.target.value })} /></label>
          <label>Fin facultative<input type="datetime-local" min={value.starts_at} value={value.ends_at} onChange={(event) => onChange({ ...value, ends_at: event.target.value })} /></label>
          <label>Statut<select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as SessionFormState['status'] })}>{Object.entries(statusLabels).map(([status,label]) => <option value={status} key={status}>{label}</option>)}</select></label>
          <label className="wide">Description facultative<textarea rows={4} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label>
        </div>
        <fieldset><legend>Publication</legend><label className="lot3-check"><input type="checkbox" checked={value.published} onChange={(event) => onChange({ ...value, published: event.target.checked })} /><span><b>Publiée dans l’API clients</b><small>Une session brouillon reste masquée.</small></span></label></fieldset>
        <footer><button type="button" onClick={onClose}>Annuler</button><button className="danger" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer la session' : 'Ajouter la session'}</button></footer>
      </form>
    </section>
  </div>;
}
