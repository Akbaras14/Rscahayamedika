import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Repositori data untuk Layanan Distribusi & Handover Makanan (Tahap 9).
 * Menyediakan implementasi InMemory (dengan seed) dan implementasi MySQL terparameterisasi.
 */

import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  JenisInsidenDistribusi,
  RingkasanDistribusiOverviewDto,
  SesiMakanDapur,
  StatusSerahPorsi,
  StatusTroliDistribusi,
} from "../../../../packages/shared-types/src/index.ts";
import {
  BENIH_INSIDEN_SINTETIS,
  BENIH_ITEM_PORSI_SINTETIS,
  BENIH_TROLI_SINTETIS,
} from "../database/seeds/delivery.seed.ts";
import type {
  ItemPorsiDistribusiEntitas,
  LaporanInsidenEntitas,
  RiwayatPenyerahanEntitas,
  TroliDistribusiEntitas,
  VerifikasiDuaIdentitasEntitas,
} from "../model/delivery.model.ts";

export type NilaiParamSql = string | number | boolean | null;

export interface DeliveryRepository {
  // Troli Distribusi
  hitungNomorTroliBerikutnya(tanggal: string): Promise<string>;
  simpanTroli(troli: TroliDistribusiEntitas): Promise<TroliDistribusiEntitas>;
  ambilTroliBerdasarkanId(id: string): Promise<TroliDistribusiEntitas | null>;
  ambilDaftarTroli(filter?: {
    bangsalId?: string;
    sesi?: SesiMakanDapur;
    status?: StatusTroliDistribusi;
    tanggal?: string;
  }): Promise<TroliDistribusiEntitas[]>;
  perbaruiTroli(
    id: string,
    perubahan: Partial<TroliDistribusiEntitas>,
  ): Promise<TroliDistribusiEntitas>;

  // Item Porsi Distribusi
  simpanItemPorsi(item: ItemPorsiDistribusiEntitas): Promise<ItemPorsiDistribusiEntitas>;
  ambilItemPorsiBerdasarkanId(id: string): Promise<ItemPorsiDistribusiEntitas | null>;
  ambilItemPorsiBerdasarkanLabelId(labelPorsiId: string): Promise<ItemPorsiDistribusiEntitas | null>;
  ambilDaftarItemPorsi(filter?: {
    troliId?: string;
    bangsalId?: string;
    statusSerah?: StatusSerahPorsi;
    nomorRm?: string;
  }): Promise<ItemPorsiDistribusiEntitas[]>;
  perbaruiItemPorsi(
    id: string,
    perubahan: Partial<ItemPorsiDistribusiEntitas>,
  ): Promise<ItemPorsiDistribusiEntitas>;

  // Verifikasi 2 Identitas & Riwayat Serah
  simpanVerifikasiDuaIdentitas(verifikasi: VerifikasiDuaIdentitasEntitas): Promise<VerifikasiDuaIdentitasEntitas>;
  ambilVerifikasiBerdasarkanPorsiId(porsiId: string): Promise<VerifikasiDuaIdentitasEntitas[]>;
  simpanRiwayatPenyerahan(riwayat: RiwayatPenyerahanEntitas): Promise<RiwayatPenyerahanEntitas>;
  ambilRiwayatPenyerahanBerdasarkanPorsiId(porsiId: string): Promise<RiwayatPenyerahanEntitas[]>;

  // Laporan Insiden Pengantaran
  hitungNomorInsidenBerikutnya(): Promise<string>;
  simpanLaporanInsiden(insiden: LaporanInsidenEntitas): Promise<LaporanInsidenEntitas>;
  ambilDaftarLaporanInsiden(filter?: {
    bangsalId?: string;
    jenis?: JenisInsidenDistribusi;
    status?: "terbuka" | "ditindaklanjuti" | "selesai";
  }): Promise<LaporanInsidenEntitas[]>;

  // Overview Dashboard
  ambilRingkasanOverview(bangsalIds?: readonly string[]): Promise<RingkasanDistribusiOverviewDto>;
}

export class InMemoryDeliveryRepository implements DeliveryRepository {
  private daftarTroli: TroliDistribusiEntitas[] = [];
  private daftarItemPorsi: ItemPorsiDistribusiEntitas[] = [];
  private daftarVerifikasi: VerifikasiDuaIdentitasEntitas[] = [];
  private daftarRiwayat: RiwayatPenyerahanEntitas[] = [];
  private daftarInsiden: LaporanInsidenEntitas[] = [];

