import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Repositori data untuk Layanan Inventaris & Gudang (Tahap 7).
 * Menyediakan implementasi InMemory (dengan seed) dan implementasi MySQL terparameterisasi.
 */

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  EntitasKartuStokMutasi,
  EntitasKatalogBahan,
  EntitasPenerimaanLot,
  EntitasPenyesuaianStokOpname,
  EntitasPermintaanBahanDapur,
} from "../model/inventory.model.ts";
import {
  SEED_KARTU_STOK,
  SEED_KATALOG_BAHAN,
  SEED_PENERIMAAN_LOT,
  SEED_PERMINTAAN_BAHAN,
} from "../database/seeds/inventory.seed.ts";

export interface InventoryRepository {
  transaksi?<T>(aksi: (repository: InventoryRepository) => Promise<T>): Promise<T>;
  // Master Bahan
  ambilSemuaBahan(): Promise<EntitasKatalogBahan[]>;
  ambilBahanBerdasarkanId(id: string): Promise<EntitasKatalogBahan | null>;
  ambilBahanBerdasarkanKode(kode: string): Promise<EntitasKatalogBahan | null>;
  simpanBahan(bahan: EntitasKatalogBahan): Promise<EntitasKatalogBahan>;
  perbaruiStokBahan(
    id: string,
    perubahan: {
      stokFisik?: number;
      stokLayak?: number;
      stokDialokasikan?: number;
      stokDitahan?: number;
    },
  ): Promise<EntitasKatalogBahan>;

  // Penerimaan Lot & Mutu
  hitungNomorLotBerikutnya(): Promise<string>;
  simpanPenerimaanLot(lot: EntitasPenerimaanLot): Promise<EntitasPenerimaanLot>;
  ambilSemuaLot(filter?: { bahanId?: string; statusLot?: string }): Promise<EntitasPenerimaanLot[]>;
  ambilLotBerdasarkanId(id: string): Promise<EntitasPenerimaanLot | null>;
  ambilLotBerdasarkanNomor(nomorLot: string): Promise<EntitasPenerimaanLot | null>;
  ambilLotAktifLayakFEFO(bahanId: string): Promise<EntitasPenerimaanLot[]>;
  perbaruiLot(id: string, perubahan: Partial<EntitasPenerimaanLot>): Promise<EntitasPenerimaanLot>;

  // Kartu Stok Mutasi
  catatMutasiKartuStok(mutasi: EntitasKartuStokMutasi): Promise<EntitasKartuStokMutasi>;
  ambilKartuStok(bahanId?: string): Promise<EntitasKartuStokMutasi[]>;

  // Permintaan Bahan Dapur
  hitungNomorPermintaanBerikutnya(): Promise<string>;
  simpanPermintaanBahan(permintaan: EntitasPermintaanBahanDapur): Promise<EntitasPermintaanBahanDapur>;
  ambilSemuaPermintaan(filter?: { status?: string; tanggal?: string }): Promise<EntitasPermintaanBahanDapur[]>;
  ambilPermintaanBerdasarkanId(id: string): Promise<EntitasPermintaanBahanDapur | null>;
  perbaruiPermintaan(
    id: string,
    perubahan: Partial<EntitasPermintaanBahanDapur>,
  ): Promise<EntitasPermintaanBahanDapur>;

  // Stok Opname
  simpanPenyesuaianOpname(opname: EntitasPenyesuaianStokOpname): Promise<EntitasPenyesuaianStokOpname>;
  ambilSemuaOpname(bahanId?: string): Promise<EntitasPenyesuaianStokOpname[]>;
}

export class InMemoryInventoryRepository implements InventoryRepository {
  private bahanList: EntitasKatalogBahan[] = [...SEED_KATALOG_BAHAN];
  private lotList: EntitasPenerimaanLot[] = [...SEED_PENERIMAAN_LOT];
  private mutasiList: EntitasKartuStokMutasi[] = [...SEED_KARTU_STOK];
  private permintaanList: EntitasPermintaanBahanDapur[] = [...SEED_PERMINTAAN_BAHAN];
  private opnameList: EntitasPenyesuaianStokOpname[] = [];

  // Master Bahan
  public async ambilSemuaBahan(): Promise<EntitasKatalogBahan[]> {
    return [...this.bahanList];
  }

