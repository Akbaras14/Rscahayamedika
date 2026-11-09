import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Repositori data untuk Layanan Dapur & Pengendalian Makanan (Tahap 8).
 * Menyediakan implementasi InMemory (dengan seed) dan implementasi MySQL terparameterisasi.
 */

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  SesiMakanDapur,
  StatusBatchProduksi,
  StatusPorsiPasien,
  StatusRencanaProduksi,
} from "../../../../packages/shared-types/src/index.ts";
import {
  BENIH_BATCH_PRODUKSI,
  BENIH_LABEL_PORSI,
  BENIH_PEMERIKSAAN_MUTU,
  BENIH_PENGGUNAAN_LOT,
  BENIH_RENCANA_PRODUKSI,
} from "../database/seeds/kitchen.seed.ts";
import type {
  EntitasBatchProduksi,
  EntitasLabelPorsi,
  EntitasPemeriksaanMutu,
  EntitasPenggunaanLotBahan,
  EntitasRencanaProduksi,
} from "../model/kitchen.model.ts";

export interface KitchenRepository {
  transaksi?<T>(kerja: (repo: KitchenRepository) => Promise<T>): Promise<T>;
  // Rencana Produksi H-1
  hitungNomorRencanaBerikutnya(): Promise<string>;
  simpanRencanaProduksi(rencana: EntitasRencanaProduksi): Promise<EntitasRencanaProduksi>;
  ambilRencanaProduksiBerdasarkanId(id: string): Promise<EntitasRencanaProduksi | null>;
  ambilDaftarRencanaProduksi(filter?: {
    tanggal?: string;
    sesi?: SesiMakanDapur;
    status?: StatusRencanaProduksi;
  }): Promise<EntitasRencanaProduksi[]>;
  perbaruiRencanaProduksi(
    id: string,
    perubahan: Partial<EntitasRencanaProduksi>,
  ): Promise<EntitasRencanaProduksi>;

  // Batch Memasak
  hitungNomorBatchBerikutnya(sesi: SesiMakanDapur): Promise<string>;
  simpanBatchProduksi(batch: EntitasBatchProduksi): Promise<EntitasBatchProduksi>;
  ambilBatchProduksiBerdasarkanId(id: string): Promise<EntitasBatchProduksi | null>;
  ambilDaftarBatchProduksi(filter?: {
    rencanaProduksiId?: string;
    sesi?: SesiMakanDapur;
    status?: StatusBatchProduksi;
  }): Promise<EntitasBatchProduksi[]>;
  perbaruiBatchProduksi(
    id: string,
    perubahan: Partial<EntitasBatchProduksi>,
  ): Promise<EntitasBatchProduksi>;

  // Penggunaan Lot Bahan Gudang (AB-018)
  simpanPenggunaanLotBahan(daftar: EntitasPenggunaanLotBahan[]): Promise<void>;
  ambilPenggunaanLotBerdasarkanBatch(batchId: string): Promise<EntitasPenggunaanLotBahan[]>;
  ambilBatchBerdasarkanNomorLot(nomorLot: string): Promise<EntitasPenggunaanLotBahan[]>;

  // Pemeriksaan Mutu Akhir (QC Organoleptik & Suhu)
  simpanPemeriksaanMutu(pemeriksaan: EntitasPemeriksaanMutu): Promise<EntitasPemeriksaanMutu>;
  ambilPemeriksaanMutuBerdasarkanBatch(batchId: string): Promise<EntitasPemeriksaanMutu | null>;
  ambilSemuaPemeriksaanMutu(): Promise<EntitasPemeriksaanMutu[]>;

  // Label Porsi Pasien & Penahanan Klinis
  hitungNomorLabelBerikutnya(): Promise<string>;
  simpanLabelPorsi(label: EntitasLabelPorsi): Promise<EntitasLabelPorsi>;
  simpanBanyakLabelPorsi(labels: EntitasLabelPorsi[]): Promise<void>;
  ambilLabelPorsiBerdasarkanId(id: string): Promise<EntitasLabelPorsi | null>;
  ambilDaftarLabelPorsi(filter?: {
    tanggal?: string;
    sesi?: SesiMakanDapur;
    status?: StatusPorsiPasien;
    pasienId?: string;
    batchProduksiId?: string;
  }): Promise<EntitasLabelPorsi[]>;
  ambilLabelBerdasarkanBatch(batchId: string): Promise<EntitasLabelPorsi[]>;
  perbaruiStatusLabelPorsi(
    id: string,
    status: StatusPorsiPasien,
    opsi?: {
      alasanPenahanan?: string | null;
      suhuKemasanCelsius?: number | null;
      batchProduksiId?: string | null;
      nomorBatch?: string | null;
    },
  ): Promise<EntitasLabelPorsi>;
  tahanPorsiBerdasarkanPasienId(
    pasienId: string,
    alasan: string,
  ): Promise<number>;
}