  public constructor() {
    this.daftarTroli = JSON.parse(JSON.stringify(BENIH_TROLI_SINTETIS)) as TroliDistribusiEntitas[];
    this.daftarItemPorsi = JSON.parse(JSON.stringify(BENIH_ITEM_PORSI_SINTETIS)) as ItemPorsiDistribusiEntitas[];
    this.daftarInsiden = JSON.parse(JSON.stringify(BENIH_INSIDEN_SINTETIS)) as LaporanInsidenEntitas[];
  }

  public async hitungNomorTroliBerikutnya(tanggal: string): Promise<string> {
    const tanggalBersih = tanggal.replace(/-/g, "");
    const urutan = (this.daftarTroli.length + 1).toString().padStart(3, "0");
    return `TRL-${tanggalBersih}-${urutan}`;
  }

  public async simpanTroli(troli: TroliDistribusiEntitas): Promise<TroliDistribusiEntitas> {
    this.daftarTroli.push(troli);
    return troli;
  }

  public async ambilTroliBerdasarkanId(id: string): Promise<TroliDistribusiEntitas | null> {
    const ketemu = this.daftarTroli.find((t) => t.id === id);
    return ketemu ? { ...ketemu } : null;
  }

  public async ambilDaftarTroli(filter?: {
    bangsalId?: string;
    sesi?: SesiMakanDapur;
    status?: StatusTroliDistribusi;
    tanggal?: string;
  }): Promise<TroliDistribusiEntitas[]> {
    return this.daftarTroli.filter((t) => {
      if (filter?.bangsalId && t.bangsalId !== filter.bangsalId) return false;
      if (filter?.sesi && t.sesiMakan !== filter.sesi) return false;
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.tanggal && t.tanggalDistribusi !== filter.tanggal) return false;
      return true;
    });
  }

  public async perbaruiTroli(
    id: string,
    perubahan: Partial<TroliDistribusiEntitas>,
  ): Promise<TroliDistribusiEntitas> {
    const idx = this.daftarTroli.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Troli dengan ID ${id} tidak ditemukan.`);
    }
    const terupdate: TroliDistribusiEntitas = {
      ...this.daftarTroli[idx],
      ...perubahan,
      updatedAt: new Date().toISOString(),
    };
    this.daftarTroli[idx] = terupdate;
    return terupdate;
  }

  public async simpanItemPorsi(item: ItemPorsiDistribusiEntitas): Promise<ItemPorsiDistribusiEntitas> {
    this.daftarItemPorsi.push(item);
    return item;
  }

  public async ambilItemPorsiBerdasarkanId(id: string): Promise<ItemPorsiDistribusiEntitas | null> {
    const ketemu = this.daftarItemPorsi.find((p) => p.id === id);
    return ketemu ? { ...ketemu } : null;
  }

  public async ambilItemPorsiBerdasarkanLabelId(labelPorsiId: string): Promise<ItemPorsiDistribusiEntitas | null> {
    const ketemu = this.daftarItemPorsi.find((p) => p.labelPorsiId === labelPorsiId);
    return ketemu ? { ...ketemu } : null;
  }

  public async ambilDaftarItemPorsi(filter?: {
    troliId?: string;
    bangsalId?: string;
    statusSerah?: StatusSerahPorsi;
    nomorRm?: string;
  }): Promise<ItemPorsiDistribusiEntitas[]> {
    return this.daftarItemPorsi.filter((p) => {
      if (filter?.troliId && p.troliId !== filter.troliId) return false;
      if (filter?.bangsalId && p.bangsalId !== filter.bangsalId) return false;
      if (filter?.statusSerah && p.statusSerah !== filter.statusSerah) return false;
      if (filter?.nomorRm && p.nomorRm !== filter.nomorRm) return false;
      return true;
    });
  }

  public async perbaruiItemPorsi(
    id: string,
    perubahan: Partial<ItemPorsiDistribusiEntitas>,
  ): Promise<ItemPorsiDistribusiEntitas> {
    const idx = this.daftarItemPorsi.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Item porsi dengan ID ${id} tidak ditemukan.`);
    }
    const terupdate: ItemPorsiDistribusiEntitas = {
      ...this.daftarItemPorsi[idx],
      ...perubahan,
      updatedAt: new Date().toISOString(),
    };
    this.daftarItemPorsi[idx] = terupdate;
    return terupdate;
  }

  public async simpanVerifikasiDuaIdentitas(verifikasi: VerifikasiDuaIdentitasEntitas): Promise<VerifikasiDuaIdentitasEntitas> {
    this.daftarVerifikasi.push(verifikasi);
    return verifikasi;
  }

  public async ambilVerifikasiBerdasarkanPorsiId(porsiId: string): Promise<VerifikasiDuaIdentitasEntitas[]> {
    return this.daftarVerifikasi.filter((v) => v.itemPorsiDistribusiId === porsiId);
  }

  public async simpanRiwayatPenyerahan(riwayat: RiwayatPenyerahanEntitas): Promise<RiwayatPenyerahanEntitas> {
    this.daftarRiwayat.push(riwayat);
    return riwayat;
  }

  public async ambilRiwayatPenyerahanBerdasarkanPorsiId(porsiId: string): Promise<RiwayatPenyerahanEntitas[]> {
    return this.daftarRiwayat.filter((r) => r.itemPorsiDistribusiId === porsiId);
  }

  public async hitungNomorInsidenBerikutnya(): Promise<string> {
    const urutan = (this.daftarInsiden.length + 1).toString().padStart(3, "0");
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `INS-${tgl}-${urutan}`;
  }

  public async simpanLaporanInsiden(insiden: LaporanInsidenEntitas): Promise<LaporanInsidenEntitas> {
    this.daftarInsiden.push(insiden);
    return insiden;
  }

  public async ambilDaftarLaporanInsiden(filter?: {
    bangsalId?: string;
    jenis?: JenisInsidenDistribusi;
    status?: "terbuka" | "ditindaklanjuti" | "selesai";
  }): Promise<LaporanInsidenEntitas[]> {
    return this.daftarInsiden.filter((i) => {
      if (filter?.bangsalId && i.bangsalId !== filter.bangsalId) return false;
      if (filter?.jenis && i.jenisInsiden !== filter.jenis) return false;
      if (filter?.status && i.statusPenyelesaian !== filter.status) return false;
      return true;
    });
  }

  public async ambilRingkasanOverview(bangsalIds?: readonly string[]): Promise<RingkasanDistribusiOverviewDto> {
    let porsi = this.daftarItemPorsi;
    let troli = this.daftarTroli;
    let insiden = this.daftarInsiden;

    if (bangsalIds && bangsalIds.length > 0) {
      porsi = porsi.filter((p) => bangsalIds.includes(p.bangsalId));
      troli = troli.filter((t) => bangsalIds.includes(t.bangsalId));
      insiden = insiden.filter((i) => bangsalIds.includes(i.bangsalId));
    }

    return {
      totalTroliAktif: troli.filter((t) => t.status === "dalam_perjalanan" || t.status === "persiapan").length,
      totalPorsiSiapKirim: porsi.filter((p) => p.statusSerah === "menunggu_pengiriman" || p.statusSerah === "dalam_troli").length,
      totalPorsiBerhasilDiserahkan: porsi.filter((p) => p.statusSerah === "berhasil_diserahkan").length,
      totalPorsiDitahanKlinis: porsi.filter((p) => p.statusSerah === "ditahan_klinis").length,
      totalInsidenAktif: insiden.filter((i) => i.statusPenyelesaian !== "selesai").length,
    };
  }
}

