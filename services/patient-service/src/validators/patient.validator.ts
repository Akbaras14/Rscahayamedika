/**
 * @fileoverview Skema validasi Zod untuk endpoint `patient-service` (Tahap 2 — Petugas Pendaftaran).
 * Seluruh pesan kesalahan disusun dalam Bahasa Indonesia yang jelas dan aman (UI_UX.md Bagian 9).
 */

import { z } from "zod";
import {
  GOLONGAN_DARAH_PASIEN,
  JENIS_KELAMIN_PASIEN,
  METODE_VERIFIKASI_DUA_PENGENAL,
  PRIORITAS_ANTREAN_KUNJUNGAN,
  STATUS_KUNJUNGAN_PASIEN,
  STATUS_VERIFIKASI_IDENTITAS,
} from "../model/patient.model.ts";

const REGEX_TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_NIK_16_DIGIT = /^\d{16}$/;
const REGEX_NOMOR_RM = /^RM-\d{4}-\d{4,6}$/;

/**
 * Skema kueri daftar/pencarian pasien (`GET /v1/patients`).
 */
export const skemaKueriDaftarPasien = z.object({
  kataKunci: z.string().trim().max(120).optional(),
  tanggalLahir: z
    .string()
    .trim()
    .regex(
      REGEX_TANGGAL_ISO,
      "Format tanggal lahir pencarian wajib YYYY-MM-DD.",
    )
    .optional(),
  statusVerifikasi: z.enum(STATUS_VERIFIKASI_IDENTITAS).optional(),
  halaman: z.coerce.number().int().min(1).default(1),
  ukuranHalaman: z.coerce.number().int().min(1).max(50).default(20),
});

export type InputKueriDaftarPasien = z.infer<typeof skemaKueriDaftarPasien>;

/**
 * Skema pemeriksaan potensi duplikasi pasien (`POST /v1/patients/check-duplicate`).
 */
export const skemaCekDuplikasiPasien = z.object({
  nomorRekamMedis: z.string().trim().max(32).optional(),
  nomorIdentitasNasional: z.string().trim().max(32).optional(),
  namaLengkap: z
    .string()
    .trim()
    .min(3, "Nama lengkap minimal 3 karakter untuk pemeriksaan duplikasi.")
    .max(160),
  tanggalLahir: z
    .string()
    .trim()
    .regex(REGEX_TANGGAL_ISO, "Tanggal lahir wajib berformat YYYY-MM-DD."),
  kecualikanPasienId: z.string().trim().max(64).optional(),
});

export type InputCekDuplikasiPasien = z.infer<typeof skemaCekDuplikasiPasien>;

/**
 * Skema pendaftaran identitas pasien baru (`POST /v1/patients`).
 * Mengikuti aturan AB-001 (identitas unik) dan AB-020 (verifikasi dua pengenal).
 */
