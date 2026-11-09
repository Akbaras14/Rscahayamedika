import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Repositori data untuk `clinical-nutrition-service` (Tahap 3 — Dokter).
 * Menyediakan implementasi InMemory (dengan seed) dan implementasi MySQL terparameterisasi.
 */

import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  EntitasAlergiPasien,
  EntitasInstruksiDiet,
  EntitasPemeriksaanKlinis,
  EntitasPengajuanRawatInap,
  EntitasRiwayatVersiInstruksiDiet,
} from "../model/clinical-nutrition.model.ts";
import type {
  EntitasObservasiAsupanKeperawatan,
  EntitasSkriningGizi,
  EntitasVerifikasiKeamananMakanan,
} from "../model/nursing.model.ts";
import type {
  EntitasAsuhanGiziAdime,
  EntitasEvaluasiAsuhanGizi,
  EntitasKatalogMenuResep,
  EntitasRencanaMenuIndividual,
} from "../model/dietitian.model.ts";
import {
  SEED_ALERGI_SINTETIS,
  SEED_INSTRUKSI_DIET_SINTETIS,
  SEED_PEMERIKSAAN_SINTETIS,
  SEED_PENGAJUAN_RAWAT_INAP_SINTETIS,
  SEED_RIWAYAT_VERSI_DIET_SINTETIS,
} from "../database/seeds/clinical-nutrition.seed.ts";
import {
  SEED_OBSERVASI_ASUPAN_SINTETIS,
  SEED_SKRINING_GIZI_SINTETIS,
  SEED_VERIFIKASI_KEAMANAN_SINTETIS,
} from "../database/seeds/nursing.seed.ts";
import {
  SEED_ASUHAN_GIZI,
  SEED_EVALUASI_ASUHAN_GIZI,
  SEED_KATALOG_MENU_RESEP,
  SEED_RENCANA_MENU_INDIVIDUAL,
} from "../database/seeds/dietitian.seed.ts";

export interface RekamanIdempotensiClinical {
  id: string;
  kunci: string;
  aktorId: string;
  metodeHttp: string;
  jalurPermintaan: string;
  kodeStatusRespons: number;
  tubuhRespons: string;
  waktuDibuat: string;
}

export interface ParameterDaftarPengajuanRawatInap {
  halaman: number;
  ukuranHalaman: number;
  statusPengajuan?: string;
  rekomendasiBangsal?: string;
  pasienId?: string;
}

export interface ClinicalNutritionRepository {
  simpanPemeriksaanKlinis(
    pemeriksaan: EntitasPemeriksaanKlinis,
  ): Promise<EntitasPemeriksaanKlinis>;
  ambilPemeriksaanTerakhir(
    pasienId: string,
  ): Promise<EntitasPemeriksaanKlinis | null>;
  ambilPemeriksaanBerdasarkanKunjungan(
    kunjunganId: string,
  ): Promise<EntitasPemeriksaanKlinis | null>;

  simpanAlergiPasien(
    alergi: EntitasAlergiPasien,
  ): Promise<EntitasAlergiPasien>;
  ambilDaftarAlergiPasien(
    pasienId: string,
    hanyaAktif?: boolean,
  ): Promise<EntitasAlergiPasien[]>;

  hitungNomorInstruksiBerikutnya(): Promise<string>;
  simpanInstruksiDiet(
    instruksi: EntitasInstruksiDiet,
  ): Promise<EntitasInstruksiDiet>;
  ambilInstruksiDietAktif(
    pasienId: string,
  ): Promise<EntitasInstruksiDiet | null>;
  ambilInstruksiDietBerdasarkanId(
    id: string,
  ): Promise<EntitasInstruksiDiet | null>;
  perbaruiVersiInstruksiDiet(
    instruksiLamaId: string,
    instruksiBaru: EntitasInstruksiDiet,
    riwayat: EntitasRiwayatVersiInstruksiDiet,
  ): Promise<{ berhasil: boolean; instruksi: EntitasInstruksiDiet | null }>;
  ambilRiwayatVersiDiet(
    instruksiDietId: string,
  ): Promise<EntitasRiwayatVersiInstruksiDiet[]>;

  hitungNomorPengajuanRawatInapBerikutnya(): Promise<string>;
  simpanPengajuanRawatInap(
    pengajuan: EntitasPengajuanRawatInap,
  ): Promise<EntitasPengajuanRawatInap>;
  ambilPengajuanRawatInapAktif(
    pasienId: string,
  ): Promise<EntitasPengajuanRawatInap | null>;
  ambilDaftarPengajuanRawatInap(
    param: ParameterDaftarPengajuanRawatInap,
  ): Promise<{ items: EntitasPengajuanRawatInap[]; totalItem: number }>;

