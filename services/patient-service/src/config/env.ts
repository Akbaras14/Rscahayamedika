/**
 * @fileoverview Validasi konfigurasi lingkungan untuk `patient-service` menggunakan Zod.
 * Mengikuti aturan TECHSTACK.md Bagian 2 (isolasi skema database per microservice).
 */

import { z } from "zod";

const skemaEnvPatient = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PATIENT_SERVICE_HOST: z.string().min(1).default("127.0.0.1"),
  PATIENT_SERVICE_PORT: z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(4002),
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3307),
  DB_USER: z.string().min(1).default("hpnms_app_user"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME_PATIENT: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_]+$/)
    .default("manajemen_gizi_pasien_patient"),
  DB_POOL_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  DB_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000),
});

export type KonfigurasiEnvPatient = z.infer<typeof skemaEnvPatient>;

/**
 * Memuat dan memvalidasi variabel lingkungan untuk `patient-service`.
 *
 * @param sumberEnv - Objek variabel lingkungan (`process.env` atau override pengujian).
 * @returns Objek konfigurasi tervalidasi.
 */
export function muatKonfigurasiPatient(
  sumberEnv: Record<string, string | undefined> = process.env,
): KonfigurasiEnvPatient {
  return skemaEnvPatient.parse(sumberEnv);
}