export const skemaBuatPasienBaru = z
  .object({
    nomorRekamMedis: z
      .string()
      .trim()
      .regex(
        REGEX_NOMOR_RM,
        "Nomor rekam medis harus berformat RM-YYYY-NNNN (contoh: RM-2026-0001).",
      )
      .optional(),
    nomorIdentitasNasional: z
      .string()
      .trim()
      .regex(
        REGEX_NIK_16_DIGIT,
        "Nomor Identitas Nasional (NIK) wajib terdiri dari 16 digit angka.",
      )
      .nullable()
      .optional(),
    alasanTanpaNik: z.string().trim().max(255).nullable().optional(),
    namaLengkap: z
      .string()
      .trim()
      .min(3, "Nama lengkap pasien wajib diisi minimal 3 karakter.")
      .max(160, "Nama lengkap pasien maksimal 160 karakter."),
    tanggalLahir: z
      .string()
      .trim()
      .regex(REGEX_TANGGAL_ISO, "Tanggal lahir wajib diisi (YYYY-MM-DD)."),
    jenisKelamin: z.enum(JENIS_KELAMIN_PASIEN, {
      message: "Jenis kelamin wajib dipilih (laki_laki atau perempuan).",
    }),
    golonganDarah: z.enum(GOLONGAN_DARAH_PASIEN).default("belum_diketahui"),
    alamatDomisili: z
      .string()
      .trim()
      .min(5, "Alamat domisili wajib diisi minimal 5 karakter.")
      .max(255, "Alamat domisili maksimal 255 karakter."),
    teleponKontakDarurat: z
      .string()
      .trim()
      .min(8, "Nomor telepon kontak darurat wajib diisi minimal 8 karakter.")
      .max(32, "Nomor telepon kontak darurat maksimal 32 karakter."),
    namaKontakDarurat: z
      .string()
      .trim()
      .min(3, "Nama kontak darurat/wali wajib diisi minimal 3 karakter.")
      .max(160),
    hubunganKontakDarurat: z
      .string()
      .trim()
      .min(2, "Hubungan kontak darurat wajib diisi.")
      .max(64),
    pengenalDiverifikasi: z.enum(METODE_VERIFIKASI_DUA_PENGENAL, {
      message:
        "Metode verifikasi sedikitnya dua pengenal pasien wajib dipilih (AB-020).",
    }),
    catatanAdministratif: z.string().trim().max(255).nullable().optional(),
    konfirmasiBukanDuplikat: z.boolean().default(false),
    alasanKonfirmasiDuplikat: z.string().trim().max(255).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      !val.nomorIdentitasNasional &&
      (!val.alasanTanpaNik || val.alasanTanpaNik.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alasanTanpaNik"],
        message:
          "Jika NIK belum tersedia, alasan administratif wajib diisi minimal 5 karakter.",
      });
    }
    if (
      val.konfirmasiBukanDuplikat &&
      (!val.alasanKonfirmasiDuplikat ||
        val.alasanKonfirmasiDuplikat.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alasanKonfirmasiDuplikat"],
        message:
          "Alasan konfirmasi bukan pasien duplikat wajib diisi minimal 5 karakter.",
      });
    }
  });

export type InputBuatPasienBaru = z.infer<typeof skemaBuatPasienBaru>;

/**
 * Skema koreksi terbatas identitas pasien (`PATCH /v1/patients/:id/identity`).
 * Mengikuti aturan AB-020 (verifikasi dua pengenal) dan AB-030 (koreksi mempertahankan riwayat & versi).
 */
export const skemaKoreksiIdentitasPasien = z
  .object({
    nomorIdentitasNasional: z
      .string()
      .trim()
      .regex(
        REGEX_NIK_16_DIGIT,
        "Nomor Identitas Nasional (NIK) wajib terdiri dari 16 digit angka.",
      )
      .nullable(),
    alasanTanpaNik: z.string().trim().max(255).nullable().optional(),
    namaLengkap: z
      .string()
      .trim()
      .min(3, "Nama lengkap pasien wajib diisi minimal 3 karakter.")
      .max(160),
    tanggalLahir: z
      .string()
      .trim()
      .regex(REGEX_TANGGAL_ISO, "Tanggal lahir wajib diisi (YYYY-MM-DD)."),
    jenisKelamin: z.enum(JENIS_KELAMIN_PASIEN),
    golonganDarah: z.enum(GOLONGAN_DARAH_PASIEN),
    alamatDomisili: z
      .string()
      .trim()
      .min(5, "Alamat domisili wajib diisi minimal 5 karakter.")
      .max(255),
    teleponKontakDarurat: z
      .string()
      .trim()
      .min(8, "Nomor telepon kontak darurat wajib diisi minimal 8 karakter.")
      .max(32),
    namaKontakDarurat: z.string().trim().min(3).max(160),
    hubunganKontakDarurat: z.string().trim().min(2).max(64),
    statusVerifikasiIdentitas: z.enum(STATUS_VERIFIKASI_IDENTITAS),
    catatanAdministratif: z.string().trim().max(255).nullable().optional(),
    pengenalDiverifikasi: z.enum(METODE_VERIFIKASI_DUA_PENGENAL, {
      message: "Metode verifikasi dua pengenal pasien wajib dipilih (AB-020).",
    }),
    versi: z
      .number()
      .int()
      .min(1, "Nomor versi data pasien wajib disertakan untuk mencegah konflik."),
    alasanKoreksi: z
      .string()
      .trim()
      .min(5, "Alasan koreksi identitas wajib diisi minimal 5 karakter (AB-030).")
      .max(255),
  })
  .superRefine((val, ctx) => {
    if (
      !val.nomorIdentitasNasional &&
      (!val.alasanTanpaNik || val.alasanTanpaNik.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alasanTanpaNik"],
        message:
          "Jika NIK kosong, alasan administratif tanpa NIK wajib diisi minimal 5 karakter.",
      });
    }
  });

