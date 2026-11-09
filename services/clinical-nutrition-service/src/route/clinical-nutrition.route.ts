/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk `clinical-nutrition-service` (`/v1/clinical-nutrition/...`).
 * Mencakup alur Tahap 3 — Peran Dokter:
 * - Pemeriksaan antrean dokter (`GET /v1/clinical-nutrition/queue`)
 * - Penyimpanan hasil pemeriksaan klinis & tanda vital (`POST /v1/clinical-nutrition/examinations`)
 * - Riwayat alergi pasien (`GET` & `POST /v1/clinical-nutrition/patients/:pasienId/allergies`)
 * - Detail klinis pasien (`GET /v1/clinical-nutrition/visits/:kunjunganId/clinical-detail`)
 * - Penetapan & pengesahan instruksi diet awal (`POST /v1/clinical-nutrition/diet-orders`)
 * - Koreksi versi instruksi diet berstempel waktu (`PATCH /v1/clinical-nutrition/diet-orders/:id`)
 * - Riwayat versi instruksi diet (`GET /v1/clinical-nutrition/diet-orders/:id/history`)
 * - Pengajuan rawat inap dokter (`POST` & `GET /v1/clinical-nutrition/admission-requests`)
 * - Penyelesaian kunjungan pemeriksaan (`POST /v1/clinical-nutrition/visits/:kunjunganId/complete`)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
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
  skemaCatatAlergiPasien,
  skemaKoreksiInstruksiDiet,
  skemaPengajuanRawatInap,
  skemaSahkanInstruksiDiet,
  skemaSimpanPemeriksaanKlinis,
} from "../validators/clinical-nutrition.validator.ts";

