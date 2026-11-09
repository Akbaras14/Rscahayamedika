/**
 * @fileoverview Skema validasi input dengan Zod untuk seluruh batas transport Identity Service
 * (termasuk cakupan Tahap 1 — Administrator).
 * Pesan validasi menggunakan bahasa Indonesia yang aman dan dapat ditindaklanjuti sesuai UI_UX.md Bagian 9.
 */

import { z } from "zod";
import {
  IZIN_SISTEM,
  KATEGORI_NOTIFIKASI,
  PERAN_PENGGUNA,
  PRIORITAS_NOTIFIKASI,
  STATUS_BACA_NOTIFIKASI,
  type RincianGalatField,
} from "../../../../packages/shared-types/src/index.ts";
import { buatGalatValidasi } from "../model/errors.ts";

export const LoginBodySchema = z.object({
  namaPengguna: z
    .string({ message: "Nama pengguna wajib diisi." })
    .trim()
    .min(3, "Nama pengguna minimal 3 karakter.")
    .max(64, "Nama pengguna maksimal 64 karakter.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Nama pengguna hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
    ),
  kataSandi: z
    .string({ message: "Kata sandi wajib diisi." })
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(128, "Kata sandi maksimal 128 karakter."),
});

export const CekAksesBodySchema = z.object({
  izinDibutuhkan: z.enum(IZIN_SISTEM, {
    message: "Kode izin sistem tidak dikenal.",
  }),
  bangsalId: z
    .string()
    .trim()
    .min(1, "Identitas bangsal tidak boleh kosong.")
    .max(64, "Identitas bangsal terlalu panjang.")
    .optional(),
});

export const KueryNotifikasiSchema = z.object({
  statusBaca: z.enum(STATUS_BACA_NOTIFIKASI).optional(),
  kategori: z.enum(KATEGORI_NOTIFIKASI).optional(),
  prioritas: z.enum(PRIORITAS_NOTIFIKASI).optional(),
  halaman: z.coerce
    .number()
    .int()
    .min(1, "Nomor halaman minimal 1.")
    .default(1),
  ukuranHalaman: z.coerce
    .number()
    .int()
    .min(1, "Ukuran halaman minimal 1.")
    .max(50, "Ukuran halaman maksimal 50.")
    .default(20),
});

export const ParamIdNotifikasiSchema = z.object({
  id: z
    .string({ message: "Identitas notifikasi wajib diisi." })
    .trim()
    .min(3, "Identitas notifikasi tidak valid.")
    .max(80, "Identitas notifikasi terlalu panjang."),
});

// --- Skema Tahap 1: Administrator ---

export const KueryDaftarPenggunaAdminSchema = z.object({
  kataKunci: z.string().trim().max(80).optional(),
  peran: z.enum(PERAN_PENGGUNA).optional(),
  aktif: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  halaman: z.coerce.number().int().min(1).default(1),
  ukuranHalaman: z.coerce.number().int().min(1).max(50).default(10),
});

export const BuatPenggunaAdminBodySchema = z.object({
  namaPengguna: z
    .string({ message: "Nama pengguna wajib diisi." })
    .trim()
    .min(3, "Nama pengguna minimal 3 karakter.")
    .max(64, "Nama pengguna maksimal 64 karakter.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Nama pengguna hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
    ),
  namaLengkap: z
    .string({ message: "Nama lengkap wajib diisi." })
    .trim()
    .min(3, "Nama lengkap minimal 3 karakter.")
    .max(160, "Nama lengkap maksimal 160 karakter."),
  kataSandi: z
    .string({ message: "Kata sandi awal wajib diisi." })
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(128, "Kata sandi maksimal 128 karakter."),
  peran: z.enum(PERAN_PENGGUNA, {
    message: "Peran pengguna tidak valid.",
  }),
  daftarBangsalId: z
    .array(
      z
        .string()
        .trim()
        .min(2, "Kode bangsal minimal 2 karakter.")
        .max(64, "Kode bangsal maksimal 64 karakter.")
        .regex(
          /^[A-Z0-9_-]+$/,
          "Kode bangsal harus menggunakan huruf kapital, angka, garis bawah, atau tanda hubung (contoh: BANGSAL-ANGGREK).",
        ),
    )
    .max(20, "Maksimal 20 penugasan bangsal per akun.")
    .default([]),
  aktif: z.boolean().default(true),
  alasan: z
    .string({ message: "Alasan pembuatan akun wajib diisi untuk audit." })
    .trim()
    .min(5, "Alasan pembuatan akun minimal 5 karakter.")
    .max(400, "Alasan pembuatan akun maksimal 400 karakter."),
});

