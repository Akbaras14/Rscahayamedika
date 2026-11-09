/**
 * @fileoverview Layanan logika bisnis `patient-service` (Tahap 2 — Peran Petugas Pendaftaran).
 * Mengimplementasikan:
 * - Pencarian dan pendaftaran pasien baru dengan pencegahan duplikasi (`AB-001`).
 * - Verifikasi sedikitnya dua pengenal pasien (`AB-020`).
 * - Koreksi terbatas identitas pasien yang mempertahankan riwayat versi sebelum & sesudah (`AB-030`, `AB-034`).
 * - Pembuatan kunjungan pemeriksaan dan pemasukan ke antrean dokter (`BRD Bab IV.4.1`).
 * - Pembatalan kunjungan administratif dengan alasan teraudit (`AB-030`, `AB-035`).
 */

import { createHash, randomUUID } from "node:crypto";
import {
  KODE_GALAT,
  type ItemNotifikasiKontrak,
  type ProfilSesiPengguna,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import { TANGGAL_OPERASIONAL_DEFAULT } from "../database/seeds/patient.seed.ts";
import type {
  DaftarKunjunganRespons,
  DaftarPasienRespons,
  EntitasKunjunganPemeriksaan,
  EntitasPasien,
  EntitasRiwayatKoreksiPasien,
  HasilCekDuplikasiPasienDto,
  SnapshotIdentitasPasien,
} from "../model/patient.model.ts";
import type { PatientRepository } from "../repository/patient.repository.ts";
import type {
  InputBatalkanKunjungan,
  InputBuatKunjunganPemeriksaan,
  InputBuatPasienBaru,
  InputCekDuplikasiPasien,
  InputKoreksiIdentitasPasien,
  InputKueriDaftarKunjungan,
  InputKueriDaftarPasien,
} from "../validators/patient.validator.ts";

/**
 * Kontrak callback pencatatan audit dan pengiriman notifikasi lintas layanan secara terisolasi.
 */
export interface KonteksIntegrasiPatientService {
  catatAuditAkses?: (param: {
    aktorId: string;
    peranAktor: ProfilSesiPengguna["peran"];
    tindakan: string;
    sumberDaya: string;
    idSumberDaya?: string;
    keputusan: "DIIZINKAN" | "DITOLAK";
    alasan: string;
    correlationId: string;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  }) => Promise<void>;
  kirimNotifikasiPengguna?: (notifikasi: ItemNotifikasiKontrak) => Promise<void>;
}

function hitungHashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? {}), "utf8")
    .digest("hex");
}

function buatSnapshotIdentitas(pasien: EntitasPasien): SnapshotIdentitasPasien {
  return {
    nomorRekamMedis: pasien.nomorRekamMedis,
    nomorIdentitasNasional: pasien.nomorIdentitasNasional,
    alasanTanpaNik: pasien.alasanTanpaNik,
    namaLengkap: pasien.namaLengkap,
    tanggalLahir: pasien.tanggalLahir,
    jenisKelamin: pasien.jenisKelamin,
    golonganDarah: pasien.golonganDarah,
    alamatDomisili: pasien.alamatDomisili,
    teleponKontakDarurat: pasien.teleponKontakDarurat,
    namaKontakDarurat: pasien.namaKontakDarurat,
    hubunganKontakDarurat: pasien.hubunganKontakDarurat,
    statusVerifikasiIdentitas: pasien.statusVerifikasiIdentitas,
    catatanAdministratif: pasien.catatanAdministratif,
  };
}

function buatSingkatanUnit(unitTujuan: string): string {
  const kata = unitTujuan
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((k) => k.length > 0 && k !== "POLIKLINIK" && k !== "POLI");
  if (kata.length === 0) {
    return "POLI-UM";
  }
  if (kata.length === 1) {
    return `POLI-${kata[0]?.slice(0, 2) ?? "UM"}`;
  }
  const inisial = kata
    .slice(0, 3)
    .map((k) => k.slice(0, 1))
    .join("");
  return `POLI-${inisial}`;
}

export class PatientService {
  private readonly repository: PatientRepository;
  private readonly integrasi: KonteksIntegrasiPatientService;

  constructor(
    repository: PatientRepository,
    integrasi: KonteksIntegrasiPatientService = {},
  ) {
    this.repository = repository;
    this.integrasi = integrasi;
  }

