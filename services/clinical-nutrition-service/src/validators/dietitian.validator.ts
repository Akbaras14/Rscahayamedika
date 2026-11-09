/**
 * @fileoverview Validator input untuk domain Ahli Gizi / Dietisien (Tahap 6).
 */

import { KODE_GALAT } from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type {
  JadwalMakanMenu,
  KeputusanTindakLanjutGizi,
} from "../../../../packages/shared-types/src/index.ts";

export interface InputAsuhanGiziBaru {
  episodeId: string;
  pasienId: string;
  konfirmasiTanggalLahir: string;
  skriningId?: string | null;
  antropometriBbKg?: number | null;
  antropometriTbCm?: number | null;
  biokimia?: string | null;
  klinisFisik?: string | null;
  riwayatDiet?: string | null;
  diagnosisGiziPes: string;
  targetEnergiKkal: number;
  targetProteinGram: number;
  targetLemakGram: number;
  targetKarbohidratGram: number;
  targetCairanMl?: number | null;
  targetSeratGram?: number | null;
  targetNatriumMg?: number | null;
  tujuanIntervensi: string;
  rencanaIntervensi: string;
  rencanaMonitoringEvaluasi: string;
  tanggalEvaluasiUlang: string;
}

export interface InputRencanaMenuIndividualBaru {
  episodeId: string;
  pasienId: string;
  asuhanGiziId: string;
  instruksiDietId: string;
  tanggalPelayanan: string;
  jadwalMakan: JadwalMakanMenu;
  menuId: string;
  porsi?: number;
  catatanKhusus?: string | null;
}

export interface InputEvaluasiAsuhanGiziBaru {
  asuhanGiziId: string;
  episodeId: string;
  pasienId: string;
  tanggalEvaluasi: string;
  evaluasiAntropometri?: string | null;
  evaluasiBiokimia?: string | null;
  evaluasiAsupan: string;
  persentasePemenuhanAsupan?: number | null;
  hambatanAsupan?: string | null;
  keputusanTindakLanjut: KeputusanTindakLanjutGizi;
  rekomendasiKeDokter?: string | null;
}

const POLA_TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

const JADWAL_MAKAN_SAH: readonly JadwalMakanMenu[] = [
  "pagi",
  "snack_pagi",
  "siang",
  "snack_sore",
  "malam",
];

const KEPUTUSAN_TINDAK_LANJUT_SAH: readonly KeputusanTindakLanjutGizi[] = [
  "lanjutkan_rencana",
  "modifikasi_diet",
  "rujuk_dpjp",
  "selesai_asuhan",
];

