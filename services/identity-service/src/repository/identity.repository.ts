import { parameterMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Kontrak dan implementasi Repository untuk Identity Service (Tahap 0 & Tahap 1 — Administrator).
 * Memisahkan akses database (`mysql2/promise` dengan query terparameterisasi) dari logika bisnis.
 * Menyediakan `MySqlIdentityRepository` untuk database MySQL nyata dan `InMemoryIdentityRepository`
 * untuk pengujian deterministik serta fallback aman pada pengembangan lokal.
 */

import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  DaftarNotifikasiRespons,
  ItemNotifikasiKontrak,
  PeranPengguna,
} from "../../../../packages/shared-types/src/index.ts";
import { jalankanDalamTransaksi } from "../database/pool.ts";
import {
  SEED_KONFIGURASI_OPERASIONAL,
  SEED_NOTIFIKASI_FONDASI,
  SEED_PENGGUNA_SINTETIS,
} from "../database/seeds/master.seed.ts";
import type {
  DaftarAuditAdminRespons,
  EntitasCatatanAudit,
  EntitasKonfigurasiOperasional,
  EntitasKunciIdempotensi,
  EntitasPengguna,
  EntitasRiwayatKonfigurasi,
  EntitasSesi,
  FilterAuditAdminDto,
  FilterNotifikasiDto,
  FilterPenggunaAdminDto,
} from "../model/identity.model.ts";

/**
 * Antarmuka repositori resmi untuk `identity-service`.
 */
export interface IdentityRepository {
  cekKesehatanPenyimpanan(): Promise<{
    terhubung: boolean;
    jenisPenyimpanan: "mysql" | "in-memory";
    detail: string;
  }>;
  cariPenggunaBerdasarkanNamaPengguna(
    namaPengguna: string,
  ): Promise<EntitasPengguna | null>;
  cariPenggunaBerdasarkanId(id: string): Promise<EntitasPengguna | null>;
  ambilDaftarPenggunaAdmin(filter: FilterPenggunaAdminDto): Promise<{
    items: EntitasPengguna[];
    totalItem: number;
  }>;
  buatPenggunaBaru(pengguna: EntitasPengguna): Promise<EntitasPengguna>;
  perbaruiPenggunaDenganVersi(parameter: {
    id: string;
    namaLengkap: string;
    peran: PeranPengguna;
    daftarBangsalId: string[];
    aktif: boolean;
    versiDiharapkan: number;
    diperbaruiPada: string;
  }): Promise<
    | { status: "berhasil"; pengguna: EntitasPengguna }
    | { status: "tidak_ditemukan" }
    | { status: "konflik_versi" }
  >;
  simpanSesiBaru(sesi: EntitasSesi): Promise<void>;
  cariSesiAktifBerdasarkanTokenHash(
    tokenHash: string,
    waktuSekarangIso: string,
  ): Promise<EntitasSesi | null>;
  cabutSesiBerdasarkanTokenHash(
    tokenHash: string,
    waktuDicabutIso: string,
  ): Promise<boolean>;
  cabutSemuaSesiPengguna(
    penggunaId: string,
    waktuDicabutIso: string,
  ): Promise<number>;
  simpanNotifikasiBaru(notifikasi: ItemNotifikasiKontrak): Promise<void>;
  ambilDaftarNotifikasi(
    filter: FilterNotifikasiDto,
  ): Promise<DaftarNotifikasiRespons>;
  cariNotifikasiBerdasarkanId(
    id: string,
  ): Promise<ItemNotifikasiKontrak | null>;
  tandaiNotifikasiSudahDibaca(
    notifikasiId: string,
    penerimaId: string,
    waktuDibacaIso: string,
  ): Promise<ItemNotifikasiKontrak | null>;
  tandaiSemuaNotifikasiSudahDibaca(
    penerimaId: string,
    waktuDibacaIso: string,
  ): Promise<number>;
  simpanCatatanAudit(catatan: EntitasCatatanAudit): Promise<void>;
  ambilCatatanAuditTerbaru(batas?: number): Promise<EntitasCatatanAudit[]>;
  ambilDaftarAuditAdmin(
    filter: FilterAuditAdminDto,
  ): Promise<DaftarAuditAdminRespons>;
  cariKunciIdempotensi(
    kunci: string,
    penggunaId: string,
    rute: string,
    waktuSekarangIso: string,
  ): Promise<EntitasKunciIdempotensi | null>;
  simpanKunciIdempotensi(entri: EntitasKunciIdempotensi): Promise<void>;
  ambilKonfigurasiOperasional(): Promise<EntitasKonfigurasiOperasional[]>;
  perbaruiKonfigurasiOperasionalDenganVersi(parameter: {
    kunci: string;
    nilaiBaru: string;
    versiDiharapkan: number;
    diubahOleh: string;
    diubahPada: string;
    alasanPerubahan: string;
    idRiwayat: string;
    correlationId: string;
  }): Promise<
    | {
        status: "berhasil";
        konfigurasi: EntitasKonfigurasiOperasional;
        riwayat: EntitasRiwayatKonfigurasi;
      }
    | { status: "tidak_ditemukan" }
    | { status: "konflik_versi" }
  >;
  ambilRiwayatKonfigurasiOperasional(
    kunci?: string,
  ): Promise<EntitasRiwayatKonfigurasi[]>;
}

/**
 * Implementasi `IdentityRepository` menggunakan MySQL 8.0+ (`mysql2/promise`)
 * dengan query terparameterisasi dan transaksi atomik.
 */
