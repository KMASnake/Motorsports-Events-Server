export type EventStatus = 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'postponed';
export type EventOrigin = 'manual' | 'provider' | 'mixed';
export type EventView = 'month' | 'week' | 'day' | 'agenda' | 'list';

export interface Championship {
  id: string;
  name: string;
  short_name: string | null;
  slug?: string;
  active: boolean;
  color?: string | null;
}

export interface Circuit {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
  timezone: string;
}

export interface EventRow {
  id: string;
  championship_id: string;
  championship_name: string;
  championship_slug: string;
  championship_logo_url?: string | null;
  circuit_id: string | null;
  circuit_name: string | null;
  circuit_city: string | null;
  country_code: string | null;
  meeting_id?: string | null;
  meeting_name?: string | null;
  name: string;
  slug: string;
  category: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  status: EventStatus;
  published: boolean;
  origin: EventOrigin;
  description: string | null;
  session_title?: string | null;
  provider_key?: string | null;
  external_id?: string | null;
  correction_count?: number;
}

export interface EventFormState {
  championship_id: string;
  circuit_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  published: boolean;
  description: string;
  session_title: string;
}

export interface SessionTitleSuggestion { title: string; usage_count: number }

export interface EventFiltersState {
  search: string;
  championship: string;
  status: string;
  publication: string;
  provider: string;
}
