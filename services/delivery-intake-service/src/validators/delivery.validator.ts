/**
 * @fileoverview Validator input Zod untuk layanan delivery-intake-service (Tahap 9).
 * Menerapkan AB-020 (verifikasi 2 pengenal), AB-021 (pemeriksaan diet terkini),
 * AB-022 (penahanan porsi dilarang serah), dan AB-030 (alasan wajib >= 5 karakter).
 */

import { z } from "zod";

export const skemaBuatTroli = z.object({
  bangsalId: z.string().min(1, "ID bangsal wajib diisi"),
  namaBangsal: z.string().min(1, "Nama bangsal wajib diisi"),
  sesiMakan: z.enum(["pagi", "siang", "malam", "snack_pagi", "snack_sore"]),
  tanggalDistribusi: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal distribusi harus YYYY-MM-DD"),
  porsiIds: z.array(z.string()).default([]),
  catatan: z.string().default("Troli pengantaran reguler"),
});

export const skemaVerifikasiDanSerah = z.object({
  namaPasienVerifikasi: z
    .string()
    .min(2, "Nama pasien untuk verifikasi minimal 2 karakter"),
  tanggalLahirVerifikasi: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir verifikasi harus YYYY-MM-DD"),
  nomorRmVerifikasi: z.string().optional(),
  metodeVerifikasi: z.enum([
    "gelang_pasien",
    "tanya_pasien_keluarga",
    "rekam_medis_bedside",
  ]),
  namaPenerima: z.string().min(2, "Nama penerima makanan minimal 2 karakter"),
  hubunganPenerima: z.enum([
    "pasien_sendiri",
    "keluarga_pasien",
    "perawat_penanggung_jawab",
  ]),
  catatanVerifikasi: z.string().default("Verifikasi dua identitas berhasil"),
});

export const skemaTahanPorsiDistribusi = z.object({
  alasanPenahanan: z
    .string()
    .min(5, "Alasan penahanan porsi makanan wajib minimal 5 karakter (AB-030)"),
});

export const skemaLaporInsiden = z.object({
  troliId: z.string().nullable().optional(),
  porsiDistribusiId: z.string().nullable().optional(),
  bangsalId: z.string().min(1, "ID bangsal wajib diisi"),
  namaBangsal: z.string().min(1, "Nama bangsal wajib diisi"),
  jenisInsiden: z.enum([
    "makanan_tumpah_rusak",
    "diet_tidak_sesuai",
    "pasien_puasa_npo",
    "pasien_pindah_kamar",
    "pasien_menolak",
    "keterlambatan_ekstrem",
    "lainnya",
  ]),
  deskripsiInsiden: z
    .string()
    .min(5, "Deskripsi insiden wajib minimal 5 karakter (AB-030)"),
  tindakanKoreksi: z
    .string()
    .min(5, "Tindakan koreksi wajib minimal 5 karakter (AB-030)"),
});

