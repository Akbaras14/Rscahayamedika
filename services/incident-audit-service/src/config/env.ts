/**
 * @fileoverview Konfigurasi variabel lingkungan untuk `incident-audit-service` (Tahap 10).
 */

export interface KonfigurasiEnvIncident {
  NODE_ENV: string;
  INCIDENT_SERVICE_HOST: string;
  INCIDENT_SERVICE_PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD?: string;
  DB_DATABASE_INCIDENT: string;
  DB_CONNECTION_LIMIT: number;
  DB_CONNECT_TIMEOUT_MS: number;
  SESSION_COOKIE_NAME: string;
  SESSION_SECRET: string;
  SESSION_TTL_SECONDS: number;
}

export function muatKonfigurasiIncident(
  sumber: NodeJS.ProcessEnv = process.env,
): KonfigurasiEnvIncident {
  return {
    NODE_ENV: sumber.NODE_ENV ?? "development",
    INCIDENT_SERVICE_HOST: sumber.INCIDENT_SERVICE_HOST ?? "127.0.0.1",
    INCIDENT_SERVICE_PORT: Number(sumber.INCIDENT_SERVICE_PORT ?? 4007),
    DB_HOST: sumber.DB_HOST ?? "127.0.0.1",
    DB_PORT: Number(sumber.DB_PORT ?? 3307),
    DB_USER: sumber.DB_USER ?? "root",
    DB_PASSWORD: sumber.DB_PASSWORD,
    DB_DATABASE_INCIDENT:
      sumber.DB_DATABASE_INCIDENT ?? "manajemen_gizi_pasien_incident",
    DB_CONNECTION_LIMIT: Number(sumber.DB_CONNECTION_LIMIT ?? 10),
    DB_CONNECT_TIMEOUT_MS: Number(sumber.DB_CONNECT_TIMEOUT_MS ?? 5000),
    SESSION_COOKIE_NAME: sumber.SESSION_COOKIE_NAME ?? "hpnms_session",
    SESSION_SECRET:
      sumber.SESSION_SECRET ?? "default_secret_for_development_at_least_32_chars!",
    SESSION_TTL_SECONDS: Number(sumber.SESSION_TTL_SECONDS ?? 28800),
  };
}
