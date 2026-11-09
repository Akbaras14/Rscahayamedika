import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  DerajatKeparahanInsiden,
  StatusInsidenGizi,
} from "../../../../packages/shared-types/src/index.ts";
import type {
  EvaluasiMutuGiziEntitas,
  InvestigasiInsidenEntitas,
  LaporanInsidenKeselamatanEntitas,
  RekonsiliasiDowntimeEntitas,
  TindakanPerbaikanEntitas,
} from "../model/incident.model.ts";
import type { IncidentRepository } from "./incident.repository.ts";

type Row = RowDataPacket & Record<string, unknown>;
const string = (row: Row, key: string): string => { const value = row[key]; return value instanceof Date ? waktuMysql(value) : typeof value === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d/.test(value) ? waktuMysql(value) : String(value ?? ""); };
const nullable = (row: Row, key: string): string | null =>
  row[key] === null || row[key] === undefined ? null : string(row, key);
const number = (row: Row, key: string): number => Number(row[key] ?? 0);
const bool = (row: Row, key: string): boolean => Boolean(row[key]);

/** Repository MySQL untuk insiden, investigasi, evaluasi mutu, dan rekonsiliasi downtime. */
export class MySqlIncidentRepository implements IncidentRepository {
  private readonly pool: Pool;
  public constructor(pool: Pool) { this.pool = pool; }

  public async ambilSemuaInsiden(filter?: { status?: StatusInsidenGizi; derajat?: DerajatKeparahanInsiden }): Promise<LaporanInsidenKeselamatanEntitas[]> {
    const where: string[] = [];
    const values: string[] = [];
    if (filter?.status) { where.push("status_insiden = ?"); values.push(filter.status); }
    if (filter?.derajat) { where.push("derajat_keparahan = ?"); values.push(filter.derajat); }
    const [rows] = await this.pool.execute<Row[]>(
      `SELECT * FROM laporan_insiden_keselamatan_gizi${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY tanggal_kejadian DESC`,
      parameterMysql(values),
    );
    return rows.map(this.petaInsiden);
  }

  public async ambilInsidenBerdasarkanId(id: string): Promise<LaporanInsidenKeselamatanEntitas | null> {
    const [rows] = await this.pool.execute<Row[]>("SELECT * FROM laporan_insiden_keselamatan_gizi WHERE id = ?", parameterMysql([id]));
    return rows[0] ? this.petaInsiden(rows[0]) : null;
  }

  public async ambilInsidenBerdasarkanNomor(nomor: string): Promise<LaporanInsidenKeselamatanEntitas | null> {
    const [rows] = await this.pool.execute<Row[]>("SELECT * FROM laporan_insiden_keselamatan_gizi WHERE nomor_insiden = ?", parameterMysql([nomor]));
    return rows[0] ? this.petaInsiden(rows[0]) : null;
  }