export interface DependensiRuteClinicalNutrition {
  clinicalService: ClinicalNutritionService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

const ParamPasienIdSchema = z.object({
  pasienId: z.string().trim().min(3, "ID pasien tidak valid.").max(64),
});

const ParamKunjunganIdSchema = z.object({
  kunjunganId: z.string().trim().min(3, "ID kunjungan tidak valid.").max(64),
});

const ParamInstruksiIdSchema = z.object({
  id: z.string().trim().min(3, "ID instruksi diet tidak valid.").max(64),
});

export async function daftarkanRuteClinicalNutrition(
  app: FastifyInstance,
  deps: DependensiRuteClinicalNutrition,
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

  // 1. Health check
  app.get("/v1/clinical-nutrition/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "clinical-nutrition-service",
      status: "sehat",
      tahap: 3,
      domain: "Nutrisi Klinis & Peran Dokter DPJP",
      waktu: new Date().toISOString(),
    });
  });

  // 2. Daftar antrean pasien dokter
  app.get(
    "/v1/clinical-nutrition/queue",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const hasil = await deps.clinicalService.ambilAntreanDokter({
        aktor: profil,
        halaman: query.halaman ? Number(query.halaman) : 1,
        ukuranHalaman: query.ukuranHalaman ? Number(query.ukuranHalaman) : 10,
        kataKunci: query.kataKunci,
        correlationId: request.correlationId,
      });

      return buatResponsSukses(request, hasil);
    },
  );

  // 3. Simpan hasil pemeriksaan klinis (AB-020, BRD Bab IV.4.2)
  app.post(
    "/v1/clinical-nutrition/examinations",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const input = validasiSkemaMasukan(
        skemaSimpanPemeriksaanKlinis,
        request.body,
      );

      const hasil = await deps.clinicalService.simpanPemeriksaanKlinis(
        input,
        profil,
        request.correlationId,
      );

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  // 4. Ambil daftar alergi pasien
  app.get(
    "/v1/clinical-nutrition/patients/:pasienId/allergies",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { pasienId } = validasiSkemaMasukan(
        ParamPasienIdSchema,
        request.params,
      );

      const items = await deps.clinicalService.ambilDaftarAlergi(
        pasienId,
        profil,
      );

      return buatResponsSukses(request, { items, totalItem: items.length });
    },
  );

  // 5. Catat alergi pasien baru (AB-007)
  app.post(
    "/v1/clinical-nutrition/patients/:pasienId/allergies",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const { pasienId } = validasiSkemaMasukan(
        ParamPasienIdSchema,
        request.params,
      );
      const input = validasiSkemaMasukan(skemaCatatAlergiPasien, request.body);

      const hasil = await deps.clinicalService.catatAlergiPasien(
        pasienId,
        input,
        profil,
        request.correlationId,
      );

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  // 6. Ambil detail lengkap klinis pasien untuk workspace dokter
  app.get(
    "/v1/clinical-nutrition/visits/:kunjunganId/clinical-detail",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { kunjunganId } = validasiSkemaMasukan(
        ParamKunjunganIdSchema,
        request.params,
      );

      const hasil = await deps.clinicalService.ambilDetailKlinisPasien(
        kunjunganId,
        profil,
      );

      return buatResponsSukses(request, hasil);
    },
  );

  // 7. Sahkan instruksi diet awal baru (AB-003, AB-004, AB-005, AB-008, AB-009)
  app.post(
    "/v1/clinical-nutrition/diet-orders",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const input = validasiSkemaMasukan(skemaSahkanInstruksiDiet, request.body);
      const idempotencyKey = request.headers["x-idempotency-key"] as
        | string
        | undefined;

      const hasil = await deps.clinicalService.sahkanInstruksiDietAwal(
        input,
        profil,
        idempotencyKey,
        request.correlationId,
      );

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  // 8. Koreksi / perubahan versi instruksi diet (AB-004, AB-010, AB-030)
  app.patch(
    "/v1/clinical-nutrition/diet-orders/:id",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = validasiSkemaMasukan(
        ParamInstruksiIdSchema,
        request.params,
      );
      const input = validasiSkemaMasukan(
        skemaKoreksiInstruksiDiet,
        request.body,
      );

      const hasil = await deps.clinicalService.koreksiInstruksiDietBerversi(
        id,
        input,
        profil,
        request.correlationId,
      );

      return buatResponsSukses(request, hasil);
    },
  );

  // 9. Riwayat versi instruksi diet (AB-004, AB-030)
  app.get(
    "/v1/clinical-nutrition/diet-orders/:id/history",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      ambilProfil(request);
      const { id } = validasiSkemaMasukan(
        ParamInstruksiIdSchema,
        request.params,
      );

      const items =
        await deps.clinicalService["clinicalRepo"].ambilRiwayatVersiDiet(id);

      return buatResponsSukses(request, { items, totalItem: items.length });
    },
  );

  // 10. Buat pengajuan rawat inap (BRD Bab IV.4.3)
  app.post(
    "/v1/clinical-nutrition/admission-requests",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = ambilProfil(request);
      const input = validasiSkemaMasukan(
        skemaPengajuanRawatInap,
        request.body,
      );
      const idempotencyKey = request.headers["x-idempotency-key"] as
        | string
        | undefined;

      const hasil = await deps.clinicalService.buatPengajuanRawatInap(
        input,
        profil,
        idempotencyKey,
        request.correlationId,
      );

      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );

  // 11. Ambil daftar pengajuan rawat inap
  app.get(
    "/v1/clinical-nutrition/admission-requests",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as Record<string, string | undefined>;

      const hasil = await deps.clinicalService.ambilDaftarPengajuanRawatInap(
        {
          halaman: query.halaman ? Number(query.halaman) : 1,
          ukuranHalaman: query.ukuranHalaman ? Number(query.ukuranHalaman) : 10,
          statusPengajuan: query.statusPengajuan,
          rekomendasiBangsal: query.rekomendasiBangsal,
          pasienId: query.pasienId,
        },
        profil,
      );

      return buatResponsSukses(request, hasil);
    },
  );

  // 12. Selesaikan kunjungan pemeriksaan rawat jalan
  app.post(
    "/v1/clinical-nutrition/visits/:kunjunganId/complete",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { kunjunganId } = validasiSkemaMasukan(
        ParamKunjunganIdSchema,
        request.params,
      );

      const hasil = await deps.clinicalService.selesaikanKunjunganPemeriksaan(
        kunjunganId,
        profil,
        request.correlationId,
      );

      return buatResponsSukses(request, hasil);
    },
  );
}