export class MySqlDeliveryRepository implements DeliveryRepository {
  private readonly pool: Pool;

  public constructor(pool: Pool) {
    this.pool = pool;
  }

  public async hitungNomorTroliBerikutnya(tanggal: string): Promise<string> {
    const tanggalBersih = tanggal.replace(/-/g, "");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM troli_distribusi_bangsal WHERE tanggal_distribusi = ?`,
      parameterMysql([tanggal]),
    );
    const total = Number(rows[0]?.total ?? 0);
    const urutan = (total + 1).toString().padStart(3, "0");
    return `TRL-${tanggalBersih}-${urutan}`;
  }

  public async simpanTroli(troli: TroliDistribusiEntitas): Promise<TroliDistribusiEntitas> {
    await this.pool.query(
      `INSERT INTO troli_distribusi_bangsal (
        id, nomor_troli, bangsal_id, nama_bangsal, sesi_makan,
        tanggal_distribusi, petugas_distribusi_id, petugas_distribusi_nama,
        status, total_porsi, total_terserah, total_ditahan,
        waktu_berangkat, waktu_kembali, catatan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        troli.id,
        troli.nomorTroli,
        troli.bangsalId,
        troli.namaBangsal,
        troli.sesiMakan,
        troli.tanggalDistribusi,
        troli.petugasDistribusiId,
        troli.petugasDistribusiNama,
        troli.status,
        troli.totalPorsi,
        troli.totalTerserah,
        troli.totalDitahan,
        troli.waktuBerangkat,
        troli.waktuKembali,
        troli.catatan,
        troli.createdAt,
        troli.updatedAt,
      ]),
    );
    return troli;
  }

  public async ambilTroliBerdasarkanId(id: string): Promise<TroliDistribusiEntitas | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM troli_distribusi_bangsal WHERE id = ?`,
      parameterMysql([id]),
    );
    if (!rows[0]) return null;
    return this.petakanTroli(rows[0]);
  }

  public async ambilDaftarTroli(filter?: {
    bangsalId?: string;
    sesi?: SesiMakanDapur;
    status?: StatusTroliDistribusi;
    tanggal?: string;
  }): Promise<TroliDistribusiEntitas[]> {
    const klausa: string[] = [];
    const params: NilaiParamSql[] = [];

    if (filter?.bangsalId) {
      klausa.push(`bangsal_id = ?`);
      params.push(filter.bangsalId);
    }
    if (filter?.sesi) {
      klausa.push(`sesi_makan = ?`);
      params.push(filter.sesi);
    }
    if (filter?.status) {
      klausa.push(`status = ?`);
      params.push(filter.status);
    }
    if (filter?.tanggal) {
      klausa.push(`tanggal_distribusi = ?`);
      params.push(filter.tanggal);
    }

    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM troli_distribusi_bangsal ${where} ORDER BY created_at DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanTroli(r));
  }

  public async perbaruiTroli(
    id: string,
    perubahan: Partial<TroliDistribusiEntitas>,
  ): Promise<TroliDistribusiEntitas> {
    const setBagian: string[] = [];
    const params: NilaiParamSql[] = [];

    if (perubahan.status !== undefined) {
      setBagian.push(`status = ?`);
      params.push(perubahan.status);
    }
    if (perubahan.totalPorsi !== undefined) {
      setBagian.push(`total_porsi = ?`);
      params.push(perubahan.totalPorsi);
    }
    if (perubahan.totalTerserah !== undefined) {
      setBagian.push(`total_terserah = ?`);
      params.push(perubahan.totalTerserah);
    }
    if (perubahan.totalDitahan !== undefined) {
      setBagian.push(`total_ditahan = ?`);
      params.push(perubahan.totalDitahan);
    }
    if (perubahan.waktuBerangkat !== undefined) {
      setBagian.push(`waktu_berangkat = ?`);
      params.push(perubahan.waktuBerangkat);
    }
    if (perubahan.waktuKembali !== undefined) {
      setBagian.push(`waktu_kembali = ?`);
      params.push(perubahan.waktuKembali);
    }
    if (perubahan.catatan !== undefined) {
      setBagian.push(`catatan = ?`);
      params.push(perubahan.catatan);
    }

    setBagian.push(`updated_at = NOW()`);
    params.push(id);

    await this.pool.query(
      `UPDATE troli_distribusi_bangsal SET ${setBagian.join(", ")} WHERE id = ?`,
      parameterMysql(params),
    );

    const terupdate = await this.ambilTroliBerdasarkanId(id);
    if (!terupdate) throw new Error(`Troli ${id} tidak ditemukan.`);
    return terupdate;
  }

  public async simpanItemPorsi(item: ItemPorsiDistribusiEntitas): Promise<ItemPorsiDistribusiEntitas> {
    await this.pool.query(
      `INSERT INTO item_porsi_distribusi (
        id, troli_id, nomor_troli, label_porsi_id, nomor_label,
        nomor_pesanan, pasien_id, nama_pasien, nomor_rm, tanggal_lahir_pasien,
        bangsal_id, nama_bangsal, kamar_bed, sesi_makan, nama_menu,
        jenis_diet_label, diet_terkini_pasien, status_kesesuaian_diet,
        status_serah, waktu_serah, nama_penerima, hubungan_penerima,
        alasan_gagal_atau_tahan, dua_identitas_terverifikasi, petugas_distribusi_nama,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        item.id,
        item.troliId,
        item.nomorTroli,
        item.labelPorsiId,
        item.nomorLabel,
        item.nomorPesanan,
        item.pasienId,
        item.namaPasien,
        item.nomorRm,
        item.tanggalLahirPasien,
        item.bangsalId,
        item.namaBangsal,
        item.kamarBed,
        item.sesiMakan,
        item.namaMenu,
        item.jenisDietLabel,
        item.dietTerkiniPasien,
        item.statusKesesuaianDiet,
        item.statusSerah,
        item.waktuSerah,
        item.namaPenerima,
        item.hubunganPenerima,
        item.alasanGagalAtauTahan,
        item.duaIdentitasTerverifikasi ? 1 : 0,
        item.petugasDistribusiNama,
        item.createdAt,
        item.updatedAt,
      ]),
    );
    return item;
  }

  public async ambilItemPorsiBerdasarkanId(id: string): Promise<ItemPorsiDistribusiEntitas | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM item_porsi_distribusi WHERE id = ?`,
      parameterMysql([id]),
    );
    if (!rows[0]) return null;
    return this.petakanItemPorsi(rows[0]);
  }

  public async ambilItemPorsiBerdasarkanLabelId(labelPorsiId: string): Promise<ItemPorsiDistribusiEntitas | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM item_porsi_distribusi WHERE label_porsi_id = ?`,
      parameterMysql([labelPorsiId]),
    );
    if (!rows[0]) return null;
    return this.petakanItemPorsi(rows[0]);
  }

  public async ambilDaftarItemPorsi(filter?: {
    troliId?: string;
    bangsalId?: string;
    statusSerah?: StatusSerahPorsi;
    nomorRm?: string;
  }): Promise<ItemPorsiDistribusiEntitas[]> {
    const klausa: string[] = [];
    const params: NilaiParamSql[] = [];

    if (filter?.troliId) {
      klausa.push(`troli_id = ?`);
      params.push(filter.troliId);
    }
    if (filter?.bangsalId) {
      klausa.push(`bangsal_id = ?`);
      params.push(filter.bangsalId);
    }
    if (filter?.statusSerah) {
      klausa.push(`status_serah = ?`);
      params.push(filter.statusSerah);
    }
    if (filter?.nomorRm) {
      klausa.push(`nomor_rm = ?`);
      params.push(filter.nomorRm);
    }

    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM item_porsi_distribusi ${where} ORDER BY kamar_bed ASC`,
      parameterMysql(params),
    );
    return rows.map((r) => this.petakanItemPorsi(r));
  }

  public async perbaruiItemPorsi(
    id: string,
    perubahan: Partial<ItemPorsiDistribusiEntitas>,
  ): Promise<ItemPorsiDistribusiEntitas> {
    const setBagian: string[] = [];
    const params: NilaiParamSql[] = [];

    if (perubahan.troliId !== undefined) {
      setBagian.push(`troli_id = ?`);
      params.push(perubahan.troliId);
    }
    if (perubahan.nomorTroli !== undefined) {
      setBagian.push(`nomor_troli = ?`);
      params.push(perubahan.nomorTroli);
    }
    if (perubahan.dietTerkiniPasien !== undefined) {
      setBagian.push(`diet_terkini_pasien = ?`);
      params.push(perubahan.dietTerkiniPasien);
    }
    if (perubahan.statusKesesuaianDiet !== undefined) {
      setBagian.push(`status_kesesuaian_diet = ?`);
      params.push(perubahan.statusKesesuaianDiet);
    }
    if (perubahan.statusSerah !== undefined) {
      setBagian.push(`status_serah = ?`);
      params.push(perubahan.statusSerah);
    }
    if (perubahan.waktuSerah !== undefined) {
      setBagian.push(`waktu_serah = ?`);
      params.push(perubahan.waktuSerah);
    }
    if (perubahan.namaPenerima !== undefined) {
      setBagian.push(`nama_penerima = ?`);
      params.push(perubahan.namaPenerima);
    }
    if (perubahan.hubunganPenerima !== undefined) {
      setBagian.push(`hubungan_penerima = ?`);
      params.push(perubahan.hubunganPenerima);
    }
    if (perubahan.alasanGagalAtauTahan !== undefined) {
      setBagian.push(`alasan_gagal_atau_tahan = ?`);
      params.push(perubahan.alasanGagalAtauTahan);
    }
    if (perubahan.duaIdentitasTerverifikasi !== undefined) {
      setBagian.push(`dua_identitas_terverifikasi = ?`);
      params.push(perubahan.duaIdentitasTerverifikasi ? 1 : 0);
    }
    if (perubahan.petugasDistribusiNama !== undefined) {
      setBagian.push(`petugas_distribusi_nama = ?`);
      params.push(perubahan.petugasDistribusiNama);
    }

    setBagian.push(`updated_at = NOW()`);
    params.push(id);

    await this.pool.query(
      `UPDATE item_porsi_distribusi SET ${setBagian.join(", ")} WHERE id = ?`,
      parameterMysql(params),
    );

    const terupdate = await this.ambilItemPorsiBerdasarkanId(id);
    if (!terupdate) throw new Error(`Item porsi ${id} tidak ditemukan.`);
    return terupdate;
  }

  public async simpanVerifikasiDuaIdentitas(verifikasi: VerifikasiDuaIdentitasEntitas): Promise<VerifikasiDuaIdentitasEntitas> {
    await this.pool.query(
      `INSERT INTO verifikasi_dua_identitas_serah (
        id, item_porsi_distribusi_id, nama_pasien_diinput, tanggal_lahir_diinput,
        nomor_rm_diinput, metode_verifikasi, status_cocok, verifikator_id,
        verifikator_nama, catatan_verifikasi, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        verifikasi.id,
        verifikasi.itemPorsiDistribusiId,
        verifikasi.namaPasienDiinput,
        verifikasi.tanggalLahirDiinput,
        verifikasi.nomorRmDiinput,
        verifikasi.metodeVerifikasi,
        verifikasi.statusCocok ? 1 : 0,
        verifikasi.verifikatorId,
        verifikasi.verifikatorNama,
        verifikasi.catatanVerifikasi,
        verifikasi.createdAt,
      ]),
    );
    return verifikasi;
  }

  public async ambilVerifikasiBerdasarkanPorsiId(porsiId: string): Promise<VerifikasiDuaIdentitasEntitas[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM verifikasi_dua_identitas_serah WHERE item_porsi_distribusi_id = ? ORDER BY created_at DESC`,
      parameterMysql([porsiId]),
    );
    return rows.map((r) => ({
      id: String(r.id),
      itemPorsiDistribusiId: String(r.item_porsi_distribusi_id),
      namaPasienDiinput: String(r.nama_pasien_diinput),
      tanggalLahirDiinput: String(r.tanggal_lahir_diinput).slice(0, 10),
      nomorRmDiinput: String(r.nomor_rm_diinput),
      metodeVerifikasi: r.metode_verifikasi,
      statusCocok: Boolean(r.status_cocok),
      verifikatorId: String(r.verifikator_id),
      verifikatorNama: String(r.verifikator_nama),
      catatanVerifikasi: String(r.catatan_verifikasi),
      createdAt: waktuMysql(r.created_at),
    }));
  }

  public async simpanRiwayatPenyerahan(riwayat: RiwayatPenyerahanEntitas): Promise<RiwayatPenyerahanEntitas> {
    await this.pool.query(
      `INSERT INTO riwayat_penyerahan_makanan (
        id, item_porsi_distribusi_id, troli_id, status_sebelumnya,
        status_sesudahnya, nama_penerima, hubungan_penerima,
        petugas_id, petugas_nama, waktu_transisi, keterangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        riwayat.id,
        riwayat.itemPorsiDistribusiId,
        riwayat.troliId,
        riwayat.statusSebelumnya,
        riwayat.statusSesudahnya,
        riwayat.namaPenerima,
        riwayat.hubunganPenerima,
        riwayat.petugasId,
        riwayat.petugasNama,
        riwayat.waktuTransisi,
        riwayat.keterangan,
      ]),
    );
    return riwayat;
  }

  public async ambilRiwayatPenyerahanBerdasarkanPorsiId(porsiId: string): Promise<RiwayatPenyerahanEntitas[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM riwayat_penyerahan_makanan WHERE item_porsi_distribusi_id = ? ORDER BY waktu_transisi DESC`,
      parameterMysql([porsiId]),
    );
    return rows.map((r) => ({
      id: String(r.id),
      itemPorsiDistribusiId: String(r.item_porsi_distribusi_id),
      troliId: r.troli_id ? String(r.troli_id) : null,
      statusSebelumnya: String(r.status_sebelumnya),
      statusSesudahnya: String(r.status_sesudahnya),
      namaPenerima: String(r.nama_penerima),
      hubunganPenerima: String(r.hubungan_penerima),
      petugasId: String(r.petugas_id),
      petugasNama: String(r.petugas_nama),
      waktuTransisi: waktuMysql(r.waktu_transisi),
      keterangan: String(r.keterangan),
    }));
  }

  public async hitungNomorInsidenBerikutnya(): Promise<string> {
    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM laporan_insiden_distribusi`,
    );
    const total = Number(rows[0]?.total ?? 0);
    const urutan = (total + 1).toString().padStart(3, "0");
    return `INS-${tgl}-${urutan}`;
  }

  public async simpanLaporanInsiden(insiden: LaporanInsidenEntitas): Promise<LaporanInsidenEntitas> {
    await this.pool.query(
      `INSERT INTO laporan_insiden_distribusi (
        id, nomor_insiden, troli_id, porsi_distribusi_id, bangsal_id,
        nama_bangsal, jenis_insiden, deskripsi_insiden, tindakan_koreksi,
        dilaporkan_oleh_id, dilaporkan_oleh_nama, waktu_kejadian,
        status_penyelesaian, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        insiden.id,
        insiden.nomorInsiden,
        insiden.troliId,
        insiden.porsiDistribusiId,
        insiden.bangsalId,
        insiden.namaBangsal,
        insiden.jenisInsiden,
        insiden.deskripsiInsiden,
        insiden.tindakanKoreksi,
        insiden.dilaporkanOlehId,
        insiden.dilaporkanOlehNama,
        insiden.waktuKejadian,
        insiden.statusPenyelesaian,
        insiden.createdAt,
        insiden.updatedAt,
      ]),
    );
    return insiden;
  }

  public async ambilDaftarLaporanInsiden(filter?: {
    bangsalId?: string;
    jenis?: JenisInsidenDistribusi;
    status?: "terbuka" | "ditindaklanjuti" | "selesai";
  }): Promise<LaporanInsidenEntitas[]> {
    const klausa: string[] = [];
    const params: NilaiParamSql[] = [];

    if (filter?.bangsalId) {
      klausa.push(`bangsal_id = ?`);
      params.push(filter.bangsalId);
    }
    if (filter?.jenis) {
      klausa.push(`jenis_insiden = ?`);
      params.push(filter.jenis);
    }
    if (filter?.status) {
      klausa.push(`status_penyelesaian = ?`);
      params.push(filter.status);
    }

    const where = klausa.length > 0 ? `WHERE ${klausa.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM laporan_insiden_distribusi ${where} ORDER BY created_at DESC`,
      parameterMysql(params),
    );
    return rows.map((r) => ({
      id: String(r.id),
      nomorInsiden: String(r.nomor_insiden),
      troliId: r.troli_id ? String(r.troli_id) : null,
      porsiDistribusiId: r.porsi_distribusi_id ? String(r.porsi_distribusi_id) : null,
      bangsalId: String(r.bangsal_id),
      namaBangsal: String(r.nama_bangsal),
      jenisInsiden: r.jenis_insiden,
      deskripsiInsiden: String(r.deskripsi_insiden),
      tindakanKoreksi: String(r.tindakan_koreksi),
      dilaporkanOlehId: String(r.dilaporkan_oleh_id),
      dilaporkanOlehNama: String(r.dilaporkan_oleh_nama),
      waktuKejadian: waktuMysql(r.waktu_kejadian),
      statusPenyelesaian: r.status_penyelesaian,
      createdAt: waktuMysql(r.created_at),
      updatedAt: waktuMysql(r.updated_at),
    }));
  }

  public async ambilRingkasanOverview(bangsalIds?: readonly string[]): Promise<RingkasanDistribusiOverviewDto> {
    const troliWhere = bangsalIds && bangsalIds.length > 0 ? `WHERE bangsal_id IN (?)` : "";
    const porsiWhere = bangsalIds && bangsalIds.length > 0 ? `WHERE bangsal_id IN (?)` : "";
    const insidenWhere = bangsalIds && bangsalIds.length > 0 ? `WHERE bangsal_id IN (?)` : "";

    const [troliRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(CASE WHEN status IN ('persiapan', 'dalam_perjalanan') THEN 1 END) AS total_troli_aktif
       FROM troli_distribusi_bangsal ${troliWhere}`,
      parameterMysql(bangsalIds && bangsalIds.length > 0 ? [bangsalIds] : []),
    );

    const [porsiRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(CASE WHEN status_serah IN ('menunggu_pengiriman', 'dalam_troli') THEN 1 END) AS siap_kirim,
        COUNT(CASE WHEN status_serah = 'berhasil_diserahkan' THEN 1 END) AS berhasil_diserahkan,
        COUNT(CASE WHEN status_serah = 'ditahan_klinis' THEN 1 END) AS ditahan_klinis
       FROM item_porsi_distribusi ${porsiWhere}`,
      parameterMysql(bangsalIds && bangsalIds.length > 0 ? [bangsalIds] : []),
    );

    const [insidenRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(CASE WHEN status_penyelesaian != 'selesai' THEN 1 END) AS total_insiden_aktif
       FROM laporan_insiden_distribusi ${insidenWhere}`,
      parameterMysql(bangsalIds && bangsalIds.length > 0 ? [bangsalIds] : []),
    );

    return {
      totalTroliAktif: Number(troliRows[0]?.total_troli_aktif ?? 0),
      totalPorsiSiapKirim: Number(porsiRows[0]?.siap_kirim ?? 0),
      totalPorsiBerhasilDiserahkan: Number(porsiRows[0]?.berhasil_diserahkan ?? 0),
      totalPorsiDitahanKlinis: Number(porsiRows[0]?.ditahan_klinis ?? 0),
      totalInsidenAktif: Number(insidenRows[0]?.total_insiden_aktif ?? 0),
    };
  }

  private petakanTroli(r: RowDataPacket): TroliDistribusiEntitas {
    return {
      id: String(r.id),
      nomorTroli: String(r.nomor_troli),
      bangsalId: String(r.bangsal_id),
      namaBangsal: String(r.nama_bangsal),
      sesiMakan: r.sesi_makan,
      tanggalDistribusi: String(r.tanggal_distribusi).slice(0, 10),
      petugasDistribusiId: String(r.petugas_distribusi_id),
      petugasDistribusiNama: String(r.petugas_distribusi_nama),
      status: r.status,
      totalPorsi: Number(r.total_porsi),
      totalTerserah: Number(r.total_terserah),
      totalDitahan: Number(r.total_ditahan),
      waktuBerangkat: r.waktu_berangkat ? waktuMysql(r.waktu_berangkat) : null,
      waktuKembali: r.waktu_kembali ? waktuMysql(r.waktu_kembali) : null,
      catatan: String(r.catatan),
      createdAt: waktuMysql(r.created_at),
      updatedAt: waktuMysql(r.updated_at),
    };
  }

  private petakanItemPorsi(r: RowDataPacket): ItemPorsiDistribusiEntitas {
    return {
      id: String(r.id),
      troliId: r.troli_id ? String(r.troli_id) : null,
      nomorTroli: r.nomor_troli ? String(r.nomor_troli) : null,
      labelPorsiId: String(r.label_porsi_id),
      nomorLabel: String(r.nomor_label),
      nomorPesanan: String(r.nomor_pesanan),
      pasienId: String(r.pasien_id),
      namaPasien: String(r.nama_pasien),
      nomorRm: String(r.nomor_rm),
      tanggalLahirPasien: String(r.tanggal_lahir_pasien).slice(0, 10),
      bangsalId: String(r.bangsal_id),
      namaBangsal: String(r.nama_bangsal),
      kamarBed: String(r.kamar_bed),
      sesiMakan: r.sesi_makan,
      namaMenu: String(r.nama_menu),
      jenisDietLabel: String(r.jenis_diet_label),
      dietTerkiniPasien: String(r.diet_terkini_pasien),
      statusKesesuaianDiet: r.status_kesesuaian_diet,
      statusSerah: r.status_serah,
      waktuSerah: r.waktu_serah ? waktuMysql(r.waktu_serah) : null,
      namaPenerima: r.nama_penerima ? String(r.nama_penerima) : null,
      hubunganPenerima: r.hubungan_penerima ?? null,
      alasanGagalAtauTahan: r.alasan_gagal_atau_tahan ? String(r.alasan_gagal_atau_tahan) : null,
      duaIdentitasTerverifikasi: Boolean(r.dua_identitas_terverifikasi),
      petugasDistribusiNama: r.petugas_distribusi_nama ? String(r.petugas_distribusi_nama) : null,
      createdAt: waktuMysql(r.created_at),
      updatedAt: waktuMysql(r.updated_at),
    };
  }
}