export type InputKoreksiIdentitasPasien = z.infer<
  typeof skemaKoreksiIdentitasPasien
>;

/**
 * Skema pembuatan kunjungan pemeriksaan & antrean dokter (`POST /v1/patients/:id/visits`).
 * Mewajibkan verifikasi dua pengenal pasien (`AB-020`) berupa pencocokan tanggal lahir pasien.
 */
export const skemaBuatKunjunganPemeriksaan = z.object({
  tanggalKunjungan: z
    .string()
    .trim()
    .regex(REGEX_TANGGAL_ISO, "Tanggal kunjungan wajib berformat YYYY-MM-DD.")
    .optional(),
  unitTujuan: z
    .string()
    .trim()
    .min(3, "Poli atau unit pemeriksaan tujuan wajib diisi.")
    .max(96),
  dokterTujuanId: z
    .string()
    .trim()
    .min(3, "Dokter pemeriksa tujuan wajib dipilih.")
    .max(64),
  dokterTujuanNama: z
    .string()
    .trim()
    .min(3, "Nama dokter pemeriksa tujuan wajib diisi.")
    .max(160),
  keluhanAdministratif: z
    .string()
    .trim()
    .min(5, "Keluhan atau tujuan kunjungan saat pendaftaran wajib diisi minimal 5 karakter.")
    .max(255),
  prioritasAntrean: z.enum(PRIORITAS_ANTREAN_KUNJUNGAN).default("reguler"),
  pengenalDiverifikasi: z.enum(METODE_VERIFIKASI_DUA_PENGENAL, {
    message:
      "Metode verifikasi dua pengenal pasien wajib dipilih sebelum masuk antrean dokter (AB-020).",
  }),
  verifikasiTanggalLahir: z
    .string()
    .trim()
    .regex(
      REGEX_TANGGAL_ISO,
      "Tanggal lahir verifikasi pasien wajib diisi (YYYY-MM-DD) untuk memastikan kecocokan dua pengenal (AB-020).",
    ),
});

export type InputBuatKunjunganPemeriksaan = z.infer<
  typeof skemaBuatKunjunganPemeriksaan
>;

/**
 * Skema pembatalan kunjungan pemeriksaan oleh Petugas Pendaftaran (`POST /v1/patients/visits/:kunjunganId/cancel`).
 */
export const skemaBatalkanKunjungan = z.object({
  versi: z.number().int().min(1, "Versi kunjungan wajib disertakan."),
  alasanPembatalan: z
    .string()
    .trim()
    .min(5, "Alasan pembatalan kunjungan wajib diisi minimal 5 karakter (AB-030).")
    .max(255),
});

export type InputBatalkanKunjungan = z.infer<typeof skemaBatalkanKunjungan>;

/**
 * Skema kueri daftar kunjungan & antrean dokter (`GET /v1/patients/visits`).
 */
export const skemaKueriDaftarKunjungan = z.object({
  kataKunci: z.string().trim().max(120).optional(),
  tanggalKunjungan: z
    .string()
    .trim()
    .regex(REGEX_TANGGAL_ISO, "Tanggal kunjungan wajib berformat YYYY-MM-DD.")
    .optional(),
  statusKunjungan: z.enum(STATUS_KUNJUNGAN_PASIEN).optional(),
  prioritasAntrean: z.enum(PRIORITAS_ANTREAN_KUNJUNGAN).optional(),
  dokterTujuanId: z.string().trim().max(64).optional(),
  pasienId: z.string().trim().max(64).optional(),
  halaman: z.coerce.number().int().min(1).default(1),
  ukuranHalaman: z.coerce.number().int().min(1).max(50).default(20),
});

export type InputKueriDaftarKunjungan = z.infer<
  typeof skemaKueriDaftarKunjungan
>;

