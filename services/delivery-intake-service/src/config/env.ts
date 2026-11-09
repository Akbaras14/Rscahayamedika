/**
 * @fileoverview Konfigurasi variabel lingkungan untuk `delivery-intake-service` (Tahap 9).
 */

export interface KonfigurasiEnvDelivery {
  DELIVERY_SERVICE_PORT: number;
  DELIVERY_SERVICE_HOST: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD?: string;
  DB_DATABASE: string;
}

export function muatKonfigurasiDelivery(): KonfigurasiEnvDelivery {
  return {
    DELIVERY_SERVICE_PORT: Number(
      process.env.DELIVERY_SERVICE_PORT ?? 4006,
    ),
    DELIVERY_SERVICE_HOST: process.env.DELIVERY_SERVICE_HOST ?? "127.0.0.1",
    DB_HOST: process.env.DB_HOST ?? "localhost",
    DB_PORT: Number(process.env.DB_PORT ?? 3306),
    DB_USER: process.env.DB_USER ?? "root",
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE:
      process.env.DB_DATABASE_DELIVERY ?? "manajemen_gizi_pasien_delivery",
  };
}

