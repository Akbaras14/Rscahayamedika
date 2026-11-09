/**
 * @fileoverview Validator skema masukan klinis menggunakan Zod.
 * Memastikan pesan validasi ramah pengguna berbahasa Indonesia (UI_UX.md Bagian 9 & 10).
 */

import { z } from "zod";
import {
  BENTUK_MAKANAN_KLINIS,
  JENIS_DIET_KLINIS,
  KATEGORI_ALERGEN,
  PRIORITAS_RAWAT_INAP,
  RUTE_PEMBERIAN_NUTRISI,
  TINGKAT_KEPARAHAN_ALERGI,
  TINDAK_LANJUT_PEMERIKSAAN,
} from "../model/clinical-nutrition.model.ts";

export const skemaSimpanPemeriksaanKlinis = z.object({
  kunjunganId: z
    .string({ error: "Kunjungan ID wajib diisi." })
    .min(1, "Kunjungan ID tidak boleh kosong."),
  pasienId: z
    .string({ error: "Pasien ID wajib diisi." })
    .min(1, "Pasien ID tidak boleh kosong."),
  verifikasiTanggalLahir: z
    .string({ error: "Verifikasi Tanggal Lahir (AB-020) wajib diisi." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir verifikasi harus YYYY-MM-DD."),
  keluhanUtama: z
    .string({ error: "Keluhan utama wajib diisi." })
    .min(3, "Keluhan utama minimal 3 karakter."),
  riwayatPenyakitSekarang: z.string().optional().nullable(),
  tekananDarahSistol: z.number().int().min(40).max(300).optional().nullable(),
  tekananDarahDiastol: z.number().int().min(20).max(200).optional().nullable(),
  denyutNadi: z.number().int().min(30).max(250).optional().nullable(),
  frekuensiNafas: z.number().int().min(5).max(80).optional().nullable(),
  suhuTubuh: z.number().min(30.0).max(45.0).optional().nullable(),
  beratBadanKg: z.number().min(0.5).max(400.0).optional().nullable(),
  tinggiBadanCm: z.number().min(20.0).max(250.0).optional().nullable(),
  diagnosisKlinisPrimer: z
    .string({ error: "Diagnosis klinis primer wajib diisi." })
    .min(3, "Diagnosis klinis primer minimal 3 karakter."),
  diagnosisKlinisSekunder: z.string().optional().nullable(),
  catatanKlinisRelevanGizi: z.string().optional().nullable(),
  tindakLanjut: z.enum(TINDAK_LANJUT_PEMERIKSAAN, {
    error: "Tindak lanjut pemeriksaan tidak sah.",
  }),
});

export type InputSimpanPemeriksaanKlinis = z.infer<
  typeof skemaSimpanPemeriksaanKlinis
>;

export const skemaCatatAlergiPasien = z.object({
  pemeriksaanId: z.string().optional().nullable(),
  kategoriAlergen: z.enum(KATEGORI_ALERGEN, {
    error: "Kategori alergen tidak sah.",
  }),
  namaAlergen: z
    .string({ error: "Nama alergen wajib diisi." })
    .min(2, "Nama alergen minimal 2 karakter."),
  tingkatKeparahan: z.enum(TINGKAT_KEPARAHAN_ALERGI, {
    error: "Tingkat keparahan alergi tidak sah.",
  }),
  reaksiAlergi: z.string().optional().nullable(),
});

export type InputCatatAlergiPasien = z.infer<typeof skemaCatatAlergiPasien>;

export const skemaSahkanInstruksiDiet = z
  .object({
    kunjunganId: z
      .string({ error: "Kunjungan ID wajib diisi." })
      .min(1, "Kunjungan ID tidak boleh kosong."),
    pasienId: z
      .string({ error: "Pasien ID wajib diisi." })
      .min(1, "Pasien ID tidak boleh kosong."),
    jenisDiet: z.enum(JENIS_DIET_KLINIS, {
      error: "Jenis diet tidak sah.",
    }),
    namaDietKustom: z.string().optional().nullable(),
    bentukMakanan: z.enum(BENTUK_MAKANAN_KLINIS, {
      error: "Bentuk makanan tidak sah.",
    }),
    rutePemberian: z.enum(RUTE_PEMBERIAN_NUTRISI, {
      error: "Rute pemberian nutrisi tidak sah.",
    }),
    statusPuasaNpo: z.boolean().default(false),
    alasanPuasa: z.string().optional().nullable(),
    targetEnergiKkal: z.number().int().min(400).max(6000).optional().nullable(),
    targetProteinGram: z.number().min(5).max(350).optional().nullable(),
    pembatasanCairanMl: z.number().int().min(200).max(5000).optional().nullable(),
    pembatasanNatriumMg: z.number().int().min(100).max(6000).optional().nullable(),
    instruksiKhusus: z.string().optional().nullable(),
    berlakuSejak: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      // AB-008: Jika status puasa/NPO aktif, wajib ada alasan puasa
      if (data.statusPuasaNpo && (!data.alasanPuasa || !data.alasanPuasa.trim())) {
        return false;
      }
      return true;
    },
    {
      message:
        "Alasan puasa wajib dicantumkan jika pasien dinyatakan puasa/NPO (AB-008).",
      path: ["alasanPuasa"],
    },
  );

export type InputSahkanInstruksiDiet = z.infer<typeof skemaSahkanInstruksiDiet>;

export const skemaKoreksiInstruksiDiet = z
  .object({
    versiSebelum: z.number().int().min(1, "Versi sebelum wajib minimal 1."),
    alasanPerubahan: z
      .string({ error: "Alasan perubahan diet wajib diisi (AB-030)." })
      .min(5, "Alasan perubahan diet minimal 5 karakter."),
    jenisDiet: z.enum(JENIS_DIET_KLINIS, {
      error: "Jenis diet tidak sah.",
    }),
    namaDietKustom: z.string().optional().nullable(),
    bentukMakanan: z.enum(BENTUK_MAKANAN_KLINIS, {
      error: "Bentuk makanan tidak sah.",
    }),
    rutePemberian: z.enum(RUTE_PEMBERIAN_NUTRISI, {
      error: "Rute pemberian nutrisi tidak sah.",
    }),
    statusPuasaNpo: z.boolean().default(false),
    alasanPuasa: z.string().optional().nullable(),
    targetEnergiKkal: z.number().int().min(400).max(6000).optional().nullable(),
    targetProteinGram: z.number().min(5).max(350).optional().nullable(),
    pembatasanCairanMl: z.number().int().min(200).max(5000).optional().nullable(),
    pembatasanNatriumMg: z.number().int().min(100).max(6000).optional().nullable(),
    instruksiKhusus: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.statusPuasaNpo && (!data.alasanPuasa || !data.alasanPuasa.trim())) {
        return false;
      }
      return true;
    },
    {
      message:
        "Alasan puasa wajib dicantumkan jika pasien dinyatakan puasa/NPO (AB-008).",
      path: ["alasanPuasa"],
    },
  );

export type InputKoreksiInstruksiDiet = z.infer<typeof skemaKoreksiInstruksiDiet>;

export const skemaPengajuanRawatInap = z.object({
  kunjunganId: z
    .string({ error: "Kunjungan ID wajib diisi." })
    .min(1, "Kunjungan ID tidak boleh kosong."),
  pasienId: z
    .string({ error: "Pasien ID wajib diisi." })
    .min(1, "Pasien ID tidak boleh kosong."),
  diagnosisUtama: z
    .string({ error: "Diagnosis utama wajib diisi." })
    .min(3, "Diagnosis utama minimal 3 karakter."),
  alasanRawatInap: z
    .string({ error: "Alasan rawat inap wajib diisi." })
    .min(5, "Alasan rawat inap minimal 5 karakter."),
  prioritasRawatInap: z.enum(PRIORITAS_RAWAT_INAP, {
    error: "Prioritas rawat inap tidak sah.",
  }),
  rekomendasiBangsal: z
    .string({ error: "Rekomendasi bangsal wajib diisi." })
    .min(2, "Rekomendasi bangsal minimal 2 karakter."),
  kebutuhanKhusus: z.string().optional().nullable(),
  instruksiDietId: z.string().optional().nullable(),
});

export type InputPengajuanRawatInap = z.infer<typeof skemaPengajuanRawatInap>;

