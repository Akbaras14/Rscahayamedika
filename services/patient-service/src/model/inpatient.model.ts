/**
 * @fileoverview Model dan entitas domain Rawat Inap (Tahap 4 — Petugas Rawat Inap).
 * Acuan: BRD Versi 4.0 Bab IV.4.3 & IV.4.5, Bab XVIII (AB-002, AB-020, AB-030, AB-031, AB-032, AB-034).
 */

import type {
  AlasanPemulangan,
  ItemBangsalDto,
  ItemEpisodeRawatInapDto,
  ItemKamarDto,
  ItemPenempatanTempatTidurDto,
  ItemPengajuanRawatInapDto,
  ItemRiwayatPerpindahanDto,
  ItemTempatTidurDto,
  KelasPelayananBangsal,
  StatusPengajuanRawatInap,
  StatusPerawatanEpisode,
  StatusTempatTidur,
} from "../../../../packages/shared-types/src/index.ts";

export type {
  AlasanPemulangan,
  ItemBangsalDto,
  ItemEpisodeRawatInapDto,
  ItemKamarDto,
  ItemPenempatanTempatTidurDto,
  ItemPengajuanRawatInapDto,
  ItemRiwayatPerpindahanDto,
  ItemTempatTidurDto,
  KelasPelayananBangsal,
  StatusPengajuanRawatInap,
  StatusPerawatanEpisode,
  StatusTempatTidur,
};

export interface EntitasBangsal {
  id: string;
  kodeBangsal: string;
  namaBangsal: string;
  kelasPelayanan: KelasPelayananBangsal;
  kapasitasTempatTidur: number;
  aktif: boolean;
  dibuatPada: string;
}

export interface EntitasKamar {
  id: string;
  bangsalId: string;
  nomorKamar: string;
  namaKamar: string;
  kapasitasTempatTidur: number;
  aktif: boolean;
  dibuatPada: string;
}

export interface EntitasTempatTidur {
  id: string;
  kamarId: string;
  bangsalId: string;
  nomorTempatTidur: string;
  statusTempatTidur: StatusTempatTidur;
  aktif: boolean;
  diperbaruiPada: string;
}

export interface EntitasEpisodeRawatInap {
  id: string;
  nomorEpisode: string;
  pasienId: string;
  kunjunganId: string;
  pengajuanId: string;
  dokterDpjpId: string;
  dokterDpjpNama: string;
  diagnosisUtama: string;
  bangsalId: string;
  kamarId: string;
  tempatTidurId: string;
  waktuMasuk: string;
  waktuKeluar: string | null;
  statusPerawatan: StatusPerawatanEpisode;
  alasanPemulangan: AlasanPemulangan | null;
  catatanPemulangan: string | null;
  dipulangkanOlehId: string | null;
  dipulangkanOlehNama: string | null;
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface EntitasPenempatanTempatTidur {
  id: string;
  episodeRawatInapId: string;
  pasienId: string;
  tempatTidurId: string;
  bangsalId: string;
  kamarId: string;
  waktuMasuk: string;
  waktuKeluar: string | null;
  statusPenempatan: "aktif" | "selesai";
  dicatatOlehId: string;
  dicatatOlehNama: string;
  dibuatPada: string;
}

export interface EntitasRiwayatPerpindahanTempatTidur {
  id: string;
  episodeRawatInapId: string;
  pasienId: string;
  bangsalAsalId: string;
  kamarAsalId: string;
  tempatTidurAsalId: string;
  bangsalTujuanId: string;
  kamarTujuanId: string;
  tempatTidurTujuanId: string;
  alasanPemindahan: string;
  dipindahkanOlehId: string;
  dipindahkanOlehNama: string;
  waktuPemindahan: string;
}

export interface ParameterPenerimaanDanPenempatan {
  pengajuanId: string;
  tempatTidurId: string;
  konfirmasiTanggalLahir: string;
  catatanPenempatan?: string;
  petugasId: string;
  petugasNama: string;
  kunciIdempotensi?: string;
  correlationId?: string;
}

export interface ParameterKeputusanPengajuan {
  pengajuanId: string;
  keputusan: "diterima" | "ditunda" | "ditolak";
  alasan: string;
  petugasId: string;
  petugasNama: string;
  correlationId?: string;
}

export interface ParameterPemindahanTempatTidur {
  episodeId: string;
  tempatTidurTujuanId: string;
  alasanPemindahan: string;
  versi: number;
  petugasId: string;
  petugasNama: string;
  correlationId?: string;
}

export interface ParameterPemulanganPasien {
  episodeId: string;
  alasanPemulangan: AlasanPemulangan;
  catatanPemulangan: string;
  versi: number;
  petugasId: string;
  petugasNama: string;
  correlationId?: string;
}

export interface RingkasanKapasitasRawatInap {
  totalTempatTidur: number;
  totalTersedia: number;
  totalTerisi: number;
  totalPemeliharaan: number;
  totalPasienAktif: number;
  totalPengajuanMenunggu: number;
}

