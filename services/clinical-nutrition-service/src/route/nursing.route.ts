/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk Asuhan Keperawatan & Verifikasi Keamanan Makanan (Tahap 5 — Perawat).
 * Mengimplementasikan endpoints:
 * - Health check (`GET /v1/nursing/health`)
 * - Daftar Pasien Bangsal (`GET /v1/nursing/patients`)
 * - Verifikasi Keamanan Makanan (`POST` & `GET /v1/nursing/food-safety-verifications`)
 * - Skrining Gizi MST (`POST` & `GET /v1/nursing/nutrition-screenings`)
 * - Observasi Asupan Comstock (`POST` & `GET /v1/nursing/intake-observations`)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import { validasiSkemaMasukan } from "../../../identity-service/src/validators/identity.validator.ts";
import type { ProfilSesiPengguna } from "../../../../packages/shared-types/src/index.ts";
import type { ClinicalNutritionService } from "../services/clinical-nutrition.service.ts";
import {
  skemaObservasiAsupan,
  skemaSkriningGizi,
  skemaVerifikasiKeamananMakanan,
} from "../validators/nursing.validator.ts";

export interface DependensiRuteNursing {
  clinicalService: ClinicalNutritionService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export async function daftarkanRuteNursing(
  app: FastifyInstance,
  deps: DependensiRuteNursing,
): Promise<void> {
  const wajibAutentikasi = buatPreHandlerWajibAutentikasi(
    deps.identityService,
    deps.namaCookieSesi,
  );

  function ambilProfil(request: FastifyRequest): ProfilSesiPengguna {
    if (!request.profilSesi) {
      throw buatGalatSesiBerakhir();
    }
    return request.profilSesi;
  }

  // 1. Health check nursing
  app.get("/v1/nursing/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "clinical-nutrition-service",
      modul: "nursing",
      status: "sehat",
      tahap: 5,
      domain: "Asuhan Keperawatan & Verifikasi Keamanan Makanan",
      waktu: new Date().toISOString(),
    });
  });

  // 2. Daftar pasien rawat inap di bangsal binaan perawat (AB-032)
  app.get(
    "/v1/nursing/patients",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const daftarPasien =
        await deps.clinicalService.ambilDaftarPasienBangsalPerawat({
          aktor: profil,
          bangsalId: query.bangsalId,
          correlationId: request.correlationId,
        });

      return buatResponsSukses(request, {
        items: daftarPasien,
        totalItem: daftarPasien.length,
      });
    },
  );

  // 3. Verifikasi Keamanan Makanan oleh Perawat (AB-003, AB-008, AB-020)
  app.post(
    "/v1/nursing/food-safety-verifications",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const input = validasiSkemaMasukan(
        skemaVerifikasiKeamananMakanan,
        request.body,
      );

      const hasil = await deps.clinicalService.verifikasiKeamananMakanan({
        aktor: profil,
        input,
        correlationId: request.correlationId,
      });

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  app.get(
    "/v1/nursing/food-safety-verifications",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;
      const items = await deps.clinicalService.ambilRiwayatKeperawatan(profil, "keamanan", query.episodeId);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );
  // 4. Skrining Gizi MST (BRD Bab V.5.2)
  app.post(
    "/v1/nursing/nutrition-screenings",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const input = validasiSkemaMasukan(skemaSkriningGizi, request.body);

      const hasil = await deps.clinicalService.rekamSkriningGizi({
        aktor: profil,
        input,
        correlationId: request.correlationId,
      });

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  app.get(
    "/v1/nursing/nutrition-screenings",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;
      const items = await deps.clinicalService.ambilRiwayatKeperawatan(profil, "skrining", query.episodeId);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );
  // 5. Observasi Asupan Comstock (BRD Bab X.10.1, 10.2)
  app.post(
    "/v1/nursing/intake-observations",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const input = validasiSkemaMasukan(skemaObservasiAsupan, request.body);

      const hasil = await deps.clinicalService.catatObservasiAsupan({
        aktor: profil,
        input,
        correlationId: request.correlationId,
      });

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  app.get(
    "/v1/nursing/intake-observations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const hasil = await deps.clinicalService.ambilRiwayatObservasiAsupan({
        aktor: profil,
        pasienId: query.pasienId,
        episodeId: query.episodeId,
        bangsalId: query.bangsalId,
        correlationId: request.correlationId,
      });

      return buatResponsSukses(request, {
        items: hasil,
        totalItem: hasil.length,
      });
    },
  );
}

