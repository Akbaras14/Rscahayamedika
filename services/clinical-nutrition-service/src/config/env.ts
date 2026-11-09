/**
 * @fileoverview Konfigurasi variabel lingkungan untuk `clinical-nutrition-service`.
 */

export interface KonfigurasiEnvClinicalNutrition {
  CLINICAL_SERVICE_PORT: number;
  CLINICAL_SERVICE_HOST: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD?: string;
  DB_DATABASE: string;
}

export function muatKonfigurasiClinicalNutrition(): KonfigurasiEnvClinicalNutrition {
  return {
    CLINICAL_SERVICE_PORT: Number(
      process.env.CLINICAL_SERVICE_PORT ?? 4003,
    ),
    CLINICAL_SERVICE_HOST: process.env.CLINICAL_SERVICE_HOST ?? "127.0.0.1",
    DB_HOST: process.env.DB_HOST ?? "localhost",
    DB_PORT: Number(process.env.DB_PORT ?? 3307),
    DB_USER: process.env.DB_USER ?? "root",
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE:
      process.env.DB_DATABASE_CLINICAL ?? "manajemen_gizi_pasien_clinical",
  };
}