  public async simpanInsiden(item: LaporanInsidenKeselamatanEntitas): Promise<LaporanInsidenKeselamatanEntitas> {
    await this.pool.execute(
      `INSERT INTO laporan_insiden_keselamatan_gizi (id, nomor_insiden, unit_pelapor, tanggal_kejadian, jenis_insiden, derajat_keparahan, deskripsi_kejadian, tindakan_awal_segera, pasien_terdampak_nama, nomor_rm_pasien, nama_bangsal, status_insiden, pelapor_id, pelapor_nama, penanggung_jawab_id, penanggung_jawab_nama, waktu_penutupan, catatan_penutupan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      parameterMysql([item.id, item.nomorInsiden, item.unitPelapor, item.tanggalKejadian, item.jenisInsiden, item.derajatKeparahan, item.deskripsiKejadian, item.tindakanAwalSegera, item.pasienTerdampakNama, item.nomorRmPasien, item.namaBangsal, item.statusInsiden, item.pelaporId, item.pelaporNama, item.penanggungJawabId, item.penanggungJawabNama, item.waktuPenutupan, item.catatanPenutupan, item.createdAt, item.updatedAt]),
    );
    return item;
  }

  public async perbaruiInsiden(id: string, patch: Partial<LaporanInsidenKeselamatanEntitas>): Promise<LaporanInsidenKeselamatanEntitas> {
    const before = await this.ambilInsidenBerdasarkanId(id);
    if (!before) throw new Error("Insiden tidak ditemukan.");
    const item = { ...before, ...patch, updatedAt: new Date().toISOString() };
    await this.pool.execute(
      `UPDATE laporan_insiden_keselamatan_gizi SET status_insiden=?, penanggung_jawab_id=?, penanggung_jawab_nama=?, waktu_penutupan=?, catatan_penutupan=?, updated_at=? WHERE id=?`,
      parameterMysql([item.statusInsiden, item.penanggungJawabId, item.penanggungJawabNama, item.waktuPenutupan, item.catatanPenutupan, item.updatedAt, id]),
    );
    return item;
  }

  public hitungNomorInsidenBerikutnya(): Promise<string> {
    return this.hitungNomor("INC", "laporan_insiden_keselamatan_gizi", "nomor_insiden");
  }

  public async simpanInvestigasi(item: InvestigasiInsidenEntitas): Promise<InvestigasiInsidenEntitas> {
    await this.pool.execute(
      `INSERT INTO investigasi_insiden_gizi (id, insiden_id, nomor_insiden, investigator_id, investigator_nama, tanggal_investigasi, akar_masalah_rca, faktor_kontributor, rekomendasi_sistemik, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=VALUES(id), nomor_insiden=VALUES(nomor_insiden), investigator_id=VALUES(investigator_id), investigator_nama=VALUES(investigator_nama), tanggal_investigasi=VALUES(tanggal_investigasi), akar_masalah_rca=VALUES(akar_masalah_rca), faktor_kontributor=VALUES(faktor_kontributor), rekomendasi_sistemik=VALUES(rekomendasi_sistemik)`,
      parameterMysql([item.id, item.insidenId, item.nomorInsiden, item.investigatorId, item.investigatorNama, item.tanggalInvestigasi, item.akarMasalahRca, item.faktorKontributor, item.rekomendasiSistemik, item.createdAt]),
    );
    return item;
  }

  public async ambilInvestigasiBerdasarkanInsidenId(insidenId: string): Promise<InvestigasiInsidenEntitas | null> {
    const [rows] = await this.pool.execute<Row[]>("SELECT * FROM investigasi_insiden_gizi WHERE insiden_id = ? LIMIT 1", parameterMysql([insidenId]));
    const row = rows[0];
    return row ? { id: string(row,"id"), insidenId: string(row,"insiden_id"), nomorInsiden: string(row,"nomor_insiden"), investigatorId: string(row,"investigator_id"), investigatorNama: string(row,"investigator_nama"), tanggalInvestigasi: string(row,"tanggal_investigasi"), akarMasalahRca: string(row,"akar_masalah_rca"), faktorKontributor: string(row,"faktor_kontributor"), rekomendasiSistemik: string(row,"rekomendasi_sistemik"), createdAt: string(row,"created_at") } : null;
  }

  public async simpanTindakanKoreksi(item: TindakanPerbaikanEntitas): Promise<TindakanPerbaikanEntitas> {
    await this.pool.execute(
      `INSERT INTO tindakan_perbaikan_insiden (id, insiden_id, nomor_insiden, deskripsi_tindakan, penanggung_jawab_id, penanggung_jawab_nama, target_tanggal_selesai, tanggal_realisasi, status_tindakan, bukti_penyelesaian, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([item.id, item.insidenId, item.nomorInsiden, item.deskripsiTindakan, item.penanggungJawabId, item.penanggungJawabNama, item.targetTanggalSelesai, item.tanggalRealisasi, item.statusTindakan, item.buktiPenyelesaian, item.createdAt]),
    );
    return item;
  }

  public async ambilDaftarTindakanBerdasarkanInsidenId(insidenId: string): Promise<TindakanPerbaikanEntitas[]> {
    const [rows] = await this.pool.execute<Row[]>("SELECT * FROM tindakan_perbaikan_insiden WHERE insiden_id = ? ORDER BY created_at", parameterMysql([insidenId]));
    return rows.map((r) => ({ id: string(r,"id"), insidenId: string(r,"insiden_id"), nomorInsiden: string(r,"nomor_insiden"), deskripsiTindakan: string(r,"deskripsi_tindakan"), penanggungJawabId: string(r,"penanggung_jawab_id"), penanggungJawabNama: string(r,"penanggung_jawab_nama"), targetTanggalSelesai: string(r,"target_tanggal_selesai"), tanggalRealisasi: nullable(r,"tanggal_realisasi"), statusTindakan: string(r,"status_tindakan") as TindakanPerbaikanEntitas["statusTindakan"], buktiPenyelesaian: nullable(r,"bukti_penyelesaian"), createdAt: string(r,"created_at") }));
  }

  public async perbaruiTindakanKoreksi(id: string, patch: Partial<TindakanPerbaikanEntitas>): Promise<TindakanPerbaikanEntitas> {
    const [rows] = await this.pool.execute<Row[]>("SELECT * FROM tindakan_perbaikan_insiden WHERE id = ?", parameterMysql([id]));
    const row = rows[0];
    if (!row) throw new Error("Tindakan koreksi tidak ditemukan.");
    const old = (await this.ambilDaftarTindakanBerdasarkanInsidenId(string(row,"insiden_id"))).find((x) => x.id === id);
    if (!old) throw new Error("Tindakan koreksi tidak ditemukan.");
    const item = { ...old, ...patch };
    await this.pool.execute("UPDATE tindakan_perbaikan_insiden SET status_tindakan=?, tanggal_realisasi=?, bukti_penyelesaian=? WHERE id=?", parameterMysql([item.statusTindakan, item.tanggalRealisasi, item.buktiPenyelesaian, id]));
    return item;
  }

  public async ambilSemuaEvaluasiMutu(): Promise<EvaluasiMutuGiziEntitas[]> {
    const [rows] = await this.pool.query<Row[]>("SELECT * FROM evaluasi_mutu_dan_sisa_makanan ORDER BY tanggal_evaluasi DESC");
    return rows.map((r) => ({ id: string(r,"id"), tanggalEvaluasi: string(r,"tanggal_evaluasi"), bangsalId: string(r,"bangsal_id"), namaBangsal: string(r,"nama_bangsal"), totalPorsiDisajikan: number(r,"total_porsi_disajikan"), rataRataSisaMakananPersen: number(r,"rata_rata_sisa_makanan_persen"), kepatuhanCcpSuhuPersen: number(r,"kepatuhan_ccp_suhu_persen"), kepatuhanDuaIdentitasPersen: number(r,"kepatuhan_dua_identitas_persen"), kategoriMutu: string(r,"kategori_mutu") as EvaluasiMutuGiziEntitas["kategoriMutu"], catatanEvaluasi: string(r,"catatan_evaluasi"), evaluatorId: string(r,"evaluator_id"), evaluatorNama: string(r,"evaluator_nama"), createdAt: string(r,"created_at") }));
  }

  public async simpanEvaluasiMutu(item: EvaluasiMutuGiziEntitas): Promise<EvaluasiMutuGiziEntitas> {
    await this.pool.execute(
      `INSERT INTO evaluasi_mutu_dan_sisa_makanan (id, tanggal_evaluasi, bangsal_id, nama_bangsal, total_porsi_disajikan, rata_rata_sisa_makanan_persen, kepatuhan_ccp_suhu_persen, kepatuhan_dua_identitas_persen, kategori_mutu, catatan_evaluasi, evaluator_id, evaluator_nama, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([item.id, item.tanggalEvaluasi, item.bangsalId, item.namaBangsal, item.totalPorsiDisajikan, item.rataRataSisaMakananPersen, item.kepatuhanCcpSuhuPersen, item.kepatuhanDuaIdentitasPersen, item.kategoriMutu, item.catatanEvaluasi, item.evaluatorId, item.evaluatorNama, item.createdAt]),
    );
    return item;
  }

  public async ambilSemuaRekonsiliasiDowntime(): Promise<RekonsiliasiDowntimeEntitas[]> {
    const [rows] = await this.pool.query<Row[]>("SELECT * FROM rekonsiliasi_downtime_pelayanan ORDER BY tanggal_insiden_downtime DESC");
    return rows.map(this.petaRekonsiliasi);
  }

  public async ambilRekonsiliasiBerdasarkanId(id: string): Promise<RekonsiliasiDowntimeEntitas | null> {
    const [rows] = await this.pool.execute<Row[]>("SELECT * FROM rekonsiliasi_downtime_pelayanan WHERE id = ?", parameterMysql([id]));
    return rows[0] ? this.petaRekonsiliasi(rows[0]) : null;
  }

  public async simpanRekonsiliasiDowntime(item: RekonsiliasiDowntimeEntitas): Promise<RekonsiliasiDowntimeEntitas> {
    await this.pool.execute(
      `INSERT INTO rekonsiliasi_downtime_pelayanan (id, nomor_rekonsiliasi, tanggal_insiden_downtime, durasi_downtime_menit, unit_terdampak, jumlah_formulir_kertas, duplikasi_terdeteksi, selisih_pesanan_selesai, status_rekonsiliasi, disahkan_oleh_id, disahkan_oleh_nama, waktu_pengesahan, catatan_rekonsiliasi, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([item.id, item.nomorRekonsiliasi, item.tanggalInsidenDowntime, item.durasiDowntimeMenit, item.unitTerdampak, item.jumlahFormulirKertas, item.duplikasiTerdeteksi, item.selisihPesananSelesai, item.statusRekonsiliasi, item.disahkanOlehId, item.disahkanOlehNama, item.waktuPengesahan, item.catatanRekonsiliasi, item.createdAt]),
    );
    return item;
  }

  public async perbaruiRekonsiliasiDowntime(id: string, patch: Partial<RekonsiliasiDowntimeEntitas>): Promise<RekonsiliasiDowntimeEntitas> {
    const old = await this.ambilRekonsiliasiBerdasarkanId(id);
    if (!old) throw new Error("Rekonsiliasi tidak ditemukan.");
    const item = { ...old, ...patch };
    await this.pool.execute("UPDATE rekonsiliasi_downtime_pelayanan SET status_rekonsiliasi=?, disahkan_oleh_id=?, disahkan_oleh_nama=?, waktu_pengesahan=?, catatan_rekonsiliasi=? WHERE id=?", parameterMysql([item.statusRekonsiliasi, item.disahkanOlehId, item.disahkanOlehNama, item.waktuPengesahan, item.catatanRekonsiliasi, id]));
    return item;
  }

  public hitungNomorRekonsiliasiBerikutnya(): Promise<string> {
    return this.hitungNomor("REC", "rekonsiliasi_downtime_pelayanan", "nomor_rekonsiliasi");
  }

  private petaInsiden(row: Row): LaporanInsidenKeselamatanEntitas {
    return { id: string(row,"id"), nomorInsiden: string(row,"nomor_insiden"), unitPelapor: string(row,"unit_pelapor") as LaporanInsidenKeselamatanEntitas["unitPelapor"], tanggalKejadian: string(row,"tanggal_kejadian"), jenisInsiden: string(row,"jenis_insiden"), derajatKeparahan: string(row,"derajat_keparahan") as DerajatKeparahanInsiden, deskripsiKejadian: string(row,"deskripsi_kejadian"), tindakanAwalSegera: string(row,"tindakan_awal_segera"), pasienTerdampakNama: nullable(row,"pasien_terdampak_nama"), nomorRmPasien: nullable(row,"nomor_rm_pasien"), namaBangsal: nullable(row,"nama_bangsal"), statusInsiden: string(row,"status_insiden") as StatusInsidenGizi, pelaporId: string(row,"pelapor_id"), pelaporNama: string(row,"pelapor_nama"), penanggungJawabId: nullable(row,"penanggung_jawab_id"), penanggungJawabNama: nullable(row,"penanggung_jawab_nama"), waktuPenutupan: nullable(row,"waktu_penutupan"), catatanPenutupan: nullable(row,"catatan_penutupan"), createdAt: string(row,"created_at"), updatedAt: string(row,"updated_at") };
  }

  private petaRekonsiliasi(row: Row): RekonsiliasiDowntimeEntitas {
    return { id: string(row,"id"), nomorRekonsiliasi: string(row,"nomor_rekonsiliasi"), tanggalInsidenDowntime: string(row,"tanggal_insiden_downtime"), durasiDowntimeMenit: number(row,"durasi_downtime_menit"), unitTerdampak: string(row,"unit_terdampak"), jumlahFormulirKertas: number(row,"jumlah_formulir_kertas"), duplikasiTerdeteksi: number(row,"duplikasi_terdeteksi"), selisihPesananSelesai: bool(row,"selisih_pesanan_selesai"), statusRekonsiliasi: string(row,"status_rekonsiliasi") as RekonsiliasiDowntimeEntitas["statusRekonsiliasi"], disahkanOlehId: nullable(row,"disahkan_oleh_id"), disahkanOlehNama: nullable(row,"disahkan_oleh_nama"), waktuPengesahan: nullable(row,"waktu_pengesahan"), catatanRekonsiliasi: string(row,"catatan_rekonsiliasi"), createdAt: string(row,"created_at") };
  }

  private async hitungNomor(prefix: "INC" | "REC", table: "laporan_insiden_keselamatan_gizi" | "rekonsiliasi_downtime_pelayanan", column: "nomor_insiden" | "nomor_rekonsiliasi"): Promise<string> {
    const kunci = `${table}:${new Date().toISOString().slice(0, 7)}`;
    const conn = await this.pool.getConnection();
    try {
      const [lockRows] = await conn.query<Row[]>("SELECT GET_LOCK(?, 5) AS didapat", parameterMysql([kunci]));
      if (Number(lockRows[0]?.didapat) !== 1) throw new Error("Nomor insiden sedang digunakan; coba lagi.");
      const [rows] = await conn.query<Row[]>(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} LIKE ?`, parameterMysql([`${prefix}-${new Date().toISOString().slice(0, 7).replace("-", "")}%`]));
      return `${prefix}-${new Date().toISOString().slice(0, 7).replace("-", "")}-${String((rows[0] ? number(rows[0],"total") : 0) + 1).padStart(3,"0")}`;
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", parameterMysql([kunci])).catch(() => undefined);
      conn.release();
    }
  }
}