export class InMemoryKitchenRepository implements KitchenRepository {
  private rencanaList: EntitasRencanaProduksi[] = [...BENIH_RENCANA_PRODUKSI];
  private batchList: EntitasBatchProduksi[] = [...BENIH_BATCH_PRODUKSI];
  private lotUseList: EntitasPenggunaanLotBahan[] = [...BENIH_PENGGUNAAN_LOT];
  private qcList: EntitasPemeriksaanMutu[] = [...BENIH_PEMERIKSAAN_MUTU];
  private labelList: EntitasLabelPorsi[] = [...BENIH_LABEL_PORSI];

  // Rencana Produksi
  public async hitungNomorRencanaBerikutnya(): Promise<string> {
    const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urutan = String(this.rencanaList.length + 1).padStart(3, "0");
    return `RP-${tanggal}-${urutan}`;
  }

  public async simpanRencanaProduksi(rencana: EntitasRencanaProduksi): Promise<EntitasRencanaProduksi> {
    this.rencanaList.unshift(rencana);
    return rencana;
  }

  public async ambilRencanaProduksiBerdasarkanId(id: string): Promise<EntitasRencanaProduksi | null> {
    return this.rencanaList.find((r) => r.id === id) ?? null;
  }

  public async ambilDaftarRencanaProduksi(filter?: {
    tanggal?: string;
    sesi?: SesiMakanDapur;
    status?: StatusRencanaProduksi;
  }): Promise<EntitasRencanaProduksi[]> {
    return this.rencanaList.filter((r) => {
      if (filter?.tanggal && r.tanggalPelayanan !== filter.tanggal) return false;
      if (filter?.sesi && r.sesiMakan !== filter.sesi) return false;
      if (filter?.status && r.status !== filter.status) return false;
      return true;
    });
  }