export function validasiInputAsuhanGizi(input: unknown): InputAsuhanGiziBaru {
  if (!input || typeof input !== "object") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Data asuhan gizi ADIME tidak valid atau kosong.",
      pesanInternal: "Payload asuhan gizi bukan objek.",
    });
  }

  const data = input as Partial<InputAsuhanGiziBaru>;

  if (!data.episodeId || typeof data.episodeId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID episode rawat inap wajib diisi.",
      pesanInternal: "episodeId wajib bertipe string.",
    });
  }

  if (!data.pasienId || typeof data.pasienId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID pasien wajib diisi.",
      pesanInternal: "pasienId wajib bertipe string.",
    });
  }

  if (
    !data.konfirmasiTanggalLahir ||
    typeof data.konfirmasiTanggalLahir !== "string" ||
    !POLA_TANGGAL_ISO.test(data.konfirmasiTanggalLahir)
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna:
        "Konfirmasi tanggal lahir pasien (dua pengenal wajib AB-020) wajib diisi dengan format YYYY-MM-DD.",
      pesanInternal: "konfirmasiTanggalLahir tidak sesuai format ISO YYYY-MM-DD.",
    });
  }

  if (
    !data.diagnosisGiziPes ||
    typeof data.diagnosisGiziPes !== "string" ||
    data.diagnosisGiziPes.trim().length < 10
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna:
        "Diagnosis gizi terstandar (PES: Problem, Etiology, Signs & Symptoms) wajib diisi minimal 10 karakter.",
      pesanInternal: "diagnosisGiziPes kurang dari 10 karakter.",
    });
  }

  if (
    typeof data.targetEnergiKkal !== "number" ||
    Number.isNaN(data.targetEnergiKkal) ||
    data.targetEnergiKkal <= 0
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Target energi (kkal) wajib berupa angka positif lebih dari 0.",
      pesanInternal: "targetEnergiKkal tidak valid.",
    });
  }

  if (
    typeof data.targetProteinGram !== "number" ||
    Number.isNaN(data.targetProteinGram) ||
    data.targetProteinGram < 0
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Target protein (gram) wajib berupa angka lebih dari atau sama dengan 0.",
      pesanInternal: "targetProteinGram tidak valid.",
    });
  }

  if (
    typeof data.targetLemakGram !== "number" ||
    Number.isNaN(data.targetLemakGram) ||
    data.targetLemakGram < 0
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Target lemak (gram) wajib berupa angka lebih dari atau sama dengan 0.",
      pesanInternal: "targetLemakGram tidak valid.",
    });
  }

  if (
    typeof data.targetKarbohidratGram !== "number" ||
    Number.isNaN(data.targetKarbohidratGram) ||
    data.targetKarbohidratGram < 0
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna:
        "Target karbohidrat (gram) wajib berupa angka lebih dari atau sama dengan 0.",
      pesanInternal: "targetKarbohidratGram tidak valid.",
    });
  }

  if (
    !data.tujuanIntervensi ||
    typeof data.tujuanIntervensi !== "string" ||
    data.tujuanIntervensi.trim().length < 5
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Tujuan intervensi gizi wajib diisi minimal 5 karakter.",
      pesanInternal: "tujuanIntervensi kurang dari 5 karakter.",
    });
  }

  if (
    !data.rencanaIntervensi ||
    typeof data.rencanaIntervensi !== "string" ||
    data.rencanaIntervensi.trim().length < 5
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Rencana intervensi gizi wajib diisi minimal 5 karakter.",
      pesanInternal: "rencanaIntervensi kurang dari 5 karakter.",
    });
  }

  if (
    !data.rencanaMonitoringEvaluasi ||
    typeof data.rencanaMonitoringEvaluasi !== "string" ||
    data.rencanaMonitoringEvaluasi.trim().length < 5
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Rencana monitoring dan evaluasi gizi wajib diisi minimal 5 karakter.",
      pesanInternal: "rencanaMonitoringEvaluasi kurang dari 5 karakter.",
    });
  }

  if (
    !data.tanggalEvaluasiUlang ||
    typeof data.tanggalEvaluasiUlang !== "string" ||
    !POLA_TANGGAL_ISO.test(data.tanggalEvaluasiUlang)
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Tanggal evaluasi ulang wajib diisi dengan format YYYY-MM-DD.",
      pesanInternal: "tanggalEvaluasiUlang tidak valid.",
    });
  }

  return {
    episodeId: data.episodeId,
    pasienId: data.pasienId,
    konfirmasiTanggalLahir: data.konfirmasiTanggalLahir,
    skriningId: data.skriningId ?? null,
    antropometriBbKg:
      typeof data.antropometriBbKg === "number" ? data.antropometriBbKg : null,
    antropometriTbCm:
      typeof data.antropometriTbCm === "number" ? data.antropometriTbCm : null,
    biokimia: data.biokimia?.trim() || null,
    klinisFisik: data.klinisFisik?.trim() || null,
    riwayatDiet: data.riwayatDiet?.trim() || null,
    diagnosisGiziPes: data.diagnosisGiziPes.trim(),
    targetEnergiKkal: Math.round(data.targetEnergiKkal),
    targetProteinGram: Number(data.targetProteinGram.toFixed(1)),
    targetLemakGram: Number(data.targetLemakGram.toFixed(1)),
    targetKarbohidratGram: Number(data.targetKarbohidratGram.toFixed(1)),
    targetCairanMl:
      typeof data.targetCairanMl === "number" ? Math.round(data.targetCairanMl) : null,
    targetSeratGram:
      typeof data.targetSeratGram === "number"
        ? Number(data.targetSeratGram.toFixed(1))
        : null,
    targetNatriumMg:
      typeof data.targetNatriumMg === "number" ? Math.round(data.targetNatriumMg) : null,
    tujuanIntervensi: data.tujuanIntervensi.trim(),
    rencanaIntervensi: data.rencanaIntervensi.trim(),
    rencanaMonitoringEvaluasi: data.rencanaMonitoringEvaluasi.trim(),
    tanggalEvaluasiUlang: data.tanggalEvaluasiUlang,
  };
}

