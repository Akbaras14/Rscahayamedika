/**
 * @fileoverview Model entitas domain untuk layanan Dapur dan Pengendalian Makanan (Tahap 8).
 */

import type {
  SesiMakanDapur,
  StatusBatchProduksi,
  StatusPemeriksaanMutu,
  StatusPorsiPasien,
  StatusRencanaProduksi,
} from "../../../../packages/shared-types/src/index.ts";

export interface EntitasRencanaProduksi {
  id: string;
  nomorRencana: string;
  tanggalPelayanan: string;
  sesiMakan: SesiMakanDapur;
  status: StatusRencanaProduksi;
  totalEstimasiPorsi: number;
  catatan: string;
  penanggungJawabId: string;
  penanggungJawabNama: string;
  waktuDibuat: string;
  waktuDisetujui: string | null;
  versi: number;
}

export interface EntitasBatchProduksi {
  id: string;
  nomorBatch: string;
  rencanaProduksiId: string;
  resepId: string;
  namaMasakan: string;
  sesiMakan: SesiMakanDapur;
  jumlahPorsiTarget: number;
  jumlahPorsiRealisasi: number;
  suhuMasakCcpCelsius: number | null;
  waktuMulaiMasak: string;
  waktuSelesaiMasak: string | null;
  status: StatusBatchProduksi;
  catatanKoki: string;
  chefPenanggungJawab: string;
  waktuDibuat: string;
  versi: number;
}

export interface EntitasPenggunaanLotBahan {
  id: string;
  batchProduksiId: string;
  bahanId: string;
  namaBahan: string;
  nomorLot: string;
  jumlahDigunakan: number;
  satuan: string;
  waktuPencatatan: string;
}

export interface EntitasPemeriksaanMutu {
  id: string;
  batchProduksiId: string;
  suhuSajiCelsius: number;
  ujiTekstur: "sesuai" | "tidak_sesuai";
  ujiAroma: "normal_segar" | "menyimpang";
  ujiRasa: "sesuai_standar" | "tidak_sesuai";
  ujiTampilanVisual: "bersih_menarik" | "kurang_baik";
  statusMutu: StatusPemeriksaanMutu;
  catatanPemeriksaan: string;
  pemeriksaId: string;
  pemeriksaNama: string;
  waktuPemeriksaan: string;
}

export interface EntitasLabelPorsi {
  id: string;
  nomorLabel: string;
  nomorPesanan: string;
  batchProduksiId: string | null;
  nomorBatch: string | null;
  pasienId: string;
  namaPasien: string;
  nomorRm: string;
  bangsalKamarBed: string;
  tanggalPelayanan: string;
  sesiMakan: SesiMakanDapur;
  namaMenu: string;
  bentukMakanan: string;
  jenisDiet: string;
  informasiAlergen: string;
  suhuKemasanCelsius: number | null;
  statusPorsi: StatusPorsiPasien;
  alasanPenahanan: string | null;
  waktuCetakLabel: string;
  petugasLabelNama: string;
  versi: number;
}

export interface InputRencanaProduksiBaru {
  jenisRencana?: "reguler" | "mendadak";
  tanggalPelayanan: string;
  sesiMakan: SesiMakanDapur;
  catatan?: string;
  daftarPesananPasienId?: string[];
}

export interface InputBatchProduksiBaru {
  rencanaProduksiId: string;
  resepId: string;
  namaMasakan: string;
  sesiMakan: SesiMakanDapur;
  jumlahPorsiTarget: number;
  catatanKoki?: string;
  chefPenanggungJawab: string;
  lotBahanDigunakan: {
    bahanId: string;
    namaBahan: string;
    nomorLot: string;
    jumlahDigunakan: number;
    satuan: string;
  }[];
}

export interface InputCatatCcpSuhu {
  suhuMasakCcpCelsius: number;
  catatanKoki?: string;
  jumlahPorsiRealisasi?: number;
}

export interface InputPemeriksaanMutuBaru {
  batchProduksiId: string;
  suhuSajiCelsius: number;
  ujiTekstur: "sesuai" | "tidak_sesuai";
  ujiAroma: "normal_segar" | "menyimpang";
  ujiRasa: "sesuai_standar" | "tidak_sesuai";
  ujiTampilanVisual: "bersih_menarik" | "kurang_baik";
  statusMutu: StatusPemeriksaanMutu;
  catatanPemeriksaan: string;
}

export interface InputCetakLabelPorsi {
  batchProduksiId: string;
  suhuKemasanCelsius?: number | null;
}

export interface InputTahanPorsiKlinis {
  alasanPenahanan: string;
}