export class MySqlIdentityRepository implements IdentityRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public async cekKesehatanPenyimpanan(): Promise<{
    terhubung: boolean;
    jenisPenyimpanan: "mysql" | "in-memory";
    detail: string;
  }> {
    try {
      await this.pool.query("SELECT 1 AS ok");
      return {
        terhubung: true,
        jenisPenyimpanan: "mysql",
        detail: "Koneksi pool MySQL identity-service sehat.",
      };
    } catch {
      return {
        terhubung: false,
        jenisPenyimpanan: "mysql",
        detail: "Koneksi MySQL belum dapat dijangkau.",
      };
    }
  }

  public async cariPenggunaBerdasarkanNamaPengguna(
    namaPengguna: string,
  ): Promise<EntitasPengguna | null> {
    const [barisPengguna] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, nama_pengguna, nama_lengkap, password_hash, password_salt, peran_kode, aktif, versi, dibuat_pada, diperbarui_pada
       FROM pengguna
       WHERE nama_pengguna = ?
       LIMIT 1`,
      parameterMysql([namaPengguna]),
    );

    const row = barisPengguna[0];
    if (!row) {
      return null;
    }

    const [barisBangsal] = await this.pool.execute<RowDataPacket[]>(
      `SELECT bangsal_id
       FROM pengguna_penugasan_bangsal
       WHERE pengguna_id = ? AND aktif = 1
       ORDER BY bangsal_id ASC`,
      parameterMysql([String(row.id)]),
    );

    return {
      id: String(row.id),
      namaPengguna: String(row.nama_pengguna),
      namaLengkap: String(row.nama_lengkap),
      passwordHash: String(row.password_hash),
      passwordSalt: String(row.password_salt),
      peran: row.peran_kode as EntitasPengguna["peran"],
      aktif: Boolean(row.aktif),
      daftarBangsalId: barisBangsal.map((b) => String(b.bangsal_id)),
      versi: Number(row.versi),
      dibuatPada: new Date(String(row.dibuat_pada)).toISOString(),
      diperbaruiPada: new Date(String(row.diperbarui_pada)).toISOString(),
    };
  }

  public async cariPenggunaBerdasarkanId(
    id: string,
  ): Promise<EntitasPengguna | null> {
    const [barisPengguna] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, nama_pengguna, nama_lengkap, password_hash, password_salt, peran_kode, aktif, versi, dibuat_pada, diperbarui_pada
       FROM pengguna
       WHERE id = ?
       LIMIT 1`,
      parameterMysql([id]),
    );

    const row = barisPengguna[0];
    if (!row) {
      return null;
    }

    const [barisBangsal] = await this.pool.execute<RowDataPacket[]>(
      `SELECT bangsal_id
       FROM pengguna_penugasan_bangsal
       WHERE pengguna_id = ? AND aktif = 1
       ORDER BY bangsal_id ASC`,
      parameterMysql([String(row.id)]),
    );

    return {
      id: String(row.id),
      namaPengguna: String(row.nama_pengguna),
      namaLengkap: String(row.nama_lengkap),
      passwordHash: String(row.password_hash),
      passwordSalt: String(row.password_salt),
      peran: row.peran_kode as EntitasPengguna["peran"],
      aktif: Boolean(row.aktif),
      daftarBangsalId: barisBangsal.map((b) => String(b.bangsal_id)),
      versi: Number(row.versi),
      dibuatPada: new Date(String(row.dibuat_pada)).toISOString(),
      diperbaruiPada: new Date(String(row.diperbarui_pada)).toISOString(),
    };
  }

  public async ambilDaftarPenggunaAdmin(
    filter: FilterPenggunaAdminDto,
  ): Promise<{
    items: EntitasPengguna[];
    totalItem: number;
  }> {
    const kondisi: string[] = ["1 = 1"];
    const param: Array<string | number> = [];

    if (filter.kataKunci && filter.kataKunci.trim().length > 0) {
      kondisi.push("(nama_pengguna LIKE ? OR nama_lengkap LIKE ?)");
      const pola = `%${filter.kataKunci.trim()}%`;
      param.push(pola, pola);
    }
    if (filter.peran) {
      kondisi.push("peran_kode = ?");
      param.push(filter.peran);
    }
    if (filter.aktif !== undefined) {
      kondisi.push("aktif = ?");
      param.push(filter.aktif ? 1 : 0);
    }

    const klausaWhere = kondisi.join(" AND ");
    const offset = (filter.halaman - 1) * filter.ukuranHalaman;

    const [barisTotal] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM pengguna WHERE ${klausaWhere}`,
      parameterMysql(param),
    );

    const [barisData] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, nama_pengguna, nama_lengkap, password_hash, password_salt, peran_kode, aktif, versi, dibuat_pada, diperbarui_pada
       FROM pengguna
       WHERE ${klausaWhere}
       ORDER BY dibuat_pada ASC
       LIMIT ? OFFSET ?`,
      parameterMysql([...param, filter.ukuranHalaman, offset]),
    );

    const items: EntitasPengguna[] = [];
    for (const row of barisData) {
      const [barisBangsal] = await this.pool.execute<RowDataPacket[]>(
        `SELECT bangsal_id
         FROM pengguna_penugasan_bangsal
         WHERE pengguna_id = ? AND aktif = 1
         ORDER BY bangsal_id ASC`,
        parameterMysql([String(row.id)]),
      );
      items.push({
        id: String(row.id),
        namaPengguna: String(row.nama_pengguna),
        namaLengkap: String(row.nama_lengkap),
        passwordHash: String(row.password_hash),
        passwordSalt: String(row.password_salt),
        peran: row.peran_kode as EntitasPengguna["peran"],
        aktif: Boolean(row.aktif),
        daftarBangsalId: barisBangsal.map((b) => String(b.bangsal_id)),
        versi: Number(row.versi),
        dibuatPada: new Date(String(row.dibuat_pada)).toISOString(),
        diperbaruiPada: new Date(String(row.diperbarui_pada)).toISOString(),
      });
    }

    return {
      items,
      totalItem: Number(barisTotal[0]?.total ?? 0),
    };
  }

  public async buatPenggunaBaru(
    pengguna: EntitasPengguna,
  ): Promise<EntitasPengguna> {
    await jalankanDalamTransaksi(this.pool, async (koneksi) => {
      const waktuDibuatSql = pengguna.dibuatPada
        .replace("T", " ")
        .replace("Z", "");
      const waktuDiperbaruiSql = pengguna.diperbaruiPada
        .replace("T", " ")
        .replace("Z", "");
      await koneksi.execute(
        `INSERT INTO pengguna (id, nama_pengguna, nama_lengkap, password_hash, password_salt, peran_kode, aktif, versi, dibuat_pada, diperbarui_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        parameterMysql([
          pengguna.id,
          pengguna.namaPengguna,
          pengguna.namaLengkap,
          pengguna.passwordHash,
          pengguna.passwordSalt,
          pengguna.peran,
          pengguna.aktif ? 1 : 0,
          pengguna.versi,
          waktuDibuatSql,
          waktuDiperbaruiSql,
        ]),
      );

      for (const bangsalId of pengguna.daftarBangsalId) {
        await koneksi.execute(
          `INSERT INTO pengguna_penugasan_bangsal (pengguna_id, bangsal_id, aktif)
           VALUES (?, ?, 1)`,
          parameterMysql([pengguna.id, bangsalId]),
        );
      }
    });

    return {
      ...pengguna,
      daftarBangsalId: [...pengguna.daftarBangsalId],
    };
  }

  public async perbaruiPenggunaDenganVersi(parameter: {
    id: string;
    namaLengkap: string;
    peran: PeranPengguna;
    daftarBangsalId: string[];
    aktif: boolean;
    versiDiharapkan: number;
    diperbaruiPada: string;
  }): Promise<
    | { status: "berhasil"; pengguna: EntitasPengguna }
    | { status: "tidak_ditemukan" }
    | { status: "konflik_versi" }
  > {
    return jalankanDalamTransaksi(this.pool, async (koneksi) => {
      const [baris] = await koneksi.execute<RowDataPacket[]>(
        `SELECT id, nama_pengguna, nama_lengkap, password_hash, password_salt, peran_kode, aktif, versi, dibuat_pada, diperbarui_pada
         FROM pengguna
         WHERE id = ?
         FOR UPDATE`,
        parameterMysql([parameter.id]),
      );

      const row = baris[0];
      if (!row) {
        return { status: "tidak_ditemukan" };
      }

      if (Number(row.versi) !== parameter.versiDiharapkan) {
        return { status: "konflik_versi" };
      }

      const versiBaru = parameter.versiDiharapkan + 1;
      const waktuSql = parameter.diperbaruiPada
        .replace("T", " ")
        .replace("Z", "");

      await koneksi.execute(
        `UPDATE pengguna
         SET nama_lengkap = ?, peran_kode = ?, aktif = ?, versi = ?, diperbarui_pada = ?
         WHERE id = ? AND versi = ?`,
        parameterMysql([
          parameter.namaLengkap,
          parameter.peran,
          parameter.aktif ? 1 : 0,
          versiBaru,
          waktuSql,
          parameter.id,
          parameter.versiDiharapkan,
        ]),
      );

      await koneksi.execute(
        `DELETE FROM pengguna_penugasan_bangsal WHERE pengguna_id = ?`,
        parameterMysql([parameter.id]),
      );

      for (const bangsalId of parameter.daftarBangsalId) {
        await koneksi.execute(
          `INSERT INTO pengguna_penugasan_bangsal (pengguna_id, bangsal_id, aktif)
           VALUES (?, ?, 1)`,
          parameterMysql([parameter.id, bangsalId]),
        );
      }

      if (!parameter.aktif) {
        await koneksi.execute(
          `UPDATE sesi_pengguna
           SET dicabut_pada = ?
           WHERE pengguna_id = ? AND dicabut_pada IS NULL`,
          parameterMysql([waktuSql, parameter.id]),
        );
      }

      return {
        status: "berhasil",
        pengguna: {
          id: String(row.id),
          namaPengguna: String(row.nama_pengguna),
          namaLengkap: parameter.namaLengkap,
          passwordHash: String(row.password_hash),
          passwordSalt: String(row.password_salt),
          peran: parameter.peran,
          aktif: parameter.aktif,
          daftarBangsalId: [...parameter.daftarBangsalId],
          versi: versiBaru,
          dibuatPada: new Date(String(row.dibuat_pada)).toISOString(),
          diperbaruiPada: parameter.diperbaruiPada,
        },
      };
    });
  }

  public async simpanSesiBaru(sesi: EntitasSesi): Promise<void> {
    await this.pool.execute(
      `INSERT INTO sesi_pengguna (id, token_hash, pengguna_id, alamat_ip, info_perangkat, waktu_dibuat, waktu_kedaluwarsa, dicabut_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      parameterMysql([
        sesi.id,
        sesi.tokenHash,
        sesi.penggunaId,
        sesi.alamatIp,
        sesi.infoPerangkat,
        sesi.waktuDibuat.replace("T", " ").replace("Z", ""),
        sesi.waktuKedaluwarsa.replace("T", " ").replace("Z", ""),
      ]),
    );
  }

  public async cariSesiAktifBerdasarkanTokenHash(
    tokenHash: string,
    waktuSekarangIso: string,
  ): Promise<EntitasSesi | null> {
    const waktuSql = waktuSekarangIso.replace("T", " ").replace("Z", "");
    const [baris] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, token_hash, pengguna_id, alamat_ip, info_perangkat, waktu_dibuat, waktu_kedaluwarsa, dicabut_pada
       FROM sesi_pengguna
       WHERE token_hash = ? AND dicabut_pada IS NULL AND waktu_kedaluwarsa > ?
       LIMIT 1`,
      parameterMysql([tokenHash, waktuSql]),
    );

    const row = baris[0];
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      tokenHash: String(row.token_hash),
      penggunaId: String(row.pengguna_id),
      alamatIp: String(row.alamat_ip),
      infoPerangkat: String(row.info_perangkat),
      waktuDibuat: new Date(String(row.waktu_dibuat)).toISOString(),
      waktuKedaluwarsa: new Date(String(row.waktu_kedaluwarsa)).toISOString(),
      dicabutPada: row.dicabut_pada
        ? new Date(String(row.dicabut_pada)).toISOString()
        : null,
    };
  }

  public async cabutSesiBerdasarkanTokenHash(
    tokenHash: string,
    waktuDicabutIso: string,
  ): Promise<boolean> {
    const waktuSql = waktuDicabutIso.replace("T", " ").replace("Z", "");
    const [hasil] = await this.pool.execute(
      `UPDATE sesi_pengguna
       SET dicabut_pada = ?
       WHERE token_hash = ? AND dicabut_pada IS NULL`,
      parameterMysql([waktuSql, tokenHash]),
    );
    const affectedRows =
      "affectedRows" in hasil ? Number(hasil.affectedRows) : 0;
    return affectedRows > 0;
  }

  public async cabutSemuaSesiPengguna(
    penggunaId: string,
    waktuDicabutIso: string,
  ): Promise<number> {
    const waktuSql = waktuDicabutIso.replace("T", " ").replace("Z", "");
    const [hasil] = await this.pool.execute(
      `UPDATE sesi_pengguna
       SET dicabut_pada = ?
       WHERE pengguna_id = ? AND dicabut_pada IS NULL`,
      parameterMysql([waktuSql, penggunaId]),
    );
    return "affectedRows" in hasil ? Number(hasil.affectedRows) : 0;
  }

  public async simpanNotifikasiBaru(
    notifikasi: ItemNotifikasiKontrak,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT IGNORE INTO notifikasi_pengguna
       (id, peristiwa_id, penerima_id, judul, ringkasan, kategori, prioritas, status_baca, tautan_tujuan, waktu_dibuat, waktu_dibaca)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        notifikasi.id,
        notifikasi.peristiwaId,
        notifikasi.penerimaId,
        notifikasi.judul,
        notifikasi.ringkasan,
        notifikasi.kategori,
        notifikasi.prioritas,
        notifikasi.statusBaca,
        notifikasi.tautanTujuan,
        notifikasi.waktuDibuat.replace("T", " ").replace("Z", ""),
        notifikasi.waktuDibaca
          ? notifikasi.waktuDibaca.replace("T", " ").replace("Z", "")
          : null,
      ]),
    );
  }

  public async ambilDaftarNotifikasi(
    filter: FilterNotifikasiDto,
  ): Promise<DaftarNotifikasiRespons> {
    const kondisi: string[] = ["penerima_id = ?"];
    const parameter: Array<string | number> = [filter.penerimaId];

    if (filter.statusBaca) {
      kondisi.push("status_baca = ?");
      parameter.push(filter.statusBaca);
    }
    if (filter.kategori) {
      kondisi.push("kategori = ?");
      parameter.push(filter.kategori);
    }
    if (filter.prioritas) {
      kondisi.push("prioritas = ?");
      parameter.push(filter.prioritas);
    }

    const klausaWhere = kondisi.join(" AND ");
    const offset = (filter.halaman - 1) * filter.ukuranHalaman;

    const [barisTotal] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM notifikasi_pengguna WHERE ${klausaWhere}`,
      parameterMysql(parameter),
    );

    const [barisBelumDibaca] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS belum_dibaca
       FROM notifikasi_pengguna
       WHERE penerima_id = ? AND status_baca = 'belum_dibaca'`,
      parameterMysql([filter.penerimaId]),
    );

    const [barisData] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, peristiwa_id, penerima_id, judul, ringkasan, kategori, prioritas, status_baca, tautan_tujuan, waktu_dibuat, waktu_dibaca
       FROM notifikasi_pengguna
       WHERE ${klausaWhere}
       ORDER BY waktu_dibuat DESC
       LIMIT ? OFFSET ?`,
      parameterMysql([...parameter, filter.ukuranHalaman, offset]),
    );

    const items: ItemNotifikasiKontrak[] = barisData.map((row) => ({
      id: String(row.id),
      peristiwaId: String(row.peristiwa_id),
      penerimaId: String(row.penerima_id),
      judul: String(row.judul),
      ringkasan: String(row.ringkasan),
      kategori: row.kategori as ItemNotifikasiKontrak["kategori"],
      prioritas: row.prioritas as ItemNotifikasiKontrak["prioritas"],
      statusBaca: row.status_baca as ItemNotifikasiKontrak["statusBaca"],
      tautanTujuan: String(row.tautan_tujuan),
      waktuDibuat: new Date(String(row.waktu_dibuat)).toISOString(),
      waktuDibaca: row.waktu_dibaca
        ? new Date(String(row.waktu_dibaca)).toISOString()
        : null,
    }));

    return {
      items,
      jumlahBelumDibaca: Number(barisBelumDibaca[0]?.belum_dibaca ?? 0),
      totalItem: Number(barisTotal[0]?.total ?? 0),
      halaman: filter.halaman,
      ukuranHalaman: filter.ukuranHalaman,
    };
  }

  public async cariNotifikasiBerdasarkanId(
    id: string,
  ): Promise<ItemNotifikasiKontrak | null> {
    const [baris] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, peristiwa_id, penerima_id, judul, ringkasan, kategori, prioritas, status_baca, tautan_tujuan, waktu_dibuat, waktu_dibaca
       FROM notifikasi_pengguna
       WHERE id = ?
       LIMIT 1`,
      parameterMysql([id]),
    );

    const row = baris[0];
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      peristiwaId: String(row.peristiwa_id),
      penerimaId: String(row.penerima_id),
      judul: String(row.judul),
      ringkasan: String(row.ringkasan),
      kategori: row.kategori as ItemNotifikasiKontrak["kategori"],
      prioritas: row.prioritas as ItemNotifikasiKontrak["prioritas"],
      statusBaca: row.status_baca as ItemNotifikasiKontrak["statusBaca"],
      tautanTujuan: String(row.tautan_tujuan),
      waktuDibuat: new Date(String(row.waktu_dibuat)).toISOString(),
      waktuDibaca: row.waktu_dibaca
        ? new Date(String(row.waktu_dibaca)).toISOString()
        : null,
    };
  }

  public async tandaiNotifikasiSudahDibaca(
    notifikasiId: string,
    penerimaId: string,
    waktuDibacaIso: string,
  ): Promise<ItemNotifikasiKontrak | null> {
    return jalankanDalamTransaksi(this.pool, async (koneksi) => {
      const [baris] = await koneksi.execute<RowDataPacket[]>(
        `SELECT id, peristiwa_id, penerima_id, judul, ringkasan, kategori, prioritas, status_baca, tautan_tujuan, waktu_dibuat, waktu_dibaca
         FROM notifikasi_pengguna
         WHERE id = ? AND penerima_id = ?
         FOR UPDATE`,
        parameterMysql([notifikasiId, penerimaId]),
      );

      const row = baris[0];
      if (!row) {
        return null;
      }

      const waktuDibacaAktual = row.waktu_dibaca
        ? new Date(String(row.waktu_dibaca)).toISOString()
        : waktuDibacaIso;

      if (row.status_baca !== "sudah_dibaca") {
        await koneksi.execute(
          `UPDATE notifikasi_pengguna
           SET status_baca = 'sudah_dibaca', waktu_dibaca = ?
           WHERE id = ? AND penerima_id = ?`,
          parameterMysql([
            waktuDibacaIso.replace("T", " ").replace("Z", ""),
            notifikasiId,
            penerimaId,
          ]),
        );
      }

      return {
        id: String(row.id),
        peristiwaId: String(row.peristiwa_id),
        penerimaId: String(row.penerima_id),
        judul: String(row.judul),
        ringkasan: String(row.ringkasan),
        kategori: row.kategori as ItemNotifikasiKontrak["kategori"],
        prioritas: row.prioritas as ItemNotifikasiKontrak["prioritas"],
        statusBaca: "sudah_dibaca",
        tautanTujuan: String(row.tautan_tujuan),
        waktuDibuat: new Date(String(row.waktu_dibuat)).toISOString(),
        waktuDibaca: waktuDibacaAktual,
      };
    });
  }

  public async tandaiSemuaNotifikasiSudahDibaca(
    penerimaId: string,
    waktuDibacaIso: string,
  ): Promise<number> {
    const waktuSql = waktuDibacaIso.replace("T", " ").replace("Z", "");
    const [hasil] = await this.pool.execute(
      `UPDATE notifikasi_pengguna
       SET status_baca = 'sudah_dibaca', waktu_dibaca = ?
       WHERE penerima_id = ? AND status_baca = 'belum_dibaca'`,
      parameterMysql([waktuSql, penerimaId]),
    );
    return "affectedRows" in hasil ? Number(hasil.affectedRows) : 0;
  }

  public async simpanCatatanAudit(catatan: EntitasCatatanAudit): Promise<void> {
    await this.pool.execute(
      `INSERT INTO catatan_audit_akses
       (id, waktu_kejadian, aktor_pengguna_id, aktor_peran, tindakan, objek_tipe, objek_id, status_hasil, alasan, correlation_id, metadata_tersanitasi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        catatan.id,
        catatan.waktuKejadian.replace("T", " ").replace("Z", ""),
        catatan.aktorPenggunaId,
        catatan.aktorPeran,
        catatan.tindakan,
        catatan.objekTipe,
        catatan.objekId,
        catatan.statusHasil,
        catatan.alasan,
        catatan.correlationId,
        JSON.stringify(catatan.metadataTersanitasi),
      ]),
    );
  }

  public async ambilCatatanAuditTerbaru(
    batas = 20,
  ): Promise<EntitasCatatanAudit[]> {
    const [baris] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, waktu_kejadian, aktor_pengguna_id, aktor_peran, tindakan, objek_tipe, objek_id, status_hasil, alasan, correlation_id, metadata_tersanitasi
       FROM catatan_audit_akses
       ORDER BY waktu_kejadian DESC
       LIMIT ?`,
      parameterMysql([batas]),
    );

    return baris.map((row) => ({
      id: String(row.id),
      waktuKejadian: new Date(String(row.waktu_kejadian)).toISOString(),
      aktorPenggunaId: row.aktor_pengguna_id
        ? String(row.aktor_pengguna_id)
        : null,
      aktorPeran: row.aktor_peran as EntitasCatatanAudit["aktorPeran"],
      tindakan: String(row.tindakan),
      objekTipe: String(row.objek_tipe),
      objekId: String(row.objek_id),
      statusHasil: row.status_hasil as EntitasCatatanAudit["statusHasil"],
      alasan: String(row.alasan),
      correlationId: String(row.correlation_id),
      metadataTersanitasi:
        typeof row.metadata_tersanitasi === "string"
          ? (JSON.parse(row.metadata_tersanitasi) as Record<
              string,
              string | number | boolean | null
            >)
          : ((row.metadata_tersanitasi ?? {}) as Record<
              string,
              string | number | boolean | null
            >),
    }));
  }

  public async ambilDaftarAuditAdmin(
    filter: FilterAuditAdminDto,
  ): Promise<DaftarAuditAdminRespons> {
    const kondisi: string[] = ["1 = 1"];
    const param: Array<string | number> = [];

    if (filter.statusHasil) {
      kondisi.push("status_hasil = ?");
      param.push(filter.statusHasil);
    }
    if (filter.tindakan && filter.tindakan.trim().length > 0) {
      kondisi.push("tindakan = ?");
      param.push(filter.tindakan.trim());
    }
    if (filter.kataKunci && filter.kataKunci.trim().length > 0) {
      kondisi.push(
        "(tindakan LIKE ? OR objek_id LIKE ? OR alasan LIKE ? OR correlation_id LIKE ?)",
      );
      const pola = `%${filter.kataKunci.trim()}%`;
      param.push(pola, pola, pola, pola);
    }

    const klausaWhere = kondisi.join(" AND ");
    const offset = (filter.halaman - 1) * filter.ukuranHalaman;

    const [barisTotal] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM catatan_audit_akses WHERE ${klausaWhere}`,
      parameterMysql(param),
    );

    const [barisData] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, waktu_kejadian, aktor_pengguna_id, aktor_peran, tindakan, objek_tipe, objek_id, status_hasil, alasan, correlation_id, metadata_tersanitasi
       FROM catatan_audit_akses
       WHERE ${klausaWhere}
       ORDER BY waktu_kejadian DESC
       LIMIT ? OFFSET ?`,
      parameterMysql([...param, filter.ukuranHalaman, offset]),
    );

    const items: EntitasCatatanAudit[] = barisData.map((row) => ({
      id: String(row.id),
      waktuKejadian: new Date(String(row.waktu_kejadian)).toISOString(),
      aktorPenggunaId: row.aktor_pengguna_id
        ? String(row.aktor_pengguna_id)
        : null,
      aktorPeran: row.aktor_peran as EntitasCatatanAudit["aktorPeran"],
      tindakan: String(row.tindakan),
      objekTipe: String(row.objek_tipe),
      objekId: String(row.objek_id),
      statusHasil: row.status_hasil as EntitasCatatanAudit["statusHasil"],
      alasan: String(row.alasan),
      correlationId: String(row.correlation_id),
      metadataTersanitasi:
        typeof row.metadata_tersanitasi === "string"
          ? (JSON.parse(row.metadata_tersanitasi) as Record<
              string,
              string | number | boolean | null
            >)
          : ((row.metadata_tersanitasi ?? {}) as Record<
              string,
              string | number | boolean | null
            >),
    }));

    return {
      items,
      totalItem: Number(barisTotal[0]?.total ?? 0),
      halaman: filter.halaman,
      ukuranHalaman: filter.ukuranHalaman,
    };
  }

  public async cariKunciIdempotensi(
    kunci: string,
    penggunaId: string,
    rute: string,
    waktuSekarangIso: string,
  ): Promise<EntitasKunciIdempotensi | null> {
    const waktuSql = waktuSekarangIso.replace("T", " ").replace("Z", "");
    const [baris] = await this.pool.execute<RowDataPacket[]>(
      `SELECT kunci, pengguna_id, rute, fingerprint_payload, status_http, respons_json, waktu_dibuat, waktu_kedaluwarsa
       FROM kunci_idempotensi
       WHERE kunci = ? AND pengguna_id = ? AND rute = ? AND waktu_kedaluwarsa > ?
       LIMIT 1`,
      parameterMysql([kunci, penggunaId, rute, waktuSql]),
    );

    const row = baris[0];
    if (!row) {
      return null;
    }

    return {
      kunci: String(row.kunci),
      penggunaId: String(row.pengguna_id),
      rute: String(row.rute),
      fingerprintPayload: String(row.fingerprint_payload),
      statusHttp: Number(row.status_http),
      responsJson:
        typeof row.respons_json === "string"
          ? row.respons_json
          : JSON.stringify(row.respons_json),
      waktuDibuat: new Date(String(row.waktu_dibuat)).toISOString(),
      waktuKedaluwarsa: new Date(String(row.waktu_kedaluwarsa)).toISOString(),
    };
  }

  public async simpanKunciIdempotensi(
    entri: EntitasKunciIdempotensi,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT IGNORE INTO kunci_idempotensi
       (kunci, pengguna_id, rute, fingerprint_payload, status_http, respons_json, waktu_dibuat, waktu_kedaluwarsa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        entri.kunci,
        entri.penggunaId,
        entri.rute,
        entri.fingerprintPayload,
        entri.statusHttp,
        entri.responsJson,
        entri.waktuDibuat.replace("T", " ").replace("Z", ""),
        entri.waktuKedaluwarsa.replace("T", " ").replace("Z", ""),
      ]),
    );
  }

  public async ambilKonfigurasiOperasional(): Promise<
    EntitasKonfigurasiOperasional[]
  > {
    const [baris] = await this.pool.execute<RowDataPacket[]>(
      `SELECT kunci, nilai, deskripsi, versi, diperbarui_oleh, diperbarui_pada
       FROM konfigurasi_operasional
       ORDER BY kunci ASC`,
    );

    return baris.map((row) => ({
      kunci: String(row.kunci),
      nilai: String(row.nilai),
      deskripsi: String(row.deskripsi),
      versi: Number(row.versi),
      diperbaruiOleh: String(row.diperbarui_oleh),
      diperbaruiPada: new Date(String(row.diperbarui_pada)).toISOString(),
    }));
  }

  public async perbaruiKonfigurasiOperasionalDenganVersi(parameter: {
    kunci: string;
    nilaiBaru: string;
    versiDiharapkan: number;
    diubahOleh: string;
    diubahPada: string;
    alasanPerubahan: string;
    idRiwayat: string;
    correlationId: string;
  }): Promise<
    | {
        status: "berhasil";
        konfigurasi: EntitasKonfigurasiOperasional;
        riwayat: EntitasRiwayatKonfigurasi;
      }
    | { status: "tidak_ditemukan" }
    | { status: "konflik_versi" }
  > {
    return jalankanDalamTransaksi(this.pool, async (koneksi) => {
      const [baris] = await koneksi.execute<RowDataPacket[]>(
        `SELECT kunci, nilai, deskripsi, versi, diperbarui_oleh, diperbarui_pada
         FROM konfigurasi_operasional
         WHERE kunci = ?
         FOR UPDATE`,
        parameterMysql([parameter.kunci]),
      );

      const row = baris[0];
      if (!row) {
        return { status: "tidak_ditemukan" };
      }

      const versiSebelum = Number(row.versi);
      if (versiSebelum !== parameter.versiDiharapkan) {
        return { status: "konflik_versi" };
      }

      const versiSesudah = versiSebelum + 1;
      const nilaiSebelum = String(row.nilai);
      const waktuSql = parameter.diubahPada.replace("T", " ").replace("Z", "");

      await koneksi.execute(
        `UPDATE konfigurasi_operasional
         SET nilai = ?, versi = ?, diperbarui_oleh = ?, diperbarui_pada = ?
         WHERE kunci = ? AND versi = ?`,
        parameterMysql([
          parameter.nilaiBaru,
          versiSesudah,
          parameter.diubahOleh,
          waktuSql,
          parameter.kunci,
          versiSebelum,
        ]),
      );

      await koneksi.execute(
        `INSERT INTO riwayat_konfigurasi_operasional
         (id, kunci_konfigurasi, nilai_sebelum, nilai_sesudah, versi_sebelum, versi_sesudah, alasan_perubahan, diubah_oleh, diubah_pada, correlation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        parameterMysql([
          parameter.idRiwayat,
          parameter.kunci,
          nilaiSebelum,
          parameter.nilaiBaru,
          versiSebelum,
          versiSesudah,
          parameter.alasanPerubahan,
          parameter.diubahOleh,
          waktuSql,
          parameter.correlationId,
        ]),
      );

      return {
        status: "berhasil",
        konfigurasi: {
          kunci: parameter.kunci,
          nilai: parameter.nilaiBaru,
          deskripsi: String(row.deskripsi),
          versi: versiSesudah,
          diperbaruiOleh: parameter.diubahOleh,
          diperbaruiPada: parameter.diubahPada,
        },
        riwayat: {
          id: parameter.idRiwayat,
          kunciKonfigurasi: parameter.kunci,
          nilaiSebelum,
          nilaiSesudah: parameter.nilaiBaru,
          versiSebelum,
          versiSesudah,
          alasanPerubahan: parameter.alasanPerubahan,
          diubahOleh: parameter.diubahOleh,
          diubahPada: parameter.diubahPada,
          correlationId: parameter.correlationId,
        },
      };
    });
  }

  public async ambilRiwayatKonfigurasiOperasional(
    kunci?: string,
  ): Promise<EntitasRiwayatKonfigurasi[]> {
    const kondisi = kunci ? "WHERE kunci_konfigurasi = ?" : "";
    const param = kunci ? [kunci] : [];
    const [baris] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id, kunci_konfigurasi, nilai_sebelum, nilai_sesudah, versi_sebelum, versi_sesudah, alasan_perubahan, diubah_oleh, diubah_pada, correlation_id
       FROM riwayat_konfigurasi_operasional
       ${kondisi}
       ORDER BY diubah_pada DESC
       LIMIT 50`,
      parameterMysql(param),
    );

    return baris.map((row) => ({
      id: String(row.id),
      kunciKonfigurasi: String(row.kunci_konfigurasi),
      nilaiSebelum: String(row.nilai_sebelum),
      nilaiSesudah: String(row.nilai_sesudah),
      versiSebelum: Number(row.versi_sebelum),
      versiSesudah: Number(row.versi_sesudah),
      alasanPerubahan: String(row.alasan_perubahan),
      diubahOleh: String(row.diubah_oleh),
      diubahPada: new Date(String(row.diubah_pada)).toISOString(),
      correlationId: String(row.correlation_id),
    }));
  }
}

/**
 * Implementasi `IdentityRepository` berbasis memori yang diinisialisasi dengan seed master yang sama.
 * Digunakan untuk pengujian unit/kontrak dan pengembangan lokal saat kredensial MySQL belum diisi.
 */
export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly penggunaMap = new Map<string, EntitasPengguna>();
  private readonly sesiMap = new Map<string, EntitasSesi>();
  private readonly notifikasiMap = new Map<string, ItemNotifikasiKontrak>();
  private readonly auditList: EntitasCatatanAudit[] = [];
  private readonly idempotensiMap = new Map<string, EntitasKunciIdempotensi>();
  private readonly konfigurasiList: EntitasKonfigurasiOperasional[] = [];
  private readonly riwayatKonfigurasiList: EntitasRiwayatKonfigurasi[] = [];

  constructor() {
    for (const akun of SEED_PENGGUNA_SINTETIS) {
      this.penggunaMap.set(akun.id, {
        ...akun,
        daftarBangsalId: [...akun.daftarBangsalId],
      });
    }
    for (const notif of SEED_NOTIFIKASI_FONDASI) {
      this.notifikasiMap.set(notif.id, { ...notif });
    }
    for (const konfig of SEED_KONFIGURASI_OPERASIONAL) {
      this.konfigurasiList.push({ ...konfig });
    }
  }

  public async cekKesehatanPenyimpanan(): Promise<{
    terhubung: boolean;
    jenisPenyimpanan: "mysql" | "in-memory";
    detail: string;
  }> {
    return {
      terhubung: true,
      jenisPenyimpanan: "in-memory",
      detail:
        "Menggunakan repositori in-memory terisolasi dengan seed master sintetis.",
    };
  }

  public async cariPenggunaBerdasarkanNamaPengguna(
    namaPengguna: string,
  ): Promise<EntitasPengguna | null> {
    for (const pengguna of this.penggunaMap.values()) {
      if (pengguna.namaPengguna === namaPengguna) {
        return {
          ...pengguna,
          daftarBangsalId: [...pengguna.daftarBangsalId],
        };
      }
    }
    return null;
  }

  public async cariPenggunaBerdasarkanId(
    id: string,
  ): Promise<EntitasPengguna | null> {
    const pengguna = this.penggunaMap.get(id);
    if (!pengguna) {
      return null;
    }
    return {
      ...pengguna,
      daftarBangsalId: [...pengguna.daftarBangsalId],
    };
  }

  public async ambilDaftarPenggunaAdmin(
    filter: FilterPenggunaAdminDto,
  ): Promise<{
    items: EntitasPengguna[];
    totalItem: number;
  }> {
    const kata = filter.kataKunci?.trim().toLowerCase();
    const tersaring = Array.from(this.penggunaMap.values()).filter((p) => {
      if (
        kata &&
        !p.namaPengguna.toLowerCase().includes(kata) &&
        !p.namaLengkap.toLowerCase().includes(kata)
      ) {
        return false;
      }
      if (filter.peran && p.peran !== filter.peran) {
        return false;
      }
      if (filter.aktif !== undefined && p.aktif !== filter.aktif) {
        return false;
      }
      return true;
    });

    const offset = (filter.halaman - 1) * filter.ukuranHalaman;
    const items = tersaring
      .slice(offset, offset + filter.ukuranHalaman)
      .map((p) => ({
        ...p,
        daftarBangsalId: [...p.daftarBangsalId],
      }));

    return {
      items,
      totalItem: tersaring.length,
    };
  }

  public async buatPenggunaBaru(
    pengguna: EntitasPengguna,
  ): Promise<EntitasPengguna> {
    const salinan: EntitasPengguna = {
      ...pengguna,
      daftarBangsalId: [...pengguna.daftarBangsalId],
    };
    this.penggunaMap.set(salinan.id, salinan);
    return {
      ...salinan,
      daftarBangsalId: [...salinan.daftarBangsalId],
    };
  }

  public async perbaruiPenggunaDenganVersi(parameter: {
    id: string;
    namaLengkap: string;
    peran: PeranPengguna;
    daftarBangsalId: string[];
    aktif: boolean;
    versiDiharapkan: number;
    diperbaruiPada: string;
  }): Promise<
    | { status: "berhasil"; pengguna: EntitasPengguna }
    | { status: "tidak_ditemukan" }
    | { status: "konflik_versi" }
  > {
    const eksisting = this.penggunaMap.get(parameter.id);
    if (!eksisting) {
      return { status: "tidak_ditemukan" };
    }
    if (eksisting.versi !== parameter.versiDiharapkan) {
      return { status: "konflik_versi" };
    }

    const diperbarui: EntitasPengguna = {
      ...eksisting,
      namaLengkap: parameter.namaLengkap,
      peran: parameter.peran,
      daftarBangsalId: [...parameter.daftarBangsalId],
      aktif: parameter.aktif,
      versi: parameter.versiDiharapkan + 1,
      diperbaruiPada: parameter.diperbaruiPada,
    };
    this.penggunaMap.set(parameter.id, diperbarui);

    if (!parameter.aktif) {
      for (const sesi of this.sesiMap.values()) {
        if (sesi.penggunaId === parameter.id && sesi.dicabutPada === null) {
          sesi.dicabutPada = parameter.diperbaruiPada;
        }
      }
    }

    return {
      status: "berhasil",
      pengguna: {
        ...diperbarui,
        daftarBangsalId: [...diperbarui.daftarBangsalId],
      },
    };
  }

  public async simpanSesiBaru(sesi: EntitasSesi): Promise<void> {
    this.sesiMap.set(sesi.tokenHash, { ...sesi });
  }

  public async cariSesiAktifBerdasarkanTokenHash(
    tokenHash: string,
    waktuSekarangIso: string,
  ): Promise<EntitasSesi | null> {
    const sesi = this.sesiMap.get(tokenHash);
    if (!sesi) {
      return null;
    }
    if (sesi.dicabutPada !== null) {
      return null;
    }
    if (
      new Date(sesi.waktuKedaluwarsa).getTime() <=
      new Date(waktuSekarangIso).getTime()
    ) {
      return null;
    }
    return { ...sesi };
  }

  public async cabutSesiBerdasarkanTokenHash(
    tokenHash: string,
    waktuDicabutIso: string,
  ): Promise<boolean> {
    const sesi = this.sesiMap.get(tokenHash);
    if (!sesi || sesi.dicabutPada !== null) {
      return false;
    }
    sesi.dicabutPada = waktuDicabutIso;
    return true;
  }

  public async cabutSemuaSesiPengguna(
    penggunaId: string,
    waktuDicabutIso: string,
  ): Promise<number> {
    let dicabut = 0;
    for (const sesi of this.sesiMap.values()) {
      if (sesi.penggunaId === penggunaId && sesi.dicabutPada === null) {
        sesi.dicabutPada = waktuDicabutIso;
        dicabut += 1;
      }
    }
    return dicabut;
  }

  public async simpanNotifikasiBaru(
    notifikasi: ItemNotifikasiKontrak,
  ): Promise<void> {
    this.notifikasiMap.set(notifikasi.id, { ...notifikasi });
  }

  public async ambilDaftarNotifikasi(
    filter: FilterNotifikasiDto,
  ): Promise<DaftarNotifikasiRespons> {
    const semuaMilikPenerima = Array.from(this.notifikasiMap.values()).filter(
      (n) => n.penerimaId === filter.penerimaId,
    );

    const jumlahBelumDibaca = semuaMilikPenerima.filter(
      (n) => n.statusBaca === "belum_dibaca",
    ).length;

    const tersaring = semuaMilikPenerima
      .filter((n) => {
        if (filter.statusBaca && n.statusBaca !== filter.statusBaca) {
          return false;
        }
        if (filter.kategori && n.kategori !== filter.kategori) {
          return false;
        }
        if (filter.prioritas && n.prioritas !== filter.prioritas) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.waktuDibuat).getTime() - new Date(a.waktuDibuat).getTime(),
      );

    const offset = (filter.halaman - 1) * filter.ukuranHalaman;
    const items = tersaring
      .slice(offset, offset + filter.ukuranHalaman)
      .map((item) => ({ ...item }));

    return {
      items,
      jumlahBelumDibaca,
      totalItem: tersaring.length,
      halaman: filter.halaman,
      ukuranHalaman: filter.ukuranHalaman,
    };
  }

  public async cariNotifikasiBerdasarkanId(
    id: string,
  ): Promise<ItemNotifikasiKontrak | null> {
    const item = this.notifikasiMap.get(id);
    return item ? { ...item } : null;
  }

  public async tandaiNotifikasiSudahDibaca(
    notifikasiId: string,
    penerimaId: string,
    waktuDibacaIso: string,
  ): Promise<ItemNotifikasiKontrak | null> {
    const item = this.notifikasiMap.get(notifikasiId);
    if (!item || item.penerimaId !== penerimaId) {
      return null;
    }
    if (item.statusBaca !== "sudah_dibaca") {
      item.statusBaca = "sudah_dibaca";
      item.waktuDibaca = waktuDibacaIso;
    }
    return { ...item };
  }

  public async tandaiSemuaNotifikasiSudahDibaca(
    penerimaId: string,
    waktuDibacaIso: string,
  ): Promise<number> {
    let diubah = 0;
    for (const item of this.notifikasiMap.values()) {
      if (item.penerimaId === penerimaId && item.statusBaca === "belum_dibaca") {
        item.statusBaca = "sudah_dibaca";
        item.waktuDibaca = waktuDibacaIso;
        diubah += 1;
      }
    }
    return diubah;
  }

  public async simpanCatatanAudit(catatan: EntitasCatatanAudit): Promise<void> {
    this.auditList.unshift({
      ...catatan,
      metadataTersanitasi: { ...catatan.metadataTersanitasi },
    });
  }

  public async ambilCatatanAuditTerbaru(
    batas = 20,
  ): Promise<EntitasCatatanAudit[]> {
    return this.auditList.slice(0, batas).map((c) => ({
      ...c,
      metadataTersanitasi: { ...c.metadataTersanitasi },
    }));
  }

  public async ambilDaftarAuditAdmin(
    filter: FilterAuditAdminDto,
  ): Promise<DaftarAuditAdminRespons> {
    const kata = filter.kataKunci?.trim().toLowerCase();
    const tindakanFilter = filter.tindakan?.trim().toLowerCase();

    const tersaring = this.auditList.filter((item) => {
      if (filter.statusHasil && item.statusHasil !== filter.statusHasil) {
        return false;
      }
      if (
        tindakanFilter &&
        item.tindakan.toLowerCase() !== tindakanFilter
      ) {
        return false;
      }
      if (kata) {
        const cocok =
          item.tindakan.toLowerCase().includes(kata) ||
          item.objekId.toLowerCase().includes(kata) ||
          item.alasan.toLowerCase().includes(kata) ||
          item.correlationId.toLowerCase().includes(kata) ||
          item.aktorPeran.toLowerCase().includes(kata);
        if (!cocok) {
          return false;
        }
      }
      return true;
    });

    const offset = (filter.halaman - 1) * filter.ukuranHalaman;
    const items = tersaring
      .slice(offset, offset + filter.ukuranHalaman)
      .map((c) => ({
        ...c,
        metadataTersanitasi: { ...c.metadataTersanitasi },
      }));

    return {
      items,
      totalItem: tersaring.length,
      halaman: filter.halaman,
      ukuranHalaman: filter.ukuranHalaman,
    };
  }

  public async cariKunciIdempotensi(
    kunci: string,
    penggunaId: string,
    rute: string,
    waktuSekarangIso: string,
  ): Promise<EntitasKunciIdempotensi | null> {
    const komposit = `${kunci}::${penggunaId}::${rute}`;
    const entri = this.idempotensiMap.get(komposit);
    if (!entri) {
      return null;
    }
    if (
      new Date(entri.waktuKedaluwarsa).getTime() <=
      new Date(waktuSekarangIso).getTime()
    ) {
      this.idempotensiMap.delete(komposit);
      return null;
    }
    return { ...entri };
  }

  public async simpanKunciIdempotensi(
    entri: EntitasKunciIdempotensi,
  ): Promise<void> {
    const komposit = `${entri.kunci}::${entri.penggunaId}::${entri.rute}`;
    this.idempotensiMap.set(komposit, { ...entri });
  }

  public async ambilKonfigurasiOperasional(): Promise<
    EntitasKonfigurasiOperasional[]
  > {
    return this.konfigurasiList.map((k) => ({ ...k }));
  }

  public async perbaruiKonfigurasiOperasionalDenganVersi(parameter: {
    kunci: string;
    nilaiBaru: string;
    versiDiharapkan: number;
    diubahOleh: string;
    diubahPada: string;
    alasanPerubahan: string;
    idRiwayat: string;
    correlationId: string;
  }): Promise<
    | {
        status: "berhasil";
        konfigurasi: EntitasKonfigurasiOperasional;
        riwayat: EntitasRiwayatKonfigurasi;
      }
    | { status: "tidak_ditemukan" }
    | { status: "konflik_versi" }
  > {
    const indeks = this.konfigurasiList.findIndex(
      (k) => k.kunci === parameter.kunci,
    );
    const eksisting = this.konfigurasiList[indeks];
    if (indeks < 0 || !eksisting) {
      return { status: "tidak_ditemukan" };
    }
    if (eksisting.versi !== parameter.versiDiharapkan) {
      return { status: "konflik_versi" };
    }

    const versiSebelum = eksisting.versi;
    const versiSesudah = versiSebelum + 1;
    const nilaiSebelum = eksisting.nilai;

    const diperbarui: EntitasKonfigurasiOperasional = {
      ...eksisting,
      nilai: parameter.nilaiBaru,
      versi: versiSesudah,
      diperbaruiOleh: parameter.diubahOleh,
      diperbaruiPada: parameter.diubahPada,
    };
    this.konfigurasiList[indeks] = diperbarui;

    const riwayat: EntitasRiwayatKonfigurasi = {
      id: parameter.idRiwayat,
      kunciKonfigurasi: parameter.kunci,
      nilaiSebelum,
      nilaiSesudah: parameter.nilaiBaru,
      versiSebelum,
      versiSesudah,
      alasanPerubahan: parameter.alasanPerubahan,
      diubahOleh: parameter.diubahOleh,
      diubahPada: parameter.diubahPada,
      correlationId: parameter.correlationId,
    };
    this.riwayatKonfigurasiList.unshift(riwayat);

    return {
      status: "berhasil",
      konfigurasi: { ...diperbarui },
      riwayat: { ...riwayat },
    };
  }

  public async ambilRiwayatKonfigurasiOperasional(
    kunci?: string,
  ): Promise<EntitasRiwayatKonfigurasi[]> {
    const sumber = kunci
      ? this.riwayatKonfigurasiList.filter((r) => r.kunciKonfigurasi === kunci)
      : this.riwayatKonfigurasiList;
    return sumber.map((r) => ({ ...r }));
  }
}