  /**
   * Memeriksa kesehatan penyimpanan `patient-service`.
   */
  public async cekKesehatan(): Promise<{
    layanan: string;
    status: "sehat" | "terdegradasi";
    penyimpanan: {
      terhubung: boolean;
      mode: "mysql" | "in-memory-sintetis";
    };
  }> {
    const penyimpanan = await this.repository.cekKesehatanPenyimpanan();
    return {
      layanan: "patient-service",
      status: penyimpanan.terhubung ? "sehat" : "terdegradasi",
      penyimpanan,
    };
  }

  /**
   * Mengambil daftar pasien dengan filter pencarian dan paginasi.
   *
   * @param kueri - Parameter filter dan paginasi pasien.
   * @returns Daftar pasien berpaginasi.
   */
  public async cariDaftarPasien(
    kueri: InputKueriDaftarPasien,
  ): Promise<DaftarPasienRespons> {
    return this.repository.cariDaftarPasien(kueri);
  }

  /**
   * Mengambil detail identitas seorang pasien beserta riwayat koreksi identitas (`AB-030`)
   * dan daftar kunjungan pemeriksaannya.
   *
   * @param pasienId - ID unik pasien.
   * @returns Detail pasien, riwayat koreksi identitas, dan riwayat kunjungan.
   * @throws AppError(404) Jika pasien tidak ditemukan.
   */
  public async ambilDetailPasien(pasienId: string): Promise<{
    pasien: EntitasPasien;
    riwayatKoreksi: EntitasRiwayatKoreksiPasien[];
    kunjunganTerbaru: DaftarKunjunganRespons;
  }> {
    const pasien = await this.repository.cariPasienBerdasarkanId(pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan.",
        pesanInternal: `Pasien ${pasienId} tidak ditemukan di repositori patient-service`,
      });
    }

    const [riwayatKoreksi, kunjunganTerbaru] = await Promise.all([
      this.repository.ambilRiwayatKoreksiPasien(pasienId),
      this.repository.cariDaftarKunjungan({
        pasienId,
        halaman: 1,
        ukuranHalaman: 20,
      }),
    ]);

    return {
      pasien,
      riwayatKoreksi,
      kunjunganTerbaru,
    };
  }

  /**
   * Memeriksa kemungkinan duplikasi data pasien sebelum pendaftaran baru atau koreksi (`AB-001`).
   * Membedakan konflik pasti (Nomor Rekam Medis / NIK sama) dan potensi duplikat (Nama + Tanggal Lahir sama).
   *
   * @param input - Parameter pengenal pasien yang akan diperiksa.
   * @returns Hasil pemeriksaan duplikasi beserta daftar kandidat pasien yang mirip.
   */
  public async periksaDuplikasiPasien(
    input: InputCekDuplikasiPasien,
  ): Promise<HasilCekDuplikasiPasienDto> {
    const alasanDeteksi: string[] = [];
    const petaKandidat = new Map<string, EntitasPasien>();
    let adaKonflikPasti = false;
    let adaPotensiDuplikat = false;

    if (input.nomorRekamMedis) {
      const cocokRm = await this.repository.cariPasienBerdasarkanNomorRM(
        input.nomorRekamMedis,
      );
      if (cocokRm && cocokRm.id !== input.kecualikanPasienId) {
        adaKonflikPasti = true;
        alasanDeteksi.push(
          `Nomor Rekam Medis ${cocokRm.nomorRekamMedis} sudah terdaftar atas nama ${cocokRm.namaLengkap}.`,
        );
        petaKandidat.set(cocokRm.id, cocokRm);
      }
    }

    if (input.nomorIdentitasNasional) {
      const cocokNik = await this.repository.cariPasienBerdasarkanNik(
        input.nomorIdentitasNasional,
      );
      if (cocokNik && cocokNik.id !== input.kecualikanPasienId) {
        adaKonflikPasti = true;
        alasanDeteksi.push(
          `NIK tersebut sudah terdaftar pada pasien dengan Nomor RM ${cocokNik.nomorRekamMedis} (${cocokNik.namaLengkap}).`,
        );
        petaKandidat.set(cocokNik.id, cocokNik);
      }
    }

    const cocokNamaTgl =
      await this.repository.cariKandidatDuplikatNamaTanggalLahir(
        input.namaLengkap,
        input.tanggalLahir,
        input.kecualikanPasienId,
      );

    for (const kandidat of cocokNamaTgl) {
      adaPotensiDuplikat = true;
      if (!petaKandidat.has(kandidat.id)) {
        petaKandidat.set(kandidat.id, kandidat);
      }
    }

    if (cocokNamaTgl.length > 0) {
      alasanDeteksi.push(
        `Ditemukan ${cocokNamaTgl.length} pasien terdaftar dengan nama lengkap dan tanggal lahir serupa (${input.tanggalLahir}). Verifikasi apakah pasien sudah pernah terdaftar sebelum membuat identitas baru.`,
      );
    }

    return {
      adaKonflikPasti,
      adaPotensiDuplikat,
      alasanDeteksi,
      kandidatPasien: [...petaKandidat.values()],
    };
  }

  /**
   * Mendaftarkan identitas pasien baru dengan pencegahan duplikasi (`AB-001`),
   * verifikasi dua pengenal (`AB-020`), dan idempotensi mutasi.
   *
   * @param aktor - Profil sesi Petugas Pendaftaran.
   * @param input - Data identitas pasien baru.
   * @param correlationId - ID korelasi permintaan.
   * @param kunciIdempotensi - Header `X-Idempotency-Key` opsional.
   * @returns Entitas pasien yang baru dibuat beserta indikator replay idempoten.
   */
  public async daftarkanPasienBaru(
    aktor: ProfilSesiPengguna,
    input: InputBuatPasienBaru,
    correlationId: string,
    kunciIdempotensi?: string,
  ): Promise<{ pasien: EntitasPasien; replayIdempoten: boolean }> {
    const rute = "POST:/v1/patients";
    const hashPayload = hitungHashPayload(input);

    if (kunciIdempotensi) {
      const rekamanLama = await this.repository.cariIdempotensi(
        kunciIdempotensi,
        aktor.id,
        rute,
      );
      if (rekamanLama) {
        if (rekamanLama.hashPayload !== hashPayload) {
          throw new AppError({
            kode: KODE_GALAT.IDEMPOTENSI_KONFLIK,
            statusHttp: 409,
            pesanPengguna:
              "Kunci idempotensi yang sama telah digunakan untuk data pendaftaran pasien yang berbeda.",
            pesanInternal: `Konflik idempotensi pendaftaran pasien oleh ${aktor.id}`,
          });
        }
        return {
          pasien: JSON.parse(rekamanLama.responsJson) as EntitasPasien,
          replayIdempoten: true,
        };
      }
    }

    const cekDuplikat = await this.periksaDuplikasiPasien({
      nomorRekamMedis: input.nomorRekamMedis,
      nomorIdentitasNasional: input.nomorIdentitasNasional ?? undefined,
      namaLengkap: input.namaLengkap,
      tanggalLahir: input.tanggalLahir,
    });

    if (cekDuplikat.adaKonflikPasti) {
      await this.integrasi.catatAuditAkses?.({
        aktorId: aktor.id,
        peranAktor: aktor.peran,
        tindakan: "PENDAFTARAN_BUAT_PASIEN",
        sumberDaya: "pasien",
        keputusan: "DITOLAK",
        alasan: "Konflik pasti Nomor Rekam Medis atau NIK ganda (AB-001)",
        correlationId,
      });
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          cekDuplikat.alasanDeteksi[0] ??
          "Nomor Rekam Medis atau NIK sudah terdaftar pada pasien lain (AB-001).",
        pesanInternal: `Duplikasi pasti pendaftaran pasien ditolak: ${cekDuplikat.alasanDeteksi.join("; ")}`,
      });
    }

    if (cekDuplikat.adaPotensiDuplikat && !input.konfirmasiBukanDuplikat) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Ditemukan pasien dengan nama dan tanggal lahir yang sama. Periksa daftar kandidat pasien lama atau centang konfirmasi bukan duplikat beserta alasannya setelah memverifikasi dua pengenal (AB-001, AB-020).",
        pesanInternal: `Potensi duplikasi nama+tanggalLahir belum dikonfirmasi oleh ${aktor.id}`,
      });
    }

    const tahunSekarang = 2026;
    const urutanRm =
      await this.repository.hitungUrutanNomorRmTahunIni(tahunSekarang);
    const nomorRekamMedis =
      input.nomorRekamMedis ??
      `RM-${tahunSekarang}-${String(urutanRm).padStart(4, "0")}`;

    const waktuSekarang = new Date().toISOString();
    const pasienBaru: EntitasPasien = {
      id: `psn-${randomUUID()}`,
      nomorRekamMedis,
      nomorIdentitasNasional: input.nomorIdentitasNasional ?? null,
      alasanTanpaNik: input.nomorIdentitasNasional
        ? null
        : (input.alasanTanpaNik ?? null),
      namaLengkap: input.namaLengkap,
      tanggalLahir: input.tanggalLahir,
      jenisKelamin: input.jenisKelamin,
      golonganDarah: input.golonganDarah,
      alamatDomisili: input.alamatDomisili,
      teleponKontakDarurat: input.teleponKontakDarurat,
      namaKontakDarurat: input.namaKontakDarurat,
      hubunganKontakDarurat: input.hubunganKontakDarurat,
      statusVerifikasiIdentitas: input.nomorIdentitasNasional
        ? "terverifikasi_dua_pengenal"
        : "perlu_verifikasi_ulang",
      catatanAdministratif: input.catatanAdministratif ?? null,
      versi: 1,
      didaftarkanOleh: aktor.id,
      dibuatPada: waktuSekarang,
      diperbaruiPada: waktuSekarang,
    };

    const tersimpan = await this.repository.simpanPasienBaru(pasienBaru);

    await this.repository.simpanPeristiwaOutbox({
      eventId: `evt-${randomUUID()}`,
      eventType: "PasienBaruTerdaftar",
      schemaVersion: 1,
      aggregateId: tersimpan.id,
      occurredAt: waktuSekarang,
      correlationId,
      payload: {
        pasienId: tersimpan.id,
        nomorRekamMedis: tersimpan.nomorRekamMedis,
        statusVerifikasiIdentitas: tersimpan.statusVerifikasiIdentitas,
        pengenalDiverifikasi: input.pengenalDiverifikasi,
        didaftarkanOleh: aktor.id,
      },
    });

    await this.integrasi.catatAuditAkses?.({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "PENDAFTARAN_BUAT_PASIEN",
      sumberDaya: "pasien",
      idSumberDaya: tersimpan.id,
      keputusan: "DIIZINKAN",
      alasan: input.konfirmasiBukanDuplikat
        ? `Registrasi pasien baru (${tersimpan.nomorRekamMedis}) dengan konfirmasi bukan duplikat: ${input.alasanKonfirmasiDuplikat}`
        : `Registrasi pasien baru (${tersimpan.nomorRekamMedis}) terverifikasi (${input.pengenalDiverifikasi})`,
      correlationId,
      metadata: {
        nomorRekamMedis: tersimpan.nomorRekamMedis,
        pengenalDiverifikasi: input.pengenalDiverifikasi,
        statusVerifikasiIdentitas: tersimpan.statusVerifikasiIdentitas,
      },
    });

    if (kunciIdempotensi) {
      await this.repository.simpanIdempotensi({
        kunciIdempotensi,
        penggunaId: aktor.id,
        rute,
        hashPayload,
        statusHttp: 201,
        responsJson: JSON.stringify(tersimpan),
        dibuatPada: waktuSekarang,
        kedaluwarsaPada: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    return { pasien: tersimpan, replayIdempoten: false };
  }

  /**
   * Melakukan koreksi terbatas atas identitas pasien dengan optimistic concurrency (`versi`),
   * verifikasi dua pengenal (`AB-020`), dan penyimpanan riwayat sebelum/sesudah (`AB-030`, `AB-034`).
   * Nomor Rekam Medis (`nomorRekamMedis`) tidak dapat diubah untuk menjaga keutuhan rujukan klinis (`AB-001`).
   *
   * @param aktor - Profil sesi Petugas Pendaftaran.
   * @param pasienId - ID pasien yang dikoreksi.
   * @param input - Payload koreksi identitas beserta versi dan alasan koreksi.
   * @param correlationId - ID korelasi permintaan.
   * @returns Data pasien terbaru dan entitas riwayat koreksi yang tercatat.
   */
  public async koreksiIdentitasPasien(
    aktor: ProfilSesiPengguna,
    pasienId: string,
    input: InputKoreksiIdentitasPasien,
    correlationId: string,
  ): Promise<{
    pasien: EntitasPasien;
    riwayat: EntitasRiwayatKoreksiPasien;
  }> {
    const saatIni = await this.repository.cariPasienBerdasarkanId(pasienId);
    if (!saatIni) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien yang akan dikoreksi tidak ditemukan.",
        pesanInternal: `Pasien ${pasienId} tidak ditemukan saat koreksi identitas`,
      });
    }

    if (saatIni.versi !== input.versi) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Data pasien telah berubah oleh petugas lain. Muat ulang halaman sebelum menyimpan koreksi.",
        pesanInternal: `Konflik versi koreksi pasien ${pasienId}: diharapkan=${input.versi}, aktual=${saatIni.versi}`,
      });
    }

    if (
      input.nomorIdentitasNasional &&
      input.nomorIdentitasNasional !== saatIni.nomorIdentitasNasional
    ) {
      const pemilikNik = await this.repository.cariPasienBerdasarkanNik(
        input.nomorIdentitasNasional,
      );
      if (pemilikNik && pemilikNik.id !== pasienId) {
        throw new AppError({
          kode: KODE_GALAT.KONFLIK_BISNIS,
          statusHttp: 409,
          pesanPengguna: `NIK tersebut sudah terdaftar pada pasien lain dengan Nomor RM ${pemilikNik.nomorRekamMedis} (AB-001).`,
          pesanInternal: `Konflik NIK saat koreksi pasien ${pasienId}`,
        });
      }
    }

    const waktuSekarang = new Date().toISOString();
    const snapshotSebelum = buatSnapshotIdentitas(saatIni);
    const snapshotSesudah: SnapshotIdentitasPasien = {
      nomorRekamMedis: saatIni.nomorRekamMedis,
      nomorIdentitasNasional: input.nomorIdentitasNasional,
      alasanTanpaNik: input.nomorIdentitasNasional
        ? null
        : (input.alasanTanpaNik ?? null),
      namaLengkap: input.namaLengkap,
      tanggalLahir: input.tanggalLahir,
      jenisKelamin: input.jenisKelamin,
      golonganDarah: input.golonganDarah,
      alamatDomisili: input.alamatDomisili,
      teleponKontakDarurat: input.teleponKontakDarurat,
      namaKontakDarurat: input.namaKontakDarurat,
      hubunganKontakDarurat: input.hubunganKontakDarurat,
      statusVerifikasiIdentitas: input.statusVerifikasiIdentitas,
      catatanAdministratif: input.catatanAdministratif ?? null,
    };

    const riwayat: EntitasRiwayatKoreksiPasien = {
      id: `kor-${randomUUID()}`,
      pasienId,
      versiSebelum: saatIni.versi,
      versiSesudah: saatIni.versi + 1,
      snapshotSebelum,
      snapshotSesudah,
      alasanKoreksi: input.alasanKoreksi,
      pengenalDiverifikasi: input.pengenalDiverifikasi,
      dikoreksiOlehId: aktor.id,
      dikoreksiOlehNama: aktor.namaLengkap,
      dikoreksiPada: waktuSekarang,
    };

    const hasil = await this.repository.koreksiIdentitasPasien({
      pasienId,
      nomorIdentitasNasional: snapshotSesudah.nomorIdentitasNasional,
      alasanTanpaNik: snapshotSesudah.alasanTanpaNik,
      namaLengkap: snapshotSesudah.namaLengkap,
      tanggalLahir: snapshotSesudah.tanggalLahir,
      jenisKelamin: snapshotSesudah.jenisKelamin,
      golonganDarah: snapshotSesudah.golonganDarah,
      alamatDomisili: snapshotSesudah.alamatDomisili,
      teleponKontakDarurat: snapshotSesudah.teleponKontakDarurat,
      namaKontakDarurat: snapshotSesudah.namaKontakDarurat,
      hubunganKontakDarurat: snapshotSesudah.hubunganKontakDarurat,
      statusVerifikasiIdentitas: snapshotSesudah.statusVerifikasiIdentitas,
      catatanAdministratif: snapshotSesudah.catatanAdministratif,
      versiDiharapkan: input.versi,
      riwayatKoreksi: riwayat,
    });

    if (!hasil.berhasil || !hasil.pasien) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Koreksi identitas gagal disimpan karena versi data telah berubah.",
        pesanInternal: `Koreksi identitas pasien ${pasienId} gagal karena konflik versi`,
      });
    }

    await this.repository.simpanPeristiwaOutbox({
      eventId: `evt-${randomUUID()}`,
      eventType: "IdentitasPasienDikoreksi",
      schemaVersion: 1,
      aggregateId: pasienId,
      occurredAt: waktuSekarang,
      correlationId,
      payload: {
        pasienId,
        nomorRekamMedis: hasil.pasien.nomorRekamMedis,
        versiSebelum: riwayat.versiSebelum,
        versiSesudah: riwayat.versiSesudah,
        alasanKoreksi: riwayat.alasanKoreksi,
        dikoreksiOlehId: aktor.id,
      },
    });

    await this.integrasi.catatAuditAkses?.({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "PENDAFTARAN_KOREKSI_IDENTITAS_PASIEN",
      sumberDaya: "pasien",
      idSumberDaya: pasienId,
      keputusan: "DIIZINKAN",
      alasan: input.alasanKoreksi,
      correlationId,
      metadata: {
        nomorRekamMedis: hasil.pasien.nomorRekamMedis,
        versiSebelum: riwayat.versiSebelum,
        versiSesudah: riwayat.versiSesudah,
        pengenalDiverifikasi: input.pengenalDiverifikasi,
      },
    });

    return {
      pasien: hasil.pasien,
      riwayat,
    };
  }

  /**
   * Membuat kunjungan pemeriksaan baru untuk pasien dan memasukkannya ke antrean dokter (`BRD Bab IV.4.1`).
   * Menegakkan aturan keselamatan `AB-020`: wajib memverifikasi kecocokan tanggal lahir pasien dengan
   * pengenal kedua sebelum kunjungan dapat dibuat.
   *
   * @param aktor - Profil sesi Petugas Pendaftaran.
   * @param pasienId - ID pasien yang didaftarkan kunjungannya.
   * @param input - Rincian kunjungan dan verifikasi dua pengenal pasien.
   * @param correlationId - ID korelasi permintaan.
   * @param kunciIdempotensi - Header `X-Idempotency-Key` opsional.
   * @returns Entitas kunjungan pemeriksaan yang telah masuk antrean dokter.
   */
  public async buatKunjunganPemeriksaan(
    aktor: ProfilSesiPengguna,
    pasienId: string,
    input: InputBuatKunjunganPemeriksaan,
    correlationId: string,
    kunciIdempotensi?: string,
  ): Promise<{
    kunjungan: EntitasKunjunganPemeriksaan;
    pasien: EntitasPasien;
    replayIdempoten: boolean;
  }> {
    const rute = `POST:/v1/patients/${pasienId}/visits`;
    const hashPayload = hitungHashPayload(input);

    const pasien = await this.repository.cariPasienBerdasarkanId(pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan.",
        pesanInternal: `Pasien ${pasienId} tidak ditemukan saat membuat kunjungan`,
      });
    }

    if (kunciIdempotensi) {
      const rekamanLama = await this.repository.cariIdempotensi(
        kunciIdempotensi,
        aktor.id,
        rute,
      );
      if (rekamanLama) {
        if (rekamanLama.hashPayload !== hashPayload) {
          throw new AppError({
            kode: KODE_GALAT.IDEMPOTENSI_KONFLIK,
            statusHttp: 409,
            pesanPengguna:
              "Kunci idempotensi yang sama telah digunakan untuk payload kunjungan yang berbeda.",
            pesanInternal: `Konflik idempotensi kunjungan pasien ${pasienId}`,
          });
        }
        return {
          kunjungan: JSON.parse(
            rekamanLama.responsJson,
          ) as EntitasKunjunganPemeriksaan,
          pasien,
          replayIdempoten: true,
        };
      }
    }

    // Penegakan AB-020: Verifikasi kecocokan tanggal lahir pasien sebagai pengenal kedua
    if (input.verifikasiTanggalLahir !== pasien.tanggalLahir) {
      await this.integrasi.catatAuditAkses?.({
        aktorId: aktor.id,
        peranAktor: aktor.peran,
        tindakan: "PENDAFTARAN_BUAT_KUNJUNGAN",
        sumberDaya: "kunjungan",
        idSumberDaya: pasienId,
        keputusan: "DITOLAK",
        alasan:
          "Ketidakcocokan verifikasi tanggal lahir saat verifikasi dua pengenal pasien (AB-020)",
        correlationId,
        metadata: {
          nomorRekamMedis: pasien.nomorRekamMedis,
          pengenalDiverifikasi: input.pengenalDiverifikasi,
        },
      });

      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna:
          "Verifikasi dua pengenal gagal (AB-020): tanggal lahir yang dimasukkan tidak cocok dengan rekam medis pasien. Periksa kembali identitas pasien sebelum memasukkan ke antrean dokter.",
        pesanInternal: `Verifikasi tanggal lahir gagal untuk pasien ${pasien.nomorRekamMedis}`,
      });
    }

    // Pencegahan kunjungan pemeriksaan aktif ganda untuk satu pasien yang sama
    const kunjunganAktif =
      await this.repository.cariKunjunganAktifPasien(pasienId);
    if (kunjunganAktif) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Pasien sudah memiliki kunjungan pemeriksaan aktif (${kunjunganAktif.nomorKunjungan} - antrean ${kunjunganAktif.kodeAntrean}) pada ${kunjunganAktif.unitTujuan}.`,
        pesanInternal: `Kunjungan aktif ganda ditolak untuk pasien ${pasienId}`,
      });
    }

    const tanggalKunjungan =
      input.tanggalKunjungan ?? TANGGAL_OPERASIONAL_DEFAULT;
    const nomorAntreanHarian =
      await this.repository.hitungNomorAntreanBerikutnya(
        tanggalKunjungan,
        input.unitTujuan,
      );
    const kodePrefix = buatSingkatanUnit(input.unitTujuan);
    const kodeAntrean = `${kodePrefix}-${String(nomorAntreanHarian).padStart(3, "0")}`;
    const tanggalRingkas = tanggalKunjungan.replace(/-/g, "");
    const nomorKunjungan = `KNJ-${tanggalRingkas}-${String(nomorAntreanHarian).padStart(4, "0")}-${pasien.nomorRekamMedis.slice(-4)}`;

    const waktuSekarang = new Date().toISOString();
    const kunjunganBaru: EntitasKunjunganPemeriksaan = {
      id: `knj-${randomUUID()}`,
      nomorKunjungan,
      pasienId: pasien.id,
      tanggalKunjungan,
      nomorAntreanHarian,
      kodeAntrean,
      unitTujuan: input.unitTujuan,
      dokterTujuanId: input.dokterTujuanId,
      dokterTujuanNama: input.dokterTujuanNama,
      keluhanAdministratif: input.keluhanAdministratif,
      prioritasAntrean: input.prioritasAntrean,
      statusKunjungan: "menunggu_pemeriksaan",
      pengenalDiverifikasi: input.pengenalDiverifikasi,
      alasanPembatalan: null,
      dibatalkanOlehId: null,
      dibatalkanPada: null,
      versi: 1,
      didaftarkanOlehId: aktor.id,
      didaftarkanOlehNama: aktor.namaLengkap,
      waktuMasukAntrean: waktuSekarang,
      diperbaruiPada: waktuSekarang,
    };

    const tersimpan = await this.repository.simpanKunjunganBaru(kunjunganBaru);

    await this.repository.simpanPeristiwaOutbox({
      eventId: `evt-${randomUUID()}`,
      eventType: "KunjunganPemeriksaanDibuat",
      schemaVersion: 1,
      aggregateId: tersimpan.id,
      occurredAt: waktuSekarang,
      correlationId,
      payload: {
        kunjunganId: tersimpan.id,
        nomorKunjungan: tersimpan.nomorKunjungan,
        pasienId: pasien.id,
        nomorRekamMedis: pasien.nomorRekamMedis,
        kodeAntrean: tersimpan.kodeAntrean,
        unitTujuan: tersimpan.unitTujuan,
        dokterTujuanId: tersimpan.dokterTujuanId,
        prioritasAntrean: tersimpan.prioritasAntrean,
      },
    });

    // Kirim notifikasi pekerjaan ke Dokter tujuan dengan informasi pasien minimal (UI_UX.md Bagian 7.1)
    await this.integrasi.kirimNotifikasiPengguna?.({
      id: `notif-${randomUUID()}`,
      peristiwaId: `evt-antrean-${tersimpan.id}`,
      penerimaId: tersimpan.dokterTujuanId,
      judul:
        tersimpan.prioritasAntrean === "mendesak"
          ? `Antrean Mendesak Baru: ${tersimpan.kodeAntrean}`
          : `Antrean Pemeriksaan Baru: ${tersimpan.kodeAntrean}`,
      ringkasan: `Pasien ${pasien.nomorRekamMedis} telah diverifikasi dua pengenal di pendaftaran dan menunggu pemeriksaan di ${tersimpan.unitTujuan}.`,
      kategori: "pekerjaan",
      prioritas:
        tersimpan.prioritasAntrean === "mendesak" ? "tinggi" : "normal",
      statusBaca: "belum_dibaca",
      tautanTujuan: "/dokter",
      waktuDibuat: waktuSekarang,
      waktuDibaca: null,
    });

    await this.integrasi.catatAuditAkses?.({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "PENDAFTARAN_BUAT_KUNJUNGAN",
      sumberDaya: "kunjungan",
      idSumberDaya: tersimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Pembuatan kunjungan pemeriksaan ${tersimpan.nomorKunjungan} (${tersimpan.kodeAntrean}) ke ${tersimpan.unitTujuan}`,
      correlationId,
      metadata: {
        nomorKunjungan: tersimpan.nomorKunjungan,
        nomorRekamMedis: pasien.nomorRekamMedis,
        kodeAntrean: tersimpan.kodeAntrean,
        prioritasAntrean: tersimpan.prioritasAntrean,
        pengenalDiverifikasi: tersimpan.pengenalDiverifikasi,
      },
    });

    if (kunciIdempotensi) {
      await this.repository.simpanIdempotensi({
        kunciIdempotensi,
        penggunaId: aktor.id,
        rute,
        hashPayload,
        statusHttp: 201,
        responsJson: JSON.stringify(tersimpan),
        dibuatPada: waktuSekarang,
        kedaluwarsaPada: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    return {
      kunjungan: tersimpan,
      pasien,
      replayIdempoten: false,
    };
  }

  /**
   * Membatalkan kunjungan pemeriksaan yang masih berstatus `menunggu_pemeriksaan` (`AB-030`, `AB-035`).
   *
   * @param aktor - Profil sesi Petugas Pendaftaran.
   * @param kunjunganId - ID kunjungan yang akan dibatalkan.
   * @param input - Versi kunjungan dan alasan pembatalan wajib.
   * @param correlationId - ID korelasi permintaan.
   * @returns Entitas kunjungan yang telah berstatus `dibatalkan`.
   */
  public async batalkanKunjunganPemeriksaan(
    aktor: ProfilSesiPengguna,
    kunjunganId: string,
    input: InputBatalkanKunjungan,
    correlationId: string,
  ): Promise<EntitasKunjunganPemeriksaan> {
    const saatIni =
      await this.repository.cariKunjunganBerdasarkanId(kunjunganId);
    if (!saatIni) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data kunjungan pemeriksaan tidak ditemukan.",
        pesanInternal: `Kunjungan ${kunjunganId} tidak ditemukan saat pembatalan`,
      });
    }

    if (saatIni.statusKunjungan !== "menunggu_pemeriksaan") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Kunjungan dengan status '${saatIni.statusKunjungan}' tidak dapat dibatalkan dari loket pendaftaran.`,
        pesanInternal: `Pembatalan kunjungan ${kunjunganId} ditolak karena status=${saatIni.statusKunjungan}`,
      });
    }

    if (saatIni.versi !== input.versi) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Status kunjungan telah berubah oleh petugas lain. Muat ulang daftar antrean sebelum membatalkan.",
        pesanInternal: `Konflik versi pembatalan kunjungan ${kunjunganId}`,
      });
    }

    const waktuSekarang = new Date().toISOString();
    const hasil = await this.repository.batalkanKunjungan({
      kunjunganId,
      versiDiharapkan: input.versi,
      alasanPembatalan: input.alasanPembatalan,
      dibatalkanOlehId: aktor.id,
      dibatalkanPada: waktuSekarang,
    });

    if (!hasil.berhasil || !hasil.kunjungan) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Pembatalan kunjungan gagal disimpan karena versi data telah berubah.",
        pesanInternal: `Gagal membatalkan kunjungan ${kunjunganId}`,
      });
    }

    await this.repository.simpanPeristiwaOutbox({
      eventId: `evt-${randomUUID()}`,
      eventType: "KunjunganPemeriksaanDibatalkan",
      schemaVersion: 1,
      aggregateId: kunjunganId,
      occurredAt: waktuSekarang,
      correlationId,
      payload: {
        kunjunganId,
        nomorKunjungan: hasil.kunjungan.nomorKunjungan,
        pasienId: hasil.kunjungan.pasienId,
        alasanPembatalan: input.alasanPembatalan,
        dibatalkanOlehId: aktor.id,
      },
    });

    await this.integrasi.catatAuditAkses?.({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "PENDAFTARAN_BATALKAN_KUNJUNGAN",
      sumberDaya: "kunjungan",
      idSumberDaya: kunjunganId,
      keputusan: "DIIZINKAN",
      alasan: input.alasanPembatalan,
      correlationId,
      metadata: {
        nomorKunjungan: hasil.kunjungan.nomorKunjungan,
        kodeAntrean: hasil.kunjungan.kodeAntrean,
      },
    });

    return hasil.kunjungan;
  }

  /**
   * Mengambil daftar kunjungan pemeriksaan dan antrean dokter berpaginasi.
   *
   * @param kueri - Filter tanggal, status, prioritas, dokter tujuan, kata kunci, dan halaman.
   * @returns Daftar kunjungan pemeriksaan beserta ringkasan antrean aktif.
   */
  public async cariDaftarKunjungan(
    kueri: InputKueriDaftarKunjungan,
  ): Promise<DaftarKunjunganRespons> {
    return this.repository.cariDaftarKunjungan(kueri);
  }
}
