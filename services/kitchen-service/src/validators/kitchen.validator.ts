/**
 * @fileoverview Validator skema Zod untuk Layanan Dapur & Pengendalian Makanan (Tahap 8).
 * Mengimplementasikan validasi fail-closed, aturan perencanaan H-1 (AB-012),
 * penahanan pesanan terdampak klinis (AB-010), dan verifikasi mutu/CCP (AB-018, AB-019).
 */

import { z } from "zod";

export const skemaInputRencanaProduksi = z.object({
  jenisRencana: z.enum(["reguler", "mendadak"]).default("reguler"),
  tanggalPelayanan: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal pelayanan harus YYYY-MM-DD."),
  sesiMakan: z.enum(["pagi", "siang", "malam", "snack_pagi", "snack_sore"], {
    message: "Sesi makan harus salah satu dari: pagi, siang, malam, snack_pagi, snack_sore.",
  }),
  catatan: z.string().optional(),
  daftarPesananPasienId: z.array(z.string()).optional(),
});

export const skemaInputBatchProduksi = z.object({
  rencanaProduksiId: z.string().min(1, "ID rencana produksi wajib diisi."),
  resepId: z.string().min(1, "ID resep masakan wajib dipilih."),
  namaMasakan: z.string().min(2, "Nama masakan minimal 2 karakter."),
  sesiMakan: z.enum(["pagi", "siang", "malam", "snack_pagi", "snack_sore"]),
  jumlahPorsiTarget: z.number().int().positive("Target jumlah porsi harus bilangan bulat positif."),
  catatanKoki: z.string().optional(),
  chefPenanggungJawab: z.string().min(2, "Nama chef penanggung jawab minimal 2 karakter."),
  lotBahanDigunakan: z
    .array(
      z.object({
        bahanId: z.string().min(1, "ID bahan baku wajib diisi."),
        namaBahan: z.string().min(1, "Nama bahan wajib diisi."),
        nomorLot: z.string().min(1, "Nomor lot bahan gudang wajib dicatat (AB-018)."),
        jumlahDigunakan: z.number().positive("Jumlah bahan yang digunakan harus > 0."),
        satuan: z.string().min(1, "Satuan bahan wajib diisi."),
      }),
    )
    .min(1, "Paling sedikit harus mencatat 1 lot bahan baku yang digunakan untuk ketertelusuran (AB-018)."),
});

export const skemaInputCatatCcpSuhu = z.object({
  suhuMasakCcpCelsius: z.number({
    message: "Suhu masak inti CCP wajib diisi angka dalam derajat Celsius.",
  }),
  catatanKoki: z.string().optional(),
  jumlahPorsiRealisasi: z.number().int().positive().optional(),
});

export const skemaInputPemeriksaanMutu = z.object({
  batchProduksiId: z.string().min(1, "ID batch produksi wajib diisi."),
  suhuSajiCelsius: z.number({
    message: "Suhu saji akhir wajib diisi angka dalam derajat Celsius.",
  }),
  ujiTekstur: z.enum(["sesuai", "tidak_sesuai"], {
    message: "Hasil uji tekstur harus 'sesuai' atau 'tidak_sesuai'.",
  }),
  ujiAroma: z.enum(["normal_segar", "menyimpang"], {
    message: "Hasil uji aroma harus 'normal_segar' atau 'menyimpang'.",
  }),
  ujiRasa: z.enum(["sesuai_standar", "tidak_sesuai"], {
    message: "Hasil uji rasa harus 'sesuai_standar' atau 'tidak_sesuai'.",
  }),
  ujiTampilanVisual: z.enum(["bersih_menarik", "kurang_baik"], {
    message: "Hasil uji tampilan visual harus 'bersih_menarik' atau 'kurang_baik'.",
  }),
  statusMutu: z.enum(["lolos_pemeriksaan", "ditahan_gagal_mutu", "perlu_koreksi"], {
    message: "Status mutu harus 'lolos_pemeriksaan', 'ditahan_gagal_mutu', atau 'perlu_koreksi'.",
  }),
  catatanPemeriksaan: z
    .string()
    .min(5, "Catatan pemeriksaan mutu organoleptik wajib diisi minimal 5 karakter."),
});

export const skemaInputCetakLabelPorsi = z.object({
  batchProduksiId: z.string().min(1, "ID batch produksi wajib diisi."),
  suhuKemasanCelsius: z.number().nullable().optional(),
});

export const skemaInputTahanPorsiKlinis = z.object({
  alasanPenahanan: z
    .string()
    .min(5, "Alasan penahanan pesanan porsi wajib diisi minimal 5 karakter (AB-010, AB-013)."),
});

