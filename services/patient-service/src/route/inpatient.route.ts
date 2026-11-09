/**
 * @fileoverview Transport HTTP Fastify untuk modul Rawat Inap (Tahap 4 — Petugas Rawat Inap).
 * Memeriksa autentikasi sesi HttpOnly dan otorisasi berbasis peran/izin (AB-032).
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  ProfilSesiPengguna,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";
import { KODE_GALAT } from "../../../../packages/shared-types/src/index.ts";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import {
  AppError,
  buatGalatSesiBerakhir,
} from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import { validasiSkemaMasukan } from "../../../identity-service/src/validators/identity.validator.ts";
import type {
  ItemBangsalDto,
  ItemEpisodeRawatInapDto,
  ItemKamarDto,
  ItemPengajuanRawatInapDto,
  ItemRiwayatPerpindahanDto,
  ItemTempatTidurDto,
  RingkasanKapasitasRawatInap,
} from "../model/inpatient.model.ts";
import type { InpatientService } from "../services/inpatient.service.ts";
import {
  skemaKeputusanPengajuan,
  skemaPemindahanTempatTidur,
  skemaPemulanganPasien,
  skemaPenerimaanDanPenempatan,
} from "../validators/inpatient.validator.ts";

export interface DependensiRuteInpatient {
  inpatientService: InpatientService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export function daftarkanRuteInpatient(
  app: FastifyInstance,
  deps: DependensiRuteInpatient,
): void {
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

  // Middleware periksa izin penempatan rawat inap (AB-032)
  function periksaIzinInpatient(
    req: FastifyRequest,
    izinWajib:
      | "rawat_inap:penempatan:baca"
      | "rawat_inap:penempatan:kelola" = "rawat_inap:penempatan:baca",
  ): ProfilSesiPengguna {
    const profil = ambilProfil(req);

    // Larangan mutlak Administrator mengakses domain klinis (AB-032)
    if (profil.peran === "administrator") {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akses Ditolak (AB-032): Administrator dilarang mengelola data klinis dan penempatan pasien.",
        pesanInternal: `Akses ditolak untuk peran administrator (${profil.id}) pada modul rawat inap.`,
      });
    }

    const punyaIzin =
      profil.daftarIzin.includes(izinWajib) ||
      profil.daftarIzin.includes("rawat_inap:penempatan:kelola");

    if (!punyaIzin) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akses Ditolak: Anda tidak memiliki wewenang untuk mengelola penempatan rawat inap.",
        pesanInternal: `Pengguna ${profil.id} (peran ${profil.peran}) tidak memiliki izin '${izinWajib}'.`,
      });
    }

    return profil;
  }

  // 1. Health check
  app.get("/v1/inpatient/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "inpatient-module",
      status: "sehat",
      waktu: new Date().toISOString(),
    });
  });

  // 2. Kapasitas & Denah Bangsal / Bed
  app.get(
    "/v1/inpatient/overview",
    { preHandler: [wajibAutentikasi] },
    async (
      req: FastifyRequest,
    ): Promise<
      ResponsApi<{
        ringkasan: RingkasanKapasitasRawatInap;
        daftarBangsal: readonly ItemBangsalDto[];
        daftarKamar: readonly ItemKamarDto[];
        daftarTempatTidur: readonly ItemTempatTidurDto[];
      }>
    > => {
      periksaIzinInpatient(req, "rawat_inap:penempatan:baca");
      const data = await deps.inpatientService.ambilKapasitasDanKetersediaan();
      return buatResponsSukses(req, data);
    },
  );

  // 3. Daftar Pengajuan Rawat Inap dari Dokter
  app.get(
    "/v1/inpatient/admission-requests",
    { preHandler: [wajibAutentikasi] },
    async (
      req,
    ): Promise<
      ResponsApi<{
        items: readonly ItemPengajuanRawatInapDto[];
        totalItem: number;
      }>
    > => {
      periksaIzinInpatient(req, "rawat_inap:penempatan:baca");
      const kueri = req.query as { status?: string };
      const items = await deps.inpatientService.ambilDaftarPengajuan(
        kueri?.status,
      );
      return buatResponsSukses(req, {
        items,
        totalItem: items.length,
      });
    },
  );

  // 4. Detail Pengajuan Rawat Inap
  app.get(
    "/v1/inpatient/admission-requests/:id",
    { preHandler: [wajibAutentikasi] },
    async (req): Promise<ResponsApi<ItemPengajuanRawatInapDto>> => {
      periksaIzinInpatient(req, "rawat_inap:penempatan:baca");
      const params = req.params as { id: string };
      const data = await deps.inpatientService.ambilPengajuanBerdasarkanId(
        params.id,
      );
      return buatResponsSukses(req, data);
    },
  );

  // 5. Keputusan Pengajuan Rawat Inap (Terima / Tunda / Tolak)
  app.post(
    "/v1/inpatient/admission-requests/:id/decide",
    { preHandler: [wajibAutentikasi] },
    async (req): Promise<ResponsApi<ItemPengajuanRawatInapDto>> => {
      const profil = periksaIzinInpatient(req, "rawat_inap:penempatan:kelola");
      const params = req.params as { id: string };
      const hasilValidasi = validasiSkemaMasukan(
        skemaKeputusanPengajuan,
        req.body,
      );

      const data = await deps.inpatientService.putuskanPengajuan({
        pengajuanId: params.id,
        keputusan: hasilValidasi.keputusan,
        alasan: hasilValidasi.alasan,
        petugasId: profil.id,
        petugasNama: profil.namaLengkap,
        correlationId: req.correlationId,
      });

      return buatResponsSukses(req, data);
    },
  );

  // 6. Penerimaan Pasien & Alokasi Tempat Tidur (AB-002, AB-020)
  app.post(
    "/v1/inpatient/admissions",
    { preHandler: [wajibAutentikasi] },
    async (
      req: FastifyRequest,
    ): Promise<
      ResponsApi<{
        episode: ItemEpisodeRawatInapDto;
        penempatanId: string;
      }>
    > => {
      const profil = periksaIzinInpatient(req, "rawat_inap:penempatan:kelola");
      const hasilValidasi = validasiSkemaMasukan(
        skemaPenerimaanDanPenempatan,
        req.body,
      );

      const hasil = await deps.inpatientService.terimaDanAlokasikanTempatTidur({
        pengajuanId: hasilValidasi.pengajuanId,
        tempatTidurId: hasilValidasi.tempatTidurId,
        konfirmasiTanggalLahir: hasilValidasi.konfirmasiTanggalLahir,
        catatanPenempatan: hasilValidasi.catatanPenempatan,
        petugasId: profil.id,
        petugasNama: profil.namaLengkap,
        kunciIdempotensi: req.headers["x-idempotency-key"] as string | undefined,
        correlationId: req.correlationId,
      });

      const daftarEp = await deps.inpatientService.ambilDaftarEpisode();
      const dtoEp = daftarEp.find((e) => e.id === hasil.episode.id)!;

      return buatResponsSukses(req, {
        episode: dtoEp,
        penempatanId: hasil.penempatan.id,
      });
    },
  );

  // 7. Daftar Episode Rawat Inap
  app.get(
    "/v1/inpatient/episodes",
    { preHandler: [wajibAutentikasi] },
    async (
      req,
    ): Promise<
      ResponsApi<{
        items: readonly ItemEpisodeRawatInapDto[];
        totalItem: number;
      }>
    > => {
      periksaIzinInpatient(req, "rawat_inap:penempatan:baca");
      const kueri = req.query as { status?: string; bangsalId?: string };
      const items = await deps.inpatientService.ambilDaftarEpisode({
        status: kueri?.status,
        bangsalId: kueri?.bangsalId,
      });
      return buatResponsSukses(req, {
        items,
        totalItem: items.length,
      });
    },
  );

  // 8. Pemindahan Tempat Tidur / Bangsal (AB-002, AB-030, AB-034)
  app.post(
    "/v1/inpatient/episodes/:id/transfer",
    { preHandler: [wajibAutentikasi] },
    async (
      req,
    ): Promise<
      ResponsApi<{
        episode: ItemEpisodeRawatInapDto;
        riwayatId: string;
      }>
    > => {
      const profil = periksaIzinInpatient(req, "rawat_inap:penempatan:kelola");
      const params = req.params as { id: string };
      const hasilValidasi = validasiSkemaMasukan(
        skemaPemindahanTempatTidur,
        req.body,
      );

      const hasil = await deps.inpatientService.pindahkanTempatTidur({
        episodeId: params.id,
        tempatTidurTujuanId: hasilValidasi.tempatTidurTujuanId,
        alasanPemindahan: hasilValidasi.alasanPemindahan,
        versi: hasilValidasi.versi,
        petugasId: profil.id,
        petugasNama: profil.namaLengkap,
        correlationId: req.correlationId,
      });

      const daftarEp = await deps.inpatientService.ambilDaftarEpisode();
      const dtoEp = daftarEp.find((e) => e.id === hasil.episode.id)!;

      return buatResponsSukses(req, {
        episode: dtoEp,
        riwayatId: hasil.riwayat.id,
      });
    },
  );

  // 9. Pemulangan Administratif Pasien (AB-031, BRD Bab 11.1)
  app.post(
    "/v1/inpatient/episodes/:id/discharge",
    { preHandler: [wajibAutentikasi] },
    async (req): Promise<ResponsApi<ItemEpisodeRawatInapDto>> => {
      const profil = periksaIzinInpatient(req, "rawat_inap:penempatan:kelola");
      const params = req.params as { id: string };
      const hasilValidasi = validasiSkemaMasukan(
        skemaPemulanganPasien,
        req.body,
      );

      const hasil = await deps.inpatientService.pulangkanPasien({
        episodeId: params.id,
        alasanPemulangan: hasilValidasi.alasanPemulangan,
        catatanPemulangan: hasilValidasi.catatanPemulangan,
        versi: hasilValidasi.versi,
        petugasId: profil.id,
        petugasNama: profil.namaLengkap,
        correlationId: req.correlationId,
      });

      const daftarEp = await deps.inpatientService.ambilDaftarEpisode();
      const dtoEp = daftarEp.find((e) => e.id === hasil.id)!;

      return buatResponsSukses(req, dtoEp);
    },
  );

  // 10. Riwayat Perpindahan Tempat Tidur
  app.get(
    "/v1/inpatient/transfers",
    { preHandler: [wajibAutentikasi] },
    async (
      req,
    ): Promise<
      ResponsApi<{
        items: readonly ItemRiwayatPerpindahanDto[];
        totalItem: number;
      }>
    > => {
      periksaIzinInpatient(req, "rawat_inap:penempatan:baca");
      const kueri = req.query as { episodeId?: string };
      const items = await deps.inpatientService.ambilRiwayatPerpindahan(
        kueri?.episodeId,
      );
      return buatResponsSukses(req, {
        items,
        totalItem: items.length,
      });
    },
  );
}
