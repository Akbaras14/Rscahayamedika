/**
 * @fileoverview Model domain dan entitas persistensi untuk Layanan Inventaris & Gudang (Tahap 7).
 * Acuan: BRD Bab VII, Bab XVII (AB-014, AB-015, AB-016, AB-017, AB-018).
 */

import type {
  JenisMutasiStok,
  KategoriBahanBaku,
  SatuanBahanBaku,
  StatusLotBahan,
  StatusMutuPenerimaan,
  StatusPermintaanBahan,
  SuhuPenyimpananBahan,
} from "../../../../packages/shared-types/src/index.ts";

export interface EntitasKatalogBahan {
  id: string;
  kodeBahan: string;
  namaBahan: string;
  kategori: KategoriBahanBaku;
  satuan: SatuanBahanBaku;
  suhuPenyimpanan: SuhuPenyimpananBahan;
  stokMinimum: number;
  stokFisik: number;
  stokLayak: number;
  stokDialokasikan: number;
  stokDitahan: number;
  daftarAlergen: readonly string[];
  kaloriPer100g: number;
  proteinPer100g: number;
  lemakPer100g: number;
  karbohidratPer100g: number;
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface EntitasPenerimaanLot {
  id: string;
  nomorLot: string;
  bahanId: string;
  namaPemasok: string;
  jumlahMasuk: number;
  sisaStokLot: number;
  satuan: SatuanBahanBaku;
  tanggalPenerimaan: string; // YYYY-MM-DD
  tanggalKedaluwarsa: string; // YYYY-MM-DD
  statusMutu: StatusMutuPenerimaan;
  catatanPemeriksaan: string;
  suhuTercatatCelsius: number | null;
  petugasPenerimaId: string;
  petugasPenerimaNama: string;
  statusLot: StatusLotBahan;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface EntitasKartuStokMutasi {
  id: string;
  bahanId: string;
  nomorLot: string | null;
  jenisMutasi: JenisMutasiStok;
  referensiDokumen: string;
  jumlahMasuk: number;
  jumlahKeluar: number;
  saldoAkhir: number;
  keterangan: string;
  petugasNama: string;
  waktuPencatatan: string;
}

export interface RincianPermintaanItemEntitas {
  bahanId: string;
  kodeBahan: string;
  namaBahan: string;
  jumlahDiminta: number;
  jumlahDialokasikan: number;
  jumlahDikeluarkan: number;
  satuan: SatuanBahanBaku;
  lotDialokasikan?: {
    lotId: string;
    nomorLot: string;
    jumlah: number;
  }[];
}

export interface EntitasPermintaanBahanDapur {
  id: string;
  nomorPermintaan: string;
  tanggalKebutuhan: string;
  unitPeminta: string;
  keterangan: string;
  status: StatusPermintaanBahan;
  alasanPenolakan: string | null;
  daftarItem: readonly RincianPermintaanItemEntitas[];
  catatanSelisih: string | null;
  waktuPermintaan: string;
  waktuAlokasi: string | null;
  waktuPengeluaran: string | null;
  petugasGudangId: string | null;
  petugasGudangNama: string | null;
}

export interface EntitasPenyesuaianStokOpname {
  id: string;
  bahanId: string;
  stokSistemSebelum: number;
  stokFisikAktual: number;
  selisih: number;
  alasanWajib: string;
  petugasId: string;
  petugasNama: string;
  waktuPencatatan: string;
}

export interface InputPenerimaanLotBaru {
  bahanId: string;
  namaPemasok: string;
  jumlahMasuk: number;
  tanggalPenerimaan: string;
  tanggalKedaluwarsa: string;
  statusMutu: StatusMutuPenerimaan;
  catatanPemeriksaan: string;
  suhuTercatatCelsius?: number | null;
}

export interface InputPermintaanBahanBaru {
  tanggalKebutuhan: string;
  unitPeminta: string;
  keterangan: string;
  daftarItem: {
    bahanId: string;
    jumlahDiminta: number;
  }[];
}

export interface InputPenyesuaianOpnameBaru {
  bahanId: string;
  stokFisikAktual: number;
  alasanWajib: string;
}