  public async ambilBahanBerdasarkanId(id: string): Promise<EntitasKatalogBahan | null> {
    const item = this.bahanList.find((b) => b.id === id);
    return item ? { ...item } : null;
  }

  public async ambilBahanBerdasarkanKode(kode: string): Promise<EntitasKatalogBahan | null> {
    const item = this.bahanList.find((b) => b.kodeBahan.toUpperCase() === kode.toUpperCase());
    return item ? { ...item } : null;
  }

  public async simpanBahan(bahan: EntitasKatalogBahan): Promise<EntitasKatalogBahan> {
    const idx = this.bahanList.findIndex((b) => b.id === bahan.id);
    if (idx >= 0) {
      this.bahanList[idx] = { ...bahan };
    } else {
      this.bahanList.push({ ...bahan });
    }
    return { ...bahan };
  }

  public async perbaruiStokBahan(
    id: string,
    perubahan: {
      stokFisik?: number;
      stokLayak?: number;
      stokDialokasikan?: number;
      stokDitahan?: number;
    },
  ): Promise<EntitasKatalogBahan> {
    const idx = this.bahanList.findIndex((b) => b.id === id);
    if (idx < 0) {
      throw new Error(`Bahan dengan ID ${id} tidak ditemukan.`);
    }
    const current = this.bahanList[idx];
    const updated: EntitasKatalogBahan = {
      ...current,
      stokFisik: perubahan.stokFisik !== undefined ? perubahan.stokFisik : current.stokFisik,
      stokLayak: perubahan.stokLayak !== undefined ? perubahan.stokLayak : current.stokLayak,
      stokDialokasikan:
        perubahan.stokDialokasikan !== undefined
          ? perubahan.stokDialokasikan
          : current.stokDialokasikan,
      stokDitahan: perubahan.stokDitahan !== undefined ? perubahan.stokDitahan : current.stokDitahan,
      versi: current.versi + 1,
      diperbaruiPada: new Date().toISOString(),
    };
    this.bahanList[idx] = updated;
    return { ...updated };
  }

  // Penerimaan Lot & Mutu
  public async hitungNomorLotBerikutnya(): Promise<string> {
    const d = new Date();
    const tgl = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const seq = String(this.lotList.length + 1).padStart(3, "0");
    return `LOT-${tgl}-${seq}`;
  }

  public async simpanPenerimaanLot(lot: EntitasPenerimaanLot): Promise<EntitasPenerimaanLot> {
    const idx = this.lotList.findIndex((l) => l.id === lot.id);
    if (idx >= 0) {
      this.lotList[idx] = { ...lot };
    } else {
      this.lotList.push({ ...lot });
    }
    return { ...lot };
  }

  public async ambilSemuaLot(filter?: { bahanId?: string; statusLot?: string }): Promise<EntitasPenerimaanLot[]> {
    let hasil = [...this.lotList];
    if (filter?.bahanId) {
      hasil = hasil.filter((l) => l.bahanId === filter.bahanId);
    }
    if (filter?.statusLot) {
      hasil = hasil.filter((l) => l.statusLot === filter.statusLot);
    }
    return hasil.sort(
      (a, b) => new Date(b.tanggalPenerimaan).getTime() - new Date(a.tanggalPenerimaan).getTime(),
    );
  }

  public async ambilLotBerdasarkanId(id: string): Promise<EntitasPenerimaanLot | null> {
    const item = this.lotList.find((l) => l.id === id);
    return item ? { ...item } : null;
  }

  public async ambilLotBerdasarkanNomor(nomorLot: string): Promise<EntitasPenerimaanLot | null> {
    const item = this.lotList.find((l) => l.nomorLot === nomorLot);
    return item ? { ...item } : null;
  }

