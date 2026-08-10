export type SessionStatus = 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'postponed';
export type SessionOrigin = 'manual' | 'provider' | 'import' | 'mixed';

export interface SessionRow {
  id: string;
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: SessionStatus;
  published: boolean;
  description: string | null;
  origin: SessionOrigin;
  provider_key: string | null;
}

export interface SessionFormState {
  title: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
  published: boolean;
  description: string;
}

export type SessionCorrectionField = 'title' | 'starts_at' | 'ends_at' | 'status' | 'published' | 'description';

export interface SessionCorrection {
  id: string;
  session_id: string;
  event_id: string;
  session_title: string;
  field_name: SessionCorrectionField;
  provider_value: unknown;
  override_value: unknown;
  effective_value: unknown;
  status: 'active' | 'conflict' | 'resolved' | 'ignored';
  provider_key: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; page_size: number; total: number; pages: number };
}

export interface SessionTitleSuggestion { title: string; usage_count: number }
