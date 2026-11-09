/**
 * @fileoverview Pabrik aplikasi (app factory) Fastify untuk Identity Service.
 * Mengonfigurasi Pino structured logging dengan redaksi data sensitif,
 * cookie HttpOnly, rate limiting per proses, serta rute `/v1`.
 */

import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import {
  type IdentityServiceEnv,
  muatKonfigurasiIdentity,
} from "./config/env.ts";
import { pasangMiddlewareKeamanan } from "./middleware/security.middleware.ts";
import {
  type IdentityRepository,
  InMemoryIdentityRepository,
} from "./repository/identity.repository.ts";
import { daftarkanRuteIdentity } from "./route/identity.route.ts";
import { IdentityService } from "./services/identity.service.ts";

export interface OpsiBangunAplikasiIdentity {
  env?: Partial<IdentityServiceEnv>;
  repository?: IdentityRepository;
  aktifkanRuteUjiGalat?: boolean;
}

/**
 * Membangun instance Fastify `identity-service` yang siap diuji (`app.inject`) maupun dijalankan.
 *
 * @param opsi - Opsi konfigurasi dan injeksi repositori.
 * @returns Instance Fastify terkonfigurasi beserta referensi service & repository.
 */
export async function bangunAplikasiIdentity(
  opsi: OpsiBangunAplikasiIdentity = {},
): Promise<{
  app: FastifyInstance;
  service: IdentityService;
  repository: IdentityRepository;
  env: IdentityServiceEnv;
}> {
  const envDasar = muatKonfigurasiIdentity(process.env);
  const env: IdentityServiceEnv = {
    ...envDasar,
    ...opsi.env,
  };

  const app = Fastify({
    bodyLimit: 64 * 1024, // Batas ukuran payload ketat 64 KB
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "body.kataSandi",
          "body.password",
          "body.token",
          "*.kataSandi",
          "*.password",
          "*.passwordHash",
          "*.tokenSesiMentah",
          "*.diagnosis",
          "*.alergi",
          "*.catatanKlinis",
        ],
        censor: "[DIREDaksi]",
      },
    },
  });

  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
  });

  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX_GLOBAL,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  pasangMiddlewareKeamanan(app);

  const repository = opsi.repository ?? new InMemoryIdentityRepository();
  const service = new IdentityService(repository, env.SESSION_TTL_SECONDS);

  await daftarkanRuteIdentity(app, {
    env,
    repository,
    service,
  });

  if (opsi.aktifkanRuteUjiGalat) {
    app.get("/v1/_test/simulasi-galat-sql", async () => {
      throw new Error(
        "ER_BAD_FIELD_ERROR: Unknown column 'rahasia_pasien' in 'SELECT * FROM pengguna WHERE password=123'",
      );
    });
  }

  return { app, service, repository, env };
}

