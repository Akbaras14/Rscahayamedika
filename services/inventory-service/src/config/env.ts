/**
 * @fileoverview Konfigurasi variabel lingkungan untuk `inventory-service` (Tahap 7).
 */

export interface KonfigurasiEnvInventory {
  INVENTORY_SERVICE_PORT: number;
  INVENTORY_SERVICE_HOST: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD?: string;
  DB_DATABASE: string;
}

export function muatKonfigurasiInventory(): KonfigurasiEnvInventory {
  return {
    INVENTORY_SERVICE_PORT: Number(
      process.env.INVENTORY_SERVICE_PORT ?? 4004,
    ),
    INVENTORY_SERVICE_HOST: process.env.INVENTORY_SERVICE_HOST ?? "127.0.0.1",
    DB_HOST: process.env.DB_HOST ?? "localhost",
    DB_PORT: Number(process.env.DB_PORT ?? 3307),
    DB_USER: process.env.DB_USER ?? "root",
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE:
      process.env.DB_DATABASE_INVENTORY ?? "manajemen_gizi_pasien_inventory",
  };
}

