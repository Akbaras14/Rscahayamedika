/**
 * @fileoverview Validator skema Zod untuk Layanan Inventaris & Gudang (Tahap 7).
 * Mengimplementasikan validasi fail-closed, aturan mutu bahan (AB-015), dan alasan wajib opname (BRD 7.6).
 */

import { z } from "zod";

export const skemaInputPenerimaanLot = z.object({
  bahanId: z.string().min(1, "ID bahan baku wajib diisi."),
  namaPemasok: z.string().min(3, "Nama pemasok minimal 3 karakter."),
  jumlahMasuk: z.number().positive("Jumlah bahan masuk harus lebih besar dari 0."),
  tanggalPenerimaan: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal penerimaan harus YYYY-MM-DD."),
  tanggalKedaluwarsa: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal kedaluwarsa harus YYYY-MM-DD."),
  statusMutu: z.enum(["layak_diterima", "ditolak_rusak", "ditahan_karantina"], {
    message: "Status pemeriksaan mutu harus layak_diterima, ditolak_rusak, atau ditahan_karantina.",
  }),
  catatanPemeriksaan: z
    .string()
    .min(5, "Catatan pemeriksaan kualitas fisik/organoleptik wajib diisi minimal 5 karakter."),
  suhuTercatatCelsius: z.number().nullable().optional(),
});

export const skemaInputPermintaanBahan = z.object({
  tanggalKebutuhan: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal kebutuhan harus YYYY-MM-DD."),
  unitPeminta: z.string().min(2, "Unit peminta minimal 2 karakter."),
  keterangan: z.string().min(3, "Keterangan permintaan minimal 3 karakter."),
  daftarItem: z
    .array(
      z.object({
        bahanId: z.string().min(1, "ID bahan baku wajib dipilih."),
        jumlahDiminta: z.number().positive("Jumlah diminta harus lebih besar dari 0."),
      }),
    )
    .min(1, "Minimal ada 1 jenis bahan baku dalam permintaan."),
});

export const skemaInputPenyesuaianOpname = z.object({
  bahanId: z.string().min(1, "ID bahan baku wajib diisi."),
  stokFisikAktual: z.number().min(0, "Stok fisik aktual tidak boleh bernilai negatif."),
  alasanWajib: z
    .string()
    .min(5, "Alasan penyesuaian stok opname wajib diisi minimal 5 karakter (BRD 7.6)."),
});

export const skemaInputPembuanganLot = z.object({
  alasanPembuangan: z
    .string()
    .min(5, "Alasan pembuangan bahan kedaluwarsa/rusak wajib diisi minimal 5 karakter."),
});

