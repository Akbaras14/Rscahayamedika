import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Repositori data untuk domain Rawat Inap (Tahap 4 — Petugas Rawat Inap).
 * Menyediakan implementasi InMemory (dengan seed) dan implementasi MySQL terparameterisasi.
 * Acuan: BRD Versi 4.0 Bab IV.4.3 & IV.4.5, Bab XVIII (AB-002, AB-020, AB-030, AB-031, AB-032, AB-034).
 */

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { SEED_PENGAJUAN_RAWAT_INAP_SINTETIS } from "../../../clinical-nutrition-service/src/database/seeds/clinical-nutrition.seed.ts";
import {
  SEED_BANGSAL_SINTETIS,
  SEED_EPISODE_RAWAT_INAP_SINTETIS,
  SEED_KAMAR_SINTETIS,
  SEED_PENEMPATAN_TEMPAT_TIDUR_SINTETIS,
  SEED_RIWAYAT_PERPINDAHAN_SINTETIS,
  SEED_TEMPAT_TIDUR_SINTETIS,
} from "../database/seeds/inpatient.seed.ts";
import type {
  AlasanPemulangan,
  EntitasBangsal,
  EntitasEpisodeRawatInap,
  EntitasKamar,
  EntitasPenempatanTempatTidur,
  EntitasRiwayatPerpindahanTempatTidur,
  EntitasTempatTidur,
  ItemPengajuanRawatInapDto,
  StatusPengajuanRawatInap,
  StatusTempatTidur,
} from "../model/inpatient.model.ts";

