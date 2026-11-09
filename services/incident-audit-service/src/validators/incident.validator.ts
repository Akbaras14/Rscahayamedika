/**
 * @fileoverview Validator input Zod untuk `incident-audit-service` (Tahap 10).
 * Menegakkan:
 * - AB-028: Penanggung jawab dan target waktu wajib ada pada setiap tindak lanjut.
 * - AB-029: Closed-loop incident resolution.
 * - AB-030: Deskripsi, analisis RCA, tindakan koreksi, dan alasan penutupan wajib minimal 5 karakter.
 * - AB-033: Pengesahan rekonsiliasi downtime dengan alasan/catatan wajib.
 */

import { z } from "zod";

export const skemaInvestigasiInsiden = z.object({
  akarMasalahRca: z
    .string()
    .trim()
    .min(5, "Analisis akar masalah (RCA) wajib diisi minimal 5 karakter (AB-030)."),
  faktorKontributor: z
    .string()
    .trim()
    .min(5, "Faktor kontributor wajib diisi minimal 5 karakter (AB-030)."),
  rekomendasiSistemik: z
    .string()
    .trim()
    .min(5, "Rekomendasi sistemik wajib diisi minimal 5 karakter (AB-030)."),
});

export const skemaTindakanKoreksi = z.object({
  deskripsiTindakan: z
    .string()
    .trim()
    .min(5, "Deskripsi tindakan perbaikan wajib diisi minimal 5 karakter (AB-030)."),
  penanggungJawabId: z
    .string()
    .trim()
    .min(1, "ID Penanggung jawab wajib dipilih (AB-028)."),
  penanggungJawabNama: z
    .string()
    .trim()
    .min(2, "Nama penanggung jawab wajib diisi (AB-028)."),
  targetTanggalSelesai: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal target harus YYYY-MM-DD (AB-028)."),
});

export const skemaPenutupanInsiden = z.object({
  catatanPenutupan: z
    .string()
    .trim()
    .min(5, "Catatan penutupan resmi insiden wajib diisi minimal 5 karakter (AB-030)."),
});

export const skemaEvaluasiMutuGizi = z.object({
  tanggalEvaluasi: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  bangsalId: z.string().trim().min(1, "Bangsal wajib dipilih."),
  namaBangsal: z.string().trim().min(2, "Nama bangsal minimal 2 karakter."),
  totalPorsiDisajikan: z.number().int().nonnegative("Total porsi tidak boleh negatif."),
  rataRataSisaMakananPersen: z
    .number()
    .min(0, "Sisa makanan minimal 0%")
    .max(100, "Sisa makanan maksimal 100%"),
  kepatuhanCcpSuhuPersen: z
    .number()
    .min(0, "Kepatuhan CCP minimal 0%")
    .max(100, "Kepatuhan CCP maksimal 100%"),
  kepatuhanDuaIdentitasPersen: z
    .number()
    .min(0, "Kepatuhan dua identitas minimal 0%")
    .max(100, "Kepatuhan dua identitas maksimal 100%"),
  catatanEvaluasi: z
    .string()
    .trim()
    .min(5, "Catatan evaluasi mutu wajib diisi minimal 5 karakter (AB-030)."),
});

export const skemaRekonsiliasiDowntime = z.object({
  tanggalInsidenDowntime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  durasiDowntimeMenit: z.number().int().positive("Durasi downtime harus positif."),
  unitTerdampak: z.string().trim().min(2, "Unit terdampak wajib diisi."),
  jumlahFormulirKertas: z.number().int().nonnegative("Jumlah formulir tidak boleh negatif."),
  duplikasiTerdeteksi: z.number().int().nonnegative("Jumlah duplikasi tidak boleh negatif."),
  selisihPesananSelesai: z.boolean(),
  catatanRekonsiliasi: z
    .string()
    .trim()
    .min(5, "Catatan rekonsiliasi downtime wajib diisi minimal 5 karakter (AB-030)."),
});

export const skemaKeputusanRekonsiliasi = z.object({
  keputusan: z.enum(["disahkan", "ditolak"] as const),
  catatan: z
    .string()
    .trim()
    .min(5, "Catatan pengesahan/penolakan wajib diisi minimal 5 karakter (AB-030)."),
});
