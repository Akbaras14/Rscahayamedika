/**
 * @fileoverview Model domain data internal untuk layanan delivery-intake-service (Tahap 9).
 */

import type {
  HubunganPenerimaMakanan,
  JenisInsidenDistribusi,
  MetodeVerifikasiIdentitas,
  SesiMakanDapur,
  StatusSerahPorsi,
  StatusTroliDistribusi,
} from "../../../../packages/shared-types/src/index.ts";

export interface TroliDistribusiEntitas {
  id: string;
  nomorTroli: string;
  bangsalId: string;
  namaBangsal: string;
  sesiMakan: SesiMakanDapur;
  tanggalDistribusi: string;
  petugasDistribusiId: string;
  petugasDistribusiNama: string;
  status: StatusTroliDistribusi;
  totalPorsi: number;
  totalTerserah: number;
  totalDitahan: number;
  waktuBerangkat: string | null;
  waktuKembali: string | null;
  catatan: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemPorsiDistribusiEntitas {
  id: string;
  troliId: string | null;
  nomorTroli: string | null;
  labelPorsiId: string;
  nomorLabel: string;
  nomorPesanan: string;
  pasienId: string;
  namaPasien: string;
  nomorRm: string;
  tanggalLahirPasien: string;
  bangsalId: string;
  namaBangsal: string;
  kamarBed: string;
  sesiMakan: SesiMakanDapur;
  namaMenu: string;
  jenisDietLabel: string;
  dietTerkiniPasien: string;
  statusKesesuaianDiet: "sesuai" | "berubah_perlu_tahan";
  statusSerah: StatusSerahPorsi;
  waktuSerah: string | null;
  namaPenerima: string | null;
  hubunganPenerima: HubunganPenerimaMakanan | null;
  alasanGagalAtauTahan: string | null;
  duaIdentitasTerverifikasi: boolean;
  petugasDistribusiNama: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerifikasiDuaIdentitasEntitas {
  id: string;
  itemPorsiDistribusiId: string;
  namaPasienDiinput: string;
  tanggalLahirDiinput: string;
  nomorRmDiinput: string;
  metodeVerifikasi: MetodeVerifikasiIdentitas;
  statusCocok: boolean;
  verifikatorId: string;
  verifikatorNama: string;
  catatanVerifikasi: string;
  createdAt: string;
}

export interface RiwayatPenyerahanEntitas {
  id: string;
  itemPorsiDistribusiId: string;
  troliId: string | null;
  statusSebelumnya: string;
  statusSesudahnya: string;
  namaPenerima: string;
  hubunganPenerima: string;
  petugasId: string;
  petugasNama: string;
  waktuTransisi: string;
  keterangan: string;
}

export interface LaporanInsidenEntitas {
  id: string;
  nomorInsiden: string;
  troliId: string | null;
  porsiDistribusiId: string | null;
  bangsalId: string;
  namaBangsal: string;
  jenisInsiden: JenisInsidenDistribusi;
  deskripsiInsiden: string;
  tindakanKoreksi: string;
  dilaporkanOlehId: string;
  dilaporkanOlehNama: string;
  waktuKejadian: string;
  statusPenyelesaian: "terbuka" | "ditindaklanjuti" | "selesai";
  createdAt: string;
  updatedAt: string;
}