export interface InpatientRepository {
  transaksi?<T>(aksi: (repo: InpatientRepository) => Promise<T>): Promise<T>;
  ambilSemuaBangsal(): Promise<readonly EntitasBangsal[]>;
  ambilBangsalBerdasarkanId(id: string): Promise<EntitasBangsal | null>;
  ambilSemuaKamar(bangsalId?: string): Promise<readonly EntitasKamar[]>;
  ambilSemuaTempatTidur(
    bangsalId?: string,
  ): Promise<readonly EntitasTempatTidur[]>;
  ambilTempatTidurBerdasarkanId(id: string): Promise<EntitasTempatTidur | null>;
  perbaruiStatusTempatTidur(
    id: string,
    status: StatusTempatTidur,
  ): Promise<void>;
  ambilSemuaPengajuan(
    status?: string,
  ): Promise<readonly ItemPengajuanRawatInapDto[]>;
  ambilPengajuanBerdasarkanId(
    id: string,
  ): Promise<ItemPengajuanRawatInapDto | null>;
  perbaruiStatusPengajuan(
    id: string,
    status: StatusPengajuanRawatInap,
    alasan?: string,
  ): Promise<void>;
  simpanEpisodeRawatInap(episode: EntitasEpisodeRawatInap): Promise<void>;
  ambilSemuaEpisode(filter?: {
    status?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasEpisodeRawatInap[]>;
  ambilEpisodeBerdasarkanId(id: string): Promise<EntitasEpisodeRawatInap | null>;
  perbaruiLokasiEpisode(
    id: string,
    bangsalId: string,
    kamarId: string,
    tempatTidurId: string,
    versiBaru: number,
  ): Promise<void>;
  pulangkanEpisode(
    id: string,
    param: {
      alasan: AlasanPemulangan;
      catatan: string;
      dipulangkanOlehId: string;
      dipulangkanOlehNama: string;
      waktuKeluar: string;
      versiBaru: number;
    },
  ): Promise<void>;
  simpanPenempatanTempatTidur(
    penempatan: EntitasPenempatanTempatTidur,
  ): Promise<void>;
  selesaikanPenempatanAktif(
    tempatTidurId: string,
    waktuKeluar: string,
  ): Promise<void>;
  ambilPenempatanAktifBerdasarkanBed(
    tempatTidurId: string,
  ): Promise<EntitasPenempatanTempatTidur | null>;
  simpanRiwayatPerpindahan(
    riwayat: EntitasRiwayatPerpindahanTempatTidur,
  ): Promise<void>;
  ambilSemuaRiwayatPerpindahan(
    episodeId?: string,
  ): Promise<readonly EntitasRiwayatPerpindahanTempatTidur[]>;
}

export class InMemoryInpatientRepository implements InpatientRepository {
  private bangsalList: EntitasBangsal[] = [...SEED_BANGSAL_SINTETIS];
  private kamarList: EntitasKamar[] = [...SEED_KAMAR_SINTETIS];
  private tempatTidurList: EntitasTempatTidur[] = [
    ...SEED_TEMPAT_TIDUR_SINTETIS,
  ];
  private pengajuanList: ItemPengajuanRawatInapDto[] =
    SEED_PENGAJUAN_RAWAT_INAP_SINTETIS.map((p) => ({
      id: p.id,
      nomorPengajuan: p.nomorPengajuan,
      pasienId: p.pasienId,
      kunjunganId: p.kunjunganId,
      nomorRekamMedis: p.nomorRekamMedis,
      namaPasien: p.namaPasien,
      dokterPengajuId: p.dokterPengajuId,
      dokterPengajuNama: p.dokterPengajuNama,
      diagnosisUtama: p.diagnosisUtama,
      alasanRawatInap: p.alasanRawatInap,
      prioritasRawatInap: p.prioritasRawatInap,
      rekomendasiBangsal: p.rekomendasiBangsal,
      kebutuhanKhusus: p.kebutuhanKhusus ?? "-",
      instruksiDietId: p.instruksiDietId,
      statusPengajuan: p.statusPengajuan as StatusPengajuanRawatInap,
      dibuatPada: (p as unknown as { dibuatPada?: string; diajukanPada: string }).dibuatPada ?? (p as unknown as { diajukanPada: string }).diajukanPada,
    }));
  private episodeList: EntitasEpisodeRawatInap[] = [
    ...SEED_EPISODE_RAWAT_INAP_SINTETIS,
  ];
  private penempatanList: EntitasPenempatanTempatTidur[] = [
    ...SEED_PENEMPATAN_TEMPAT_TIDUR_SINTETIS,
  ];
  private riwayatPerpindahanList: EntitasRiwayatPerpindahanTempatTidur[] = [
    ...SEED_RIWAYAT_PERPINDAHAN_SINTETIS,
  ];

  public async ambilSemuaBangsal(): Promise<readonly EntitasBangsal[]> {
    return [...this.bangsalList];
  }

  public async ambilBangsalBerdasarkanId(
    id: string,
  ): Promise<EntitasBangsal | null> {
    const b = this.bangsalList.find((item) => item.id === id);
    return b ? { ...b } : null;
  }

  public async ambilSemuaKamar(
    bangsalId?: string,
  ): Promise<readonly EntitasKamar[]> {
    let hasil = [...this.kamarList];
    if (bangsalId) {
      hasil = hasil.filter((k) => k.bangsalId === bangsalId);
    }
    return hasil;
  }

  public async ambilSemuaTempatTidur(
    bangsalId?: string,
  ): Promise<readonly EntitasTempatTidur[]> {
    let hasil = [...this.tempatTidurList];
    if (bangsalId) {
      hasil = hasil.filter((t) => t.bangsalId === bangsalId);
    }
    return hasil;
  }

  public async ambilTempatTidurBerdasarkanId(
    id: string,
  ): Promise<EntitasTempatTidur | null> {
    const t = this.tempatTidurList.find((item) => item.id === id);
    return t ? { ...t } : null;
  }

  public async perbaruiStatusTempatTidur(
    id: string,
    status: StatusTempatTidur,
  ): Promise<void> {
    const idx = this.tempatTidurList.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.tempatTidurList[idx] = {
        ...this.tempatTidurList[idx],
        statusTempatTidur: status,
        diperbaruiPada: new Date().toISOString(),
      };
    }
  }

  public async ambilSemuaPengajuan(
    status?: string,
  ): Promise<readonly ItemPengajuanRawatInapDto[]> {
    let hasil = [...this.pengajuanList];
    if (status && status !== "SEMUA") {
      hasil = hasil.filter((p) => p.statusPengajuan === status);
    }
    return hasil;
  }

  public async ambilPengajuanBerdasarkanId(
    id: string,
  ): Promise<ItemPengajuanRawatInapDto | null> {
    const p = this.pengajuanList.find((item) => item.id === id);
    return p ? { ...p } : null;
  }

  public async perbaruiStatusPengajuan(
    id: string,
    status: StatusPengajuanRawatInap,
    alasan?: string,
  ): Promise<void> {
    const idx = this.pengajuanList.findIndex((item) => item.id === id);
    if (idx !== -1) {
      const p = this.pengajuanList[idx];
      this.pengajuanList[idx] = {
        ...p,
        statusPengajuan: status,
        alasanPenundaan: status === "ditunda" ? alasan : p.alasanPenundaan,
        alasanPenolakan: status === "ditolak" ? alasan : p.alasanPenolakan,
      };
    }
  }

  public async simpanEpisodeRawatInap(
    episode: EntitasEpisodeRawatInap,
  ): Promise<void> {
    this.episodeList.push({ ...episode });
  }

  public async ambilSemuaEpisode(filter?: {
    status?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasEpisodeRawatInap[]> {
    let hasil = [...this.episodeList];
    if (filter?.status && filter.status !== "SEMUA") {
      hasil = hasil.filter((e) => e.statusPerawatan === filter.status);
    }
    if (filter?.bangsalId && filter.bangsalId !== "SEMUA") {
      hasil = hasil.filter((e) => e.bangsalId === filter.bangsalId);
    }
    return hasil;
  }

  public async ambilEpisodeBerdasarkanId(
    id: string,
  ): Promise<EntitasEpisodeRawatInap | null> {
    const e = this.episodeList.find((item) => item.id === id);
    return e ? { ...e } : null;
  }

  public async perbaruiLokasiEpisode(
    id: string,
    bangsalId: string,
    kamarId: string,
    tempatTidurId: string,
    versiBaru: number,
  ): Promise<void> {
    const idx = this.episodeList.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.episodeList[idx] = {
        ...this.episodeList[idx],
        bangsalId,
        kamarId,
        tempatTidurId,
        versi: versiBaru,
        diperbaruiPada: new Date().toISOString(),
      };
    }
  }

  public async pulangkanEpisode(
    id: string,
    param: {
      alasan: AlasanPemulangan;
      catatan: string;
      dipulangkanOlehId: string;
      dipulangkanOlehNama: string;
      waktuKeluar: string;
      versiBaru: number;
    },
  ): Promise<void> {
    const idx = this.episodeList.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.episodeList[idx] = {
        ...this.episodeList[idx],
        statusPerawatan: param.alasan === "meninggal" ? "meninggal" : "selesai",
        alasanPemulangan: param.alasan,
        catatanPemulangan: param.catatan,
        waktuKeluar: param.waktuKeluar,
        dipulangkanOlehId: param.dipulangkanOlehId,
        dipulangkanOlehNama: param.dipulangkanOlehNama,
        versi: param.versiBaru,
        diperbaruiPada: new Date().toISOString(),
      };
    }
  }

  public async simpanPenempatanTempatTidur(
    penempatan: EntitasPenempatanTempatTidur,
  ): Promise<void> {
    this.penempatanList.push({ ...penempatan });
  }

  public async selesaikanPenempatanAktif(
    tempatTidurId: string,
    waktuKeluar: string,
  ): Promise<void> {
    const idx = this.penempatanList.findIndex(
      (p) => p.tempatTidurId === tempatTidurId && p.statusPenempatan === "aktif",
    );
    if (idx !== -1) {
      this.penempatanList[idx] = {
        ...this.penempatanList[idx],
        statusPenempatan: "selesai",
        waktuKeluar,
      };
    }
  }

  public async ambilPenempatanAktifBerdasarkanBed(
    tempatTidurId: string,
  ): Promise<EntitasPenempatanTempatTidur | null> {
    const p = this.penempatanList.find(
      (item) =>
        item.tempatTidurId === tempatTidurId &&
        item.statusPenempatan === "aktif",
    );
    return p ? { ...p } : null;
  }

  public async simpanRiwayatPerpindahan(
    riwayat: EntitasRiwayatPerpindahanTempatTidur,
  ): Promise<void> {
    this.riwayatPerpindahanList.push({ ...riwayat });
  }

  public async ambilSemuaRiwayatPerpindahan(
    episodeId?: string,
  ): Promise<readonly EntitasRiwayatPerpindahanTempatTidur[]> {
    let hasil = [...this.riwayatPerpindahanList];
    if (episodeId) {
      hasil = hasil.filter((r) => r.episodeRawatInapId === episodeId);
    }
    return hasil;
  }

  public tambahPengajuanSintetis(pengajuan: ItemPengajuanRawatInapDto): void {
    this.pengajuanList.push({ ...pengajuan });
  }
}

export class MySqlInpatientRepository implements InpatientRepository {
  private readonly pool: Pool | PoolConnection;
  private readonly tabelPengajuan: string;

