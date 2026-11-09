/**
 * @fileoverview Middleware keamanan untuk Fastify:
 * - Pelacakan Request ID & Correlation ID
 * - Penanganan galat terpusat yang menyamarkan detail internal/SQL/stack trace (UI_UX.md Bagian 9)
 * - Ekstraksi sesi pengguna terautentikasi dari cookie HttpOnly atau header
 * - Penanganan kunci idempotensi (`X-Idempotency-Key`) untuk mutasi penting
 */

import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  KODE_GALAT,
  type ProfilSesiPengguna,
  type ResponsGalatApi,
  type ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError, buatGalatKonflik } from "../model/errors.ts";
import type { IdentityRepository } from "../repository/identity.repository.ts";
import type { IdentityService } from "../services/identity.service.ts";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
    profilSesi?: ProfilSesiPengguna;
    tokenSesiMentah?: string;
  }
}

/**
 * Membungkus payload sukses ke dalam amplop respons API standar v1.
 */
export function buatResponsSukses<T>(
  request: FastifyRequest,
  data: T,
): ResponsSuksesApi<T> {
  return {
    sukses: true,
    data,
    meta: {
      requestId: String(request.id),
      correlationId: request.correlationId,
      waktuRespons: new Date().toISOString(),
    },
  };
}

/**
 * Memasang hook pelacakan `correlationId` dan penanganan galat aman pada instance Fastify.
 * Menjamin tidak ada query SQL, stack trace, nama tabel, atau kredensial yang bocor ke klien.
 */
export function pasangMiddlewareKeamanan(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    const headerCorrelation = request.headers["x-correlation-id"];
    const correlationId =
      typeof headerCorrelation === "string" &&
      headerCorrelation.trim().length > 0 &&
      headerCorrelation.trim().length <= 96
        ? headerCorrelation.trim()
        : `corr-${randomUUID()}`;

    request.correlationId = correlationId;
    reply.header("x-request-id", String(request.id));
    reply.header("x-correlation-id", correlationId);
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") error = buatGalatKonflik("Data sudah ada atau sumber daya sedang dipakai. Muat ulang sebelum melanjutkan.");
    const correlationId = request.correlationId ?? `corr-${randomUUID()}`;
    const kodeLaporan = `ERR-${correlationId.slice(-8).toUpperCase()}`;

    if (error instanceof AppError) {
      request.log.warn(
        {
          kode: error.kode,
          statusHttp: error.statusHttp,
          kodeLaporan,
          correlationId,
        },
        "Permintaan ditolak oleh validasi atau aturan bisnis.",
      );

      const bodyGalat: ResponsGalatApi = {
        sukses: false,
        galat: {
          kode: error.kode,
          pesan: error.pesanPengguna,
          kodeLaporan,
          ...(error.rincianValidasi
            ? { rincianValidasi: error.rincianValidasi }
            : {}),
        },
        meta: {
          requestId: String(request.id),
          correlationId,
          waktuRespons: new Date().toISOString(),
        },
      };

      reply.status(error.statusHttp).send(bodyGalat);
      return;
    }

    const statusRateLimit =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      (error as { statusCode?: unknown }).statusCode === 429;

    if (statusRateLimit) {
      const bodyRateLimit: ResponsGalatApi = {
        sukses: false,
        galat: {
          kode: KODE_GALAT.TERLALU_BANYAK_PERMINTAAN,
          pesan:
            "Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu beberapa saat lalu coba kembali.",
          kodeLaporan,
        },
        meta: {
          requestId: String(request.id),
          correlationId,
          waktuRespons: new Date().toISOString(),
        },
      };
      reply.status(429).send(bodyRateLimit);
      return;
    }

    const pesanErrorMentah =
      error instanceof Error ? error.message : "Galat internal tidak dikenal";
    request.log.error(
      {
        kodeLaporan,
        correlationId,
        rute: request.url,
        metode: request.method,
        pesanInternalTersanitasi: pesanErrorMentah.replace(
          /(password|token|secret)=([^&\s]+)/gi,
          "$1=[DIREDaksi]",
        ),
      },
      "Galat teknis internal tertangkap pada batas HTTP.",
    );

    const bodyInternalAman: ResponsGalatApi = {
      sukses: false,
      galat: {
        kode: KODE_GALAT.GANGGUAN_INTERNAL,
        pesan: "Sistem sedang mengalami gangguan. Silakan coba lagi.",
        kodeLaporan,
      },
      meta: {
        requestId: String(request.id),
        correlationId,
        waktuRespons: new Date().toISOString(),
      },
    };

    reply.status(500).send(bodyInternalAman);
  });
}

