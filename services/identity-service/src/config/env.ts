/**
 * @fileoverview Konfigurasi environment bertipe ketat untuk Identity Service.
 * Memvalidasi seluruh variabel konfigurasi di batas sistem menggunakan Zod.
 */

import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  IDENTITY_SERVICE_HOST: z.string().min(1).default("127.0.0.1"),
  IDENTITY_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default("hpnms_app_user"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME_IDENTITY: z
    .string()
    .min(1)
    .default("manajemen_gizi_pasien_identity"),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  DB_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(60000)
    .default(5000),
  SESSION_COOKIE_NAME: z.string().min(1).default("hpnms_session"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("dev-only-session-secret-change-in-env-32chars"),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(86400)
    .default(28800),
  RATE_LIMIT_MAX_GLOBAL: z.coerce.number().int().min(10).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_LOGIN: z.coerce.number().int().min(1).default(5),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production") {
    if (!env.DB_PASSWORD || env.DB_PASSWORD === "CHANGE_ME_LOCAL_MYSQL_PASSWORD") {
      context.addIssue({ code: "custom", path: ["DB_PASSWORD"], message: "Wajib menggunakan kredensial database produksi." });
    }
    if (env.SESSION_SECRET === "dev-only-session-secret-change-in-env-32chars") {
      context.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "Wajib menggunakan rahasia sesi unik untuk produksi." });
    }
  }
});

export type IdentityServiceEnv = z.infer<typeof EnvSchema>;

/**
 * Membaca dan memvalidasi variabel environment untuk Identity Service.
 *
 * @param rawEnv - Objek environment (default `process.env`).
 * @returns Objek konfigurasi yang telah tervalidasi.
 * @throws Error apabila variabel environment tidak memenuhi skema keamanan dasar.
 */
export function muatKonfigurasiIdentity(
  rawEnv: NodeJS.ProcessEnv = process.env,
): IdentityServiceEnv {
  const hasil = EnvSchema.safeParse(rawEnv);
  if (!hasil.success) {
    const rincian = hasil.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Konfigurasi Identity Service tidak valid: ${rincian}`);
  }
  return hasil.data;
}