  constructor(pool: Pool | PoolConnection) {
    this.pool = pool;
    const skema = process.env.DB_DATABASE_CLINICAL ?? "manajemen_gizi_pasien_clinical";
    if (!/^[a-zA-Z0-9_]+$/.test(skema)) throw new Error("Nama skema clinical tidak valid.");
    this.tabelPengajuan = `\`${skema}\`.pengajuan_rawat_inap`;
  }

  async transaksi<T>(aksi: (repo: InpatientRepository) => Promise<T>): Promise<T> {
    if (!("getConnection" in this.pool)) return aksi(this);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("SELECT id FROM tempat_tidur ORDER BY id FOR UPDATE");
      const result = await aksi(new MySqlInpatientRepository(connection));
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  public async ambilSemuaBangsal(): Promise<readonly EntitasBangsal[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, kode_bangsal, nama_bangsal, kelas_pelayanan, kapasitas_tempat_tidur, aktif, dibuat_pada
       FROM bangsal ORDER BY kode_bangsal ASC`,
    );
    return rows.map((r) => this.petakanBarisBangsal(r));
  }

  public async ambilBangsalBerdasarkanId(
    id: string,
  ): Promise<EntitasBangsal | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, kode_bangsal, nama_bangsal, kelas_pelayanan, kapasitas_tempat_tidur, aktif, dibuat_pada
       FROM bangsal WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (rows.length === 0) return null;
    return this.petakanBarisBangsal(rows[0]);
  }

  public async ambilSemuaKamar(
    bangsalId?: string,
  ): Promise<readonly EntitasKamar[]> {
    let sql = `SELECT id, bangsal_id, nomor_kamar, nama_kamar, kapasitas_tempat_tidur, aktif, dibuat_pada FROM kamar`;
    const params: string[] = [];
    if (bangsalId) {
      sql += ` WHERE bangsal_id = ?`;
      params.push(bangsalId);
    }
    sql += ` ORDER BY nomor_kamar ASC`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisKamar(r));
  }

  public async ambilSemuaTempatTidur(
    bangsalId?: string,
  ): Promise<readonly EntitasTempatTidur[]> {
    let sql = `SELECT id, kamar_id, bangsal_id, nomor_tempat_tidur, status_tempat_tidur, aktif, diperbarui_pada FROM tempat_tidur`;
    const params: string[] = [];
    if (bangsalId) {
      sql += ` WHERE bangsal_id = ?`;
      params.push(bangsalId);
    }
    sql += ` ORDER BY nomor_tempat_tidur ASC`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisTempatTidur(r));
  }

  public async ambilTempatTidurBerdasarkanId(
    id: string,
  ): Promise<EntitasTempatTidur | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, kamar_id, bangsal_id, nomor_tempat_tidur, status_tempat_tidur, aktif, diperbarui_pada
       FROM tempat_tidur WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (rows.length === 0) return null;
    return this.petakanBarisTempatTidur(rows[0]);
  }

  public async perbaruiStatusTempatTidur(
    id: string,
    status: StatusTempatTidur,
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE tempat_tidur SET status_tempat_tidur = ?, diperbarui_pada = NOW(3) WHERE id = ?`,
      parameterMysql([status, id]),
    );
  }