  public async ambilLotAktifLayakFEFO(bahanId: string): Promise<EntitasPenerimaanLot[]> {
    return this.lotList
      .filter(
        (l) =>
          l.bahanId === bahanId &&
          l.statusLot === "aktif" &&
          l.statusMutu === "layak_diterima" &&
          l.tanggalKedaluwarsa >= new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) &&
          l.sisaStokLot > 0,
      )
      .sort(
        (a, b) =>
          new Date(a.tanggalKedaluwarsa).getTime() - new Date(b.tanggalKedaluwarsa).getTime() ||
          new Date(a.tanggalPenerimaan).getTime() - new Date(b.tanggalPenerimaan).getTime(),
      );
  }

  public async perbaruiLot(
    id: string,
    perubahan: Partial<EntitasPenerimaanLot>,
  ): Promise<EntitasPenerimaanLot> {
    const idx = this.lotList.findIndex((l) => l.id === id);
    if (idx < 0) {
      throw new Error(`Lot dengan ID ${id} tidak ditemukan.`);
    }
    const updated: EntitasPenerimaanLot = {
      ...this.lotList[idx],
      ...perubahan,
      diperbaruiPada: new Date().toISOString(),
    };
    this.lotList[idx] = updated;
    return { ...updated };
  }

  // Kartu Stok Mutasi
  public async catatMutasiKartuStok(mutasi: EntitasKartuStokMutasi): Promise<EntitasKartuStokMutasi> {
    this.mutasiList.unshift({ ...mutasi });
    return { ...mutasi };
  }

  public async ambilKartuStok(bahanId?: string): Promise<EntitasKartuStokMutasi[]> {
    let hasil = [...this.mutasiList];
    if (bahanId) {
      hasil = hasil.filter((m) => m.bahanId === bahanId);
    }
    return hasil;
  }

  // Permintaan Bahan Dapur
  public async hitungNomorPermintaanBerikutnya(): Promise<string> {
    const d = new Date();
    const tgl = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const seq = String(this.permintaanList.length + 1).padStart(3, "0");
    return `REQ-${tgl}-${seq}`;
  }

  public async simpanPermintaanBahan(
    permintaan: EntitasPermintaanBahanDapur,
  ): Promise<EntitasPermintaanBahanDapur> {
    const idx = this.permintaanList.findIndex((p) => p.id === permintaan.id);
    if (idx >= 0) {
      this.permintaanList[idx] = { ...permintaan };
    } else {
      this.permintaanList.push({ ...permintaan });
    }
    return { ...permintaan };
  }

  public async ambilSemuaPermintaan(filter?: {
    status?: string;
    tanggal?: string;
  }): Promise<EntitasPermintaanBahanDapur[]> {
    let hasil = [...this.permintaanList];
    if (filter?.status) {
      hasil = hasil.filter((p) => p.status === filter.status);
    }
    if (filter?.tanggal) {
      hasil = hasil.filter((p) => p.tanggalKebutuhan === filter.tanggal);
    }
    return hasil.sort(
      (a, b) => new Date(b.waktuPermintaan).getTime() - new Date(a.waktuPermintaan).getTime(),
    );
  }

  public async ambilPermintaanBerdasarkanId(id: string): Promise<EntitasPermintaanBahanDapur | null> {
    const item = this.permintaanList.find((p) => p.id === id);
    return item ? { ...item } : null;
  }

  public async perbaruiPermintaan(
    id: string,
    perubahan: Partial<EntitasPermintaanBahanDapur>,
  ): Promise<EntitasPermintaanBahanDapur> {
    const idx = this.permintaanList.findIndex((p) => p.id === id);
    if (idx < 0) {
      throw new Error(`Permintaan bahan dengan ID ${id} tidak ditemukan.`);
    }
    const updated: EntitasPermintaanBahanDapur = {
      ...this.permintaanList[idx],
      ...perubahan,
    };
    this.permintaanList[idx] = updated;
    return { ...updated };
  }

  // Stok Opname
  public async simpanPenyesuaianOpname(
    opname: EntitasPenyesuaianStokOpname,
  ): Promise<EntitasPenyesuaianStokOpname> {
    this.opnameList.unshift({ ...opname });
    return { ...opname };
  }

  public async ambilSemuaOpname(bahanId?: string): Promise<EntitasPenyesuaianStokOpname[]> {
    let hasil = [...this.opnameList];
    if (bahanId) {
      hasil = hasil.filter((o) => o.bahanId === bahanId);
    }
    return hasil;
  }
}

type TabelInventory = "katalog_bahan_baku" | "penerimaan_lot_bahan" | "kartu_stok_mutasi" | "permintaan_bahan_dapur" | "penyesuaian_stok_opname";
const angkaInventory = new Set(["stok_minimum", "stok_fisik", "stok_layak", "stok_dialokasikan", "stok_ditahan", "kalori_per_100g", "protein_per_100g", "lemak_per_100g", "karbohidrat_per_100g", "versi", "jumlah_masuk", "sisa_stok_lot", "suhu_tercatat_celsius", "jumlah_keluar", "saldo_akhir", "stok_sistem_sebelum", "stok_fisik_aktual", "selisih"]);
const kolomKhusus: Record<string, string> = { daftarAlergen: "daftar_alergen_json", kaloriPer100g: "kalori_per_100g", proteinPer100g: "protein_per_100g", lemakPer100g: "lemak_per_100g", karbohidratPer100g: "karbohidrat_per_100g", daftarItem: "rincian_item_json" };

