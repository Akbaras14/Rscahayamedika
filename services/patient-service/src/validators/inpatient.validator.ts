/**
 * @fileoverview Validator skema input untuk modul Rawat Inap (Tahap 4 — Petugas Rawat Inap).
 * Menggunakan Zod dengan pesan kesalahan Bahasa Indonesia yang jelas dan aman (UI_UX.md Bagian 9).
 */

import { z } from "zod";

export const skemaPenerimaanDanPenempatan = z.object({
  pengajuanId: z
    .string({
      error: "ID pengajuan rawat inap wajib diisi.",
    })
    .min(1, "ID pengajuan rawat inap tidak boleh kosong."),
  tempatTidurId: z
    .string({
      error: "Tempat tidur alokasi wajib dipilih.",
    })
    .min(1, "Tempat tidur alokasi tidak boleh kosong."),
  konfirmasiTanggalLahir: z
    .string({
      error: "Konfirmasi tanggal lahir pasien (pengenal kedua) wajib diisi.",
    })
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Format konfirmasi tanggal lahir harus YYYY-MM-DD.",
    ),
  catatanPenempatan: z.string().max(255).optional(),
});

export const skemaKeputusanPengajuan = z
  .object({
    keputusan: z.enum(["diterima", "ditunda", "ditolak"], {
      error: "Keputusan harus salah satu dari: diterima, ditunda, atau ditolak.",
    }),
    alasan: z.string().default(""),
  })
  .refine(
    (data) => {
      if (data.keputusan === "ditunda" || data.keputusan === "ditolak") {
        return data.alasan.trim().length >= 5;
      }
      return true;
    },
    {
      message:
        "Alasan keputusan wajib diisi minimal 5 karakter ketika pengajuan ditunda atau ditolak.",
      path: ["alasan"],
    },
  );

export const skemaPemindahanTempatTidur = z.object({
  tempatTidurTujuanId: z
    .string({
      error: "Tempat tidur tujuan wajib dipilih.",
    })
    .min(1, "Tempat tidur tujuan tidak boleh kosong."),
  alasanPemindahan: z
    .string({
      error: "Alasan pemindahan tempat tidur wajib diisi.",
    })
    .min(5, "Alasan pemindahan tempat tidur minimal 5 karakter."),
  versi: z.number({
    error: "Nomor versi episode rawat inap wajib disertakan.",
  }),
});

export const skemaPemulanganPasien = z.object({
  alasanPemulangan: z.enum(
    ["sembuh", "rujuk_rs_lain", "pulang_paksa", "meninggal"],
    {
      error:
        "Alasan pemulangan harus salah satu dari: sembuh, rujuk_rs_lain, pulang_paksa, atau meninggal.",
    },
  ),
  catatanPemulangan: z
    .string({
      error: "Catatan atau ringkasan pemulangan administratif wajib diisi.",
    })
    .min(5, "Catatan pemulangan minimal 5 karakter."),
  versi: z.number({
    error: "Nomor versi episode rawat inap wajib disertakan.",
  }),
});