/**
 * Mengambil token sesi dari cookie `HttpOnly` atau header `Authorization: Bearer <token>`.
 */
export function ekstrakTokenSesiDariPermintaan(
  request: FastifyRequest,
  namaCookieSesi: string,
): string | undefined {
  const dariCookie = request.cookies?.[namaCookieSesi];
  if (typeof dariCookie === "string" && dariCookie.trim().length > 0) {
    return dariCookie.trim();
  }

  const headerAuth = request.headers.authorization;
  if (
    typeof headerAuth === "string" &&
    headerAuth.toLowerCase().startsWith("bearer ")
  ) {
    return headerAuth.slice(7).trim();
  }

  return undefined;
}

/**
 * Membuat preHandler Fastify yang mewajibkan sesi terautentikasi yang sah.
 */
export function buatPreHandlerWajibAutentikasi(
  identityService: IdentityService,
  namaCookieSesi: string,
) {
  return async function wajibAutentikasi(
    request: FastifyRequest,
  ): Promise<void> {
    const tokenMentah = ekstrakTokenSesiDariPermintaan(request, namaCookieSesi);
    const profil = await identityService.validasiSesiAktif(tokenMentah);
    request.tokenSesiMentah = tokenMentah;
    request.profilSesi = profil;
  };
}

/**
 * Menjalankan operasi mutasi dengan perlindungan idempotensi berbasis `X-Idempotency-Key`.
 * Jika kunci yang sama dikirim ulang dengan payload yang sama, mengembalikan respons sebelumnya tanpa duplikasi.
 * Jika kunci yang sama dipakai untuk payload berbeda, melempar `ERR_IDEMPOTENSI_KONFLIK` (HTTP 409).
 */
export async function jalankanDenganIdempotensi<T>(parameter: {
  request: FastifyRequest;
  reply: FastifyReply;
  repository: IdentityRepository;
  penggunaId: string;
  rute: string;
  payloadUntukFingerprint: unknown;
  eksekusi: () => Promise<{ statusHttp: number; body: ResponsSuksesApi<T> }>;
}): Promise<ResponsSuksesApi<T>> {
  const headerKunci = parameter.request.headers["x-idempotency-key"];
  const kunci =
    typeof headerKunci === "string" ? headerKunci.trim() : undefined;

  if (!kunci) {
    const hasil = await parameter.eksekusi();
    parameter.reply.status(hasil.statusHttp);
    return hasil.body;
  }

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(parameter.payloadUntukFingerprint ?? {}), "utf8")
    .digest("hex");

  const sekarangIso = new Date().toISOString();
  const sudahAda = await parameter.repository.cariKunciIdempotensi(
    kunci,
    parameter.penggunaId,
    parameter.rute,
    sekarangIso,
  );

  if (sudahAda) {
    if (sudahAda.fingerprintPayload !== fingerprint) {
      throw buatGalatKonflik(
        "Kunci idempotensi yang sama tidak dapat digunakan untuk isi permintaan yang berbeda.",
        KODE_GALAT.IDEMPOTENSI_KONFLIK,
      );
    }
    parameter.reply.header("x-idempotent-replay", "true");
    parameter.reply.status(sudahAda.statusHttp);
    return JSON.parse(sudahAda.responsJson) as ResponsSuksesApi<T>;
  }

  const hasilBaru = await parameter.eksekusi();
  const kedaluwarsaIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  await parameter.repository.simpanKunciIdempotensi({
    kunci,
    penggunaId: parameter.penggunaId,
    rute: parameter.rute,
    fingerprintPayload: fingerprint,
    statusHttp: hasilBaru.statusHttp,
    responsJson: JSON.stringify(hasilBaru.body),
    waktuDibuat: sekarangIso,
    waktuKedaluwarsa: kedaluwarsaIso,
  });

  parameter.reply.status(hasilBaru.statusHttp);
  return hasilBaru.body;
}