  // Domain Asuhan Keperawatan (Tahap 5 — Perawat)
  hitungNomorSkriningBerikutnya(): Promise<string>;
  simpanSkriningGizi(
    skrining: EntitasSkriningGizi,
  ): Promise<EntitasSkriningGizi>;
  ambilDaftarSkriningGizi(filter?: {
    episodeId?: string;
    pasienId?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasSkriningGizi[]>;
  ambilSkriningGiziTerakhir(
    episodeId: string,
  ): Promise<EntitasSkriningGizi | null>;

  hitungNomorVerifikasiKeamananBerikutnya(): Promise<string>;
  simpanVerifikasiKeamananMakanan(
    verifikasi: EntitasVerifikasiKeamananMakanan,
  ): Promise<EntitasVerifikasiKeamananMakanan>;
  ambilDaftarVerifikasiKeamananMakanan(filter?: {
    episodeId?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasVerifikasiKeamananMakanan[]>;
  ambilVerifikasiKeamananTerakhir(
    episodeId: string,
  ): Promise<EntitasVerifikasiKeamananMakanan | null>;

  simpanObservasiAsupan(
    observasi: EntitasObservasiAsupanKeperawatan,
  ): Promise<EntitasObservasiAsupanKeperawatan>;
  ambilDaftarObservasiAsupan(filter?: {
    episodeId?: string;
    bangsalId?: string;
    tanggal?: string;
  }): Promise<readonly EntitasObservasiAsupanKeperawatan[]>;

  // --- TAHAP 6: AHLI GIZI / DIETISIEN & PERENCANAAN MENU ---
  hitungNomorAsuhanGiziBerikutnya(): Promise<string>;
  simpanAsuhanGizi(
    asuhan: EntitasAsuhanGiziAdime,
  ): Promise<EntitasAsuhanGiziAdime>;
  ambilAsuhanGiziBerdasarkanId(
    id: string,
  ): Promise<EntitasAsuhanGiziAdime | null>;
  ambilAsuhanGiziTerakhirBerdasarkanEpisode(
    episodeId: string,
  ): Promise<EntitasAsuhanGiziAdime | null>;
  ambilDaftarAsuhanGizi(filter?: {
    episodeId?: string;
    pasienId?: string;
    bangsalId?: string;
    statusAsuhan?: string;
  }): Promise<readonly EntitasAsuhanGiziAdime[]>;

  ambilKatalogMenuResep(filter?: {
    kategoriMakanan?: string;
    bentukMakanan?: string;
    aktifHanya?: boolean;
  }): Promise<readonly EntitasKatalogMenuResep[]>;
  ambilMenuResepBerdasarkanId(
    id: string,
  ): Promise<EntitasKatalogMenuResep | null>;
  simpanMenuResep(
    menu: EntitasKatalogMenuResep,
  ): Promise<EntitasKatalogMenuResep>;

  simpanRencanaMenuIndividual(
    rencana: EntitasRencanaMenuIndividual,
  ): Promise<EntitasRencanaMenuIndividual>;
  ambilRencanaMenuIndividualBerdasarkanId(
    id: string,
  ): Promise<EntitasRencanaMenuIndividual | null>;
  ambilDaftarRencanaMenuIndividual(filter?: {
    episodeId?: string;
    pasienId?: string;
    tanggalPelayanan?: string;
    statusPengesahan?: string;
  }): Promise<readonly EntitasRencanaMenuIndividual[]>;
  perbaruiStatusPengesahanMenu(
    id: string,
    status: string,
    disahkanOleh: string,
    disahkanPada: string,
  ): Promise<EntitasRencanaMenuIndividual>;

  simpanEvaluasiAsuhanGizi(
    evaluasi: EntitasEvaluasiAsuhanGizi,
  ): Promise<EntitasEvaluasiAsuhanGizi>;
  ambilDaftarEvaluasiAsuhanGizi(filter?: {
    asuhanGiziId?: string;
    episodeId?: string;
  }): Promise<readonly EntitasEvaluasiAsuhanGizi[]>;

  ambilRekamanIdempotensi(
    kunci: string,
  ): Promise<RekamanIdempotensiClinical | null>;
  simpanRekamanIdempotensi(
    rekaman: RekamanIdempotensiClinical,
  ): Promise<void>;
  simpanOutbox(
    tipe: string,
    agregatId: string,
    muatan: Record<string, unknown>,
  ): Promise<void>;
}

export class InMemoryClinicalNutritionRepository
  implements ClinicalNutritionRepository
{
  private readonly petaPemeriksaan = new Map<string, EntitasPemeriksaanKlinis>();
  private readonly daftarAlergi: EntitasAlergiPasien[] = [];
  private readonly petaInstruksiDiet = new Map<string, EntitasInstruksiDiet>();
  private readonly daftarRiwayatVersiDiet: EntitasRiwayatVersiInstruksiDiet[] = [];
  private readonly petaPengajuanRawatInap = new Map<
    string,
    EntitasPengajuanRawatInap
  >();
  private readonly daftarSkriningGizi: EntitasSkriningGizi[] = [
    ...SEED_SKRINING_GIZI_SINTETIS,
  ];
  private readonly daftarVerifikasiKeamanan: EntitasVerifikasiKeamananMakanan[] = [
    ...SEED_VERIFIKASI_KEAMANAN_SINTETIS,
  ];
  private readonly daftarObservasiAsupan: EntitasObservasiAsupanKeperawatan[] = [
    ...SEED_OBSERVASI_ASUPAN_SINTETIS,
  ];
  private readonly daftarAsuhanGizi: EntitasAsuhanGiziAdime[] = [
    ...SEED_ASUHAN_GIZI,
  ];
  private readonly daftarKatalogMenuResep: EntitasKatalogMenuResep[] = [
    ...SEED_KATALOG_MENU_RESEP,
  ];
  private readonly daftarRencanaMenuIndividual: EntitasRencanaMenuIndividual[] = [
    ...SEED_RENCANA_MENU_INDIVIDUAL,
  ];
  private readonly daftarEvaluasiAsuhanGizi: EntitasEvaluasiAsuhanGizi[] = [
    ...SEED_EVALUASI_ASUHAN_GIZI,
  ];
  private readonly petaIdempotensi = new Map<
    string,
    RekamanIdempotensiClinical
  >();
  private readonly daftarOutbox: Array<{
    id: string;
    tipe: string;
    agregatId: string;
    muatan: string;
    status: string;
    waktuDibuat: string;
  }> = [];

  constructor() {
    this.inisialisasiSeed();
  }

  private inisialisasiSeed(): void {
    for (const p of SEED_PEMERIKSAAN_SINTETIS) {
      this.petaPemeriksaan.set(p.id, { ...p });
    }
    for (const a of SEED_ALERGI_SINTETIS) {
      this.daftarAlergi.push({ ...a });
    }
    for (const d of SEED_INSTRUKSI_DIET_SINTETIS) {
      this.petaInstruksiDiet.set(d.id, { ...d });
    }
    for (const r of SEED_RIWAYAT_VERSI_DIET_SINTETIS) {
      this.daftarRiwayatVersiDiet.push({ ...r });
    }
    for (const ri of SEED_PENGAJUAN_RAWAT_INAP_SINTETIS) {
      this.petaPengajuanRawatInap.set(ri.id, { ...ri });
    }
  }

  public async simpanPemeriksaanKlinis(
    pemeriksaan: EntitasPemeriksaanKlinis,
  ): Promise<EntitasPemeriksaanKlinis> {
    const salinan: EntitasPemeriksaanKlinis = { ...pemeriksaan };
    this.petaPemeriksaan.set(salinan.id, salinan);
    return { ...salinan };
  }

  public async ambilPemeriksaanTerakhir(
    pasienId: string,
  ): Promise<EntitasPemeriksaanKlinis | null> {
    const cocok: EntitasPemeriksaanKlinis[] = [];
    for (const p of this.petaPemeriksaan.values()) {
      if (p.pasienId === pasienId) {
        cocok.push({ ...p });
      }
    }
    if (cocok.length === 0) return null;
    cocok.sort(
      (a, b) =>
        new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime(),
    );
    return cocok[0];
  }

  public async ambilPemeriksaanBerdasarkanKunjungan(
    kunjunganId: string,
  ): Promise<EntitasPemeriksaanKlinis | null> {
    for (const p of this.petaPemeriksaan.values()) {
      if (p.kunjunganId === kunjunganId) {
        return { ...p };
      }
    }
    return null;
  }

  public async simpanAlergiPasien(
    alergi: EntitasAlergiPasien,
  ): Promise<EntitasAlergiPasien> {
    const salinan: EntitasAlergiPasien = { ...alergi };
    this.daftarAlergi.unshift(salinan);
    return { ...salinan };
  }

  public async ambilDaftarAlergiPasien(
    pasienId: string,
    hanyaAktif = true,
  ): Promise<EntitasAlergiPasien[]> {
    return this.daftarAlergi
      .filter((a) => a.pasienId === pasienId && (!hanyaAktif || a.statusAktif))
      .map((a) => ({ ...a }));
  }

  public async hitungNomorInstruksiBerikutnya(): Promise<string> {
    const sekarang = new Date();
    const thn = sekarang.getFullYear();
    const bln = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tgl = String(sekarang.getDate()).padStart(2, "0");
    const awalan = `DIET-${thn}${bln}${tgl}-`;
    let urutanMaks = 0;
    for (const d of this.petaInstruksiDiet.values()) {
      if (d.nomorInstruksi.startsWith(awalan)) {
        const belakang = Number(d.nomorInstruksi.slice(awalan.length));
        if (!Number.isNaN(belakang) && belakang > urutanMaks) {
          urutanMaks = belakang;
        }
      }
    }
    return `${awalan}${String(urutanMaks + 1).padStart(4, "0")}`;
  }

  public async simpanInstruksiDiet(
    instruksi: EntitasInstruksiDiet,
  ): Promise<EntitasInstruksiDiet> {
    const salinan: EntitasInstruksiDiet = { ...instruksi };
    this.petaInstruksiDiet.set(salinan.id, salinan);
    return { ...salinan };
  }

  public async ambilInstruksiDietAktif(
    pasienId: string,
  ): Promise<EntitasInstruksiDiet | null> {
    for (const d of this.petaInstruksiDiet.values()) {
      if (d.pasienId === pasienId && d.statusInstruksi === "aktif") {
        return { ...d };
      }
    }
    return null;
  }

  public async ambilInstruksiDietBerdasarkanId(
    id: string,
  ): Promise<EntitasInstruksiDiet | null> {
    const d = this.petaInstruksiDiet.get(id);
    return d ? { ...d } : null;
  }

  public async perbaruiVersiInstruksiDiet(
    instruksiLamaId: string,
    instruksiBaru: EntitasInstruksiDiet,
    riwayat: EntitasRiwayatVersiInstruksiDiet,
  ): Promise<{ berhasil: boolean; instruksi: EntitasInstruksiDiet | null }> {
    const lama = this.petaInstruksiDiet.get(instruksiLamaId);
    if (!lama) {
      return { berhasil: false, instruksi: null };
    }

    // Tandai versi lama digantikan
    const lamaDiperbarui: EntitasInstruksiDiet = {
      ...lama,
      statusInstruksi: "digantikan",
      berlakuHingga: instruksiBaru.berlakuSejak,
      diperbaruiPada: riwayat.diubahPada,
    };
    this.petaInstruksiDiet.set(lama.id, lamaDiperbarui);

    // Simpan versi baru yang aktif
    const baruDisimpan: EntitasInstruksiDiet = { ...instruksiBaru };
    this.petaInstruksiDiet.set(baruDisimpan.id, baruDisimpan);

    // Rekam jejak perubahan ke riwayat versi
    this.daftarRiwayatVersiDiet.unshift({ ...riwayat });

    return { berhasil: true, instruksi: { ...baruDisimpan } };
  }

  public async ambilRiwayatVersiDiet(
    instruksiDietId: string,
  ): Promise<EntitasRiwayatVersiInstruksiDiet[]> {
    const nomor = this.petaInstruksiDiet.get(instruksiDietId)?.nomorInstruksi;
    return this.daftarRiwayatVersiDiet
      .filter((r) => r.instruksiDietId === instruksiDietId || (nomor && r.snapshotData.nomorInstruksi === nomor))
      .map((r) => ({ ...r }))
      .sort((a, b) => b.versi - a.versi);
  }

  public async hitungNomorPengajuanRawatInapBerikutnya(): Promise<string> {
    const sekarang = new Date();
    const thn = sekarang.getFullYear();
    const bln = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tgl = String(sekarang.getDate()).padStart(2, "0");
    const awalan = `RI-${thn}${bln}${tgl}-`;
    let urutanMaks = 0;
    for (const ri of this.petaPengajuanRawatInap.values()) {
      if (ri.nomorPengajuan.startsWith(awalan)) {
        const belakang = Number(ri.nomorPengajuan.slice(awalan.length));
        if (!Number.isNaN(belakang) && belakang > urutanMaks) {
          urutanMaks = belakang;
        }
      }
    }
    return `${awalan}${String(urutanMaks + 1).padStart(4, "0")}`;
  }

  public async simpanPengajuanRawatInap(
    pengajuan: EntitasPengajuanRawatInap,
  ): Promise<EntitasPengajuanRawatInap> {
    const salinan: EntitasPengajuanRawatInap = { ...pengajuan };
    this.petaPengajuanRawatInap.set(salinan.id, salinan);
    return { ...salinan };
  }

  public async ambilPengajuanRawatInapAktif(
    pasienId: string,
  ): Promise<EntitasPengajuanRawatInap | null> {
    for (const ri of this.petaPengajuanRawatInap.values()) {
      if (
        ri.pasienId === pasienId &&
        ri.statusPengajuan === "menunggu_penempatan"
      ) {
        return { ...ri };
      }
    }
    return null;
  }

  public async ambilDaftarPengajuanRawatInap(
    param: ParameterDaftarPengajuanRawatInap,
  ): Promise<{ items: EntitasPengajuanRawatInap[]; totalItem: number }> {
    let baris = Array.from(this.petaPengajuanRawatInap.values());

    if (param.pasienId) {
      baris = baris.filter((r) => r.pasienId === param.pasienId);
    }
    if (param.statusPengajuan) {
      baris = baris.filter((r) => r.statusPengajuan === param.statusPengajuan);
    }
    if (param.rekomendasiBangsal) {
      baris = baris.filter(
        (r) => r.rekomendasiBangsal === param.rekomendasiBangsal,
      );
    }

    baris.sort(
      (a, b) =>
        new Date(b.diajukanPada).getTime() - new Date(a.diajukanPada).getTime(),
    );

    const totalItem = baris.length;
    const awal = (param.halaman - 1) * param.ukuranHalaman;
    const akhir = awal + param.ukuranHalaman;
    const items = baris.slice(awal, akhir).map((r) => ({ ...r }));

    return { items, totalItem };
  }

  public async ambilRekamanIdempotensi(
    kunci: string,
  ): Promise<RekamanIdempotensiClinical | null> {
    const r = this.petaIdempotensi.get(kunci);
    return r ? { ...r } : null;
  }

  public async simpanRekamanIdempotensi(
    rekaman: RekamanIdempotensiClinical,
  ): Promise<void> {
    this.petaIdempotensi.set(rekaman.kunci, { ...rekaman });
  }

  public async simpanOutbox(
    tipe: string,
    agregatId: string,
    muatan: Record<string, unknown>,
  ): Promise<void> {
    this.daftarOutbox.push({
      id: `outbox-cln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipe,
      agregatId,
      muatan: JSON.stringify(muatan),
      status: "TERTUNDA",
      waktuDibuat: new Date().toISOString(),
    });
  }

  // --- Domain Asuhan Keperawatan (Tahap 5 — Perawat) ---
  public async hitungNomorSkriningBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urut = String(this.daftarSkriningGizi.length + 1).padStart(4, "0");
    return `MST-${tgl}-${urut}`;
  }

  public async simpanSkriningGizi(
    skrining: EntitasSkriningGizi,
  ): Promise<EntitasSkriningGizi> {
    const idx = this.daftarSkriningGizi.findIndex((s) => s.id === skrining.id);
    if (idx >= 0) {
      this.daftarSkriningGizi[idx] = { ...skrining };
    } else {
      this.daftarSkriningGizi.unshift({ ...skrining });
    }
    return { ...skrining };
  }

  public async ambilDaftarSkriningGizi(filter?: {
    episodeId?: string;
    pasienId?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasSkriningGizi[]> {
    let hasil = [...this.daftarSkriningGizi];
    if (filter?.episodeId) {
      hasil = hasil.filter((s) => s.episodeId === filter.episodeId);
    }
    if (filter?.pasienId) {
      hasil = hasil.filter((s) => s.pasienId === filter.pasienId);
    }
    if (filter?.bangsalId) {
      hasil = hasil.filter((s) => s.bangsalId === filter.bangsalId);
    }
    return hasil;
  }

  public async ambilSkriningGiziTerakhir(
    episodeId: string,
  ): Promise<EntitasSkriningGizi | null> {
    const item = this.daftarSkriningGizi.find((s) => s.episodeId === episodeId);
    return item ? { ...item } : null;
  }

  public async hitungNomorVerifikasiKeamananBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urut = String(this.daftarVerifikasiKeamanan.length + 1).padStart(4, "0");
    return `VKM-${tgl}-${urut}`;
  }

  public async simpanVerifikasiKeamananMakanan(
    verifikasi: EntitasVerifikasiKeamananMakanan,
  ): Promise<EntitasVerifikasiKeamananMakanan> {
    const idx = this.daftarVerifikasiKeamanan.findIndex(
      (v) => v.id === verifikasi.id,
    );
    if (idx >= 0) {
      this.daftarVerifikasiKeamanan[idx] = { ...verifikasi };
    } else {
      this.daftarVerifikasiKeamanan.unshift({ ...verifikasi });
    }
    return { ...verifikasi };
  }

  public async ambilDaftarVerifikasiKeamananMakanan(filter?: {
    episodeId?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasVerifikasiKeamananMakanan[]> {
    let hasil = [...this.daftarVerifikasiKeamanan];
    if (filter?.episodeId) {
      hasil = hasil.filter((v) => v.episodeId === filter.episodeId);
    }
    if (filter?.bangsalId) {
      hasil = hasil.filter((v) => v.bangsalId === filter.bangsalId);
    }
    return hasil;
  }

  public async ambilVerifikasiKeamananTerakhir(
    episodeId: string,
  ): Promise<EntitasVerifikasiKeamananMakanan | null> {
    const item = this.daftarVerifikasiKeamanan.find(
      (v) => v.episodeId === episodeId,
    );
    return item ? { ...item } : null;
  }

  public async simpanObservasiAsupan(
    observasi: EntitasObservasiAsupanKeperawatan,
  ): Promise<EntitasObservasiAsupanKeperawatan> {
    const idx = this.daftarObservasiAsupan.findIndex(
      (o) => o.id === observasi.id,
    );
    if (idx >= 0) {
      this.daftarObservasiAsupan[idx] = { ...observasi };
    } else {
      this.daftarObservasiAsupan.unshift({ ...observasi });
    }
    return { ...observasi };
  }

  public async ambilDaftarObservasiAsupan(filter?: {
    episodeId?: string;
    bangsalId?: string;
    tanggal?: string;
  }): Promise<readonly EntitasObservasiAsupanKeperawatan[]> {
    let hasil = [...this.daftarObservasiAsupan];
    if (filter?.episodeId) {
      hasil = hasil.filter((o) => o.episodeId === filter.episodeId);
    }
    if (filter?.bangsalId) {
      hasil = hasil.filter((o) => o.bangsalId === filter.bangsalId);
    }
    if (filter?.tanggal) {
      hasil = hasil.filter((o) => o.tanggalMakan === filter.tanggal);
    }
    return hasil;
  }

  // --- TAHAP 6: AHLI GIZI / DIETISIEN IN-MEMORY ---
  public async hitungNomorAsuhanGiziBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urut = String(this.daftarAsuhanGizi.length + 1).padStart(4, "0");
    return `ADIME-${tgl}-${urut}`;
  }

  public async simpanAsuhanGizi(
    asuhan: EntitasAsuhanGiziAdime,
  ): Promise<EntitasAsuhanGiziAdime> {
    const idx = this.daftarAsuhanGizi.findIndex((a) => a.id === asuhan.id);
    if (idx >= 0) {
      this.daftarAsuhanGizi[idx] = { ...asuhan };
    } else {
      this.daftarAsuhanGizi.unshift({ ...asuhan });
    }
    return { ...asuhan };
  }

  public async ambilAsuhanGiziBerdasarkanId(
    id: string,
  ): Promise<EntitasAsuhanGiziAdime | null> {
    const item = this.daftarAsuhanGizi.find((a) => a.id === id);
    return item ? { ...item } : null;
  }

  public async ambilAsuhanGiziTerakhirBerdasarkanEpisode(
    episodeId: string,
  ): Promise<EntitasAsuhanGiziAdime | null> {
    const item = this.daftarAsuhanGizi.find((a) => a.episodeId === episodeId);
    return item ? { ...item } : null;
  }

  public async ambilDaftarAsuhanGizi(filter?: {
    episodeId?: string;
    pasienId?: string;
    bangsalId?: string;
    statusAsuhan?: string;
  }): Promise<readonly EntitasAsuhanGiziAdime[]> {
    let hasil = [...this.daftarAsuhanGizi];
    if (filter?.episodeId) {
      hasil = hasil.filter((a) => a.episodeId === filter.episodeId);
    }
    if (filter?.pasienId) {
      hasil = hasil.filter((a) => a.pasienId === filter.pasienId);
    }
    if (filter?.bangsalId) {
      hasil = hasil.filter((a) => a.bangsalId === filter.bangsalId);
    }
    if (filter?.statusAsuhan) {
      hasil = hasil.filter((a) => a.statusAsuhan === filter.statusAsuhan);
    }
    return hasil;
  }

  public async ambilKatalogMenuResep(filter?: {
    kategoriMakanan?: string;
    bentukMakanan?: string;
    aktifHanya?: boolean;
  }): Promise<readonly EntitasKatalogMenuResep[]> {
    let hasil = [...this.daftarKatalogMenuResep];
    if (filter?.aktifHanya !== false) {
      hasil = hasil.filter((m) => m.aktif);
    }
    if (filter?.kategoriMakanan) {
      hasil = hasil.filter((m) => m.kategoriMakanan === filter.kategoriMakanan);
    }
    if (filter?.bentukMakanan) {
      hasil = hasil.filter((m) => m.bentukMakanan === filter.bentukMakanan);
    }
    return hasil;
  }

  public async ambilMenuResepBerdasarkanId(
    id: string,
  ): Promise<EntitasKatalogMenuResep | null> {
    const item = this.daftarKatalogMenuResep.find((m) => m.id === id);
    return item ? { ...item } : null;
  }

  public async simpanMenuResep(
    menu: EntitasKatalogMenuResep,
  ): Promise<EntitasKatalogMenuResep> {
    const idx = this.daftarKatalogMenuResep.findIndex((m) => m.id === menu.id);
    if (idx >= 0) {
      this.daftarKatalogMenuResep[idx] = { ...menu };
    } else {
      this.daftarKatalogMenuResep.push({ ...menu });
    }
    return { ...menu };
  }

  public async simpanRencanaMenuIndividual(
    rencana: EntitasRencanaMenuIndividual,
  ): Promise<EntitasRencanaMenuIndividual> {
    const idx = this.daftarRencanaMenuIndividual.findIndex(
      (r) => r.id === rencana.id,
    );
    if (idx >= 0) {
      this.daftarRencanaMenuIndividual[idx] = { ...rencana };
    } else {
      this.daftarRencanaMenuIndividual.unshift({ ...rencana });
    }
    return { ...rencana };
  }

  public async ambilRencanaMenuIndividualBerdasarkanId(
    id: string,
  ): Promise<EntitasRencanaMenuIndividual | null> {
    const item = this.daftarRencanaMenuIndividual.find((r) => r.id === id);
    return item ? { ...item } : null;
  }

  public async ambilDaftarRencanaMenuIndividual(filter?: {
    episodeId?: string;
    pasienId?: string;
    tanggalPelayanan?: string;
    statusPengesahan?: string;
  }): Promise<readonly EntitasRencanaMenuIndividual[]> {
    let hasil = [...this.daftarRencanaMenuIndividual];
    if (filter?.episodeId) {
      hasil = hasil.filter((r) => r.episodeId === filter.episodeId);
    }
    if (filter?.pasienId) {
      hasil = hasil.filter((r) => r.pasienId === filter.pasienId);
    }
    if (filter?.tanggalPelayanan) {
      hasil = hasil.filter(
        (r) => r.tanggalPelayanan === filter.tanggalPelayanan,
      );
    }
    if (filter?.statusPengesahan) {
      hasil = hasil.filter(
        (r) => r.statusPengesahan === filter.statusPengesahan,
      );
    }
    return hasil;
  }

  public async perbaruiStatusPengesahanMenu(
    id: string,
    status: string,
    disahkanOleh: string,
    disahkanPada: string,
  ): Promise<EntitasRencanaMenuIndividual> {
    const idx = this.daftarRencanaMenuIndividual.findIndex((r) => r.id === id);
    if (idx < 0) {
      throw new Error(`Rencana menu individual ${id} tidak ditemukan.`);
    }
    const lama = this.daftarRencanaMenuIndividual[idx];
    const baru: EntitasRencanaMenuIndividual = {
      ...lama,
      statusPengesahan: status as EntitasRencanaMenuIndividual["statusPengesahan"],
      disahkanOleh,
      disahkanPada,
      versi: lama.versi + 1,
      diperbaruiPada: new Date().toISOString(),
    };
    this.daftarRencanaMenuIndividual[idx] = baru;
    return baru;
  }

  public async simpanEvaluasiAsuhanGizi(
    evaluasi: EntitasEvaluasiAsuhanGizi,
  ): Promise<EntitasEvaluasiAsuhanGizi> {
    const idx = this.daftarEvaluasiAsuhanGizi.findIndex(
      (e) => e.id === evaluasi.id,
    );
    if (idx >= 0) {
      this.daftarEvaluasiAsuhanGizi[idx] = { ...evaluasi };
    } else {
      this.daftarEvaluasiAsuhanGizi.unshift({ ...evaluasi });
    }
    return { ...evaluasi };
  }

  public async ambilDaftarEvaluasiAsuhanGizi(filter?: {
    asuhanGiziId?: string;
    episodeId?: string;
  }): Promise<readonly EntitasEvaluasiAsuhanGizi[]> {
    let hasil = [...this.daftarEvaluasiAsuhanGizi];
    if (filter?.asuhanGiziId) {
      hasil = hasil.filter((e) => e.asuhanGiziId === filter.asuhanGiziId);
    }
    if (filter?.episodeId) {
      hasil = hasil.filter((e) => e.episodeId === filter.episodeId);
    }
    return hasil;
  }
}

export class MySqlClinicalNutritionRepository
  implements ClinicalNutritionRepository
{
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public async simpanPemeriksaanKlinis(
    pemeriksaan: EntitasPemeriksaanKlinis,
  ): Promise<EntitasPemeriksaanKlinis> {
    await this.pool.execute(
      `INSERT INTO pemeriksaan_klinis (
        id, kunjungan_id, pasien_id, nomor_rekam_medis, nama_pasien, tanggal_lahir_pasien,
        dokter_id, dokter_nama, unit_pelayanan, bangsal_id, keluhan_utama, riwayat_penyakit_sekarang,
        tekanan_darah_sistol, tekanan_darah_diastol, denyut_nadi, frekuensi_nafas, suhu_tubuh,
        berat_badan_kg, tinggi_badan_cm, diagnosis_klinis_primer, diagnosis_klinis_sekunder,
        catatan_klinis_relevan_gizi, tindak_lanjut, dibuat_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        pemeriksaan.id,
        pemeriksaan.kunjunganId,
        pemeriksaan.pasienId,
        pemeriksaan.nomorRekamMedis,
        pemeriksaan.namaPasien,
        pemeriksaan.tanggalLahirPasien,
        pemeriksaan.dokterId,
        pemeriksaan.dokterNama,
        pemeriksaan.unitPelayanan,
        pemeriksaan.bangsalId ?? null,
        pemeriksaan.keluhanUtama,
        pemeriksaan.riwayatPenyakitSekarang ?? null,
        pemeriksaan.tandaVital.tekananDarahSistol ?? null,
        pemeriksaan.tandaVital.tekananDarahDiastol ?? null,
        pemeriksaan.tandaVital.denyutNadi ?? null,
        pemeriksaan.tandaVital.frekuensiNafas ?? null,
        pemeriksaan.tandaVital.suhuTubuh ?? null,
        pemeriksaan.tandaVital.beratBadanKg ?? null,
        pemeriksaan.tandaVital.tinggiBadanCm ?? null,
        pemeriksaan.diagnosisKlinisPrimer,
        pemeriksaan.diagnosisKlinisSekunder ?? null,
        pemeriksaan.catatanKlinisRelevanGizi ?? null,
        pemeriksaan.tindakLanjut,
        pemeriksaan.dibuatPada,
        pemeriksaan.diperbaruiPada,
      ]),
    );
    return { ...pemeriksaan };
  }

  public async ambilPemeriksaanTerakhir(
    pasienId: string,
  ): Promise<EntitasPemeriksaanKlinis | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM pemeriksaan_klinis WHERE pasien_id = ? ORDER BY dibuat_pada DESC LIMIT 1`,
      parameterMysql([pasienId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisPemeriksaan(rows[0]);
  }

  public async ambilPemeriksaanBerdasarkanKunjungan(
    kunjunganId: string,
  ): Promise<EntitasPemeriksaanKlinis | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM pemeriksaan_klinis WHERE kunjungan_id = ? LIMIT 1`,
      parameterMysql([kunjunganId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisPemeriksaan(rows[0]);
  }

  public async simpanAlergiPasien(
    alergi: EntitasAlergiPasien,
  ): Promise<EntitasAlergiPasien> {
    await this.pool.execute(
      `INSERT INTO alergi_pasien (
        id, pasien_id, pemeriksaan_id, kategori_alergen, nama_alergen,
        tingkat_keparahan, reaksi_alergi, status_aktif, dicatat_oleh_id,
        dicatat_oleh_nama, dicatat_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        alergi.id,
        alergi.pasienId,
        alergi.pemeriksaanId ?? null,
        alergi.kategoriAlergen,
        alergi.namaAlergen,
        alergi.tingkatKeparahan,
        alergi.reaksiAlergi,
        alergi.statusAktif ? 1 : 0,
        alergi.dicatatOlehId,
        alergi.dicatatOlehNama,
        alergi.dicatatPada,
      ]),
    );
    return { ...alergi };
  }

  public async ambilDaftarAlergiPasien(
    pasienId: string,
    hanyaAktif = true,
  ): Promise<EntitasAlergiPasien[]> {
    const sql = hanyaAktif
      ? `SELECT * FROM alergi_pasien WHERE pasien_id = ? AND status_aktif = 1 ORDER BY dicatat_pada DESC`
      : `SELECT * FROM alergi_pasien WHERE pasien_id = ? ORDER BY dicatat_pada DESC`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql([pasienId]));
    return (rows ?? []).map(this.petakanBarisAlergi);
  }

  public async hitungNomorInstruksiBerikutnya(): Promise<string> {
    const sekarang = new Date();
    const thn = sekarang.getFullYear();
    const bln = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tgl = String(sekarang.getDate()).padStart(2, "0");
    const awalan = `DIET-${thn}${bln}${tgl}-%`;

    const [rows] = await this.pool.query<
      Array<RowDataPacket & { nomor_instruksi: string }>
    >(
      `SELECT nomor_instruksi FROM instruksi_diet WHERE nomor_instruksi LIKE ? ORDER BY nomor_instruksi DESC LIMIT 1`,
      parameterMysql([awalan]),
    );
    const prefix = `DIET-${thn}${bln}${tgl}-`;
    if (!rows || rows.length === 0) {
      return `${prefix}0001`;
    }
    const belakang = Number(rows[0].nomor_instruksi.slice(prefix.length));
    return `${prefix}${String(belakang + 1).padStart(4, "0")}`;
  }

  public async simpanInstruksiDiet(
    instruksi: EntitasInstruksiDiet,
  ): Promise<EntitasInstruksiDiet> {
    await this.pool.execute(
      `INSERT INTO instruksi_diet (
        id, nomor_instruksi, pasien_id, kunjungan_id, nomor_rekam_medis, nama_pasien,
        dokter_pengesah_id, dokter_pengesah_nama, bangsal_id, jenis_diet, nama_diet_kustom,
        bentuk_makanan, rute_pemberian, status_puasa_npo, alasan_puasa, target_energi_kkal,
        target_protein_gram, pembatasan_cairan_ml, pembatasan_natrium_mg, instruksi_khusus,
        status_instruksi, versi, berlaku_sejak, berlaku_hingga, disahkan_pada, dibuat_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        instruksi.id,
        instruksi.nomorInstruksi,
        instruksi.pasienId,
        instruksi.kunjunganId,
        instruksi.nomorRekamMedis,
        instruksi.namaPasien,
        instruksi.dokterPengesahId,
        instruksi.dokterPengesahNama,
        instruksi.bangsalId ?? null,
        instruksi.jenisDiet,
        instruksi.namaDietKustom ?? null,
        instruksi.bentukMakanan,
        instruksi.rutePemberian,
        instruksi.statusPuasaNpo ? 1 : 0,
        instruksi.alasanPuasa ?? null,
        instruksi.targetEnergiKkal ?? null,
        instruksi.targetProteinGram ?? null,
        instruksi.pembatasanCairanMl ?? null,
        instruksi.pembatasanNatriumMg ?? null,
        instruksi.instruksiKhusus ?? null,
        instruksi.statusInstruksi,
        instruksi.versi,
        instruksi.berlakuSejak,
        instruksi.berlakuHingga ?? null,
        instruksi.disahkanPada,
        instruksi.dibuatPada,
        instruksi.diperbaruiPada,
      ]),
    );
    return { ...instruksi };
  }

  public async ambilInstruksiDietAktif(
    pasienId: string,
  ): Promise<EntitasInstruksiDiet | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM instruksi_diet WHERE pasien_id = ? AND status_instruksi = 'aktif' LIMIT 1`,
      parameterMysql([pasienId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisInstruksiDiet(rows[0]);
  }

  public async ambilInstruksiDietBerdasarkanId(
    id: string,
  ): Promise<EntitasInstruksiDiet | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM instruksi_diet WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisInstruksiDiet(rows[0]);
  }

  public async perbaruiVersiInstruksiDiet(
    instruksiLamaId: string,
    instruksiBaru: EntitasInstruksiDiet,
    riwayat: EntitasRiwayatVersiInstruksiDiet,
  ): Promise<{ berhasil: boolean; instruksi: EntitasInstruksiDiet | null }> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const [updated] = await conn.execute(
        `UPDATE instruksi_diet
         SET status_instruksi = 'digantikan', berlaku_hingga = ?, diperbarui_pada = ?
         WHERE id = ? AND status_instruksi = 'aktif' AND versi = ?`,
        parameterMysql([instruksiBaru.berlakuSejak, riwayat.diubahPada, instruksiLamaId, instruksiBaru.versi - 1]),
      );

      if ((updated as { affectedRows: number }).affectedRows !== 1) {
        await conn.rollback();
        return { berhasil: false, instruksi: null };
      }

      await conn.execute(
        `INSERT INTO instruksi_diet (
          id, nomor_instruksi, pasien_id, kunjungan_id, nomor_rekam_medis, nama_pasien,
          dokter_pengesah_id, dokter_pengesah_nama, bangsal_id, jenis_diet, nama_diet_kustom,
          bentuk_makanan, rute_pemberian, status_puasa_npo, alasan_puasa, target_energi_kkal,
          target_protein_gram, pembatasan_cairan_ml, pembatasan_natrium_mg, instruksi_khusus,
          status_instruksi, versi, berlaku_sejak, berlaku_hingga, disahkan_pada, dibuat_pada, diperbarui_pada
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        parameterMysql([
          instruksiBaru.id,
          instruksiBaru.nomorInstruksi,
          instruksiBaru.pasienId,
          instruksiBaru.kunjunganId,
          instruksiBaru.nomorRekamMedis,
          instruksiBaru.namaPasien,
          instruksiBaru.dokterPengesahId,
          instruksiBaru.dokterPengesahNama,
          instruksiBaru.bangsalId,
          instruksiBaru.jenisDiet,
          instruksiBaru.namaDietKustom,
          instruksiBaru.bentukMakanan,
          instruksiBaru.rutePemberian,
          instruksiBaru.statusPuasaNpo ? 1 : 0,
          instruksiBaru.alasanPuasa,
          instruksiBaru.targetEnergiKkal,
          instruksiBaru.targetProteinGram,
          instruksiBaru.pembatasanCairanMl,
          instruksiBaru.pembatasanNatriumMg,
          instruksiBaru.instruksiKhusus,
          instruksiBaru.statusInstruksi,
          instruksiBaru.versi,
          instruksiBaru.berlakuSejak,
          instruksiBaru.berlakuHingga,
          instruksiBaru.disahkanPada,
          instruksiBaru.dibuatPada,
          instruksiBaru.diperbaruiPada,
        ]),
      );

      await conn.execute(
        `INSERT INTO riwayat_versi_instruksi_diet (
          id, instruksi_diet_id, pasien_id, versi, snapshot_data,
          alasan_perubahan, diubah_oleh_id, diubah_oleh_nama, diubah_pada
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        parameterMysql([
          riwayat.id,
          riwayat.instruksiDietId,
          riwayat.pasienId,
          riwayat.versi,
          JSON.stringify(riwayat.snapshotData),
          riwayat.alasanPerubahan,
          riwayat.diubahOlehId,
          riwayat.diubahOlehNama,
          riwayat.diubahPada,
        ]),
      );

      await conn.commit();
      return { berhasil: true, instruksi: { ...instruksiBaru } };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  public async ambilRiwayatVersiDiet(
    instruksiDietId: string,
  ): Promise<EntitasRiwayatVersiInstruksiDiet[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.* FROM riwayat_versi_instruksi_diet r JOIN instruksi_diet i ON i.id = r.instruksi_diet_id WHERE i.nomor_instruksi = (SELECT nomor_instruksi FROM instruksi_diet WHERE id = ?) ORDER BY r.versi DESC`,
      parameterMysql([instruksiDietId]),
    );
    return (rows ?? []).map((r) => ({
      id: String(r.id),
      instruksiDietId: String(r.instruksi_diet_id),
      pasienId: String(r.pasien_id),
      versi: Number(r.versi),
      snapshotData:
        typeof r.snapshot_data === "string"
          ? JSON.parse(r.snapshot_data)
          : (r.snapshot_data as EntitasInstruksiDiet),
      alasanPerubahan: String(r.alasan_perubahan),
      diubahOlehId: String(r.diubah_oleh_id),
      diubahOlehNama: String(r.diubah_oleh_nama),
      diubahPada: waktuMysql(r.diubah_pada),
    }));
  }

  public async hitungNomorPengajuanRawatInapBerikutnya(): Promise<string> {
    const sekarang = new Date();
    const thn = sekarang.getFullYear();
    const bln = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tgl = String(sekarang.getDate()).padStart(2, "0");
    const awalan = `RI-${thn}${bln}${tgl}-%`;

    const [rows] = await this.pool.query<
      Array<RowDataPacket & { nomor_pengajuan: string }>
    >(
      `SELECT nomor_pengajuan FROM pengajuan_rawat_inap WHERE nomor_pengajuan LIKE ? ORDER BY nomor_pengajuan DESC LIMIT 1`,
      parameterMysql([awalan]),
    );
    const prefix = `RI-${thn}${bln}${tgl}-`;
    if (!rows || rows.length === 0) {
      return `${prefix}0001`;
    }
    const belakang = Number(rows[0].nomor_pengajuan.slice(prefix.length));
    return `${prefix}${String(belakang + 1).padStart(4, "0")}`;
  }

  public async simpanPengajuanRawatInap(
    pengajuan: EntitasPengajuanRawatInap,
  ): Promise<EntitasPengajuanRawatInap> {
    await this.pool.execute(
      `INSERT INTO pengajuan_rawat_inap (
        id, nomor_pengajuan, pasien_id, kunjungan_id, nomor_rekam_medis, nama_pasien,
        dokter_pengaju_id, dokter_pengaju_nama, diagnosis_utama, alasan_rawat_inap,
        prioritas_rawat_inap, rekomendasi_bangsal, kebutuhan_khusus, instruksi_diet_id,
        status_pengajuan, diajukan_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        pengajuan.id,
        pengajuan.nomorPengajuan,
        pengajuan.pasienId,
        pengajuan.kunjunganId,
        pengajuan.nomorRekamMedis,
        pengajuan.namaPasien,
        pengajuan.dokterPengajuId,
        pengajuan.dokterPengajuNama,
        pengajuan.diagnosisUtama,
        pengajuan.alasanRawatInap,
        pengajuan.prioritasRawatInap,
        pengajuan.rekomendasiBangsal,
        pengajuan.kebutuhanKhusus ?? null,
        pengajuan.instruksiDietId ?? null,
        pengajuan.statusPengajuan,
        pengajuan.diajukanPada,
        pengajuan.diperbaruiPada,
      ]),
    );
    return { ...pengajuan };
  }

  public async ambilPengajuanRawatInapAktif(
    pasienId: string,
  ): Promise<EntitasPengajuanRawatInap | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM pengajuan_rawat_inap WHERE pasien_id = ? AND status_pengajuan = 'menunggu_penempatan' LIMIT 1`,
      parameterMysql([pasienId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisPengajuan(rows[0]);
  }

  public async ambilDaftarPengajuanRawatInap(
    param: ParameterDaftarPengajuanRawatInap,
  ): Promise<{ items: EntitasPengajuanRawatInap[]; totalItem: number }> {
    const kondisi: string[] = [];
    const args: Array<string | number> = [];

    if (param.pasienId) {
      kondisi.push("pasien_id = ?");
      args.push(param.pasienId);
    }
    if (param.statusPengajuan) {
      kondisi.push("status_pengajuan = ?");
      args.push(param.statusPengajuan);
    }
    if (param.rekomendasiBangsal) {
      kondisi.push("rekomendasi_bangsal = ?");
      args.push(param.rekomendasiBangsal);
    }

    const where = kondisi.length > 0 ? `WHERE ${kondisi.join(" AND ")}` : "";
    const [cnt] = await this.pool.query<
      Array<RowDataPacket & { total: number }>
    >(
      `SELECT COUNT(*) AS total FROM pengajuan_rawat_inap ${where}`,
      parameterMysql(args),
    );
    const totalItem = Number(cnt[0]?.total ?? 0);

    const offset = (param.halaman - 1) * param.ukuranHalaman;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM pengajuan_rawat_inap ${where} ORDER BY diajukan_pada DESC LIMIT ? OFFSET ?`,
      parameterMysql([...args, param.ukuranHalaman, offset]),
    );

    return {
      items: (rows ?? []).map(this.petakanBarisPengajuan),
      totalItem,
    };
  }

  public async ambilRekamanIdempotensi(
    kunci: string,
  ): Promise<RekamanIdempotensiClinical | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM kunci_idempotensi_clinical WHERE kunci = ? LIMIT 1`,
      parameterMysql([kunci]),
    );
    if (!rows || rows.length === 0) return null;
    return {
      id: String(rows[0].id),
      kunci: String(rows[0].kunci),
      aktorId: String(rows[0].aktor_id),
      metodeHttp: String(rows[0].metode_http),
      jalurPermintaan: String(rows[0].jalur_permintaan),
      kodeStatusRespons: Number(rows[0].kode_status_respons),
      tubuhRespons: String(rows[0].tubuh_respons),
      waktuDibuat: new Date(rows[0].waktu_dibuat).toISOString(),
    };
  }

  public async simpanRekamanIdempotensi(
    rekaman: RekamanIdempotensiClinical,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO kunci_idempotensi_clinical (
        id, kunci, aktor_id, metode_http, jalur_permintaan, kode_status_respons, tubuh_respons, waktu_dibuat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        rekaman.id,
        rekaman.kunci,
        rekaman.aktorId,
        rekaman.metodeHttp,
        rekaman.jalurPermintaan,
        rekaman.kodeStatusRespons,
        rekaman.tubuhRespons,
        rekaman.waktuDibuat,
      ]),
    );
  }

  public async simpanOutbox(
    tipe: string,
    agregatId: string,
    muatan: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO outbox_peristiwa_clinical (id, tipe_peristiwa, id_agregat, muatan, status_publikasi, waktu_dibuat)
       VALUES (?, ?, ?, ?, 'TERTUNDA', NOW(3))`,
      parameterMysql([`outbox-${Date.now()}`, tipe, agregatId, JSON.stringify(muatan)]),
    );
  }

  private petakanBarisPemeriksaan(r: RowDataPacket): EntitasPemeriksaanKlinis {
    return {
      id: r.id,
      kunjunganId: r.kunjungan_id,
      pasienId: r.pasien_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      tanggalLahirPasien:
        r.tanggal_lahir_pasien instanceof Date
          ? r.tanggal_lahir_pasien.toISOString().split("T")[0]
          : String(r.tanggal_lahir_pasien),
      dokterId: r.dokter_id,
      dokterNama: r.dokter_nama,
      unitPelayanan: r.unit_pelayanan,
      bangsalId: r.bangsal_id,
      keluhanUtama: r.keluhan_utama,
      riwayatPenyakitSekarang: r.riwayat_penyakit_sekarang,
      tandaVital: {
        tekananDarahSistol: r.tekanan_darah_sistol,
        tekananDarahDiastol: r.tekanan_darah_diastol,
        denyutNadi: r.denyut_nadi,
        frekuensiNafas: r.frekuensi_nafas,
        suhuTubuh: r.suhu_tubuh !== null ? Number(r.suhu_tubuh) : null,
        beratBadanKg: r.berat_badan_kg !== null ? Number(r.berat_badan_kg) : null,
        tinggiBadanCm: r.tinggi_badan_cm !== null ? Number(r.tinggi_badan_cm) : null,
      },
      diagnosisKlinisPrimer: r.diagnosis_klinis_primer,
      diagnosisKlinisSekunder: r.diagnosis_klinis_sekunder,
      catatanKlinisRelevanGizi: r.catatan_klinis_relevan_gizi,
      tindakLanjut: r.tindak_lanjut,
      dibuatPada: waktuMysql(r.dibuat_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisAlergi(r: RowDataPacket): EntitasAlergiPasien {
    return {
      id: r.id,
      pasienId: r.pasien_id,
      pemeriksaanId: r.pemeriksaan_id,
      kategoriAlergen: r.kategori_alergen,
      namaAlergen: r.nama_alergen,
      tingkatKeparahan: r.tingkat_keparahan,
      reaksiAlergi: r.reaksi_alergi,
      statusAktif: Boolean(r.status_aktif),
      dicatatOlehId: r.dicatat_oleh_id,
      dicatatOlehNama: r.dicatat_oleh_nama,
      dicatatPada: waktuMysql(r.dicatat_pada),
    };
  }

  private petakanBarisInstruksiDiet(r: RowDataPacket): EntitasInstruksiDiet {
    return {
      id: r.id,
      nomorInstruksi: r.nomor_instruksi,
      pasienId: r.pasien_id,
      kunjunganId: r.kunjungan_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      dokterPengesahId: r.dokter_pengesah_id,
      dokterPengesahNama: r.dokter_pengesah_nama,
      bangsalId: r.bangsal_id,
      jenisDiet: r.jenis_diet,
      namaDietKustom: r.nama_diet_kustom,
      bentukMakanan: r.bentuk_makanan,
      rutePemberian: r.rute_pemberian,
      statusPuasaNpo: Boolean(r.status_puasa_npo),
      alasanPuasa: r.alasan_puasa,
      targetEnergiKkal: r.target_energi_kkal,
      targetProteinGram:
        r.target_protein_gram !== null ? Number(r.target_protein_gram) : null,
      pembatasanCairanMl: r.pembatasan_cairan_ml,
      pembatasanNatriumMg: r.pembatasan_natrium_mg,
      instruksiKhusus: r.instruksi_khusus,
      statusInstruksi: r.status_instruksi,
      versi: r.versi,
      berlakuSejak: waktuMysql(r.berlaku_sejak),
      berlakuHingga: r.berlaku_hingga
        ? waktuMysql(r.berlaku_hingga)
        : null,
      disahkanPada: waktuMysql(r.disahkan_pada),
      dibuatPada: waktuMysql(r.dibuat_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisPengajuan(r: RowDataPacket): EntitasPengajuanRawatInap {
    return {
      id: r.id,
      nomorPengajuan: r.nomor_pengajuan,
      pasienId: r.pasien_id,
      kunjunganId: r.kunjungan_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      dokterPengajuId: r.dokter_pengaju_id,
      dokterPengajuNama: r.dokter_pengaju_nama,
      diagnosisUtama: r.diagnosis_utama,
      alasanRawatInap: r.alasan_rawat_inap,
      prioritasRawatInap: r.prioritas_rawat_inap,
      rekomendasiBangsal: r.rekomendasi_bangsal,
      kebutuhanKhusus: r.kebutuhan_khusus,
      instruksiDietId: r.instruksi_diet_id,
      statusPengajuan: r.status_pengajuan,
      diajukanPada: waktuMysql(r.diajukan_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  // --- Domain Asuhan Keperawatan (Tahap 5 — Perawat) ---
  public async hitungNomorSkriningBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM skrining_gizi WHERE nomor_skrining LIKE ?`,
      parameterMysql([`MST-${tgl}-%`]),
    );
    const count = Number(rows[0]?.total ?? 0) + 1;
    return `MST-${tgl}-${String(count).padStart(4, "0")}`;
  }

  public async simpanSkriningGizi(
    skrining: EntitasSkriningGizi,
  ): Promise<EntitasSkriningGizi> {
    await this.pool.execute(
      `INSERT INTO skrining_gizi (
        id, nomor_skrining, episode_id, pasien_id, nomor_rekam_medis, nama_pasien,
        bangsal_id, perawat_id, perawat_nama, metode_skrining, penurunan_berat_badan,
        skor_penurunan_bb, asupan_makan_berkurang, skor_asupan_makan, total_skor,
        kategori_risiko, perlu_penilaian_lanjut, catatan_skrining, diskrining_pada,
        dibuat_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        penurunan_berat_badan = VALUES(penurunan_berat_badan),
        skor_penurunan_bb = VALUES(skor_penurunan_bb),
        asupan_makan_berkurang = VALUES(asupan_makan_berkurang),
        skor_asupan_makan = VALUES(skor_asupan_makan),
        total_skor = VALUES(total_skor),
        kategori_risiko = VALUES(kategori_risiko),
        perlu_penilaian_lanjut = VALUES(perlu_penilaian_lanjut),
        catatan_skrining = VALUES(catatan_skrining),
        diperbarui_pada = VALUES(diperbarui_pada)`,
      parameterMysql([
        skrining.id,
        skrining.nomorSkrining,
        skrining.episodeId,
        skrining.pasienId,
        skrining.nomorRekamMedis,
        skrining.namaPasien,
        skrining.bangsalId,
        skrining.perawatId,
        skrining.perawatNama,
        skrining.metodeSkrining,
        skrining.penurunanBeratBadan,
        skrining.skorPenurunanBb,
        skrining.asupanMakanBerkurang ? 1 : 0,
        skrining.skorAsupanMakan,
        skrining.totalSkor,
        skrining.kategoriRisiko,
        skrining.perluPenilaianLanjut ? 1 : 0,
        skrining.catatanSkrining ?? null,
        skrining.diskriningPada,
        skrining.dibuatPada,
        skrining.diperbaruiPada,
      ]),
    );
    return { ...skrining };
  }

  public async ambilDaftarSkriningGizi(filter?: {
    episodeId?: string;
    pasienId?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasSkriningGizi[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.episodeId) {
      klausa.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    if (filter?.pasienId) {
      klausa.push("pasien_id = ?");
      params.push(filter.pasienId);
    }
    if (filter?.bangsalId) {
      klausa.push("bangsal_id = ?");
      params.push(filter.bangsalId);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM skrining_gizi ${where} ORDER BY diskrining_pada DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisSkrining(r));
  }

  public async ambilSkriningGiziTerakhir(
    episodeId: string,
  ): Promise<EntitasSkriningGizi | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM skrining_gizi WHERE episode_id = ? ORDER BY diskrining_pada DESC LIMIT 1`,
      parameterMysql([episodeId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisSkrining(rows[0]);
  }

  public async hitungNomorVerifikasiKeamananBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM verifikasi_keamanan_makanan WHERE nomor_verifikasi LIKE ?`,
      parameterMysql([`VKM-${tgl}-%`]),
    );
    const count = Number(rows[0]?.total ?? 0) + 1;
    return `VKM-${tgl}-${String(count).padStart(4, "0")}`;
  }

  public async simpanVerifikasiKeamananMakanan(
    verifikasi: EntitasVerifikasiKeamananMakanan,
  ): Promise<EntitasVerifikasiKeamananMakanan> {
    await this.pool.execute(
      `INSERT INTO verifikasi_keamanan_makanan (
        id, nomor_verifikasi, episode_id, pasien_id, nomor_rekam_medis, nama_pasien,
        bangsal_id, tempat_tidur_id, nomor_tempat_tidur, instruksi_diet_id, perawat_id,
        perawat_nama, konfirmasi_tanggal_lahir, apakah_identitas_sesuai, apakah_diet_sesuai,
        apakah_alergi_terkonfirmasi, kemampuan_menelan, status_kesadaran, status_puasa_npo,
        keputusan, alasan_penahanan, tindakan_eskalasi, diverifikasi_pada, dibuat_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        verifikasi.id,
        verifikasi.nomorVerifikasi,
        verifikasi.episodeId,
        verifikasi.pasienId,
        verifikasi.nomorRekamMedis,
        verifikasi.namaPasien,
        verifikasi.bangsalId,
        verifikasi.tempatTidurId,
        verifikasi.nomorTempatTidur,
        verifikasi.instruksiDietId ?? null,
        verifikasi.perawatId,
        verifikasi.perawatNama,
        verifikasi.konfirmasiTanggalLahir,
        verifikasi.apakahIdentitasSesuai ? 1 : 0,
        verifikasi.apakahDietSesuai ? 1 : 0,
        verifikasi.apakahAlergiTerkonfirmasi ? 1 : 0,
        verifikasi.kemampuanMenelan,
        verifikasi.statusKesadaran,
        verifikasi.statusPuasaNpo,
        verifikasi.keputusan,
        verifikasi.alasanPenahanan ?? null,
        verifikasi.tindakanEskalasi ?? null,
        verifikasi.diverifikasiPada,
        verifikasi.dibuatPada,
      ]),
    );
    return { ...verifikasi };
  }

  public async ambilDaftarVerifikasiKeamananMakanan(filter?: {
    episodeId?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasVerifikasiKeamananMakanan[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.episodeId) {
      klausa.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    if (filter?.bangsalId) {
      klausa.push("bangsal_id = ?");
      params.push(filter.bangsalId);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM verifikasi_keamanan_makanan ${where} ORDER BY diverifikasi_pada DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisVerifikasi(r));
  }

  public async ambilVerifikasiKeamananTerakhir(
    episodeId: string,
  ): Promise<EntitasVerifikasiKeamananMakanan | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM verifikasi_keamanan_makanan WHERE episode_id = ? ORDER BY diverifikasi_pada DESC LIMIT 1`,
      parameterMysql([episodeId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisVerifikasi(rows[0]);
  }

  public async simpanObservasiAsupan(
    observasi: EntitasObservasiAsupanKeperawatan,
  ): Promise<EntitasObservasiAsupanKeperawatan> {
    await this.pool.execute(
      `INSERT INTO observasi_asupan_keperawatan (
        id, episode_id, pasien_id, nomor_rekam_medis, nama_pasien, bangsal_id,
        tempat_tidur_id, perawat_id, perawat_nama, tanggal_makan, jadwal_makan,
        skala_comstock, persentase_konsumsi, kondisi_pemberian, alasan_tidak_habis,
        catatan_observasi, peringatan_asupan_rendah, diobservasi_pada, dibuat_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        skala_comstock = VALUES(skala_comstock),
        persentase_konsumsi = VALUES(persentase_konsumsi),
        kondisi_pemberian = VALUES(kondisi_pemberian),
        alasan_tidak_habis = VALUES(alasan_tidak_habis),
        catatan_observasi = VALUES(catatan_observasi),
        peringatan_asupan_rendah = VALUES(peringatan_asupan_rendah),
        diobservasi_pada = VALUES(diobservasi_pada)`,
      parameterMysql([
        observasi.id,
        observasi.episodeId,
        observasi.pasienId,
        observasi.nomorRekamMedis,
        observasi.namaPasien,
        observasi.bangsalId,
        observasi.tempatTidurId,
        observasi.perawatId,
        observasi.perawatNama,
        observasi.tanggalMakan,
        observasi.jadwalMakan,
        observasi.skalaComstock,
        observasi.persentaseKonsumsi,
        observasi.kondisiPemberian,
        observasi.alasanTidakHabis ?? null,
        observasi.catatanObservasi ?? null,
        observasi.peringatanAsupanRendah ? 1 : 0,
        observasi.diobservasiPada,
        observasi.dibuatPada,
      ]),
    );
    return { ...observasi };
  }

  public async ambilDaftarObservasiAsupan(filter?: {
    episodeId?: string;
    bangsalId?: string;
    tanggal?: string;
  }): Promise<readonly EntitasObservasiAsupanKeperawatan[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.episodeId) {
      klausa.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    if (filter?.bangsalId) {
      klausa.push("bangsal_id = ?");
      params.push(filter.bangsalId);
    }
    if (filter?.tanggal) {
      klausa.push("tanggal_makan = ?");
      params.push(filter.tanggal);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM observasi_asupan_keperawatan ${where} ORDER BY diobservasi_pada DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisObservasi(r));
  }

  private petakanBarisSkrining(r: RowDataPacket): EntitasSkriningGizi {
    return {
      id: r.id,
      nomorSkrining: r.nomor_skrining,
      episodeId: r.episode_id,
      pasienId: r.pasien_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      bangsalId: r.bangsal_id,
      perawatId: r.perawat_id,
      perawatNama: r.perawat_nama,
      metodeSkrining: r.metode_skrining,
      penurunanBeratBadan: r.penurunan_berat_badan,
      skorPenurunanBb: Number(r.skor_penurunan_bb),
      asupanMakanBerkurang: Boolean(r.asupan_makan_berkurang),
      skorAsupanMakan: Number(r.skor_asupan_makan),
      totalSkor: Number(r.total_skor),
      kategoriRisiko: r.kategori_risiko,
      perluPenilaianLanjut: Boolean(r.perlu_penilaian_lanjut),
      catatanSkrining: r.catatan_skrining,
      diskriningPada: waktuMysql(r.diskrining_pada),
      dibuatPada: waktuMysql(r.dibuat_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisVerifikasi(
    r: RowDataPacket,
  ): EntitasVerifikasiKeamananMakanan {
    return {
      id: r.id,
      nomorVerifikasi: r.nomor_verifikasi,
      episodeId: r.episode_id,
      pasienId: r.pasien_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      bangsalId: r.bangsal_id,
      tempatTidurId: r.tempat_tidur_id,
      nomorTempatTidur: r.nomor_tempat_tidur,
      instruksiDietId: r.instruksi_diet_id,
      perawatId: r.perawat_id,
      perawatNama: r.perawat_nama,
      konfirmasiTanggalLahir:
        r.konfirmasi_tanggal_lahir instanceof Date
          ? r.konfirmasi_tanggal_lahir.toISOString().split("T")[0]
          : String(r.konfirmasi_tanggal_lahir),
      apakahIdentitasSesuai: Boolean(r.apakah_identitas_sesuai),
      apakahDietSesuai: Boolean(r.apakah_diet_sesuai),
      apakahAlergiTerkonfirmasi: Boolean(r.apakah_alergi_terkonfirmasi),
      kemampuanMenelan: r.kemampuan_menelan,
      statusKesadaran: r.status_kesadaran,
      statusPuasaNpo: r.status_puasa_npo,
      keputusan: r.keputusan,
      alasanPenahanan: r.alasan_penahanan,
      tindakanEskalasi: r.tindakan_eskalasi,
      diverifikasiPada: waktuMysql(r.diverifikasi_pada),
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  private petakanBarisObservasi(
    r: RowDataPacket,
  ): EntitasObservasiAsupanKeperawatan {
    return {
      id: r.id,
      episodeId: r.episode_id,
      pasienId: r.pasien_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      bangsalId: r.bangsal_id,
      tempatTidurId: r.tempat_tidur_id,
      perawatId: r.perawat_id,
      perawatNama: r.perawat_nama,
      tanggalMakan:
        r.tanggal_makan instanceof Date
          ? r.tanggal_makan.toISOString().split("T")[0]
          : String(r.tanggal_makan),
      jadwalMakan: r.jadwal_makan,
      skalaComstock: r.skala_comstock,
      persentaseKonsumsi: Number(r.persentase_konsumsi),
      kondisiPemberian: r.kondisi_pemberian,
      alasanTidakHabis: r.alasan_tidak_habis,
      catatanObservasi: r.catatan_observasi,
      peringatanAsupanRendah: Boolean(r.peringatan_asupan_rendah),
      diobservasiPada: waktuMysql(r.diobservasi_pada),
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  // --- TAHAP 6: AHLI GIZI / DIETISIEN MYSQL ---
  public async hitungNomorAsuhanGiziBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM asuhan_gizi_adime WHERE DATE(dibuat_pada) = CURDATE()`,
    );
    const urut = String(Number(rows[0]?.total ?? 0) + 1).padStart(4, "0");
    return `ADIME-${tgl}-${urut}`;
  }

  public async simpanAsuhanGizi(
    asuhan: EntitasAsuhanGiziAdime,
  ): Promise<EntitasAsuhanGiziAdime> {
    await this.pool.execute(
      `INSERT INTO asuhan_gizi_adime (
        id, nomor_asuhan, episode_id, pasien_id, nomor_rekam_medis, nama_pasien,
        bangsal_id, skrining_id, ahli_gizi_id, ahli_gizi_nama, antropometri_bb_kg,
        antropometri_tb_cm, antropometri_imt, klasifikasi_imt, biokimia, klinis_fisik,
        riwayat_diet, diagnosis_gizi_pes, target_energi_kkal, target_protein_gram,
        target_lemak_gram, target_karbohidrat_gram, target_cairan_ml, target_serat_gram,
        target_natrium_mg, tujuan_intervensi, rencana_intervensi, rencana_monitoring_evaluasi,
        tanggal_evaluasi_ulang, status_asuhan, waktu_berlaku, versi, dibuat_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status_asuhan = VALUES(status_asuhan),
        versi = versi + 1,
        diperbarui_pada = VALUES(diperbarui_pada)`,
      parameterMysql([
        asuhan.id,
        asuhan.nomorAsuhan,
        asuhan.episodeId,
        asuhan.pasienId,
        asuhan.nomorRekamMedis,
        asuhan.namaPasien,
        asuhan.bangsalId,
        asuhan.skriningId,
        asuhan.ahliGiziId,
        asuhan.ahliGiziNama,
        asuhan.antropometriBbKg,
        asuhan.antropometriTbCm,
        asuhan.antropometriImt,
        asuhan.klasifikasiImt,
        asuhan.biokimia,
        asuhan.klinisFisik,
        asuhan.riwayatDiet,
        asuhan.diagnosisGiziPes,
        asuhan.targetEnergiKkal,
        asuhan.targetProteinGram,
        asuhan.targetLemakGram,
        asuhan.targetKarbohidratGram,
        asuhan.targetCairanMl,
        asuhan.targetSeratGram,
        asuhan.targetNatriumMg,
        asuhan.tujuanIntervensi,
        asuhan.rencanaIntervensi,
        asuhan.rencanaMonitoringEvaluasi,
        asuhan.tanggalEvaluasiUlang,
        asuhan.statusAsuhan,
        asuhan.waktuBerlaku,
        asuhan.versi,
        asuhan.dibuatPada,
        asuhan.diperbaruiPada,
      ]),
    );
    return { ...asuhan };
  }

  public async ambilAsuhanGiziBerdasarkanId(
    id: string,
  ): Promise<EntitasAsuhanGiziAdime | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM asuhan_gizi_adime WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisAsuhanGizi(rows[0]);
  }

  public async ambilAsuhanGiziTerakhirBerdasarkanEpisode(
    episodeId: string,
  ): Promise<EntitasAsuhanGiziAdime | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM asuhan_gizi_adime WHERE episode_id = ? ORDER BY dibuat_pada DESC LIMIT 1`,
      parameterMysql([episodeId]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisAsuhanGizi(rows[0]);
  }

  public async ambilDaftarAsuhanGizi(filter?: {
    episodeId?: string;
    pasienId?: string;
    bangsalId?: string;
    statusAsuhan?: string;
  }): Promise<readonly EntitasAsuhanGiziAdime[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.episodeId) {
      klausa.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    if (filter?.pasienId) {
      klausa.push("pasien_id = ?");
      params.push(filter.pasienId);
    }
    if (filter?.bangsalId) {
      klausa.push("bangsal_id = ?");
      params.push(filter.bangsalId);
    }
    if (filter?.statusAsuhan) {
      klausa.push("status_asuhan = ?");
      params.push(filter.statusAsuhan);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM asuhan_gizi_adime ${where} ORDER BY dibuat_pada DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisAsuhanGizi(r));
  }

  public async ambilKatalogMenuResep(filter?: {
    kategoriMakanan?: string;
    bentukMakanan?: string;
    aktifHanya?: boolean;
  }): Promise<readonly EntitasKatalogMenuResep[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.aktifHanya !== false) {
      klausa.push("aktif = 1");
    }
    if (filter?.kategoriMakanan) {
      klausa.push("kategori_makanan = ?");
      params.push(filter.kategoriMakanan);
    }
    if (filter?.bentukMakanan) {
      klausa.push("bentuk_makanan = ?");
      params.push(filter.bentukMakanan);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM katalog_menu_resep ${where} ORDER BY nama_menu ASC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisMenuResep(r));
  }

  public async ambilMenuResepBerdasarkanId(
    id: string,
  ): Promise<EntitasKatalogMenuResep | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM katalog_menu_resep WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisMenuResep(rows[0]);
  }

  public async simpanMenuResep(
    menu: EntitasKatalogMenuResep,
  ): Promise<EntitasKatalogMenuResep> {
    await this.pool.execute(
      `INSERT INTO katalog_menu_resep (
        id, kode_menu, nama_menu, kategori_makanan, bentuk_makanan, jenis_diet_terkait,
        energi_kkal, protein_gram, lemak_gram, karbohidrat_gram, komposisi_bahan,
        alergen, aktif, dibuat_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      parameterMysql([
        menu.id,
        menu.kodeMenu,
        menu.namaMenu,
        menu.kategoriMakanan,
        menu.bentukMakanan,
        menu.jenisDietTerkait,
        menu.energiKkal,
        menu.proteinGram,
        menu.lemakGram,
        menu.karbohidratGram,
        JSON.stringify(menu.komposisiBahan),
        JSON.stringify(menu.alergen),
        menu.aktif ? 1 : 0,
        menu.dibuatPada,
      ]),
    );
    return { ...menu };
  }

  public async simpanRencanaMenuIndividual(
    rencana: EntitasRencanaMenuIndividual,
  ): Promise<EntitasRencanaMenuIndividual> {
    await this.pool.execute(
      `INSERT INTO rencana_menu_individual (
        id, episode_id, pasien_id, nomor_rekam_medis, nama_pasien, asuhan_gizi_id,
        instruksi_diet_id, tanggal_pelayanan, jadwal_makan, menu_id, nama_menu,
        bentuk_makanan, porsi, energi_kkal, protein_gram, lemak_gram, karbohidrat_gram,
        status_kesesuaian, alasan_tidak_sesuai, status_pengesahan, disahkan_oleh,
        disahkan_pada, catatan_khusus, versi, dibuat_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status_pengesahan = VALUES(status_pengesahan),
        disahkan_oleh = VALUES(disahkan_oleh),
        disahkan_pada = VALUES(disahkan_pada),
        versi = versi + 1,
        diperbarui_pada = VALUES(diperbarui_pada)`,
      parameterMysql([
        rencana.id,
        rencana.episodeId,
        rencana.pasienId,
        rencana.nomorRekamMedis,
        rencana.namaPasien,
        rencana.asuhanGiziId,
        rencana.instruksiDietId,
        rencana.tanggalPelayanan,
        rencana.jadwalMakan,
        rencana.menuId,
        rencana.namaMenu,
        rencana.bentukMakanan,
        rencana.porsi,
        rencana.energiKkal,
        rencana.proteinGram,
        rencana.lemakGram,
        rencana.karbohidratGram,
        rencana.statusKesesuaian,
        rencana.alasanTidakSesuai,
        rencana.statusPengesahan,
        rencana.disahkanOleh,
        rencana.disahkanPada,
        rencana.catatanKhusus,
        rencana.versi,
        rencana.dibuatPada,
        rencana.diperbaruiPada,
      ]),
    );
    return { ...rencana };
  }

  public async ambilRencanaMenuIndividualBerdasarkanId(
    id: string,
  ): Promise<EntitasRencanaMenuIndividual | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM rencana_menu_individual WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (!rows || rows.length === 0) return null;
    return this.petakanBarisRencanaMenu(rows[0]);
  }

  public async ambilDaftarRencanaMenuIndividual(filter?: {
    episodeId?: string;
    pasienId?: string;
    tanggalPelayanan?: string;
    statusPengesahan?: string;
  }): Promise<readonly EntitasRencanaMenuIndividual[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.episodeId) {
      klausa.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    if (filter?.pasienId) {
      klausa.push("pasien_id = ?");
      params.push(filter.pasienId);
    }
    if (filter?.tanggalPelayanan) {
      klausa.push("tanggal_pelayanan = ?");
      params.push(filter.tanggalPelayanan);
    }
    if (filter?.statusPengesahan) {
      klausa.push("status_pengesahan = ?");
      params.push(filter.statusPengesahan);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM rencana_menu_individual ${where} ORDER BY tanggal_pelayanan ASC, jadwal_makan ASC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisRencanaMenu(r));
  }

  public async perbaruiStatusPengesahanMenu(
    id: string,
    status: string,
    disahkanOleh: string,
    disahkanPada: string,
  ): Promise<EntitasRencanaMenuIndividual> {
    await this.pool.execute(
      `UPDATE rencana_menu_individual
       SET status_pengesahan = ?, disahkan_oleh = ?, disahkan_pada = ?, versi = versi + 1, diperbarui_pada = NOW(3)
       WHERE id = ?`,
      parameterMysql([status, disahkanOleh, disahkanPada, id]),
    );
    const updated = await this.ambilRencanaMenuIndividualBerdasarkanId(id);
    if (!updated) {
      throw new Error(`Rencana menu individual ${id} tidak ditemukan.`);
    }
    return updated;
  }

  public async simpanEvaluasiAsuhanGizi(
    evaluasi: EntitasEvaluasiAsuhanGizi,
  ): Promise<EntitasEvaluasiAsuhanGizi> {
    await this.pool.execute(
      `INSERT INTO evaluasi_asuhan_gizi (
        id, asuhan_gizi_id, episode_id, pasien_id, ahli_gizi_id, ahli_gizi_nama,
        tanggal_evaluasi, evaluasi_antropometri, evaluasi_biokimia, evaluasi_asupan,
        persentase_pemenuhan_asupan, hambatan_asupan, keputusan_tindak_lanjut,
        rekomendasi_ke_dokter, dibuat_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        evaluasi.id,
        evaluasi.asuhanGiziId,
        evaluasi.episodeId,
        evaluasi.pasienId,
        evaluasi.ahliGiziId,
        evaluasi.ahliGiziNama,
        evaluasi.tanggalEvaluasi,
        evaluasi.evaluasiAntropometri,
        evaluasi.evaluasiBiokimia,
        evaluasi.evaluasiAsupan,
        evaluasi.persentasePemenuhanAsupan,
        evaluasi.hambatanAsupan,
        evaluasi.keputusanTindakLanjut,
        evaluasi.rekomendasiKeDokter,
        evaluasi.dibuatPada,
      ]),
    );
    return { ...evaluasi };
  }

  public async ambilDaftarEvaluasiAsuhanGizi(filter?: {
    asuhanGiziId?: string;
    episodeId?: string;
  }): Promise<readonly EntitasEvaluasiAsuhanGizi[]> {
    const klausa: string[] = [];
    const params: unknown[] = [];
    if (filter?.asuhanGiziId) {
      klausa.push("asuhan_gizi_id = ?");
      params.push(filter.asuhanGiziId);
    }
    if (filter?.episodeId) {
      klausa.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM evaluasi_asuhan_gizi ${where} ORDER BY tanggal_evaluasi DESC, dibuat_pada DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanBarisEvaluasi(r));
  }

  private petakanBarisAsuhanGizi(r: RowDataPacket): EntitasAsuhanGiziAdime {
    return {
      id: r.id,
      nomorAsuhan: r.nomor_asuhan,
      episodeId: r.episode_id,
      pasienId: r.pasien_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      bangsalId: r.bangsal_id,
      skriningId: r.skrining_id,
      ahliGiziId: r.ahli_gizi_id,
      ahliGiziNama: r.ahli_gizi_nama,
      antropometriBbKg: r.antropometri_bb_kg !== null ? Number(r.antropometri_bb_kg) : null,
      antropometriTbCm: r.antropometri_tb_cm !== null ? Number(r.antropometri_tb_cm) : null,
      antropometriImt: r.antropometri_imt !== null ? Number(r.antropometri_imt) : null,
      klasifikasiImt: r.klasifikasi_imt,
      biokimia: r.biokimia,
      klinisFisik: r.klinis_fisik,
      riwayatDiet: r.riwayat_diet,
      diagnosisGiziPes: r.diagnosis_gizi_pes,
      targetEnergiKkal: Number(r.target_energi_kkal),
      targetProteinGram: Number(r.target_protein_gram),
      targetLemakGram: Number(r.target_lemak_gram),
      targetKarbohidratGram: Number(r.target_karbohidrat_gram),
      targetCairanMl: r.target_cairan_ml !== null ? Number(r.target_cairan_ml) : null,
      targetSeratGram: r.target_serat_gram !== null ? Number(r.target_serat_gram) : null,
      targetNatriumMg: r.target_natrium_mg !== null ? Number(r.target_natrium_mg) : null,
      tujuanIntervensi: r.tujuan_intervensi,
      rencanaIntervensi: r.rencana_intervensi,
      rencanaMonitoringEvaluasi: r.rencana_monitoring_evaluasi,
      tanggalEvaluasiUlang:
        r.tanggal_evaluasi_ulang instanceof Date
          ? r.tanggal_evaluasi_ulang.toISOString().split("T")[0]
          : String(r.tanggal_evaluasi_ulang),
      statusAsuhan: r.status_asuhan,
      waktuBerlaku: waktuMysql(r.waktu_berlaku),
      versi: Number(r.versi),
      dibuatPada: waktuMysql(r.dibuat_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisMenuResep(r: RowDataPacket): EntitasKatalogMenuResep {
    return {
      id: r.id,
      kodeMenu: r.kode_menu,
      namaMenu: r.nama_menu,
      kategoriMakanan: r.kategori_makanan,
      bentukMakanan: r.bentuk_makanan,
      jenisDietTerkait: r.jenis_diet_terkait,
      energiKkal: Number(r.energi_kkal),
      proteinGram: Number(r.protein_gram),
      lemakGram: Number(r.lemak_gram),
      karbohidratGram: Number(r.karbohidrat_gram),
      komposisiBahan:
        typeof r.komposisi_bahan === "string"
          ? JSON.parse(r.komposisi_bahan)
          : r.komposisi_bahan ?? [],
      alergen:
        typeof r.alergen === "string" ? JSON.parse(r.alergen) : r.alergen ?? [],
      aktif: Boolean(r.aktif),
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  private petakanBarisRencanaMenu(
    r: RowDataPacket,
  ): EntitasRencanaMenuIndividual {
    return {
      id: r.id,
      episodeId: r.episode_id,
      pasienId: r.pasien_id,
      nomorRekamMedis: r.nomor_rekam_medis,
      namaPasien: r.nama_pasien,
      asuhanGiziId: r.asuhan_gizi_id,
      instruksiDietId: r.instruksi_diet_id,
      tanggalPelayanan:
        r.tanggal_pelayanan instanceof Date
          ? r.tanggal_pelayanan.toISOString().split("T")[0]
          : String(r.tanggal_pelayanan),
      jadwalMakan: r.jadwal_makan,
      menuId: r.menu_id,
      namaMenu: r.nama_menu,
      bentukMakanan: r.bentuk_makanan,
      porsi: Number(r.porsi),
      energiKkal: Number(r.energi_kkal),
      proteinGram: Number(r.protein_gram),
      lemakGram: Number(r.lemak_gram),
      karbohidratGram: Number(r.karbohidrat_gram),
      statusKesesuaian: r.status_kesesuaian,
      alasanTidakSesuai: r.alasan_tidak_sesuai,
      statusPengesahan: r.status_pengesahan,
      disahkanOleh: r.disahkan_oleh,
      disahkanPada: r.disahkan_pada ? waktuMysql(r.disahkan_pada) : null,
      catatanKhusus: r.catatan_khusus,
      versi: Number(r.versi),
      dibuatPada: waktuMysql(r.dibuat_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisEvaluasi(r: RowDataPacket): EntitasEvaluasiAsuhanGizi {
    return {
      id: r.id,
      asuhanGiziId: r.asuhan_gizi_id,
      episodeId: r.episode_id,
      pasienId: r.pasien_id,
      ahliGiziId: r.ahli_gizi_id,
      ahliGiziNama: r.ahli_gizi_nama,
      tanggalEvaluasi:
        r.tanggal_evaluasi instanceof Date
          ? r.tanggal_evaluasi.toISOString().split("T")[0]
          : String(r.tanggal_evaluasi),
      evaluasiAntropometri: r.evaluasi_antropometri,
      evaluasiBiokimia: r.evaluasi_biokimia,
      evaluasiAsupan: r.evaluasi_asupan,
      persentasePemenuhanAsupan:
        r.persentase_pemenuhan_asupan !== null
          ? Number(r.persentase_pemenuhan_asupan)
          : null,
      hambatanAsupan: r.hambatan_asupan,
      keputusanTindakLanjut: r.keputusan_tindak_lanjut,
      rekomendasiKeDokter: r.rekomendasi_ke_dokter,
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }
}
