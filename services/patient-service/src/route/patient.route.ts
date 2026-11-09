/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk `patient-service` (`/v1/patients/...`).
 * Mencakup alur Tahap 2 — Peran Petugas Pendaftaran:
 * - Pencarian dan pengambilan daftar pasien (`GET /v1/patients`)
 * - Pemeriksaan potensi data pasien ganda (`POST /v1/patients/check-duplicate`)
 * - Pendaftaran identitas pasien baru (`POST /v1/patients`)
 * - Detail pasien & riwayat koreksi identitas (`GET /v1/patients/:id`)
 * - Koreksi terbatas identitas pasien berversi & teraudit (`PATCH /v1/patients/:id/identity`)
 * - Pembuatan kunjungan pemeriksaan & pemasukan ke antrean dokter (`POST /v1/patients/:id/visits`)
 * - Daftar kunjungan & antrean dokter (`GET /v1/patients/visits`)
 * - Pembatalan kunjungan pemeriksaan (`POST /v1/patients/visits/:kunjunganId/cancel`)
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import { validasiSkemaMasukan } from "../../../identity-service/src/validators/identity.validator.ts";
import type { PatientService } from "../services/patient.service.ts";
import {
  skemaBatalkanKunjungan,
  skemaBuatKunjunganPemeriksaan,
  skemaBuatPasienBaru,
  skemaCekDuplikasiPasien,
  skemaKoreksiIdentitasPasien,
  skemaKueriDaftarKunjungan,
  skemaKueriDaftarPasien,
} from "../validators/patient.validator.ts";

const ParamPasienIdSchema = z.object({
  id: z.string().trim().min(3, "ID pasien tidak valid.").max(64),
});

const ParamKunjunganIdSchema = z.object({
  kunjunganId: z.string().trim().min(3, "ID kunjungan tidak valid.").max(64),
});

export interface DependensiRutePatient {
  identityService: IdentityService;
  namaCookieSesi: string;
  patientService: PatientService;
}

/**
 * Mendaftarkan seluruh endpoint `/v1/patients` untuk Tahap 2 (Petugas Pendaftaran).
 */
export async function daftarkanRutePatient(
  app: FastifyInstance,
  deps: DependensiRutePatient,
): Promise<void> {
  const wajibAutentikasi = buatPreHandlerWajibAutentikasi(
    deps.identityService,
    deps.namaCookieSesi,
  );

  /**
   * Health check `patient-service`.
   */
  app.get("/v1/patients/health", async (request, reply) => {
    const status = await deps.patientService.cekKesehatan();
    reply.status(status.status === "sehat" ? 200 : 503);
    return buatResponsSukses(request, status);
  });

  /**
   * Mengambil daftar kunjungan pemeriksaan dan antrean dokter (`GET /v1/patients/visits`).
   */
  app.get(
    "/v1/patients/visits",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:baca" },
        request.correlationId,
      );

      const kueri = validasiSkemaMasukan(
        skemaKueriDaftarKunjungan,
        request.query,
      );
      const daftar = await deps.patientService.cariDaftarKunjungan(kueri);
      return buatResponsSukses(request, daftar);
    },
  );

  /**
   * Membatalkan kunjungan pemeriksaan yang masih menunggu pemeriksaan (`POST /v1/patients/visits/:kunjunganId/cancel`).
   */
  app.post(
    "/v1/patients/visits/:kunjunganId/cancel",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:koreksi" },
        request.correlationId,
      );

      const param = validasiSkemaMasukan(ParamKunjunganIdSchema, request.params);
      const body = validasiSkemaMasukan(skemaBatalkanKunjungan, request.body);
      const kunjungan = await deps.patientService.batalkanKunjunganPemeriksaan(
        profil,
        param.kunjunganId,
        body,
        request.correlationId,
      );
      return buatResponsSukses(request, kunjungan);
    },
  );

  /**
   * Memeriksa kemungkinan duplikasi data pasien sebelum registrasi (`POST /v1/patients/check-duplicate`).
   */
  app.post(
    "/v1/patients/check-duplicate",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:baca" },
        request.correlationId,
      );

      const body = validasiSkemaMasukan(skemaCekDuplikasiPasien, request.body);
      const hasil = await deps.patientService.periksaDuplikasiPasien(body);
      return buatResponsSukses(request, hasil);
    },
  );

  /**
   * Mencari dan mengambil daftar pasien berpaginasi (`GET /v1/patients`).
   */
  app.get(
    "/v1/patients",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:baca" },
        request.correlationId,
      );

      const kueri = validasiSkemaMasukan(skemaKueriDaftarPasien, request.query);
      const daftar = await deps.patientService.cariDaftarPasien(kueri);
      return buatResponsSukses(request, daftar);
    },
  );

  /**
   * Mendaftarkan identitas pasien baru (`POST /v1/patients`).
   * Mendukung header `X-Idempotency-Key`.
   */
  app.post(
    "/v1/patients",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:buat" },
        request.correlationId,
      );

      const body = validasiSkemaMasukan(skemaBuatPasienBaru, request.body);
      const kunciIdempotensi =
        typeof request.headers["x-idempotency-key"] === "string"
          ? request.headers["x-idempotency-key"].trim()
          : undefined;

      const hasil = await deps.patientService.daftarkanPasienBaru(
        profil,
        body,
        request.correlationId,
        kunciIdempotensi,
      );

      if (hasil.replayIdempoten) {
        reply.header("x-idempotent-replay", "true");
      }
      reply.status(201);
      return buatResponsSukses(request, hasil.pasien);
    },
  );

  /**
   * Mengambil detail pasien beserta riwayat koreksi identitas (`AB-030`) dan kunjungan (`GET /v1/patients/:id`).
   */
  app.get(
    "/v1/patients/:id",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:baca" },
        request.correlationId,
      );

      const param = validasiSkemaMasukan(ParamPasienIdSchema, request.params);
      const detail = await deps.patientService.ambilDetailPasien(param.id);
      return buatResponsSukses(request, detail);
    },
  );

  /**
   * Melakukan koreksi terbatas identitas pasien dengan optimistic concurrency (`versi`) dan riwayat (`PATCH /v1/patients/:id/identity`).
   */
  app.patch(
    "/v1/patients/:id/identity",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:koreksi" },
        request.correlationId,
      );

      const param = validasiSkemaMasukan(ParamPasienIdSchema, request.params);
      const body = validasiSkemaMasukan(
        skemaKoreksiIdentitasPasien,
        request.body,
      );
      const hasil = await deps.patientService.koreksiIdentitasPasien(
        profil,
        param.id,
        body,
        request.correlationId,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  /**
   * Membuat kunjungan pemeriksaan dan memasukkan pasien ke antrean dokter (`POST /v1/patients/:id/visits`).
   */
  app.post(
    "/v1/patients/:id/visits",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.identityService.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "pendaftaran:pasien:buat" },
        request.correlationId,
      );

      const param = validasiSkemaMasukan(ParamPasienIdSchema, request.params);
      const body = validasiSkemaMasukan(
        skemaBuatKunjunganPemeriksaan,
        request.body,
      );
      const kunciIdempotensi =
        typeof request.headers["x-idempotency-key"] === "string"
          ? request.headers["x-idempotency-key"].trim()
          : undefined;

      const hasil = await deps.patientService.buatKunjunganPemeriksaan(
        profil,
        param.id,
        body,
        request.correlationId,
        kunciIdempotensi,
      );

      if (hasil.replayIdempoten) {
        reply.header("x-idempotent-replay", "true");
      }
      reply.status(201);
      return buatResponsSukses(request, hasil);
    },
  );
}