export const ParamIdPenggunaAdminSchema = z.object({
  id: z
    .string({ message: "Identitas pengguna wajib diisi." })
    .trim()
    .min(3, "Identitas pengguna tidak valid.")
    .max(64, "Identitas pengguna terlalu panjang."),
});

export const UbahPenggunaAdminBodySchema = z.object({
  namaLengkap: z
    .string({ message: "Nama lengkap wajib diisi." })
    .trim()
    .min(3, "Nama lengkap minimal 3 karakter.")
    .max(160, "Nama lengkap maksimal 160 karakter."),
  peran: z.enum(PERAN_PENGGUNA, {
    message: "Peran pengguna tidak valid.",
  }),
  daftarBangsalId: z
    .array(
      z
        .string()
        .trim()
        .min(2, "Kode bangsal minimal 2 karakter.")
        .max(64, "Kode bangsal maksimal 64 karakter.")
        .regex(
          /^[A-Z0-9_-]+$/,
          "Kode bangsal harus menggunakan huruf kapital, angka, garis bawah, atau tanda hubung.",
        ),
    )
    .max(20, "Maksimal 20 penugasan bangsal per akun.")
    .default([]),
  aktif: z.boolean(),
  versi: z
    .number({ message: "Versi data pengguna wajib disertakan." })
    .int()
    .min(1, "Versi data pengguna minimal 1."),
  alasanPerubahan: z
    .string({ message: "Alasan perubahan wajib diisi sesuai AB-030." })
    .trim()
    .min(5, "Alasan perubahan minimal 5 karakter.")
    .max(400, "Alasan perubahan maksimal 400 karakter."),
});

export const CabutSesiPenggunaAdminBodySchema = z.object({
  alasan: z
    .string({ message: "Alasan pencabutan sesi wajib diisi." })
    .trim()
    .min(5, "Alasan pencabutan sesi minimal 5 karakter.")
    .max(400, "Alasan pencabutan sesi maksimal 400 karakter."),
});

export const ParamKunciKonfigurasiSchema = z.object({
  kunci: z
    .string({ message: "Kunci konfigurasi wajib diisi." })
    .trim()
    .min(3, "Kunci konfigurasi minimal 3 karakter.")
    .max(96, "Kunci konfigurasi maksimal 96 karakter.")
    .regex(
      /^[a-z0-9_.-]+$/,
      "Kunci konfigurasi hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung.",
    ),
});

export const UbahKonfigurasiBodySchema = z.object({
  nilai: z
    .string({ message: "Nilai konfigurasi wajib diisi." })
    .trim()
    .min(1, "Nilai konfigurasi tidak boleh kosong.")
    .max(512, "Nilai konfigurasi maksimal 512 karakter."),
  versi: z
    .number({ message: "Versi konfigurasi wajib disertakan." })
    .int()
    .min(1, "Versi konfigurasi minimal 1."),
  alasanPerubahan: z
    .string({
      message: "Alasan perubahan konfigurasi wajib diisi sesuai AB-030.",
    })
    .trim()
    .min(5, "Alasan perubahan konfigurasi minimal 5 karakter.")
    .max(400, "Alasan perubahan konfigurasi maksimal 400 karakter."),
});

export const KueryAuditAdminSchema = z.object({
  kataKunci: z.string().trim().max(80).optional(),
  statusHasil: z.enum(["berhasil", "ditolak", "gagal"]).optional(),
  tindakan: z.string().trim().max(80).optional(),
  halaman: z.coerce.number().int().min(1).default(1),
  ukuranHalaman: z.coerce.number().int().min(1).max(50).default(15),
});

/**
 * Memvalidasi payload terhadap skema Zod dan melempar `AppError` (400) bila tidak valid.
 *
 * @param schema - Skema Zod yang digunakan.
 * @param payload - Data mentah dari permintaan klien.
 * @returns Data bertipe ketat hasil validasi.
 * @throws AppError dengan kode `ERR_VALIDASI_GAGAL` jika validasi gagal.
 */
export function validasiSkemaMasukan<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): T {
  const hasil = schema.safeParse(payload);
  if (!hasil.success) {
    const rincianValidasi: RincianGalatField[] = hasil.error.issues.map(
      (issue) => ({
        field: issue.path.join(".") || "payload",
        pesan: issue.message,
      }),
    );
    const pesanUtama =
      rincianValidasi[0]?.pesan ??
      "Permintaan tidak valid. Periksa kembali isian formulir.";
    throw buatGalatValidasi(pesanUtama, rincianValidasi);
  }
  return hasil.data;
}
