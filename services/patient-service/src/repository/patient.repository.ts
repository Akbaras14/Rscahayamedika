import { parameterMysql, waktuMysql } from "../../../../packages/database/src/mysql.ts";
/**
 * @fileoverview Lapisan repositori untuk `patient-service` (Tahap 2 — Peran Petugas Pendaftaran).
 * Mengimplementasikan `PatientRepository` dengan dua adapter:
 * 1. `MySqlPatientRepository` — Query MySQL/MariaDB terparameterisasi pada skema `manajemen_gizi_pasien_patient`.
 * 2. `InMemoryPatientRepository` — Penyimpanan deterministik untuk pengujian otomatis dan pengembangan lokal.
 *
 * Acuan aturan bisnis: AB-001 (identitas unik), AB-020 (verifikasi dua pengenal), AB-030 (riwayat koreksi), AB-034 (jejak telusur).
 */

import type { Pool, RowDataPacket } from "mysql2/promise";
import type { AmplopPeristiwaIntegrasi } from "../../../../packages/shared-types/src/index.ts";
import {
  SEED_KUNJUNGAN_SINTETIS,
  SEED_PASIEN_SINTETIS,
  SEED_RIWAYAT_KOREKSI_PASIEN,
} from "../database/seeds/patient.seed.ts";
import { jalankanTransaksiPatient } from "../database/pool.ts";
import type {
  DaftarKunjunganRespons,
  DaftarPasienRespons,
  EntitasKunjunganPemeriksaan,
  EntitasPasien,
  EntitasRiwayatKoreksiPasien,
  GolonganDarahPasien,
  ItemAntreanKunjunganDto,
  JenisKelaminPasien,
  MetodeVerifikasiDuaPengenal,
  PrioritasAntreanKunjungan,
  RekamanIdempotensiPasien,
  SnapshotIdentitasPasien,
  StatusKunjunganPasien,
  StatusVerifikasiIdentitas,
} from "../model/patient.model.ts";

export interface ParameterCariPasien {
  kataKunci?: string;
  tanggalLahir?: string;
  statusVerifikasi?: StatusVerifikasiIdentitas;
  halaman: number;
  ukuranHalaman: number;
}

export interface ParameterCariKunjungan {
  kataKunci?: string;
  tanggalKunjungan?: string;
  statusKunjungan?: StatusKunjunganPasien;
  prioritasAntrean?: PrioritasAntreanKunjungan;
  dokterTujuanId?: string;
  pasienId?: string;
  halaman: number;
  ukuranHalaman: number;
}

export interface ParameterKoreksiPasien {
  pasienId: string;
  nomorIdentitasNasional: string | null;
  alasanTanpaNik: string | null;
  namaLengkap: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelaminPasien;
  golonganDarah: GolonganDarahPasien;
  alamatDomisili: string;
  teleponKontakDarurat: string;
  namaKontakDarurat: string;
  hubunganKontakDarurat: string;
  statusVerifikasiIdentitas: StatusVerifikasiIdentitas;
  catatanAdministratif: string | null;
  versiDiharapkan: number;
  riwayatKoreksi: EntitasRiwayatKoreksiPasien;
}

export interface ParameterBatalkanKunjungan {
  kunjunganId: string;
  versiDiharapkan: number;
  alasanPembatalan: string;
  dibatalkanOlehId: string;
  dibatalkanPada: string;
}

export interface PatientRepository {
  cariDaftarPasien(param: ParameterCariPasien): Promise<DaftarPasienRespons>;
  cariPasienBerdasarkanId(pasienId: string): Promise<EntitasPasien | null>;
  cariPasienBerdasarkanNomorRM(
    nomorRekamMedis: string,
  ): Promise<EntitasPasien | null>;
  cariPasienBerdasarkanNik(nik: string): Promise<EntitasPasien | null>;
  cariKandidatDuplikatNamaTanggalLahir(
    namaLengkap: string,
    tanggalLahir: string,
    kecualikanPasienId?: string,
  ): Promise<EntitasPasien[]>;
  hitungUrutanNomorRmTahunIni(tahun: number): Promise<number>;
  simpanPasienBaru(pasien: EntitasPasien): Promise<EntitasPasien>;
  koreksiIdentitasPasien(
    param: ParameterKoreksiPasien,
  ): Promise<{
    berhasil: boolean;
    pasien: EntitasPasien | null;
  }>;
  ambilRiwayatKoreksiPasien(
    pasienId: string,
  ): Promise<EntitasRiwayatKoreksiPasien[]>;
  cariKunjunganAktifPasien(
    pasienId: string,
  ): Promise<EntitasKunjunganPemeriksaan | null>;
  cariKunjunganBerdasarkanId(
    kunjunganId: string,
  ): Promise<EntitasKunjunganPemeriksaan | null>;
  hitungNomorAntreanBerikutnya(
    tanggalKunjungan: string,
    unitTujuan: string,
  ): Promise<number>;
  simpanKunjunganBaru(
    kunjungan: EntitasKunjunganPemeriksaan,
  ): Promise<EntitasKunjunganPemeriksaan>;
  batalkanKunjungan(
    param: ParameterBatalkanKunjungan,
  ): Promise<{
    berhasil: boolean;
    kunjungan: EntitasKunjunganPemeriksaan | null;
  }>;
  cariDaftarKunjungan(
    param: ParameterCariKunjungan,
  ): Promise<DaftarKunjunganRespons>;
  cariIdempotensi(
    kunciIdempotensi: string,
    penggunaId: string,
    rute: string,
  ): Promise<RekamanIdempotensiPasien | null>;
  simpanIdempotensi(rekaman: RekamanIdempotensiPasien): Promise<void>;
  simpanPeristiwaOutbox(peristiwa: AmplopPeristiwaIntegrasi): Promise<void>;
  cekKesehatanPenyimpanan(): Promise<{
    terhubung: boolean;
    mode: "mysql" | "in-memory-sintetis";
  }>;
}

/**
 * Menormalisasi nama lengkap untuk pencocokan deteksi duplikasi (`AB-001`).
 */
