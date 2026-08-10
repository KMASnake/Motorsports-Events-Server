export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
}

export interface DashboardSummary {
  championships: number;
  events: number;
  circuits: number;
  synchronizationsToday: number;
}

export type SessionStatus = 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'postponed';
export type SessionOrigin = 'manual' | 'provider' | 'import' | 'mixed';

export interface SessionType {
  key: string;
  label: string;
  sort_order: number;
  active: boolean;
}

export interface AdminSession {
  id: string;
  event_id: string;
  name: string;
  type: string;
  /** Intitulé métier unique. `name` et `type` restent des champs techniques de compatibilité. */
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: SessionStatus;
  published: boolean;
  description: string | null;
  origin: SessionOrigin;
  provider_key: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicSession {
  id: string;
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: Exclude<SessionStatus, 'draft'>;
  description: string | null;
}

export interface CreateSessionInput {
  title: string;
  starts_at: string;
  ends_at?: string | null;
  status?: SessionStatus;
  published?: boolean;
  description?: string | null;
}

export type UpdateSessionInput = Partial<CreateSessionInput>;

export type SessionCorrectionField = 'title' | 'starts_at' | 'ends_at' | 'status' | 'published' | 'description';
export type SessionCorrectionStatus = 'active' | 'conflict' | 'resolved' | 'ignored';

export interface AdminSessionCorrection {
  id: string;
  session_id: string;
  event_id: string;
  field_name: SessionCorrectionField;
  provider_value: unknown;
  override_value: unknown;
  effective_value: unknown;
  status: SessionCorrectionStatus;
  provider_key: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
