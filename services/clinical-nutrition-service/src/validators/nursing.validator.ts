/**
 * @fileoverview Validator masukan untuk domain Asuhan Keperawatan (Tahap 5 — Perawat).
 * Menggunakan Zod untuk memvalidasi masukan secara fail-closed dan aman.
 */

import { z } from "zod";
import {
  ALASAN_TIDAK_HABIS,
  JADWAL_MAKAN,
  KATEGORI_PENURUNAN_BB,
  KEMAMPUAN_MENELAN,
  KEPUTUSAN_KEAMANAN_MAKANAN,
  KONDISI_PEMBERIAN_MAKANAN,
  SKALA_COMSTOCK,
  STATUS_KESADARAN,
  STATUS_PUASA_NPO,
} from "../model/nursing.model.ts";

export const skemaSkriningGizi = z.object({
  episodeId: z
    .string({ error: "ID episode rawat inap wajib diisi." })
    .min(1, "ID episode tidak boleh kosong."),
  penurunanBeratBadan: z.enum(
    KATEGORI_PENURUNAN_BB as unknown as [string, ...string[]],
    {
      error: "Kategori penurunan berat badan tidak sah.",
    },
  ),
  asupanMakanBerkurang: z.boolean({
    error: "Status penurunan asupan makan wajib berupa boolean.",
  }),
  catatanSkrining: z.string().optional().nullable(),
});

export type InputSkriningGizi = z.infer<typeof skemaSkriningGizi>;

export const skemaVerifikasiKeamananMakanan = z
  .object({
    episodeId: z
      .string({ error: "ID episode rawat inap wajib diisi." })
      .min(1, "ID episode tidak boleh kosong."),
    konfirmasiTanggalLahir: z
      .string({ error: "Konfirmasi tanggal lahir pasien (AB-020) wajib diisi." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD."),
    apakahIdentitasSesuai: z.boolean({
      error: "Pemeriksaan kesesuaian identitas wajib dicatat.",
    }),
    apakahDietSesuai: z.boolean({
      error: "Pemeriksaan kesesuaian diet DPJP wajib dicatat.",
    }),
    apakahAlergiTerkonfirmasi: z.boolean({
      error: "Pemeriksaan alergi bahan makanan wajib dicatat.",
    }),
    kemampuanMenelan: z.enum(
      KEMAMPUAN_MENELAN as unknown as [string, ...string[]],
      {
        error: "Kategori kemampuan menelan tidak sah.",
      },
    ),
    statusKesadaran: z.enum(
      STATUS_KESADARAN as unknown as [string, ...string[]],
      {
        error: "Status kesadaran tidak sah.",
      },
    ),
    statusPuasaNpo: z.enum(
      STATUS_PUASA_NPO as unknown as [string, ...string[]],
      {
        error: "Status puasa/NPO tidak sah.",
      },
    ),
    keputusan: z.enum(
      KEPUTUSAN_KEAMANAN_MAKANAN as unknown as [string, ...string[]],
      {
        error: "Keputusan keamanan makanan harus aman_lolos atau ditahan_safety_hold.",
      },
    ),
    alasanPenahanan: z.string().optional().nullable(),
    tindakanEskalasi: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.keputusan === "ditahan_safety_hold" &&
        (!data.alasanPenahanan || data.alasanPenahanan.trim().length < 5)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Alasan penahanan keselamatan wajib diisi minimal 5 karakter jika keputusan adalah ditahan (Safety Hold).",
      path: ["alasanPenahanan"],
    },
  );

export type InputVerifikasiKeamananMakanan = z.infer<
  typeof skemaVerifikasiKeamananMakanan
>;

export const skemaObservasiAsupan = z
  .object({
    episodeId: z
      .string({ error: "ID episode rawat inap wajib diisi." })
      .min(1, "ID episode tidak boleh kosong."),
    tanggalMakan: z
      .string({ error: "Tanggal makan wajib diisi." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal makan harus YYYY-MM-DD."),
    jadwalMakan: z.enum(JADWAL_MAKAN as unknown as [string, ...string[]], {
      error: "Jadwal makan tidak sah (pagi, siang, malam, selingan).",
    }),
    skalaComstock: z.enum(SKALA_COMSTOCK as unknown as [string, ...string[]], {
      error: "Skala Comstock visual tidak sah.",
    }),
    kondisiPemberian: z.enum(
      KONDISI_PEMBERIAN_MAKANAN as unknown as [string, ...string[]],
      {
        error: "Kondisi pemberian makanan tidak sah.",
      },
    ),
    alasanTidakHabis: z
      .enum(ALASAN_TIDAK_HABIS as unknown as [string, ...string[]])
      .optional()
      .nullable(),
    catatanObservasi: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      // Jika skala comstock < skala_100 (makanan bersisa) dan bukan belum_diobservasi, wajib sertakan alasan
      if (
        (data.skalaComstock === "skala_0" ||
          data.skalaComstock === "skala_25" ||
          data.skalaComstock === "skala_50" ||
          data.skalaComstock === "skala_75") &&
        !data.alasanTidakHabis
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Alasan makanan tidak habis wajib dicatat jika konsumsi tidak mencapai 100%.",
      path: ["alasanTidakHabis"],
    },
  );

export type InputObservasiAsupan = z.infer<typeof skemaObservasiAsupan>;