export function validasiInputRencanaMenuIndividual(
  input: unknown,
): InputRencanaMenuIndividualBaru {
  if (!input || typeof input !== "object") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Data rencana menu individual tidak valid atau kosong.",
      pesanInternal: "Payload rencana menu individual bukan objek.",
    });
  }

  const data = input as Partial<InputRencanaMenuIndividualBaru>;

  if (!data.episodeId || typeof data.episodeId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID episode rawat inap wajib diisi.",
      pesanInternal: "episodeId wajib bertipe string.",
    });
  }

  if (!data.pasienId || typeof data.pasienId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID pasien wajib diisi.",
      pesanInternal: "pasienId wajib bertipe string.",
    });
  }

  if (!data.asuhanGiziId || typeof data.asuhanGiziId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID asuhan gizi ADIME rujukan wajib diisi.",
      pesanInternal: "asuhanGiziId wajib bertipe string.",
    });
  }

  if (!data.instruksiDietId || typeof data.instruksiDietId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID instruksi diet dokter aktif wajib diisi.",
      pesanInternal: "instruksiDietId wajib bertipe string.",
    });
  }

  if (
    !data.tanggalPelayanan ||
    typeof data.tanggalPelayanan !== "string" ||
    !POLA_TANGGAL_ISO.test(data.tanggalPelayanan)
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Tanggal pelayanan menu wajib berformat YYYY-MM-DD.",
      pesanInternal: "tanggalPelayanan tidak valid.",
    });
  }

  if (!data.jadwalMakan || !JADWAL_MAKAN_SAH.includes(data.jadwalMakan)) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: `Jadwal makan tidak sah. Pilihan: ${JADWAL_MAKAN_SAH.join(", ")}.`,
      pesanInternal: `jadwalMakan '${String(data.jadwalMakan)}' tidak valid.`,
    });
  }

  if (!data.menuId || typeof data.menuId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID menu dari katalog resep wajib dipilih.",
      pesanInternal: "menuId wajib bertipe string.",
    });
  }

  const porsi =
    typeof data.porsi === "number" && !Number.isNaN(data.porsi) && data.porsi > 0
      ? Number(data.porsi.toFixed(2))
      : 1.0;

  return {
    episodeId: data.episodeId,
    pasienId: data.pasienId,
    asuhanGiziId: data.asuhanGiziId,
    instruksiDietId: data.instruksiDietId,
    tanggalPelayanan: data.tanggalPelayanan,
    jadwalMakan: data.jadwalMakan,
    menuId: data.menuId,
    porsi,
    catatanKhusus: data.catatanKhusus?.trim() || null,
  };
}

export function validasiInputEvaluasiAsuhanGizi(
  input: unknown,
): InputEvaluasiAsuhanGiziBaru {
  if (!input || typeof input !== "object") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Data evaluasi asuhan gizi tidak valid atau kosong.",
      pesanInternal: "Payload evaluasi asuhan gizi bukan objek.",
    });
  }

  const data = input as Partial<InputEvaluasiAsuhanGiziBaru>;

  if (!data.asuhanGiziId || typeof data.asuhanGiziId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID asuhan gizi wajib diisi.",
      pesanInternal: "asuhanGiziId wajib bertipe string.",
    });
  }

  if (!data.episodeId || typeof data.episodeId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID episode rawat inap wajib diisi.",
      pesanInternal: "episodeId wajib bertipe string.",
    });
  }

  if (!data.pasienId || typeof data.pasienId !== "string") {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "ID pasien wajib diisi.",
      pesanInternal: "pasienId wajib bertipe string.",
    });
  }

  if (
    !data.tanggalEvaluasi ||
    typeof data.tanggalEvaluasi !== "string" ||
    !POLA_TANGGAL_ISO.test(data.tanggalEvaluasi)
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Tanggal evaluasi wajib berformat YYYY-MM-DD.",
      pesanInternal: "tanggalEvaluasi tidak valid.",
    });
  }

  if (
    !data.evaluasiAsupan ||
    typeof data.evaluasiAsupan !== "string" ||
    data.evaluasiAsupan.trim().length < 5
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: "Evaluasi asupan makan wajib diisi minimal 5 karakter.",
      pesanInternal: "evaluasiAsupan kurang dari 5 karakter.",
    });
  }

  if (
    !data.keputusanTindakLanjut ||
    !KEPUTUSAN_TINDAK_LANJUT_SAH.includes(data.keputusanTindakLanjut)
  ) {
    throw new AppError({
      kode: KODE_GALAT.VALIDASI_GAGAL,
      statusHttp: 400,
      pesanPengguna: `Keputusan tindak lanjut gizi tidak sah. Pilihan: ${KEPUTUSAN_TINDAK_LANJUT_SAH.join(", ")}.`,
      pesanInternal: `keputusanTindakLanjut '${String(data.keputusanTindakLanjut)}' tidak valid.`,
    });
  }

  return {
    asuhanGiziId: data.asuhanGiziId,
    episodeId: data.episodeId,
    pasienId: data.pasienId,
    tanggalEvaluasi: data.tanggalEvaluasi,
    evaluasiAntropometri: data.evaluasiAntropometri?.trim() || null,
    evaluasiBiokimia: data.evaluasiBiokimia?.trim() || null,
    evaluasiAsupan: data.evaluasiAsupan.trim(),
    persentasePemenuhanAsupan:
      typeof data.persentasePemenuhanAsupan === "number"
        ? Math.min(100, Math.max(0, Number(data.persentasePemenuhanAsupan.toFixed(1))))
        : null,
    hambatanAsupan: data.hambatanAsupan?.trim() || null,
    keputusanTindakLanjut: data.keputusanTindakLanjut,
    rekomendasiKeDokter: data.rekomendasiKeDokter?.trim() || null,
  };
}