  public async perbaruiRencanaProduksi(
    id: string,
    perubahan: Partial<EntitasRencanaProduksi>,
  ): Promise<EntitasRencanaProduksi> {
    const idx = this.rencanaList.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Rencana produksi ${id} tidak ditemukan.`);
    const terbarui = {
      ...this.rencanaList[idx],
      ...perubahan,
      versi: this.rencanaList[idx].versi + 1,
    };
    this.rencanaList[idx] = terbarui;
    return terbarui;
  }

  // Batch Memasak
  public async hitungNomorBatchBerikutnya(sesi: SesiMakanDapur): Promise<string> {
    const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urutan = String(this.batchList.length + 1).padStart(2, "0");
    return `BATCH-${tanggal}-${sesi.toUpperCase()}-${urutan}`;
  }

  public async simpanBatchProduksi(batch: EntitasBatchProduksi): Promise<EntitasBatchProduksi> {
    this.batchList.unshift(batch);
    return batch;
  }

  public async ambilBatchProduksiBerdasarkanId(id: string): Promise<EntitasBatchProduksi | null> {
    return this.batchList.find((b) => b.id === id) ?? null;
  }

  public async ambilDaftarBatchProduksi(filter?: {
    rencanaProduksiId?: string;
    sesi?: SesiMakanDapur;
    status?: StatusBatchProduksi;
  }): Promise<EntitasBatchProduksi[]> {
    return this.batchList.filter((b) => {
      if (filter?.rencanaProduksiId && b.rencanaProduksiId !== filter.rencanaProduksiId) return false;
      if (filter?.sesi && b.sesiMakan !== filter.sesi) return false;
      if (filter?.status && b.status !== filter.status) return false;
      return true;
    });
  }

  public async perbaruiBatchProduksi(
    id: string,
    perubahan: Partial<EntitasBatchProduksi>,
  ): Promise<EntitasBatchProduksi> {
    const idx = this.batchList.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error(`Batch produksi ${id} tidak ditemukan.`);
    const terbarui = {
      ...this.batchList[idx],
      ...perubahan,
      versi: this.batchList[idx].versi + 1,
    };
    this.batchList[idx] = terbarui;
    return terbarui;
  }

  // Penggunaan Lot Bahan
  public async simpanPenggunaanLotBahan(daftar: EntitasPenggunaanLotBahan[]): Promise<void> {
    this.lotUseList.push(...daftar);
  }

  public async ambilPenggunaanLotBerdasarkanBatch(batchId: string): Promise<EntitasPenggunaanLotBahan[]> {
    return this.lotUseList.filter((l) => l.batchProduksiId === batchId);
  }

  public async ambilBatchBerdasarkanNomorLot(nomorLot: string): Promise<EntitasPenggunaanLotBahan[]> {
    return this.lotUseList.filter((l) => l.nomorLot === nomorLot);
  }

  // Pemeriksaan Mutu
  public async simpanPemeriksaanMutu(pemeriksaan: EntitasPemeriksaanMutu): Promise<EntitasPemeriksaanMutu> {
    const idx = this.qcList.findIndex((q) => q.batchProduksiId === pemeriksaan.batchProduksiId);
    if (idx !== -1) {
      this.qcList[idx] = pemeriksaan;
    } else {
      this.qcList.unshift(pemeriksaan);
    }
    return pemeriksaan;
  }

  public async ambilPemeriksaanMutuBerdasarkanBatch(batchId: string): Promise<EntitasPemeriksaanMutu | null> {
    return this.qcList.find((q) => q.batchProduksiId === batchId) ?? null;
  }

  public async ambilSemuaPemeriksaanMutu(): Promise<EntitasPemeriksaanMutu[]> {
    return [...this.qcList];
  }

  // Label Porsi
  public async hitungNomorLabelBerikutnya(): Promise<string> {
    const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urutan = String(this.labelList.length + 1).padStart(3, "0");
    return `LBL-${tanggal}-${urutan}`;
  }

  public async simpanLabelPorsi(label: EntitasLabelPorsi): Promise<EntitasLabelPorsi> {
    this.labelList.unshift(label);
    return label;
  }

  public async simpanBanyakLabelPorsi(labels: EntitasLabelPorsi[]): Promise<void> {
    this.labelList.unshift(...labels);
  }

  public async ambilLabelPorsiBerdasarkanId(id: string): Promise<EntitasLabelPorsi | null> {
    return this.labelList.find((l) => l.id === id) ?? null;
  }

  public async ambilDaftarLabelPorsi(filter?: {
    tanggal?: string;
    sesi?: SesiMakanDapur;
    status?: StatusPorsiPasien;
    pasienId?: string;
    batchProduksiId?: string;
  }): Promise<EntitasLabelPorsi[]> {
    return this.labelList.filter((l) => {
      if (filter?.tanggal && l.tanggalPelayanan !== filter.tanggal) return false;
      if (filter?.sesi && l.sesiMakan !== filter.sesi) return false;
      if (filter?.status && l.statusPorsi !== filter.status) return false;
      if (filter?.pasienId && l.pasienId !== filter.pasienId) return false;
      if (filter?.batchProduksiId && l.batchProduksiId !== filter.batchProduksiId) return false;
      return true;
    });
  }

  public async ambilLabelBerdasarkanBatch(batchId: string): Promise<EntitasLabelPorsi[]> {
    return this.labelList.filter((l) => l.batchProduksiId === batchId);
  }

  public async perbaruiStatusLabelPorsi(
    id: string,
    status: StatusPorsiPasien,
    opsi?: {
      alasanPenahanan?: string | null;
      suhuKemasanCelsius?: number | null;
      batchProduksiId?: string | null;
      nomorBatch?: string | null;
    },
  ): Promise<EntitasLabelPorsi> {
    const idx = this.labelList.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error(`Label porsi ${id} tidak ditemukan.`);
    const terbarui: EntitasLabelPorsi = {
      ...this.labelList[idx],
      statusPorsi: status,
      alasanPenahanan:
        opsi?.alasanPenahanan !== undefined
          ? opsi.alasanPenahanan
          : this.labelList[idx].alasanPenahanan,
      suhuKemasanCelsius:
        opsi?.suhuKemasanCelsius !== undefined
          ? opsi.suhuKemasanCelsius
          : this.labelList[idx].suhuKemasanCelsius,
      batchProduksiId:
        opsi?.batchProduksiId !== undefined
          ? opsi.batchProduksiId
          : this.labelList[idx].batchProduksiId,
      nomorBatch:
        opsi?.nomorBatch !== undefined
          ? opsi.nomorBatch
          : this.labelList[idx].nomorBatch,
      versi: this.labelList[idx].versi + 1,
    };
    this.labelList[idx] = terbarui;
    return terbarui;
  }

  public async tahanPorsiBerdasarkanPasienId(
    pasienId: string,
    alasan: string,
  ): Promise<number> {
    let terhitung = 0;
    this.labelList = this.labelList.map((lbl) => {
      if (lbl.pasienId === pasienId && lbl.statusPorsi !== "batal") {
        terhitung++;
        return {
          ...lbl,
          statusPorsi: "ditahan_perubahan_klinis",
          alasanPenahanan: alasan,
          versi: lbl.versi + 1,
        };
      }
      return lbl;
    });
    return terhitung;
  }
}

type NilaiParamSql = string | number | boolean | null;

export class MySqlKitchenRepository implements KitchenRepository {
  private readonly pool: Pool | PoolConnection;

  public constructor(pool: Pool | PoolConnection) {
    this.pool = pool;
  }

  public async transaksi<T>(kerja: (repo: KitchenRepository) => Promise<T>): Promise<T> {
    if (!("getConnection" in this.pool)) return kerja(this);
    const conn = await this.pool.getConnection();
    try {
      const [rows] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(), ':kitchen'), 10) AS acquired");
      if (Number(rows[0]?.acquired) !== 1) throw new Error("Operasi sedang diproses. Silakan coba kembali.");
      await conn.beginTransaction();
      const result = await kerja(new MySqlKitchenRepository(conn));
      await conn.commit();
      return result;
    } catch (error) { await conn.rollback().catch(() => undefined); throw error; }
    finally { await conn.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':kitchen'))").catch(() => undefined); conn.release(); }
  }

  public async hitungNomorRencanaBerikutnya(): Promise<string> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM rencana_produksi_h1",
    );
    const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urutan = String((rows[0]?.total ?? 0) + 1).padStart(3, "0");
    return `RP-${tanggal}-${urutan}`;
  }

  public async simpanRencanaProduksi(rencana: EntitasRencanaProduksi): Promise<EntitasRencanaProduksi> {
    await this.pool.execute(
      `INSERT INTO rencana_produksi_h1
       (id, nomor_rencana, tanggal_pelayanan, sesi_makan, status, total_estimasi_porsi,
        catatan, penanggung_jawab_id, penanggung_jawab_nama, waktu_dibuat, waktu_disetujui, versi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        rencana.id,
        rencana.nomorRencana,
        rencana.tanggalPelayanan,
        rencana.sesiMakan,
        rencana.status,
        rencana.totalEstimasiPorsi,
        rencana.catatan,
        rencana.penanggungJawabId,
        rencana.penanggungJawabNama,
        rencana.waktuDibuat,
        rencana.waktuDisetujui,
        rencana.versi,
      ]),
    );
    return rencana;
  }

  public async ambilRencanaProduksiBerdasarkanId(id: string): Promise<EntitasRencanaProduksi | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM rencana_produksi_h1 WHERE id = ?",
      parameterMysql([id]),
    );
    if (!rows[0]) return null;
    return this.petakanBarisRencana(rows[0]);
  }

  public async ambilDaftarRencanaProduksi(filter?: {
    tanggal?: string;
    sesi?: SesiMakanDapur;
    status?: StatusRencanaProduksi;
  }): Promise<EntitasRencanaProduksi[]> {
    let sql = "SELECT * FROM rencana_produksi_h1 WHERE 1=1";
    const params: NilaiParamSql[] = [];
    if (filter?.tanggal) {
      sql += " AND tanggal_pelayanan = ?";
      params.push(filter.tanggal);
    }
    if (filter?.sesi) {
      sql += " AND sesi_makan = ?";
      params.push(filter.sesi);
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    sql += " ORDER BY waktu_dibuat DESC";
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisRencana(r));
  }

  public async perbaruiRencanaProduksi(
    id: string,
    perubahan: Partial<EntitasRencanaProduksi>,
  ): Promise<EntitasRencanaProduksi> {
    const fields: string[] = [];
    const params: NilaiParamSql[] = [];
    if (perubahan.status !== undefined) {
      fields.push("status = ?");
      params.push(perubahan.status);
    }
    if (perubahan.waktuDisetujui !== undefined) {
      fields.push("waktu_disetujui = ?");
      params.push(perubahan.waktuDisetujui);
    }
    if (perubahan.totalEstimasiPorsi !== undefined) {
      fields.push("total_estimasi_porsi = ?");
      params.push(perubahan.totalEstimasiPorsi);
    }
    fields.push("versi = versi + 1");
    params.push(id);
    await this.pool.execute(
      `UPDATE rencana_produksi_h1 SET ${fields.join(", ")} WHERE id = ?`,
      parameterMysql(params),
    );
    const terbarui = await this.ambilRencanaProduksiBerdasarkanId(id);
    if (!terbarui) throw new Error(`Rencana ${id} tidak ditemukan.`);
    return terbarui;
  }

  // Batch Memasak
  public async hitungNomorBatchBerikutnya(sesi: SesiMakanDapur): Promise<string> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM batch_produksi_dapur WHERE sesi_makan = ?",
      parameterMysql([sesi]),
    );
    const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urutan = String((rows[0]?.total ?? 0) + 1).padStart(2, "0");
    return `BATCH-${tanggal}-${sesi.toUpperCase()}-${urutan}`;
  }

  public async simpanBatchProduksi(batch: EntitasBatchProduksi): Promise<EntitasBatchProduksi> {
    await this.pool.execute(
      `INSERT INTO batch_produksi_dapur
       (id, nomor_batch, rencana_produksi_id, resep_id, nama_masakan, sesi_makan,
        jumlah_porsi_target, jumlah_porsi_realisasi, suhu_masak_ccp_celsius, waktu_mulai_masak,
        waktu_selesai_masak, status, catatan_koki, chef_penanggung_jawab, waktu_dibuat, versi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        batch.id,
        batch.nomorBatch,
        batch.rencanaProduksiId,
        batch.resepId,
        batch.namaMasakan,
        batch.sesiMakan,
        batch.jumlahPorsiTarget,
        batch.jumlahPorsiRealisasi,
        batch.suhuMasakCcpCelsius,
        batch.waktuMulaiMasak,
        batch.waktuSelesaiMasak,
        batch.status,
        batch.catatanKoki,
        batch.chefPenanggungJawab,
        batch.waktuDibuat,
        batch.versi,
      ]),
    );
    return batch;
  }

  public async ambilBatchProduksiBerdasarkanId(id: string): Promise<EntitasBatchProduksi | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM batch_produksi_dapur WHERE id = ?",
      parameterMysql([id]),
    );
    if (!rows[0]) return null;
    return this.petakanBarisBatch(rows[0]);
  }

  public async ambilDaftarBatchProduksi(filter?: {
    rencanaProduksiId?: string;
    sesi?: SesiMakanDapur;
    status?: StatusBatchProduksi;
  }): Promise<EntitasBatchProduksi[]> {
    let sql = "SELECT * FROM batch_produksi_dapur WHERE 1=1";
    const params: NilaiParamSql[] = [];
    if (filter?.rencanaProduksiId) {
      sql += " AND rencana_produksi_id = ?";
      params.push(filter.rencanaProduksiId);
    }
    if (filter?.sesi) {
      sql += " AND sesi_makan = ?";
      params.push(filter.sesi);
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    sql += " ORDER BY waktu_mulai_masak DESC";
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisBatch(r));
  }

  public async perbaruiBatchProduksi(
    id: string,
    perubahan: Partial<EntitasBatchProduksi>,
  ): Promise<EntitasBatchProduksi> {
    const fields: string[] = [];
    const params: NilaiParamSql[] = [];
    if (perubahan.status !== undefined) {
      fields.push("status = ?");
      params.push(perubahan.status);
    }
    if (perubahan.suhuMasakCcpCelsius !== undefined) {
      fields.push("suhu_masak_ccp_celsius = ?");
      params.push(perubahan.suhuMasakCcpCelsius);
    }
    if (perubahan.jumlahPorsiRealisasi !== undefined) {
      fields.push("jumlah_porsi_realisasi = ?");
      params.push(perubahan.jumlahPorsiRealisasi);
    }
    if (perubahan.waktuSelesaiMasak !== undefined) {
      fields.push("waktu_selesai_masak = ?");
      params.push(perubahan.waktuSelesaiMasak);
    }
    if (perubahan.catatanKoki !== undefined) {
      fields.push("catatan_koki = ?");
      params.push(perubahan.catatanKoki);
    }
    fields.push("versi = versi + 1");
    params.push(id);
    await this.pool.execute(
      `UPDATE batch_produksi_dapur SET ${fields.join(", ")} WHERE id = ?`,
      parameterMysql(params),
    );
    const terbarui = await this.ambilBatchProduksiBerdasarkanId(id);
    if (!terbarui) throw new Error(`Batch ${id} tidak ditemukan.`);
    return terbarui;
  }

  // Penggunaan Lot Bahan
  public async simpanPenggunaanLotBahan(daftar: EntitasPenggunaanLotBahan[]): Promise<void> {
    for (const item of daftar) {
      await this.pool.execute(
        `INSERT INTO penggunaan_lot_bahan_batch
         (id, batch_produksi_id, bahan_id, nama_bahan, nomor_lot, jumlah_digunakan, satuan, waktu_pencatatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        parameterMysql([
          item.id,
          item.batchProduksiId,
          item.bahanId,
          item.namaBahan,
          item.nomorLot,
          item.jumlahDigunakan,
          item.satuan,
          item.waktuPencatatan,
        ]),
      );
    }
  }

  public async ambilPenggunaanLotBerdasarkanBatch(batchId: string): Promise<EntitasPenggunaanLotBahan[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM penggunaan_lot_bahan_batch WHERE batch_produksi_id = ? ORDER BY waktu_pencatatan ASC",
      parameterMysql([batchId]),
    );
    return rows.map((r) => ({
      id: r.id,
      batchProduksiId: r.batch_produksi_id,
      bahanId: r.bahan_id,
      namaBahan: r.nama_bahan,
      nomorLot: r.nomor_lot,
      jumlahDigunakan: Number(r.jumlah_digunakan),
      satuan: r.satuan,
      waktuPencatatan: waktuMysql(r.waktu_pencatatan),
    }));
  }

  public async ambilBatchBerdasarkanNomorLot(nomorLot: string): Promise<EntitasPenggunaanLotBahan[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM penggunaan_lot_bahan_batch WHERE nomor_lot = ? ORDER BY waktu_pencatatan DESC",
      parameterMysql([nomorLot]),
    );
    return rows.map((r) => ({
      id: r.id,
      batchProduksiId: r.batch_produksi_id,
      bahanId: r.bahan_id,
      namaBahan: r.nama_bahan,
      nomorLot: r.nomor_lot,
      jumlahDigunakan: Number(r.jumlah_digunakan),
      satuan: r.satuan,
      waktuPencatatan: waktuMysql(r.waktu_pencatatan),
    }));
  }

  // QC
  public async simpanPemeriksaanMutu(pemeriksaan: EntitasPemeriksaanMutu): Promise<EntitasPemeriksaanMutu> {
    await this.pool.execute(
      `INSERT INTO pemeriksaan_mutu_produksi
       (id, batch_produksi_id, suhu_saji_celsius, uji_tekstur, uji_aroma, uji_rasa,
        uji_tampilan_visual, status_mutu, catatan_pemeriksaan, pemeriksa_id, pemeriksa_nama, waktu_pemeriksaan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        suhu_saji_celsius = VALUES(suhu_saji_celsius),
        uji_tekstur = VALUES(uji_tekstur),
        uji_aroma = VALUES(uji_aroma),
        uji_rasa = VALUES(uji_rasa),
        uji_tampilan_visual = VALUES(uji_tampilan_visual),
        status_mutu = VALUES(status_mutu),
        catatan_pemeriksaan = VALUES(catatan_pemeriksaan),
        pemeriksa_id = VALUES(pemeriksa_id),
        pemeriksa_nama = VALUES(pemeriksa_nama),
        waktu_pemeriksaan = VALUES(waktu_pemeriksaan)`,
      parameterMysql([
        pemeriksaan.id,
        pemeriksaan.batchProduksiId,
        pemeriksaan.suhuSajiCelsius,
        pemeriksaan.ujiTekstur,
        pemeriksaan.ujiAroma,
        pemeriksaan.ujiRasa,
        pemeriksaan.ujiTampilanVisual,
        pemeriksaan.statusMutu,
        pemeriksaan.catatanPemeriksaan,
        pemeriksaan.pemeriksaId,
        pemeriksaan.pemeriksaNama,
        pemeriksaan.waktuPemeriksaan,
      ]),
    );
    return pemeriksaan;
  }

  public async ambilPemeriksaanMutuBerdasarkanBatch(batchId: string): Promise<EntitasPemeriksaanMutu | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM pemeriksaan_mutu_produksi WHERE batch_produksi_id = ?",
      parameterMysql([batchId]),
    );
    if (!rows[0]) return null;
    return this.petakanBarisQC(rows[0]);
  }

  public async ambilSemuaPemeriksaanMutu(): Promise<EntitasPemeriksaanMutu[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM pemeriksaan_mutu_produksi ORDER BY waktu_pemeriksaan DESC",
    );
    return rows.map((r) => this.petakanBarisQC(r));
  }

  // Label
  public async hitungNomorLabelBerikutnya(): Promise<string> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM label_porsi_makanan",
    );
    const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const urutan = String((rows[0]?.total ?? 0) + 1).padStart(3, "0");
    return `LBL-${tanggal}-${urutan}`;
  }

  public async simpanLabelPorsi(label: EntitasLabelPorsi): Promise<EntitasLabelPorsi> {
    await this.pool.execute(
      `INSERT INTO label_porsi_makanan
       (id, nomor_label, nomor_pesanan, batch_produksi_id, nomor_batch, pasien_id, nama_pasien,
        nomor_rm, bangsal_kamar_bed, tanggal_pelayanan, sesi_makan, nama_menu, bentuk_makanan,
        jenis_diet, informasi_alergen, suhu_kemasan_celsius, status_porsi, alasan_penahanan,
        waktu_cetak_label, petugas_label_nama, versi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        label.id,
        label.nomorLabel,
        label.nomorPesanan,
        label.batchProduksiId,
        label.nomorBatch,
        label.pasienId,
        label.namaPasien,
        label.nomorRm,
        label.bangsalKamarBed,
        label.tanggalPelayanan,
        label.sesiMakan,
        label.namaMenu,
        label.bentukMakanan,
        label.jenisDiet,
        label.informasiAlergen,
        label.suhuKemasanCelsius,
        label.statusPorsi,
        label.alasanPenahanan,
        label.waktuCetakLabel,
        label.petugasLabelNama,
        label.versi,
      ]),
    );
    return label;
  }

  public async simpanBanyakLabelPorsi(labels: EntitasLabelPorsi[]): Promise<void> {
    for (const label of labels) {
      await this.simpanLabelPorsi(label);
    }
  }

  public async ambilLabelPorsiBerdasarkanId(id: string): Promise<EntitasLabelPorsi | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM label_porsi_makanan WHERE id = ?",
      parameterMysql([id]),
    );
    if (!rows[0]) return null;
    return this.petakanBarisLabel(rows[0]);
  }

  public async ambilDaftarLabelPorsi(filter?: {
    tanggal?: string;
    sesi?: SesiMakanDapur;
    status?: StatusPorsiPasien;
    pasienId?: string;
    batchProduksiId?: string;
  }): Promise<EntitasLabelPorsi[]> {
    let sql = "SELECT * FROM label_porsi_makanan WHERE 1=1";
    const params: NilaiParamSql[] = [];
    if (filter?.tanggal) {
      sql += " AND tanggal_pelayanan = ?";
      params.push(filter.tanggal);
    }
    if (filter?.sesi) {
      sql += " AND sesi_makan = ?";
      params.push(filter.sesi);
    }
    if (filter?.status) {
      sql += " AND status_porsi = ?";
      params.push(filter.status);
    }
    if (filter?.pasienId) {
      sql += " AND pasien_id = ?";
      params.push(filter.pasienId);
    }
    if (filter?.batchProduksiId) {
      sql += " AND batch_produksi_id = ?";
      params.push(filter.batchProduksiId);
    }
    sql += " ORDER BY waktu_cetak_label DESC";
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisLabel(r));
  }

  public async ambilLabelBerdasarkanBatch(batchId: string): Promise<EntitasLabelPorsi[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM label_porsi_makanan WHERE batch_produksi_id = ? ORDER BY waktu_cetak_label ASC",
      parameterMysql([batchId]),
    );
    return rows.map((r) => this.petakanBarisLabel(r));
  }

  public async perbaruiStatusLabelPorsi(
    id: string,
    status: StatusPorsiPasien,
    opsi?: {
      alasanPenahanan?: string | null;
      suhuKemasanCelsius?: number | null;
      batchProduksiId?: string | null;
      nomorBatch?: string | null;
    },
  ): Promise<EntitasLabelPorsi> {
    const fields: string[] = ["status_porsi = ?"];
    const params: NilaiParamSql[] = [status];
    if (opsi?.alasanPenahanan !== undefined) {
      fields.push("alasan_penahanan = ?");
      params.push(opsi.alasanPenahanan);
    }
    if (opsi?.suhuKemasanCelsius !== undefined) {
      fields.push("suhu_kemasan_celsius = ?");
      params.push(opsi.suhuKemasanCelsius);
    }
    if (opsi?.batchProduksiId !== undefined) {
      fields.push("batch_produksi_id = ?");
      params.push(opsi.batchProduksiId);
    }
    if (opsi?.nomorBatch !== undefined) {
      fields.push("nomor_batch = ?");
      params.push(opsi.nomorBatch);
    }
    fields.push("versi = versi + 1");
    params.push(id);
    await this.pool.execute(
      `UPDATE label_porsi_makanan SET ${fields.join(", ")} WHERE id = ?`,
      parameterMysql(params),
    );
    const terbarui = await this.ambilLabelPorsiBerdasarkanId(id);
    if (!terbarui) throw new Error(`Label ${id} tidak ditemukan.`);
    return terbarui;
  }

  public async tahanPorsiBerdasarkanPasienId(
    pasienId: string,
    alasan: string,
  ): Promise<number> {
    const [result] = await this.pool.execute(
      `UPDATE label_porsi_makanan
       SET status_porsi = 'ditahan_perubahan_klinis', alasan_penahanan = ?, versi = versi + 1
       WHERE pasien_id = ? AND status_porsi != 'batal'`,
      parameterMysql([alasan, pasienId]),
    );
    return (result as { affectedRows: number }).affectedRows ?? 0;
  }

  private petakanBarisRencana(r: RowDataPacket): EntitasRencanaProduksi {
    return {
      id: r.id,
      nomorRencana: r.nomor_rencana,
      tanggalPelayanan: r.tanggal_pelayanan instanceof Date
        ? r.tanggal_pelayanan.toISOString().slice(0, 10)
        : String(r.tanggal_pelayanan),
      sesiMakan: r.sesi_makan,
      status: r.status,
      totalEstimasiPorsi: Number(r.total_estimasi_porsi),
      catatan: r.catatan ?? "",
      penanggungJawabId: r.penanggung_jawab_id,
      penanggungJawabNama: r.penanggung_jawab_nama,
      waktuDibuat: waktuMysql(r.waktu_dibuat),
      waktuDisetujui: r.waktu_disetujui ? waktuMysql(r.waktu_disetujui) : null,
      versi: Number(r.versi),
    };
  }

  private petakanBarisBatch(r: RowDataPacket): EntitasBatchProduksi {
    return {
      id: r.id,
      nomorBatch: r.nomor_batch,
      rencanaProduksiId: r.rencana_produksi_id,
      resepId: r.resep_id,
      namaMasakan: r.nama_masakan,
      sesiMakan: r.sesi_makan,
      jumlahPorsiTarget: Number(r.jumlah_porsi_target),
      jumlahPorsiRealisasi: Number(r.jumlah_porsi_realisasi),
      suhuMasakCcpCelsius: r.suhu_masak_ccp_celsius !== null ? Number(r.suhu_masak_ccp_celsius) : null,
      waktuMulaiMasak: waktuMysql(r.waktu_mulai_masak),
      waktuSelesaiMasak: r.waktu_selesai_masak ? waktuMysql(r.waktu_selesai_masak) : null,
      status: r.status,
      catatanKoki: r.catatan_koki ?? "",
      chefPenanggungJawab: r.chef_penanggung_jawab,
      waktuDibuat: waktuMysql(r.waktu_dibuat),
      versi: Number(r.versi),
    };
  }

  private petakanBarisQC(r: RowDataPacket): EntitasPemeriksaanMutu {
    return {
      id: r.id,
      batchProduksiId: r.batch_produksi_id,
      suhuSajiCelsius: Number(r.suhu_saji_celsius),
      ujiTekstur: r.uji_tekstur,
      ujiAroma: r.uji_aroma,
      ujiRasa: r.uji_rasa,
      ujiTampilanVisual: r.uji_tampilan_visual,
      statusMutu: r.status_mutu,
      catatanPemeriksaan: r.catatan_pemeriksaan,
      pemeriksaId: r.pemeriksa_id,
      pemeriksaNama: r.pemeriksa_nama,
      waktuPemeriksaan: waktuMysql(r.waktu_pemeriksaan),
    };
  }

  private petakanBarisLabel(r: RowDataPacket): EntitasLabelPorsi {
    return {
      id: r.id,
      nomorLabel: r.nomor_label,
      nomorPesanan: r.nomor_pesanan,
      batchProduksiId: r.batch_produksi_id ?? null,
      nomorBatch: r.nomor_batch ?? null,
      pasienId: r.pasien_id,
      namaPasien: r.nama_pasien,
      nomorRm: r.nomor_rm,
      bangsalKamarBed: r.bangsal_kamar_bed,
      tanggalPelayanan: r.tanggal_pelayanan instanceof Date
        ? r.tanggal_pelayanan.toISOString().slice(0, 10)
        : String(r.tanggal_pelayanan),
      sesiMakan: r.sesi_makan,
      namaMenu: r.nama_menu,
      bentukMakanan: r.bentuk_makanan,
      jenisDiet: r.jenis_diet,
      informasiAlergen: r.informasi_alergen,
      suhuKemasanCelsius: r.suhu_kemasan_celsius !== null ? Number(r.suhu_kemasan_celsius) : null,
      statusPorsi: r.status_porsi,
      alasanPenahanan: r.alasan_penahanan ?? null,
      waktuCetakLabel: waktuMysql(r.waktu_cetak_label),
      petugasLabelNama: r.petugas_label_nama,
      versi: Number(r.versi),
    };
  }
}