  public async ambilSemuaPengajuan(
    status?: string,
  ): Promise<readonly ItemPengajuanRawatInapDto[]> {
    let sql = `SELECT id, nomor_pengajuan, pasien_id, kunjungan_id, nomor_rekam_medis, nama_pasien, dokter_pengaju_id, dokter_pengaju_nama,
               diagnosis_utama, alasan_rawat_inap, prioritas_rawat_inap, rekomendasi_bangsal, kebutuhan_khusus, instruksi_diet_id,
               status_pengajuan, alasan_penolakan, alasan_penundaan, diajukan_pada AS dibuat_pada
               FROM ${this.tabelPengajuan}`;
    const params: string[] = [];
    if (status && status !== "SEMUA") {
      sql += ` WHERE status_pengajuan = ?`;
      params.push(status);
    }
    sql += ` ORDER BY diajukan_pada DESC`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisPengajuan(r));
  }

  public async ambilPengajuanBerdasarkanId(
    id: string,
  ): Promise<ItemPengajuanRawatInapDto | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, nomor_pengajuan, pasien_id, kunjungan_id, nomor_rekam_medis, nama_pasien, dokter_pengaju_id, dokter_pengaju_nama,
              diagnosis_utama, alasan_rawat_inap, prioritas_rawat_inap, rekomendasi_bangsal, kebutuhan_khusus, instruksi_diet_id,
              status_pengajuan, alasan_penolakan, alasan_penundaan, diajukan_pada AS dibuat_pada
       FROM ${this.tabelPengajuan} WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (rows.length === 0) return null;
    return this.petakanBarisPengajuan(rows[0]);
  }

  public async perbaruiStatusPengajuan(
    id: string,
    status: StatusPengajuanRawatInap,
    alasan?: string,
  ): Promise<void> {
    if (status === "ditunda") {
      await this.pool.execute(
        `UPDATE ${this.tabelPengajuan} SET status_pengajuan = ?, alasan_penundaan = ? WHERE id = ?`,
        parameterMysql([status, alasan ?? null, id]),
      );
    } else if (status === "ditolak") {
      await this.pool.execute(
        `UPDATE ${this.tabelPengajuan} SET status_pengajuan = ?, alasan_penolakan = ? WHERE id = ?`,
        parameterMysql([status, alasan ?? null, id]),
      );
    } else {
      await this.pool.execute(
        `UPDATE ${this.tabelPengajuan} SET status_pengajuan = ? WHERE id = ?`,
        parameterMysql([status, id]),
      );
    }
  }

  public async simpanEpisodeRawatInap(
    episode: EntitasEpisodeRawatInap,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO episode_rawat_inap (
        id, nomor_episode, pasien_id, kunjungan_id, pengajuan_id, dokter_dpjp_id, dokter_dpjp_nama,
        diagnosis_utama, bangsal_id, kamar_id, tempat_tidur_id, waktu_masuk, status_perawatan, versi, dibuat_pada, diperbarui_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      parameterMysql([
        episode.id,
        episode.nomorEpisode,
        episode.pasienId,
        episode.kunjunganId,
        episode.pengajuanId,
        episode.dokterDpjpId,
        episode.dokterDpjpNama,
        episode.diagnosisUtama,
        episode.bangsalId,
        episode.kamarId,
        episode.tempatTidurId,
        new Date(episode.waktuMasuk),
        episode.statusPerawatan,
        episode.versi,
      ]),
    );
  }

  public async ambilSemuaEpisode(filter?: {
    status?: string;
    bangsalId?: string;
  }): Promise<readonly EntitasEpisodeRawatInap[]> {
    let sql = `SELECT id, nomor_episode, pasien_id, kunjungan_id, pengajuan_id, dokter_dpjp_id, dokter_dpjp_nama,
               diagnosis_utama, bangsal_id, kamar_id, tempat_tidur_id, waktu_masuk, waktu_keluar, status_perawatan,
               alasan_pemulangan, catatan_pemulangan, dipulangkan_oleh_id, dipulangkan_oleh_nama, versi, dibuat_pada, diperbarui_pada
               FROM episode_rawat_inap WHERE 1=1`;
    const params: string[] = [];
    if (filter?.status && filter.status !== "SEMUA") {
      sql += ` AND status_perawatan = ?`;
      params.push(filter.status);
    }
    if (filter?.bangsalId && filter.bangsalId !== "SEMUA") {
      sql += ` AND bangsal_id = ?`;
      params.push(filter.bangsalId);
    }
    sql += ` ORDER BY dibuat_pada DESC`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisEpisode(r));
  }

  public async ambilEpisodeBerdasarkanId(
    id: string,
  ): Promise<EntitasEpisodeRawatInap | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, nomor_episode, pasien_id, kunjungan_id, pengajuan_id, dokter_dpjp_id, dokter_dpjp_nama,
              diagnosis_utama, bangsal_id, kamar_id, tempat_tidur_id, waktu_masuk, waktu_keluar, status_perawatan,
              alasan_pemulangan, catatan_pemulangan, dipulangkan_oleh_id, dipulangkan_oleh_nama, versi, dibuat_pada, diperbarui_pada
       FROM episode_rawat_inap WHERE id = ? LIMIT 1`,
      parameterMysql([id]),
    );
    if (rows.length === 0) return null;
    return this.petakanBarisEpisode(rows[0]);
  }

  public async perbaruiLokasiEpisode(
    id: string,
    bangsalId: string,
    kamarId: string,
    tempatTidurId: string,
    versiBaru: number,
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE episode_rawat_inap SET bangsal_id = ?, kamar_id = ?, tempat_tidur_id = ?, versi = ?, diperbarui_pada = NOW(3)
       WHERE id = ?`,
      parameterMysql([bangsalId, kamarId, tempatTidurId, versiBaru, id]),
    );
  }

  public async pulangkanEpisode(
    id: string,
    param: {
      alasan: AlasanPemulangan;
      catatan: string;
      dipulangkanOlehId: string;
      dipulangkanOlehNama: string;
      waktuKeluar: string;
      versiBaru: number;
    },
  ): Promise<void> {
    const statusPerawatan = param.alasan === "meninggal" ? "meninggal" : "selesai";
    await this.pool.execute(
      `UPDATE episode_rawat_inap SET status_perawatan = ?, alasan_pemulangan = ?, catatan_pemulangan = ?, waktu_keluar = ?,
       dipulangkan_oleh_id = ?, dipulangkan_oleh_nama = ?, versi = ?, diperbarui_pada = NOW(3)
       WHERE id = ?`,
      parameterMysql([
        statusPerawatan,
        param.alasan,
        param.catatan,
        new Date(param.waktuKeluar),
        param.dipulangkanOlehId,
        param.dipulangkanOlehNama,
        param.versiBaru,
        id,
      ]),
    );
  }

  public async simpanPenempatanTempatTidur(
    penempatan: EntitasPenempatanTempatTidur,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO penempatan_tempat_tidur (
        id, episode_rawat_inap_id, pasien_id, tempat_tidur_id, bangsal_id, kamar_id, waktu_masuk, status_penempatan, dicatat_oleh_id, dicatat_oleh_nama, dibuat_pada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      parameterMysql([
        penempatan.id,
        penempatan.episodeRawatInapId,
        penempatan.pasienId,
        penempatan.tempatTidurId,
        penempatan.bangsalId,
        penempatan.kamarId,
        new Date(penempatan.waktuMasuk),
        penempatan.statusPenempatan,
        penempatan.dicatatOlehId,
        penempatan.dicatatOlehNama,
      ]),
    );
  }

  public async selesaikanPenempatanAktif(
    tempatTidurId: string,
    waktuKeluar: string,
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE penempatan_tempat_tidur SET status_penempatan = 'selesai', waktu_keluar = ?
       WHERE tempat_tidur_id = ? AND status_penempatan = 'aktif'`,
      parameterMysql([new Date(waktuKeluar), tempatTidurId]),
    );
  }

  public async ambilPenempatanAktifBerdasarkanBed(
    tempatTidurId: string,
  ): Promise<EntitasPenempatanTempatTidur | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, episode_rawat_inap_id, pasien_id, tempat_tidur_id, bangsal_id, kamar_id, waktu_masuk, waktu_keluar, status_penempatan, dicatat_oleh_id, dicatat_oleh_nama, dibuat_pada
       FROM penempatan_tempat_tidur WHERE tempat_tidur_id = ? AND status_penempatan = 'aktif' LIMIT 1`,
      parameterMysql([tempatTidurId]),
    );
    if (rows.length === 0) return null;
    return this.petakanBarisPenempatan(rows[0]);
  }

  public async simpanRiwayatPerpindahan(
    riwayat: EntitasRiwayatPerpindahanTempatTidur,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO riwayat_perpindahan_tempat_tidur (
        id, episode_rawat_inap_id, pasien_id, bangsal_asal_id, kamar_asal_id, tempat_tidur_asal_id,
        bangsal_tujuan_id, kamar_tujuan_id, tempat_tidur_tujuan_id, alasan_pemindahan, dipindahkan_oleh_id, dipindahkan_oleh_nama, waktu_pemindahan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      parameterMysql([
        riwayat.id,
        riwayat.episodeRawatInapId,
        riwayat.pasienId,
        riwayat.bangsalAsalId,
        riwayat.kamarAsalId,
        riwayat.tempatTidurAsalId,
        riwayat.bangsalTujuanId,
        riwayat.kamarTujuanId,
        riwayat.tempatTidurTujuanId,
        riwayat.alasanPemindahan,
        riwayat.dipindahkanOlehId,
        riwayat.dipindahkanOlehNama,
      ]),
    );
  }

  public async ambilSemuaRiwayatPerpindahan(
    episodeId?: string,
  ): Promise<readonly EntitasRiwayatPerpindahanTempatTidur[]> {
    let sql = `SELECT id, episode_rawat_inap_id, pasien_id, bangsal_asal_id, kamar_asal_id, tempat_tidur_asal_id,
               bangsal_tujuan_id, kamar_tujuan_id, tempat_tidur_tujuan_id, alasan_pemindahan, dipindahkan_oleh_id, dipindahkan_oleh_nama, waktu_pemindahan
               FROM riwayat_perpindahan_tempat_tidur`;
    const params: string[] = [];
    if (episodeId) {
      sql += ` WHERE episode_rawat_inap_id = ?`;
      params.push(episodeId);
    }
    sql += ` ORDER BY waktu_pemindahan DESC`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, parameterMysql(params));
    return rows.map((r) => this.petakanBarisRiwayatPindah(r));
  }

  private petakanBarisBangsal(r: RowDataPacket): EntitasBangsal {
    return {
      id: r.id,
      kodeBangsal: r.kode_bangsal,
      namaBangsal: r.nama_bangsal,
      kelasPelayanan: r.kelas_pelayanan,
      kapasitasTempatTidur: r.kapasitas_tempat_tidur,
      aktif: Boolean(r.aktif),
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  private petakanBarisKamar(r: RowDataPacket): EntitasKamar {
    return {
      id: r.id,
      bangsalId: r.bangsal_id,
      nomorKamar: r.nomor_kamar,
      namaKamar: r.nama_kamar,
      kapasitasTempatTidur: r.kapasitas_tempat_tidur,
      aktif: Boolean(r.aktif),
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  private petakanBarisTempatTidur(r: RowDataPacket): EntitasTempatTidur {
    return {
      id: r.id,
      kamarId: r.kamar_id,
      bangsalId: r.bangsal_id,
      nomorTempatTidur: r.nomor_tempat_tidur,
      statusTempatTidur: r.status_tempat_tidur,
      aktif: Boolean(r.aktif),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisPengajuan(r: RowDataPacket): ItemPengajuanRawatInapDto {
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
      alasanPenolakan: r.alasan_penolakan,
      alasanPenundaan: r.alasan_penundaan,
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  private petakanBarisEpisode(r: RowDataPacket): EntitasEpisodeRawatInap {
    return {
      id: r.id,
      nomorEpisode: r.nomor_episode,
      pasienId: r.pasien_id,
      kunjunganId: r.kunjungan_id,
      pengajuanId: r.pengajuan_id,
      dokterDpjpId: r.dokter_dpjp_id,
      dokterDpjpNama: r.dokter_dpjp_nama,
      diagnosisUtama: r.diagnosis_utama,
      bangsalId: r.bangsal_id,
      kamarId: r.kamar_id,
      tempatTidurId: r.tempat_tidur_id,
      waktuMasuk: waktuMysql(r.waktu_masuk),
      waktuKeluar: r.waktu_keluar ? waktuMysql(r.waktu_keluar) : null,
      statusPerawatan: r.status_perawatan,
      alasanPemulangan: r.alasan_pemulangan,
      catatanPemulangan: r.catatan_pemulangan,
      dipulangkanOlehId: r.dipulangkan_oleh_id,
      dipulangkanOlehNama: r.dipulangkan_oleh_nama,
      versi: r.versi,
      dibuatPada: waktuMysql(r.dibuat_pada),
      diperbaruiPada: waktuMysql(r.diperbarui_pada),
    };
  }

  private petakanBarisPenempatan(r: RowDataPacket): EntitasPenempatanTempatTidur {
    return {
      id: r.id,
      episodeRawatInapId: r.episode_rawat_inap_id,
      pasienId: r.pasien_id,
      tempatTidurId: r.tempat_tidur_id,
      bangsalId: r.bangsal_id,
      kamarId: r.kamar_id,
      waktuMasuk: waktuMysql(r.waktu_masuk),
      waktuKeluar: r.waktu_keluar ? waktuMysql(r.waktu_keluar) : null,
      statusPenempatan: r.status_penempatan,
      dicatatOlehId: r.dicatat_oleh_id,
      dicatatOlehNama: r.dicatat_oleh_nama,
      dibuatPada: waktuMysql(r.dibuat_pada),
    };
  }

  private petakanBarisRiwayatPindah(
    r: RowDataPacket,
  ): EntitasRiwayatPerpindahanTempatTidur {
    return {
      id: r.id,
      episodeRawatInapId: r.episode_rawat_inap_id,
      pasienId: r.pasien_id,
      bangsalAsalId: r.bangsal_asal_id,
      kamarAsalId: r.kamar_asal_id,
      tempatTidurAsalId: r.tempat_tidur_asal_id,
      bangsalTujuanId: r.bangsal_tujuan_id,
      kamarTujuanId: r.kamar_tujuan_id,
      tempatTidurTujuanId: r.tempat_tidur_tujuan_id,
      alasanPemindahan: r.alasan_pemindahan,
      dipindahkanOlehId: r.dipindahkan_oleh_id,
      dipindahkanOlehNama: r.dipindahkan_oleh_nama,
      waktuPemindahan: waktuMysql(r.waktu_pemindahan),
    };
  }
}
