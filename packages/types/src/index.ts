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
