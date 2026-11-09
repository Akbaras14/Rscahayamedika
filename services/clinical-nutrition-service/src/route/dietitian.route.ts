/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk Ahli Gizi / Dietisien & Perencanaan Menu Individual (Tahap 6).
 * Mengimplementasikan endpoints:
 * - Health check (`GET /v1/dietitian/health`)
 * - Daftar Pasien Konsultasi & Rujukan Gizi (`GET /v1/dietitian/patients`)
 * - Asuhan Gizi ADIME (`POST` & `GET /v1/dietitian/nutrition-care`)
 * - Evaluasi Asuhan Gizi (`POST` & `GET /v1/dietitian/evaluations`)
 * - Master Katalog Menu & Resep (`GET /v1/meal-planning/recipes`)
 * - Rencana Menu Individual (`POST`, `GET`, `POST /:id/approve` pada `/v1/meal-planning/individual-menus`)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import type { ProfilSesiPengguna } from "../../../../packages/shared-types/src/index.ts";
import type { ClinicalNutritionService } from "../services/clinical-nutrition.service.ts";

export interface DependensiRuteDietitian {
  clinicalService: ClinicalNutritionService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export async function daftarkanRuteDietitian(
  app: FastifyInstance,
  deps: DependensiRuteDietitian,
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

  // 1. Health check dietitian
  app.get("/v1/dietitian/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "clinical-nutrition-service",
      modul: "dietitian",
      status: "sehat",
      tahap: 6,
      domain: "Asuhan Gizi Terstandar ADIME & Perencanaan Menu Individual",
      waktu: new Date().toISOString(),
    });
  });

  // 2. Daftar pasien rawat inap untuk konsultasi gizi & rujukan perawat (Tahap 6)
  app.get(
    "/v1/dietitian/patients",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const daftarPasien =
        await deps.clinicalService.ambilDaftarPasienDietisien({
          aktor: profil,
          bangsalId: query.bangsalId,
          risikoGizi: query.risikoGizi,
          statusAsuhan: query.statusAsuhan,
          correlationId: request.correlationId,
        });

      return buatResponsSukses(request, {
        items: daftarPasien,
        totalItem: daftarPasien.length,
      });
    },
  );

  // 3. Asuhan Gizi ADIME & Target Nutrisi (BRD Bab V.5.3, AB-020, AB-027)
  app.post(
    "/v1/dietitian/nutrition-care",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);

      const hasil = await deps.clinicalService.rekamAsuhanGiziAdime({
        aktor: profil,
        input: request.body,
        correlationId: request.correlationId,
      });

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  app.get(
    "/v1/dietitian/nutrition-care",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const items = await deps.clinicalService.ambilRiwayatAsuhanGizi({
        aktor: profil,
        episodeId: query.episodeId,
        pasienId: query.pasienId,
        correlationId: request.correlationId,
      });

      return buatResponsSukses(request, {
        items,
        totalItem: items.length,
      });
    },
  );

  // 4. Monitoring & Evaluasi Asuhan Gizi (BRD Bab V.5.6, Bab XI, AB-026, AB-028)
  app.post(
    "/v1/dietitian/evaluations",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);

      const hasil = await deps.clinicalService.rekamEvaluasiAsuhanGizi({
        aktor: profil,
        input: request.body,
        correlationId: request.correlationId,
      });

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  app.get(
    "/v1/dietitian/evaluations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const items = await deps.clinicalService.ambilRiwayatEvaluasiAsuhanGizi({
        aktor: profil,
        asuhanGiziId: query.asuhanGiziId,
        episodeId: query.episodeId,
        correlationId: request.correlationId,
      });

      return buatResponsSukses(request, {
        items,
        totalItem: items.length,
      });
    },
  );

  // 5. Master Katalog Menu & Resep Standar (BRD Bab V.5.5, AB-014)
  app.get(
    "/v1/meal-planning/recipes",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const items = await deps.clinicalService.ambilKatalogMenuResep({
        aktor: profil,
        kategoriMakanan: query.kategoriMakanan,
        bentukMakanan: query.bentukMakanan,
        correlationId: request.correlationId,
      });

      return buatResponsSukses(request, {
        items,
        totalItem: items.length,
      });
    },
  );

  // 6. Rencana Menu Individual Pasien (BRD Bab V.5.4, V.5.5, AB-007, AB-011)
  app.post(
    "/v1/meal-planning/individual-menus",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);

      const hasil = await deps.clinicalService.buatRencanaMenuIndividual({
        aktor: profil,
        input: request.body,
        correlationId: request.correlationId,
      });

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  app.get(
    "/v1/meal-planning/individual-menus",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const items =
        await deps.clinicalService.ambilDaftarRencanaMenuIndividual({
          aktor: profil,
          episodeId: query.episodeId,
          pasienId: query.pasienId,
          tanggalPelayanan: query.tanggalPelayanan,
          correlationId: request.correlationId,
        });

      return buatResponsSukses(request, {
        items,
        totalItem: items.length,
      });
    },
  );

  app.post(
    "/v1/meal-planning/individual-menus/:id/approve",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const params = request.params as { id: string };

      const hasil = await deps.clinicalService.sahkanRencanaMenuIndividual({
        aktor: profil,
        rencanaId: params.id,
        correlationId: request.correlationId,
      });

      return buatResponsSukses(request, hasil);
    },
  );
}