export function normalisasiNamaPasien(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/\(data uji sintetis\)/gi, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Implementasi in-memory deterministik untuk pengujian otomatis dan pengembangan lokal.
 */
export class InMemoryPatientRepository implements PatientRepository {
  private readonly petaPasien = new Map<string, EntitasPasien>();
  private readonly daftarRiwayatKoreksi: EntitasRiwayatKoreksiPasien[] = [];
  private readonly petaKunjungan = new Map<
    string,
    EntitasKunjunganPemeriksaan
  >();
  private readonly petaIdempotensi = new Map<
    string,
    RekamanIdempotensiPasien
  >();
  private readonly daftarOutbox: AmplopPeristiwaIntegrasi[] = [];

  constructor() {
    for (const p of SEED_PASIEN_SINTETIS) {
      this.petaPasien.set(p.id, { ...p });
    }
    for (const r of SEED_RIWAYAT_KOREKSI_PASIEN) {
      this.daftarRiwayatKoreksi.push({
        ...r,
        snapshotSebelum: { ...r.snapshotSebelum },
        snapshotSesudah: { ...r.snapshotSesudah },
      });
    }
    for (const k of SEED_KUNJUNGAN_SINTETIS) {
      this.petaKunjungan.set(k.id, { ...k });
    }
  }

  public async cariDaftarPasien(
    param: ParameterCariPasien,
  ): Promise<DaftarPasienRespons> {
    const kataKunci = param.kataKunci?.trim().toLowerCase() ?? "";
    const semua = [...this.petaPasien.values()]
      .filter((p) => {
        if (
          param.statusVerifikasi &&
          p.statusVerifikasiIdentitas !== param.statusVerifikasi
        ) {
          return false;
        }
        if (param.tanggalLahir && p.tanggalLahir !== param.tanggalLahir) {
          return false;
        }
        if (!kataKunci) {
          return true;
        }
        return (
          p.nomorRekamMedis.toLowerCase().includes(kataKunci) ||
          (p.nomorIdentitasNasional?.toLowerCase().includes(kataKunci) ??
            false) ||
          p.namaLengkap.toLowerCase().includes(kataKunci) ||
          p.tanggalLahir.includes(kataKunci) ||
          p.teleponKontakDarurat.toLowerCase().includes(kataKunci)
        );
      })
      .sort((a, b) => a.nomorRekamMedis.localeCompare(b.nomorRekamMedis));

    const offset = (param.halaman - 1) * param.ukuranHalaman;
    const items = semua
      .slice(offset, offset + param.ukuranHalaman)
      .map((item) => ({ ...item }));

    return {
      items,
      totalItem: semua.length,
      halaman: param.halaman,
      ukuranHalaman: param.ukuranHalaman,
    };
  }

  public async cariPasienBerdasarkanId(
    pasienId: string,
  ): Promise<EntitasPasien | null> {
    const p = this.petaPasien.get(pasienId);
    return p ? { ...p } : null;
  }

  public async cariPasienBerdasarkanNomorRM(
    nomorRekamMedis: string,
  ): Promise<EntitasPasien | null> {
    const target = nomorRekamMedis.trim().toUpperCase();
    for (const p of this.petaPasien.values()) {
      if (p.nomorRekamMedis.toUpperCase() === target) {
        return { ...p };
      }
    }
    return null;
  }

  public async cariPasienBerdasarkanNik(
    nik: string,
  ): Promise<EntitasPasien | null> {
    const target = nik.trim();
    for (const p of this.petaPasien.values()) {
      if (p.nomorIdentitasNasional === target) {
        return { ...p };
      }
    }
    return null;
  }

  public async cariKandidatDuplikatNamaTanggalLahir(
    namaLengkap: string,
    tanggalLahir: string,
    kecualikanPasienId?: string,
  ): Promise<EntitasPasien[]> {
    const namaNorm = normalisasiNamaPasien(namaLengkap);
    const hasil: EntitasPasien[] = [];
    for (const p of this.petaPasien.values()) {
      if (kecualikanPasienId && p.id === kecualikanPasienId) {
        continue;
      }
      const pNorm = normalisasiNamaPasien(p.namaLengkap);
      if (p.tanggalLahir === tanggalLahir && pNorm === namaNorm) {
        hasil.push({ ...p });
      }
    }
    return hasil;
  }

  public async hitungUrutanNomorRmTahunIni(tahun: number): Promise<number> {
    const awalan = `RM-${tahun}-`;
    let maks = 0;
    for (const p of this.petaPasien.values()) {
      if (p.nomorRekamMedis.startsWith(awalan)) {
        const angka = Number.parseInt(
          p.nomorRekamMedis.slice(awalan.length),
          10,
        );
        if (!Number.isNaN(angka) && angka > maks) {
          maks = angka;
        }
      }
    }
    return maks + 1;
  }

  public async simpanPasienBaru(pasien: EntitasPasien): Promise<EntitasPasien> {
    const salinan: EntitasPasien = { ...pasien };
    this.petaPasien.set(salinan.id, salinan);
    return { ...salinan };
  }

  public async koreksiIdentitasPasien(
    param: ParameterKoreksiPasien,
  ): Promise<{ berhasil: boolean; pasien: EntitasPasien | null }> {
    const saatIni = this.petaPasien.get(param.pasienId);
    if (!saatIni) {
      return { berhasil: false, pasien: null };
    }
    if (saatIni.versi !== param.versiDiharapkan) {
      return { berhasil: false, pasien: { ...saatIni } };
    }

    const diperbarui: EntitasPasien = {
      ...saatIni,
      nomorIdentitasNasional: param.nomorIdentitasNasional,
      alasanTanpaNik: param.alasanTanpaNik,
      namaLengkap: param.namaLengkap,
      tanggalLahir: param.tanggalLahir,
      jenisKelamin: param.jenisKelamin,
      golonganDarah: param.golonganDarah,
      alamatDomisili: param.alamatDomisili,
      teleponKontakDarurat: param.teleponKontakDarurat,
      namaKontakDarurat: param.namaKontakDarurat,
      hubunganKontakDarurat: param.hubunganKontakDarurat,
      statusVerifikasiIdentitas: param.statusVerifikasiIdentitas,
      catatanAdministratif: param.catatanAdministratif,
      versi: saatIni.versi + 1,
      diperbaruiPada: param.riwayatKoreksi.dikoreksiPada,
    };

    this.petaPasien.set(diperbarui.id, diperbarui);
    this.daftarRiwayatKoreksi.unshift({
      ...param.riwayatKoreksi,
      snapshotSebelum: { ...param.riwayatKoreksi.snapshotSebelum },
      snapshotSesudah: { ...param.riwayatKoreksi.snapshotSesudah },
    });

    return { berhasil: true, pasien: { ...diperbarui } };
  }

  public async ambilRiwayatKoreksiPasien(
    pasienId: string,
  ): Promise<EntitasRiwayatKoreksiPasien[]> {
    return this.daftarRiwayatKoreksi
      .filter((r) => r.pasienId === pasienId)
      .map((r) => ({
        ...r,
        snapshotSebelum: { ...r.snapshotSebelum },
        snapshotSesudah: { ...r.snapshotSesudah },
      }));
  }

  public async cariKunjunganAktifPasien(
    pasienId: string,
  ): Promise<EntitasKunjunganPemeriksaan | null> {
    for (const k of this.petaKunjungan.values()) {
      if (
        k.pasienId === pasienId &&
        (k.statusKunjungan === "menunggu_pemeriksaan" ||
          k.statusKunjungan === "sedang_diperiksa")
      ) {
        return { ...k };
      }
    }
    return null;
  }

  public async cariKunjunganBerdasarkanId(
    kunjunganId: string,
  ): Promise<EntitasKunjunganPemeriksaan | null> {
    const k = this.petaKunjungan.get(kunjunganId);
    return k ? { ...k } : null;
  }

  public async hitungNomorAntreanBerikutnya(
    tanggalKunjungan: string,
    unitTujuan: string,
  ): Promise<number> {
    let maks = 0;
    const unitNorm = unitTujuan.trim().toLowerCase();
    for (const k of this.petaKunjungan.values()) {
      if (
        k.tanggalKunjungan === tanggalKunjungan &&
        k.unitTujuan.trim().toLowerCase() === unitNorm &&
        k.nomorAntreanHarian > maks
      ) {
        maks = k.nomorAntreanHarian;
      }
    }
    return maks + 1;
  }

  public async simpanKunjunganBaru(
    kunjungan: EntitasKunjunganPemeriksaan,
  ): Promise<EntitasKunjunganPemeriksaan> {
    const salinan: EntitasKunjunganPemeriksaan = { ...kunjungan };
    this.petaKunjungan.set(salinan.id, salinan);
    return { ...salinan };
  }

  public async batalkanKunjungan(
    param: ParameterBatalkanKunjungan,
  ): Promise<{
    berhasil: boolean;
    kunjungan: EntitasKunjunganPemeriksaan | null;
  }> {
    const saatIni = this.petaKunjungan.get(param.kunjunganId);
    if (!saatIni) {
      return { berhasil: false, kunjungan: null };
    }
    if (saatIni.versi !== param.versiDiharapkan) {
      return { berhasil: false, kunjungan: { ...saatIni } };
    }

    const diperbarui: EntitasKunjunganPemeriksaan = {
      ...saatIni,
      statusKunjungan: "dibatalkan",
      alasanPembatalan: param.alasanPembatalan,
      dibatalkanOlehId: param.dibatalkanOlehId,
      dibatalkanPada: param.dibatalkanPada,
      versi: saatIni.versi + 1,
      diperbaruiPada: param.dibatalkanPada,
    };

    this.petaKunjungan.set(diperbarui.id, diperbarui);
    return { berhasil: true, kunjungan: { ...diperbarui } };
  }

  public async cariDaftarKunjungan(
    param: ParameterCariKunjungan,
  ): Promise<DaftarKunjunganRespons> {
    const kataKunci = param.kataKunci?.trim().toLowerCase() ?? "";
    const semuaKunjungan = [...this.petaKunjungan.values()];

    let menungguPemeriksaan = 0;
    let mendesakMenunggu = 0;
    let sedangDiperiksa = 0;
    let dibatalkanHariIni = 0;

    for (const k of semuaKunjungan) {
      if (
        param.tanggalKunjungan &&
        k.tanggalKunjungan !== param.tanggalKunjungan
      ) {
        continue;
      }
      if (k.statusKunjungan === "menunggu_pemeriksaan") {
        menungguPemeriksaan += 1;
        if (k.prioritasAntrean === "mendesak") {
          mendesakMenunggu += 1;
        }
      } else if (k.statusKunjungan === "sedang_diperiksa") {
        sedangDiperiksa += 1;
      } else if (k.statusKunjungan === "dibatalkan") {
        dibatalkanHariIni += 1;
      }
    }

    const gabungan: ItemAntreanKunjunganDto[] = [];
    for (const k of semuaKunjungan) {
      const p = this.petaPasien.get(k.pasienId);
      if (!p) {
        continue;
      }
      if (
        param.tanggalKunjungan &&
        k.tanggalKunjungan !== param.tanggalKunjungan
      ) {
        continue;
      }
      if (
        param.statusKunjungan &&
        k.statusKunjungan !== param.statusKunjungan
      ) {
        continue;
      }
      if (
        param.prioritasAntrean &&
        k.prioritasAntrean !== param.prioritasAntrean
      ) {
        continue;
      }
      if (param.dokterTujuanId && k.dokterTujuanId !== param.dokterTujuanId) {
        continue;
      }
      if (param.pasienId && k.pasienId !== param.pasienId) {
        continue;
      }
      if (kataKunci) {
        const cocok =
          k.nomorKunjungan.toLowerCase().includes(kataKunci) ||
          k.kodeAntrean.toLowerCase().includes(kataKunci) ||
          k.unitTujuan.toLowerCase().includes(kataKunci) ||
          k.dokterTujuanNama.toLowerCase().includes(kataKunci) ||
          p.namaLengkap.toLowerCase().includes(kataKunci) ||
          p.nomorRekamMedis.toLowerCase().includes(kataKunci);
        if (!cocok) {
          continue;
        }
      }

      gabungan.push({
        ...k,
        pasien: {
          id: p.id,
          nomorRekamMedis: p.nomorRekamMedis,
          nomorIdentitasNasional: p.nomorIdentitasNasional,
          namaLengkap: p.namaLengkap,
          tanggalLahir: p.tanggalLahir,
          jenisKelamin: p.jenisKelamin,
          statusVerifikasiIdentitas: p.statusVerifikasiIdentitas,
        },
      });
    }

    gabungan.sort((a, b) => {
      // Prioritaskan yang sedang menunggu pemeriksaan & mendesak di bagian atas antrean
      const skorStatus = (s: StatusKunjunganPasien): number =>
        s === "menunggu_pemeriksaan"
          ? 0
          : s === "sedang_diperiksa"
            ? 1
            : s === "diajukan_rawat_inap"
              ? 2
              : s === "selesai_pemeriksaan"
                ? 3
                : 4;
      const selisihStatus =
        skorStatus(a.statusKunjungan) - skorStatus(b.statusKunjungan);
      if (selisihStatus !== 0) {
        return selisihStatus;
      }
      if (a.prioritasAntrean !== b.prioritasAntrean) {
        return a.prioritasAntrean === "mendesak" ? -1 : 1;
      }
      return a.nomorAntreanHarian - b.nomorAntreanHarian;
    });

    const offset = (param.halaman - 1) * param.ukuranHalaman;
    const items = gabungan.slice(offset, offset + param.ukuranHalaman);

    return {
      items,
      totalItem: gabungan.length,
      halaman: param.halaman,
      ukuranHalaman: param.ukuranHalaman,
      ringkasanAntrean: {
        menungguPemeriksaan,
        mendesakMenunggu,
        sedangDiperiksa,
        dibatalkanHariIni,
      },
    };
  }

  public async cariIdempotensi(
    kunciIdempotensi: string,
    penggunaId: string,
    rute: string,
  ): Promise<RekamanIdempotensiPasien | null> {
    const kunci = `${kunciIdempotensi}:${penggunaId}:${rute}`;
    const rekaman = this.petaIdempotensi.get(kunci);
    if (!rekaman) {
      return null;
    }
    if (new Date(rekaman.kedaluwarsaPada).getTime() <= Date.now()) {
      this.petaIdempotensi.delete(kunci);
      return null;
    }
    return { ...rekaman };
  }

  public async simpanIdempotensi(
    rekaman: RekamanIdempotensiPasien,
  ): Promise<void> {
    const kunci = `${rekaman.kunciIdempotensi}:${rekaman.penggunaId}:${rekaman.rute}`;
    this.petaIdempotensi.set(kunci, { ...rekaman });
  }

  public async simpanPeristiwaOutbox(
    peristiwa: AmplopPeristiwaIntegrasi,
  ): Promise<void> {
    this.daftarOutbox.push({ ...peristiwa });
  }

  public async cekKesehatanPenyimpanan(): Promise<{
    terhubung: boolean;
    mode: "mysql" | "in-memory-sintetis";
  }> {
    return { terhubung: true, mode: "in-memory-sintetis" };
  }
}

interface BarisPasienMysql extends RowDataPacket {
  id: string;
  nomor_rekam_medis: string;
  nomor_identitas_nasional: string | null;
  alasan_tanpa_nik: string | null;
  nama_lengkap: string;
  tanggal_lahir: string;
  jenis_kelamin: JenisKelaminPasien;
  golongan_darah: GolonganDarahPasien;
  alamat_domisili: string;
  telepon_kontak_darurat: string;
  nama_kontak_darurat: string;
  hubungan_kontak_darurat: string;
  status_verifikasi_identitas: StatusVerifikasiIdentitas;
  catatan_administratif: string | null;
  versi: number;
  didaftarkan_oleh: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

interface BarisKunjunganMysql extends RowDataPacket {
  id: string;
  nomor_kunjungan: string;
  pasien_id: string;
  tanggal_kunjungan: string;
  nomor_antrean_harian: number;
  kode_antrean: string;
  unit_tujuan: string;
  dokter_tujuan_id: string;
  dokter_tujuan_nama: string;
  keluhan_administratif: string;
  prioritas_antrean: PrioritasAntreanKunjungan;
  status_kunjungan: StatusKunjunganPasien;
  pengenal_diverifikasi: MetodeVerifikasiDuaPengenal;
  alasan_pembatalan: string | null;
  dibatalkan_oleh_id: string | null;
  dibatalkan_pada: string | null;
  versi: number;
  didaftarkan_oleh_id: string;
  didaftarkan_oleh_nama: string;
  waktu_masuk_antrean: string;
  diperbarui_pada: string;
}

function petakanBarisPasien(row: BarisPasienMysql): EntitasPasien {
  return {
    id: row.id,
    nomorRekamMedis: row.nomor_rekam_medis,
    nomorIdentitasNasional: row.nomor_identitas_nasional,
    alasanTanpaNik: row.alasan_tanpa_nik,
    namaLengkap: row.nama_lengkap,
    tanggalLahir: row.tanggal_lahir,
    jenisKelamin: row.jenis_kelamin,
    golonganDarah: row.golongan_darah,
    alamatDomisili: row.alamat_domisili,
    teleponKontakDarurat: row.telepon_kontak_darurat,
    namaKontakDarurat: row.nama_kontak_darurat,
    hubunganKontakDarurat: row.hubungan_kontak_darurat,
    statusVerifikasiIdentitas: row.status_verifikasi_identitas,
    catatanAdministratif: row.catatan_administratif,
    versi: Number(row.versi),
    didaftarkanOleh: row.didaftarkan_oleh,
    dibuatPada: waktuMysql(row.dibuat_pada),
    diperbaruiPada: waktuMysql(row.diperbarui_pada),
  };
}

function petakanBarisKunjungan(
  row: BarisKunjunganMysql,
): EntitasKunjunganPemeriksaan {
  return {
    id: row.id,
    nomorKunjungan: row.nomor_kunjungan,
    pasienId: row.pasien_id,
    tanggalKunjungan: row.tanggal_kunjungan,
    nomorAntreanHarian: Number(row.nomor_antrean_harian),
    kodeAntrean: row.kode_antrean,
    unitTujuan: row.unit_tujuan,
    dokterTujuanId: row.dokter_tujuan_id,
    dokterTujuanNama: row.dokter_tujuan_nama,
    keluhanAdministratif: row.keluhan_administratif,
    prioritasAntrean: row.prioritas_antrean,
    statusKunjungan: row.status_kunjungan,
    pengenalDiverifikasi: row.pengenal_diverifikasi,
    alasanPembatalan: row.alasan_pembatalan,
    dibatalkanOlehId: row.dibatalkan_oleh_id,
    dibatalkanPada: row.dibatalkan_pada
      ? waktuMysql(row.dibatalkan_pada)
      : null,
    versi: Number(row.versi),
    didaftarkanOlehId: row.didaftarkan_oleh_id,
    didaftarkanOlehNama: row.didaftarkan_oleh_nama,
    waktuMasukAntrean: waktuMysql(row.waktu_masuk_antrean),
    diperbaruiPada: waktuMysql(row.diperbarui_pada),
  };
}

/**
 * Implementasi repositori MySQL/MariaDB terparameterisasi untuk `patient-service`.
 */
export class MySqlPatientRepository implements PatientRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public async cariDaftarPasien(
    param: ParameterCariPasien,
  ): Promise<DaftarPasienRespons> {
    const kondisi: string[] = [];
    const argumen: Array<string | number> = [];

    if (param.statusVerifikasi) {
      kondisi.push("status_verifikasi_identitas = ?");
      argumen.push(param.statusVerifikasi);
    }
    if (param.tanggalLahir) {
      kondisi.push("tanggal_lahir = ?");
      argumen.push(param.tanggalLahir);
    }
    if (param.kataKunci && param.kataKunci.trim().length > 0) {
      const pola = `%${param.kataKunci.trim()}%`;
      kondisi.push(
        "(nomor_rekam_medis LIKE ? OR nomor_identitas_nasional LIKE ? OR nama_lengkap LIKE ? OR telepon_kontak_darurat LIKE ?)",
      );
      argumen.push(pola, pola, pola, pola);
    }

    const klausaWhere =
      kondisi.length > 0 ? `WHERE ${kondisi.join(" AND ")}` : "";
    const offset = (param.halaman - 1) * param.ukuranHalaman;

    const [barisHitung] = await this.pool.execute<
      Array<RowDataPacket & { total: number }>
    >(`SELECT COUNT(*) AS total FROM pasien ${klausaWhere}`, parameterMysql(argumen));
    const totalItem = Number(barisHitung[0]?.total ?? 0);

    const [barisData] = await this.pool.execute<BarisPasienMysql[]>(
      `SELECT id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap,
              tanggal_lahir, jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat,
              nama_kontak_darurat, hubungan_kontak_darurat, status_verifikasi_identitas,
              catatan_administratif, versi, didaftarkan_oleh, dibuat_pada, diperbarui_pada
       FROM pasien
       ${klausaWhere}
       ORDER BY nomor_rekam_medis ASC
       LIMIT ? OFFSET ?`,
      parameterMysql([...argumen, param.ukuranHalaman, offset]),
    );

    return {
      items: barisData.map(petakanBarisPasien),
      totalItem,
      halaman: param.halaman,
      ukuranHalaman: param.ukuranHalaman,
    };
  }

  public async cariPasienBerdasarkanId(
    pasienId: string,
  ): Promise<EntitasPasien | null> {
    const [baris] = await this.pool.execute<BarisPasienMysql[]>(
      `SELECT id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap,
              tanggal_lahir, jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat,
              nama_kontak_darurat, hubungan_kontak_darurat, status_verifikasi_identitas,
              catatan_administratif, versi, didaftarkan_oleh, dibuat_pada, diperbarui_pada
       FROM pasien
       WHERE id = ?
       LIMIT 1`,
      parameterMysql([pasienId]),
    );
    return baris[0] ? petakanBarisPasien(baris[0]) : null;
  }

  public async cariPasienBerdasarkanNomorRM(
    nomorRekamMedis: string,
  ): Promise<EntitasPasien | null> {
    const [baris] = await this.pool.execute<BarisPasienMysql[]>(
      `SELECT id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap,
              tanggal_lahir, jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat,
              nama_kontak_darurat, hubungan_kontak_darurat, status_verifikasi_identitas,
              catatan_administratif, versi, didaftarkan_oleh, dibuat_pada, diperbarui_pada
       FROM pasien
       WHERE nomor_rekam_medis = ?
       LIMIT 1`,
      parameterMysql([nomorRekamMedis]),
    );
    return baris[0] ? petakanBarisPasien(baris[0]) : null;
  }

  public async cariPasienBerdasarkanNik(
    nik: string,
  ): Promise<EntitasPasien | null> {
    const [baris] = await this.pool.execute<BarisPasienMysql[]>(
      `SELECT id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap,
              tanggal_lahir, jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat,
              nama_kontak_darurat, hubungan_kontak_darurat, status_verifikasi_identitas,
              catatan_administratif, versi, didaftarkan_oleh, dibuat_pada, diperbarui_pada
       FROM pasien
       WHERE nomor_identitas_nasional = ?
       LIMIT 1`,
      parameterMysql([nik]),
    );
    return baris[0] ? petakanBarisPasien(baris[0]) : null;
  }

  public async cariKandidatDuplikatNamaTanggalLahir(
    namaLengkap: string,
    tanggalLahir: string,
    kecualikanPasienId?: string,
  ): Promise<EntitasPasien[]> {
    const [baris] = await this.pool.execute<BarisPasienMysql[]>(
      `SELECT id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap,
              tanggal_lahir, jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat,
              nama_kontak_darurat, hubungan_kontak_darurat, status_verifikasi_identitas,
              catatan_administratif, versi, didaftarkan_oleh, dibuat_pada, diperbarui_pada
       FROM pasien
       WHERE tanggal_lahir = ?`,
      parameterMysql([tanggalLahir]),
    );
    const namaNorm = normalisasiNamaPasien(namaLengkap);
    return baris
      .map(petakanBarisPasien)
      .filter(
        (p) =>
          p.id !== kecualikanPasienId &&
          normalisasiNamaPasien(p.namaLengkap) === namaNorm,
      );
  }

  public async hitungUrutanNomorRmTahunIni(tahun: number): Promise<number> {
    const awalan = `RM-${tahun}-%`;
    const [baris] = await this.pool.execute<
      Array<RowDataPacket & { total: number }>
    >(
      `SELECT COUNT(*) AS total FROM pasien WHERE nomor_rekam_medis LIKE ?`,
      parameterMysql([awalan]),
    );
    return Number(baris[0]?.total ?? 0) + 1;
  }

  public async simpanPasienBaru(pasien: EntitasPasien): Promise<EntitasPasien> {
    await this.pool.execute(
      `INSERT INTO pasien
       (id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap,
        tanggal_lahir, jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat,
        nama_kontak_darurat, hubungan_kontak_darurat, status_verifikasi_identitas,
        catatan_administratif, versi, didaftarkan_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        pasien.id,
        pasien.nomorRekamMedis,
        pasien.nomorIdentitasNasional,
        pasien.alasanTanpaNik,
        pasien.namaLengkap,
        pasien.tanggalLahir,
        pasien.jenisKelamin,
        pasien.golonganDarah,
        pasien.alamatDomisili,
        pasien.teleponKontakDarurat,
        pasien.namaKontakDarurat,
        pasien.hubunganKontakDarurat,
        pasien.statusVerifikasiIdentitas,
        pasien.catatanAdministratif,
        pasien.versi,
        pasien.didaftarkanOleh,
      ]),
    );
    return pasien;
  }

  public async koreksiIdentitasPasien(
    param: ParameterKoreksiPasien,
  ): Promise<{ berhasil: boolean; pasien: EntitasPasien | null }> {
    return jalankanTransaksiPatient(this.pool, async (conn) => {
      const [hasilUpdate] = await conn.execute(
        `UPDATE pasien
         SET nomor_identitas_nasional = ?,
             alasan_tanpa_nik = ?,
             nama_lengkap = ?,
             tanggal_lahir = ?,
             jenis_kelamin = ?,
             golongan_darah = ?,
             alamat_domisili = ?,
             telepon_kontak_darurat = ?,
             nama_kontak_darurat = ?,
             hubungan_kontak_darurat = ?,
             status_verifikasi_identitas = ?,
             catatan_administratif = ?,
             versi = versi + 1
         WHERE id = ? AND versi = ?`,
        parameterMysql([
          param.nomorIdentitasNasional,
          param.alasanTanpaNik,
          param.namaLengkap,
          param.tanggalLahir,
          param.jenisKelamin,
          param.golonganDarah,
          param.alamatDomisili,
          param.teleponKontakDarurat,
          param.namaKontakDarurat,
          param.hubunganKontakDarurat,
          param.statusVerifikasiIdentitas,
          param.catatanAdministratif,
          param.pasienId,
          param.versiDiharapkan,
        ]),
      );

      const affected = (hasilUpdate as { affectedRows?: number }).affectedRows ?? 0;
      if (affected === 0) {
        const saatIni = await this.cariPasienBerdasarkanId(param.pasienId);
        return { berhasil: false, pasien: saatIni };
      }

      const r = param.riwayatKoreksi;
      await conn.execute(
        `INSERT INTO riwayat_koreksi_identitas_pasien
         (id, pasien_id, versi_sebelum, versi_sesudah, snapshot_sebelum_json, snapshot_sesudah_json,
          alasan_koreksi, pengenal_diverifikasi, dikoreksi_oleh_id, dikoreksi_oleh_nama)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        parameterMysql([
          r.id,
          r.pasienId,
          r.versiSebelum,
          r.versiSesudah,
          JSON.stringify(r.snapshotSebelum),
          JSON.stringify(r.snapshotSesudah),
          r.alasanKoreksi,
          r.pengenalDiverifikasi,
          r.dikoreksiOlehId,
          r.dikoreksiOlehNama,
        ]),
      );

      const terbaru = await this.cariPasienBerdasarkanId(param.pasienId);
      return { berhasil: true, pasien: terbaru };
    });
  }

  public async ambilRiwayatKoreksiPasien(
    pasienId: string,
  ): Promise<EntitasRiwayatKoreksiPasien[]> {
    const [baris] = await this.pool.execute<
      Array<
        RowDataPacket & {
          id: string;
          pasien_id: string;
          versi_sebelum: number;
          versi_sesudah: number;
          snapshot_sebelum_json: string | SnapshotIdentitasPasien;
          snapshot_sesudah_json: string | SnapshotIdentitasPasien;
          alasan_koreksi: string;
          pengenal_diverifikasi: MetodeVerifikasiDuaPengenal;
          dikoreksi_oleh_id: string;
          dikoreksi_oleh_nama: string;
          dikoreksi_pada: string;
        }
      >
    >(
      `SELECT id, pasien_id, versi_sebelum, versi_sesudah, snapshot_sebelum_json, snapshot_sesudah_json,
              alasan_koreksi, pengenal_diverifikasi, dikoreksi_oleh_id, dikoreksi_oleh_nama, dikoreksi_pada
       FROM riwayat_koreksi_identitas_pasien
       WHERE pasien_id = ?
       ORDER BY dikoreksi_pada DESC`,
      parameterMysql([pasienId]),
    );

    return baris.map((row) => ({
      id: row.id,
      pasienId: row.pasien_id,
      versiSebelum: Number(row.versi_sebelum),
      versiSesudah: Number(row.versi_sesudah),
      snapshotSebelum:
        typeof row.snapshot_sebelum_json === "string"
          ? (JSON.parse(row.snapshot_sebelum_json) as SnapshotIdentitasPasien)
          : row.snapshot_sebelum_json,
      snapshotSesudah:
        typeof row.snapshot_sesudah_json === "string"
          ? (JSON.parse(row.snapshot_sesudah_json) as SnapshotIdentitasPasien)
          : row.snapshot_sesudah_json,
      alasanKoreksi: row.alasan_koreksi,
      pengenalDiverifikasi: row.pengenal_diverifikasi,
      dikoreksiOlehId: row.dikoreksi_oleh_id,
      dikoreksiOlehNama: row.dikoreksi_oleh_nama,
      dikoreksiPada: waktuMysql(row.dikoreksi_pada),
    }));
  }

  public async cariKunjunganAktifPasien(
    pasienId: string,
  ): Promise<EntitasKunjunganPemeriksaan | null> {
    const [baris] = await this.pool.execute<BarisKunjunganMysql[]>(
      `SELECT id, nomor_kunjungan, pasien_id, tanggal_kunjungan, nomor_antrean_harian, kode_antrean,
              unit_tujuan, dokter_tujuan_id, dokter_tujuan_nama, keluhan_administratif, prioritas_antrean,
              status_kunjungan, pengenal_diverifikasi, alasan_pembatalan, dibatalkan_oleh_id, dibatalkan_pada,
              versi, didaftarkan_oleh_id, didaftarkan_oleh_nama, waktu_masuk_antrean, diperbarui_pada
       FROM kunjungan
       WHERE pasien_id = ?
         AND status_kunjungan IN ('menunggu_pemeriksaan', 'sedang_diperiksa')
       LIMIT 1`,
      parameterMysql([pasienId]),
    );
    return baris[0] ? petakanBarisKunjungan(baris[0]) : null;
  }

  public async cariKunjunganBerdasarkanId(
    kunjunganId: string,
  ): Promise<EntitasKunjunganPemeriksaan | null> {
    const [baris] = await this.pool.execute<BarisKunjunganMysql[]>(
      `SELECT id, nomor_kunjungan, pasien_id, tanggal_kunjungan, nomor_antrean_harian, kode_antrean,
              unit_tujuan, dokter_tujuan_id, dokter_tujuan_nama, keluhan_administratif, prioritas_antrean,
              status_kunjungan, pengenal_diverifikasi, alasan_pembatalan, dibatalkan_oleh_id, dibatalkan_pada,
              versi, didaftarkan_oleh_id, didaftarkan_oleh_nama, waktu_masuk_antrean, diperbarui_pada
       FROM kunjungan
       WHERE id = ?
       LIMIT 1`,
      parameterMysql([kunjunganId]),
    );
    return baris[0] ? petakanBarisKunjungan(baris[0]) : null;
  }

  public async hitungNomorAntreanBerikutnya(
    tanggalKunjungan: string,
    unitTujuan: string,
  ): Promise<number> {
    const [baris] = await this.pool.execute<
      Array<RowDataPacket & { maks: number | null }>
    >(
      `SELECT MAX(nomor_antrean_harian) AS maks
       FROM kunjungan
       WHERE tanggal_kunjungan = ? AND unit_tujuan = ?`,
      parameterMysql([tanggalKunjungan, unitTujuan]),
    );
    return Number(baris[0]?.maks ?? 0) + 1;
  }

  public async simpanKunjunganBaru(
    kunjungan: EntitasKunjunganPemeriksaan,
  ): Promise<EntitasKunjunganPemeriksaan> {
    await this.pool.execute(
      `INSERT INTO kunjungan
       (id, nomor_kunjungan, pasien_id, tanggal_kunjungan, nomor_antrean_harian, kode_antrean,
        unit_tujuan, dokter_tujuan_id, dokter_tujuan_nama, keluhan_administratif, prioritas_antrean,
        status_kunjungan, pengenal_diverifikasi, alasan_pembatalan, dibatalkan_oleh_id, dibatalkan_pada,
        versi, didaftarkan_oleh_id, didaftarkan_oleh_nama)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        kunjungan.id,
        kunjungan.nomorKunjungan,
        kunjungan.pasienId,
        kunjungan.tanggalKunjungan,
        kunjungan.nomorAntreanHarian,
        kunjungan.kodeAntrean,
        kunjungan.unitTujuan,
        kunjungan.dokterTujuanId,
        kunjungan.dokterTujuanNama,
        kunjungan.keluhanAdministratif,
        kunjungan.prioritasAntrean,
        kunjungan.statusKunjungan,
        kunjungan.pengenalDiverifikasi,
        kunjungan.alasanPembatalan,
        kunjungan.dibatalkanOlehId,
        kunjungan.dibatalkanPada,
        kunjungan.versi,
        kunjungan.didaftarkanOlehId,
        kunjungan.didaftarkanOlehNama,
      ]),
    );
    return kunjungan;
  }

  public async batalkanKunjungan(
    param: ParameterBatalkanKunjungan,
  ): Promise<{
    berhasil: boolean;
    kunjungan: EntitasKunjunganPemeriksaan | null;
  }> {
    const waktuMysql = param.dibatalkanPada.replace("T", " ").replace("Z", "");
    const [hasil] = await this.pool.execute(
      `UPDATE kunjungan
       SET status_kunjungan = 'dibatalkan',
           alasan_pembatalan = ?,
           dibatalkan_oleh_id = ?,
           dibatalkan_pada = ?,
           versi = versi + 1
       WHERE id = ? AND versi = ?`,
      parameterMysql([
        param.alasanPembatalan,
        param.dibatalkanOlehId,
        waktuMysql,
        param.kunjunganId,
        param.versiDiharapkan,
      ]),
    );

    const affected = (hasil as { affectedRows?: number }).affectedRows ?? 0;
    const terbaru = await this.cariKunjunganBerdasarkanId(param.kunjunganId);
    return { berhasil: affected > 0, kunjungan: terbaru };
  }

  public async cariDaftarKunjungan(
    param: ParameterCariKunjungan,
  ): Promise<DaftarKunjunganRespons> {
    const kondisi: string[] = [];
    const argumen: Array<string | number> = [];

    if (param.tanggalKunjungan) {
      kondisi.push("k.tanggal_kunjungan = ?");
      argumen.push(param.tanggalKunjungan);
    }
    if (param.statusKunjungan) {
      kondisi.push("k.status_kunjungan = ?");
      argumen.push(param.statusKunjungan);
    }
    if (param.prioritasAntrean) {
      kondisi.push("k.prioritas_antrean = ?");
      argumen.push(param.prioritasAntrean);
    }
    if (param.dokterTujuanId) {
      kondisi.push("k.dokter_tujuan_id = ?");
      argumen.push(param.dokterTujuanId);
    }
    if (param.pasienId) {
      kondisi.push("k.pasien_id = ?");
      argumen.push(param.pasienId);
    }
    if (param.kataKunci && param.kataKunci.trim().length > 0) {
      const pola = `%${param.kataKunci.trim()}%`;
      kondisi.push(
        "(k.nomor_kunjungan LIKE ? OR k.kode_antrean LIKE ? OR p.nama_lengkap LIKE ? OR p.nomor_rekam_medis LIKE ?)",
      );
      argumen.push(pola, pola, pola, pola);
    }

    const klausaWhere =
      kondisi.length > 0 ? `WHERE ${kondisi.join(" AND ")}` : "";
    const offset = (param.halaman - 1) * param.ukuranHalaman;

    const [barisHitung] = await this.pool.execute<
      Array<RowDataPacket & { total: number }>
    >(
      `SELECT COUNT(*) AS total
       FROM kunjungan k
       INNER JOIN pasien p ON p.id = k.pasien_id
       ${klausaWhere}`,
      parameterMysql(argumen),
    );
    const totalItem = Number(barisHitung[0]?.total ?? 0);

    const [barisData] = await this.pool.execute<
      Array<
        BarisKunjunganMysql & {
          p_nomor_rekam_medis: string;
          p_nomor_identitas_nasional: string | null;
          p_nama_lengkap: string;
          p_tanggal_lahir: string;
          p_jenis_kelamin: JenisKelaminPasien;
          p_status_verifikasi: StatusVerifikasiIdentitas;
        }
      >
    >(
      `SELECT k.id, k.nomor_kunjungan, k.pasien_id, k.tanggal_kunjungan, k.nomor_antrean_harian,
              k.kode_antrean, k.unit_tujuan, k.dokter_tujuan_id, k.dokter_tujuan_nama,
              k.keluhan_administratif, k.prioritas_antrean, k.status_kunjungan, k.pengenal_diverifikasi,
              k.alasan_pembatalan, k.dibatalkan_oleh_id, k.dibatalkan_pada, k.versi,
              k.didaftarkan_oleh_id, k.didaftarkan_oleh_nama, k.waktu_masuk_antrean, k.diperbarui_pada,
              p.nomor_rekam_medis AS p_nomor_rekam_medis,
              p.nomor_identitas_nasional AS p_nomor_identitas_nasional,
              p.nama_lengkap AS p_nama_lengkap,
              p.tanggal_lahir AS p_tanggal_lahir,
              p.jenis_kelamin AS p_jenis_kelamin,
              p.status_verifikasi_identitas AS p_status_verifikasi
       FROM kunjungan k
       INNER JOIN pasien p ON p.id = k.pasien_id
       ${klausaWhere}
       ORDER BY k.nomor_antrean_harian ASC
       LIMIT ? OFFSET ?`,
      parameterMysql([...argumen, param.ukuranHalaman, offset]),
    );

    const items: ItemAntreanKunjunganDto[] = barisData.map((row) => ({
      ...petakanBarisKunjungan(row),
      pasien: {
        id: row.pasien_id,
        nomorRekamMedis: row.p_nomor_rekam_medis,
        nomorIdentitasNasional: row.p_nomor_identitas_nasional,
        namaLengkap: row.p_nama_lengkap,
        tanggalLahir: row.p_tanggal_lahir,
        jenisKelamin: row.p_jenis_kelamin,
        statusVerifikasiIdentitas: row.p_status_verifikasi,
      },
    }));

    return {
      items,
      totalItem,
      halaman: param.halaman,
      ukuranHalaman: param.ukuranHalaman,
      ringkasanAntrean: {
        menungguPemeriksaan: items.filter(
          (i) => i.statusKunjungan === "menunggu_pemeriksaan",
        ).length,
        mendesakMenunggu: items.filter(
          (i) =>
            i.statusKunjungan === "menunggu_pemeriksaan" &&
            i.prioritasAntrean === "mendesak",
        ).length,
        sedangDiperiksa: items.filter(
          (i) => i.statusKunjungan === "sedang_diperiksa",
        ).length,
        dibatalkanHariIni: items.filter(
          (i) => i.statusKunjungan === "dibatalkan",
        ).length,
      },
    };
  }

  public async cariIdempotensi(
    kunciIdempotensi: string,
    penggunaId: string,
    rute: string,
  ): Promise<RekamanIdempotensiPasien | null> {
    const [baris] = await this.pool.execute<
      Array<
        RowDataPacket & {
          kunci_idempotensi: string;
          pengguna_id: string;
          rute: string;
          hash_payload: string;
          status_http: number;
          respons_json: string | Record<string, unknown>;
          dibuat_pada: string;
          kedaluwarsa_pada: string;
        }
      >
    >(
      `SELECT kunci_idempotensi, pengguna_id, rute, hash_payload, status_http, respons_json, dibuat_pada, kedaluwarsa_pada
       FROM kunci_idempotensi_pasien
       WHERE kunci_idempotensi = ? AND pengguna_id = ? AND rute = ? AND kedaluwarsa_pada > UTC_TIMESTAMP(3)
       LIMIT 1`,
      parameterMysql([kunciIdempotensi, penggunaId, rute]),
    );
    const r = baris[0];
    if (!r) {
      return null;
    }
    return {
      kunciIdempotensi: r.kunci_idempotensi,
      penggunaId: r.pengguna_id,
      rute: r.rute,
      hashPayload: r.hash_payload,
      statusHttp: Number(r.status_http),
      responsJson:
        typeof r.respons_json === "string"
          ? r.respons_json
          : JSON.stringify(r.respons_json),
      dibuatPada: waktuMysql(r.dibuat_pada),
      kedaluwarsaPada: waktuMysql(r.kedaluwarsa_pada),
    };
  }

  public async simpanIdempotensi(
    rekaman: RekamanIdempotensiPasien,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO kunci_idempotensi_pasien
       (kunci_idempotensi, pengguna_id, rute, hash_payload, status_http, respons_json, kedaluwarsa_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      parameterMysql([
        rekaman.kunciIdempotensi,
        rekaman.penggunaId,
        rekaman.rute,
        rekaman.hashPayload,
        rekaman.statusHttp,
        rekaman.responsJson,
        rekaman.kedaluwarsaPada.replace("T", " ").replace("Z", ""),
      ]),
    );
  }

  public async simpanPeristiwaOutbox(
    peristiwa: AmplopPeristiwaIntegrasi,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO outbox_peristiwa_pasien
       (event_id, event_type, schema_version, aggregate_id, correlation_id, payload_json, status_pengiriman)
       VALUES (?, ?, ?, ?, ?, ?, 'menunggu')`,
      parameterMysql([
        peristiwa.eventId,
        peristiwa.eventType,
        peristiwa.schemaVersion,
        peristiwa.aggregateId,
        peristiwa.correlationId,
        JSON.stringify(peristiwa.payload),
      ]),
    );
  }

  public async cekKesehatanPenyimpanan(): Promise<{
    terhubung: boolean;
    mode: "mysql" | "in-memory-sintetis";
  }> {
    try {
      await this.pool.query("SELECT 1");
      return { terhubung: true, mode: "mysql" };
    } catch {
      return { terhubung: false, mode: "mysql" };
    }
  }
}