export class MySqlInventoryRepository implements InventoryRepository {
  private readonly pool: Pool | PoolConnection;
  constructor(pool: Pool | PoolConnection) { this.pool = pool; }

  async transaksi<T>(aksi: (repository: InventoryRepository) => Promise<T>): Promise<T> {
    if (!("getConnection" in this.pool)) return aksi(this);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("SELECT id FROM katalog_bahan_baku ORDER BY id FOR UPDATE");
      const result = await aksi(new MySqlInventoryRepository(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  private async baca<T>(table: TabelInventory, where = "", params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT * FROM " + table + (where ? " WHERE " + where : ""), parameterMysql(params));
    return rows.map((row) => {
      const item: Record<string, unknown> = {};
      for (const [column, raw] of Object.entries(row)) {
        const key = Object.keys(kolomKhusus).find((key) => kolomKhusus[key] === column) ?? column.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
        let value = raw;
        if (value !== null && angkaInventory.has(column)) value = Number(value);
        else if (column.endsWith("_json")) value = typeof value === "string" ? JSON.parse(value) : value;
        else if (value instanceof Date) value = column.startsWith("tanggal_") ? value.toISOString().slice(0, 10) : value.toISOString();
        else if (typeof value === "string" && (column.startsWith("waktu_") || column.endsWith("_pada"))) value = waktuMysql(value);
        item[key] = value;
      }
      return item as T;
    });
  }

  private kolom(key: string): string {
    const column = kolomKhusus[key] ?? key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
    if (!/^[a-z][a-z0-9_]*$/.test(column)) throw new Error("Kolom inventory tidak valid.");
    return column;
  }

  private async simpan<T extends object>(table: TabelInventory, item: T): Promise<T> {
    const entries = Object.entries(item);
    const columns = entries.map(([key]) => this.kolom(key));
    const values = entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value);
    await this.pool.execute("INSERT INTO " + table + " (" + columns.join(",") + ") VALUES (" + columns.map(() => "?").join(",") + ")", parameterMysql(values));
    return item;
  }

  private async ubah<T extends { id: string }>(table: TabelInventory, id: string, patch: Partial<T>): Promise<T> {
    const old = (await this.baca<T>(table, "id = ?", [id]))[0];
    if (!old) throw new Error("Data inventory tidak ditemukan.");
    const entries = Object.entries(patch).filter(([key, value]) => key !== "id" && value !== undefined);
    if (entries.length) {
      await this.pool.execute("UPDATE " + table + " SET " + entries.map(([key]) => this.kolom(key) + " = ?").join(",") + " WHERE id = ?",
        parameterMysql([...entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value), id]));
    }
    return { ...old, ...patch };
  }

  ambilSemuaBahan(): Promise<EntitasKatalogBahan[]> { return this.baca("katalog_bahan_baku"); }
  async ambilBahanBerdasarkanId(id: string): Promise<EntitasKatalogBahan | null> { return (await this.baca<EntitasKatalogBahan>("katalog_bahan_baku", "id = ?", [id]))[0] ?? null; }
  async ambilBahanBerdasarkanKode(kode: string): Promise<EntitasKatalogBahan | null> { return (await this.baca<EntitasKatalogBahan>("katalog_bahan_baku", "kode_bahan = ?", [kode]))[0] ?? null; }
  simpanBahan(item: EntitasKatalogBahan): Promise<EntitasKatalogBahan> { return this.simpan("katalog_bahan_baku", item); }
  async perbaruiStokBahan(id: string, perubahan: { stokFisik?: number; stokLayak?: number; stokDialokasikan?: number; stokDitahan?: number }): Promise<EntitasKatalogBahan> {
    const old = await this.ambilBahanBerdasarkanId(id);
    if (!old) throw new Error("Bahan tidak ditemukan.");
    return this.ubah<EntitasKatalogBahan>("katalog_bahan_baku", id, { ...perubahan, versi: old.versi + 1, diperbaruiPada: new Date().toISOString() });
  }

  async hitungNomorLotBerikutnya(): Promise<string> { return "LOT-" + crypto.randomUUID(); }
  simpanPenerimaanLot(item: EntitasPenerimaanLot): Promise<EntitasPenerimaanLot> { return this.simpan("penerimaan_lot_bahan", item); }
  ambilSemuaLot(filter?: { bahanId?: string; statusLot?: string }): Promise<EntitasPenerimaanLot[]> {
    const where: string[] = []; const params: string[] = [];
    if (filter?.bahanId) { where.push("bahan_id = ?"); params.push(filter.bahanId); }
    if (filter?.statusLot) { where.push("status_lot = ?"); params.push(filter.statusLot); }
    return this.baca("penerimaan_lot_bahan", where.join(" AND "), params);
  }
  async ambilLotBerdasarkanId(id: string): Promise<EntitasPenerimaanLot | null> { return (await this.baca<EntitasPenerimaanLot>("penerimaan_lot_bahan", "id = ?", [id]))[0] ?? null; }
  async ambilLotBerdasarkanNomor(nomor: string): Promise<EntitasPenerimaanLot | null> { return (await this.baca<EntitasPenerimaanLot>("penerimaan_lot_bahan", "nomor_lot = ?", [nomor]))[0] ?? null; }
  async ambilLotAktifLayakFEFO(bahanId: string): Promise<EntitasPenerimaanLot[]> {
    const hariIni = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const lots = await this.baca<EntitasPenerimaanLot>("penerimaan_lot_bahan", "bahan_id = ? AND status_lot = 'aktif' AND status_mutu = 'layak_diterima' AND tanggal_kedaluwarsa >= ? AND sisa_stok_lot > 0", [bahanId, hariIni]);
    return lots.sort((a, b) => a.tanggalKedaluwarsa.localeCompare(b.tanggalKedaluwarsa) || a.tanggalPenerimaan.localeCompare(b.tanggalPenerimaan));
  }
  perbaruiLot(id: string, patch: Partial<EntitasPenerimaanLot>): Promise<EntitasPenerimaanLot> { return this.ubah("penerimaan_lot_bahan", id, { ...patch, diperbaruiPada: new Date().toISOString() }); }

  catatMutasiKartuStok(item: EntitasKartuStokMutasi): Promise<EntitasKartuStokMutasi> { return this.simpan("kartu_stok_mutasi", item); }
  ambilKartuStok(bahanId?: string): Promise<EntitasKartuStokMutasi[]> { return this.baca("kartu_stok_mutasi", bahanId ? "bahan_id = ?" : "", bahanId ? [bahanId] : []); }

  async hitungNomorPermintaanBerikutnya(): Promise<string> { return "REQ-" + crypto.randomUUID(); }
  simpanPermintaanBahan(item: EntitasPermintaanBahanDapur): Promise<EntitasPermintaanBahanDapur> { return this.simpan("permintaan_bahan_dapur", item); }
  ambilSemuaPermintaan(filter?: { status?: string; tanggal?: string }): Promise<EntitasPermintaanBahanDapur[]> {
    const where: string[] = []; const params: string[] = [];
    if (filter?.status) { where.push("status = ?"); params.push(filter.status); }
    if (filter?.tanggal) { where.push("tanggal_kebutuhan = ?"); params.push(filter.tanggal); }
    return this.baca("permintaan_bahan_dapur", where.join(" AND "), params);
  }
  async ambilPermintaanBerdasarkanId(id: string): Promise<EntitasPermintaanBahanDapur | null> { return (await this.baca<EntitasPermintaanBahanDapur>("permintaan_bahan_dapur", "id = ?", [id]))[0] ?? null; }
  perbaruiPermintaan(id: string, patch: Partial<EntitasPermintaanBahanDapur>): Promise<EntitasPermintaanBahanDapur> { return this.ubah("permintaan_bahan_dapur", id, patch); }

  simpanPenyesuaianOpname(item: EntitasPenyesuaianStokOpname): Promise<EntitasPenyesuaianStokOpname> { return this.simpan("penyesuaian_stok_opname", item); }
  ambilSemuaOpname(bahanId?: string): Promise<EntitasPenyesuaianStokOpname[]> { return this.baca("penyesuaian_stok_opname", bahanId ? "bahan_id = ?" : "", bahanId ? [bahanId] : []); }
}
