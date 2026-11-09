/**
 * @fileoverview Pengujian otomatis Tahap 2 — Peran Petugas Pendaftaran (`patient-service`).
 * Menguji:
 * 1. Matriks akses negatif: penolakan Administrator (`AB-032`) dan Perawat terhadap endpoint `/v1/patients/*` (403).
 * 2. Pencegahan duplikasi (`AB-001`): penolakan NIK ganda (409), deteksi nama + tanggal lahir sama,
 *    konfirmasi eksplisit bukan duplikat, pembuatan pasien baru, dan idempotensi (`X-Idempotency-Key`).
 * 3. Koreksi terbatas identitas pasien berversi (`versi`) dan pencatatan riwayat sebelum/sesudah (`AB-030`, `AB-034`).
 * 4. Pembuatan kunjungan pemeriksaan dengan verifikasi dua pengenal (`AB-020` -> 422 bila tanggal lahir tidak cocok),
 *    pencegahan kunjungan aktif ganda (409), pengiriman notifikasi antrean ke dokter, dan pembatalan kunjungan teraudit.
 * 5. Validasi DDL migrasi SQL `001_tahap_2_pendaftaran_pasien.sql`.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  KODE_GALAT,
  type DaftarNotifikasiRespons,
  type ResponsGalatApi,
  type ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { pisahkanPernyataanSql } from "../../../identity-service/src/database/pool.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import type {
  DaftarKunjunganRespons,
  EntitasKunjunganPemeriksaan,
  EntitasPasien,
  EntitasRiwayatKoreksiPasien,
  HasilCekDuplikasiPasienDto,
} from "../model/patient.model.ts";

function ambilCookieSesi(
  setCookieHeader: string | string[] | undefined,
): string {
  const daftar = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const cocok = daftar.find((item) => item.startsWith("hpnms_session="));
  assert.ok(cocok, "Cookie sesi hpnms_session harus tersedia");
  return cocok.split(";")[0] ?? "";
}

describe("Tahap 2 — Peran Petugas Pendaftaran (Registrasi, Verifikasi 2 Pengenal, Koreksi Teraudit, Kunjungan & Antrean)", () => {
  it("1. menolak akses ke endpoint /v1/patients/* bagi Administrator (AB-032) dan Perawat (403)", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const loginAdmin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "admin.fondasi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieAdmin = ambilCookieSesi(loginAdmin.headers["set-cookie"]);

    const loginPerawat = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "perawat.anggrek",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookiePerawat = ambilCookieSesi(loginPerawat.headers["set-cookie"]);

    for (const cookie of [cookieAdmin, cookiePerawat]) {
      const resDaftar = await app.inject({
        method: "GET",
        url: "/v1/patients",
        headers: { cookie },
      });
      assert.equal(resDaftar.statusCode, 403);
      assert.equal(
        resDaftar.json<ResponsGalatApi>().galat.kode,
        KODE_GALAT.AKSES_DITOLAK,
      );

      const resAntrean = await app.inject({
        method: "GET",
        url: "/v1/patients/visits",
        headers: { cookie },
      });
      assert.equal(resAntrean.statusCode, 403);
    }

    await app.close();
  });

  it("2. mencegah duplikasi pasien (AB-001), mendaftarkan pasien baru dengan verifikasi 2 pengenal (AB-020), dan menjaga idempotensi", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const loginPendaftaran = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.pendaftaran",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginPendaftaran.statusCode, 200);
    const cookiePendaftaran = ambilCookieSesi(
      loginPendaftaran.headers["set-cookie"],
    );

    // Negatif 1: Pendaftaran dengan NIK yang sudah dimiliki psn-sintetis-001 wajib ditolak 409 (AB-001)
    const tolakNikGanda = await app.inject({
      method: "POST",
      url: "/v1/patients",
      headers: { cookie: cookiePendaftaran },
      payload: {
        nomorIdentitasNasional: "9900010180010001",
        namaLengkap: "Pasien Uji NIK Ganda (Data Uji Sintetis)",
        tanggalLahir: "1990-05-10",
        jenisKelamin: "laki_laki",
        golonganDarah: "O",
        alamatDomisili: "Jl. Uji Duplikat No. 1 (Sintetis)",
        teleponKontakDarurat: "081100009991",
        namaKontakDarurat: "Wali Uji",
        hubunganKontakDarurat: "Saudara",
        pengenalDiverifikasi: "nik_dan_tanggal_lahir",
      },
    });
    assert.equal(tolakNikGanda.statusCode, 409);
    assert.equal(
      tolakNikGanda.json<ResponsGalatApi>().galat.kode,
      KODE_GALAT.KONFLIK_BISNIS,
    );

    // Pemeriksaan potensi duplikat berdasarkan nama lengkap + tanggal lahir yang sama dengan Budi Santoso
    const cekDuplikat = await app.inject({
      method: "POST",
      url: "/v1/patients/check-duplicate",
      headers: { cookie: cookiePendaftaran },
      payload: {
        namaLengkap: "Budi Santoso",
        tanggalLahir: "1980-04-12",
      },
    });
    assert.equal(cekDuplikat.statusCode, 200);
    const dataDuplikat =
      cekDuplikat.json<ResponsSuksesApi<HasilCekDuplikasiPasienDto>>().data;
    assert.equal(dataDuplikat.adaPotensiDuplikat, true);
    assert.ok(dataDuplikat.kandidatPasien.length >= 1);

    // Negatif 2: Mencoba mendaftarkan nama + tanggal lahir sama tanpa konfirmasiBukanDuplikat -> ditolak 409
    const tolakPotensiDuplikat = await app.inject({
      method: "POST",
      url: "/v1/patients",
      headers: { cookie: cookiePendaftaran },
      payload: {
        nomorIdentitasNasional: "9900019980040099",
        namaLengkap: "Budi Santoso (Data Uji Sintetis)",
        tanggalLahir: "1980-04-12",
        jenisKelamin: "laki_laki",
        golonganDarah: "A",
        alamatDomisili: "Jl. Simulasi Berbeda No. 88 (Sintetis)",
        teleponKontakDarurat: "081100008888",
        namaKontakDarurat: "Dewi Sartika (Sintetis)",
        hubunganKontakDarurat: "Istri",
        pengenalDiverifikasi: "nik_dan_tanggal_lahir",
        konfirmasiBukanDuplikat: false,
      },
    });
    assert.equal(tolakPotensiDuplikat.statusCode, 409);

    // Positif: Mendaftarkan pasien baru dengan X-Idempotency-Key
    const payloadPasienBaru = {
      nomorIdentitasNasional: "9900010495020004",
      namaLengkap: "Lestari Wulandari (Data Uji Sintetis)",
      tanggalLahir: "1995-02-14",
      jenisKelamin: "perempuan",
      golonganDarah: "AB",
      alamatDomisili: "Jl. Simulasi Gizi No. 44, Blok Uji D (Sintetis)",
      teleponKontakDarurat: "081100001104",
      namaKontakDarurat: "Bagus Saputra (Wali Sintetis)",
      hubunganKontakDarurat: "Suami",
      pengenalDiverifikasi: "nik_dan_tanggal_lahir",
      catatanAdministratif: "Pasien baru terverifikasi KTP & KK (Sintetis).",
    };

    const buat1 = await app.inject({
      method: "POST",
      url: "/v1/patients",
      headers: {
        cookie: cookiePendaftaran,
        "x-idempotency-key": "idem-reg-lestari-001",
      },
      payload: payloadPasienBaru,
    });
    assert.equal(buat1.statusCode, 201);
    const pasienDibuat = buat1.json<ResponsSuksesApi<EntitasPasien>>().data;
    assert.equal(pasienDibuat.nomorRekamMedis, "RM-2026-0004");
    assert.equal(
      pasienDibuat.statusVerifikasiIdentitas,
      "terverifikasi_dua_pengenal",
    );
    assert.equal(pasienDibuat.versi, 1);

    // Replay idempotensi mengembalikan respons 201 yang sama dengan header x-idempotent-replay
    const buatReplay = await app.inject({
      method: "POST",
      url: "/v1/patients",
      headers: {
        cookie: cookiePendaftaran,
        "x-idempotency-key": "idem-reg-lestari-001",
      },
      payload: payloadPasienBaru,
    });
    assert.equal(buatReplay.statusCode, 201);
    assert.equal(buatReplay.headers["x-idempotent-replay"], "true");
    assert.equal(
      buatReplay.json<ResponsSuksesApi<EntitasPasien>>().data.id,
      pasienDibuat.id,
    );

    await app.close();
  });

  it("3. menerapkan koreksi identitas pasien berversi (versi) dan menyimpan riwayat koreksi (AB-030, AB-034)", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const loginPendaftaran = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.pendaftaran",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookiePendaftaran = ambilCookieSesi(
      loginPendaftaran.headers["set-cookie"],
    );

    // Koreksi psn-sintetis-003 (melengkapi NIK yang sebelumnya belum tersedia)
    const koreksi1 = await app.inject({
      method: "PATCH",
      url: "/v1/patients/psn-sintetis-003/identity",
      headers: { cookie: cookiePendaftaran },
      payload: {
        nomorIdentitasNasional: "9900010375110003",
        alasanTanpaNik: null,
        namaLengkap: "Dimas Pratama, S.E. (Data Uji Sintetis)",
        tanggalLahir: "1975-11-03",
        jenisKelamin: "laki_laki",
        golonganDarah: "B",
        alamatDomisili: "Jl. Simulasi Gizi No. 35, Blok Uji C (Sintetis)",
        teleponKontakDarurat: "081100001103",
        namaKontakDarurat: "Rina Pratama (Wali Sintetis)",
        hubunganKontakDarurat: "Anak Kandung",
        statusVerifikasiIdentitas: "terverifikasi_dua_pengenal",
        catatanAdministratif: "NIK dan ejaan nama telah diverifikasi dari KTP fisik.",
        pengenalDiverifikasi: "nik_dan_tanggal_lahir",
        versi: 1,
        alasanKoreksi:
          "Keluarga pasien menyerahkan KTP fisik untuk kelengkapan NIK dan koreksi gelar nama",
      },
    });
    assert.equal(koreksi1.statusCode, 200);
    const dataKoreksi = koreksi1.json<
      ResponsSuksesApi<{
        pasien: EntitasPasien;
        riwayat: EntitasRiwayatKoreksiPasien;
      }>
    >().data;
    assert.equal(dataKoreksi.pasien.versi, 2);
    assert.equal(dataKoreksi.riwayat.versiSebelum, 1);
    assert.equal(dataKoreksi.riwayat.versiSesudah, 2);
    assert.equal(dataKoreksi.riwayat.snapshotSebelum.nomorIdentitasNasional, null);
    assert.equal(
      dataKoreksi.riwayat.snapshotSesudah.nomorIdentitasNasional,
      "9900010375110003",
    );

    // Negatif Concurrency: mencoba menyimpan lagi dengan versi lama (versi: 1) -> ditolak 409
    const koreksiUsang = await app.inject({
      method: "PATCH",
      url: "/v1/patients/psn-sintetis-003/identity",
      headers: { cookie: cookiePendaftaran },
      payload: {
        nomorIdentitasNasional: "9900010375110003",
        namaLengkap: "Nama Usang",
        tanggalLahir: "1975-11-03",
        jenisKelamin: "laki_laki",
        golonganDarah: "B",
        alamatDomisili: "Jl. Simulasi Gizi No. 35",
        teleponKontakDarurat: "081100001103",
        namaKontakDarurat: "Rina Pratama",
        hubunganKontakDarurat: "Anak Kandung",
        statusVerifikasiIdentitas: "terverifikasi_dua_pengenal",
        pengenalDiverifikasi: "nik_dan_tanggal_lahir",
        versi: 1,
        alasanKoreksi: "Percobaan koreksi dengan versi usang",
      },
    });
    assert.equal(koreksiUsang.statusCode, 409);

    await app.close();
  });

  it("4. memverifikasi 2 pengenal saat membuat kunjungan (AB-020), memasukkan ke antrean dokter, mengirim notifikasi, dan membatalkan kunjungan", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const loginPendaftaran = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.pendaftaran",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookiePendaftaran = ambilCookieSesi(
      loginPendaftaran.headers["set-cookie"],
    );

    // Negatif Keselamatan AB-020: tanggal lahir verifikasi salah saat membuat kunjungan untuk psn-sintetis-002 -> ditolak 422
    const gagalVerifikasi2Pengenal = await app.inject({
      method: "POST",
      url: "/v1/patients/psn-sintetis-002/visits",
      headers: { cookie: cookiePendaftaran },
      payload: {
        unitTujuan: "Poliklinik Penyakit Dalam",
        dokterTujuanId: "usr-sintetis-dokter-melati",
        dokterTujuanNama: "Dokter Penanggung Jawab Melati (Sintetis)",
        keluhanAdministratif: "Kontrol evaluasi asupan makanan (Sintetis)",
        prioritasAntrean: "reguler",
        pengenalDiverifikasi: "nomor_rekam_medis_dan_tanggal_lahir",
        verifikasiTanggalLahir: "1999-01-01", // Salah! Seharusnya 1992-08-23
      },
    });
    assert.equal(gagalVerifikasi2Pengenal.statusCode, 422);
    assert.equal(
      gagalVerifikasi2Pengenal.json<ResponsGalatApi>().galat.kode,
      KODE_GALAT.PENAHANAN_KESELAMATAN,
    );

    // Positif: tanggal lahir verifikasi cocok (1992-08-23) -> kunjungan dibuat dan masuk antrean nomor 2
    const buatKunjungan = await app.inject({
      method: "POST",
      url: "/v1/patients/psn-sintetis-002/visits",
      headers: {
        cookie: cookiePendaftaran,
        "x-idempotency-key": "idem-kunjungan-ratna-001",
      },
      payload: {
        unitTujuan: "Poliklinik Penyakit Dalam",
        dokterTujuanId: "usr-sintetis-dokter-melati",
        dokterTujuanNama: "Dokter Penanggung Jawab Melati (Sintetis)",
        keluhanAdministratif: "Kontrol evaluasi asupan makanan (Sintetis)",
        prioritasAntrean: "reguler",
        pengenalDiverifikasi: "nomor_rekam_medis_dan_tanggal_lahir",
        verifikasiTanggalLahir: "1992-08-23",
      },
    });
    assert.equal(buatKunjungan.statusCode, 201);
    const dataKunjungan = buatKunjungan.json<
      ResponsSuksesApi<{
        kunjungan: EntitasKunjunganPemeriksaan;
      }>
    >().data.kunjungan;
    assert.equal(dataKunjungan.nomorAntreanHarian, 2);
    assert.equal(dataKunjungan.kodeAntrean, "POLI-PD-002");
    assert.equal(dataKunjungan.statusKunjungan, "menunggu_pemeriksaan");

    // Negatif: mencoba membuat kunjungan aktif kedua untuk pasien yang sama -> ditolak 409
    const tolakKunjunganGanda = await app.inject({
      method: "POST",
      url: "/v1/patients/psn-sintetis-002/visits",
      headers: { cookie: cookiePendaftaran },
      payload: {
        unitTujuan: "Poliklinik Gizi Klinis",
        dokterTujuanId: "usr-sintetis-dokter-melati",
        dokterTujuanNama: "Dokter Penanggung Jawab Melati (Sintetis)",
        keluhanAdministratif: "Percobaan kunjungan ganda (Sintetis)",
        prioritasAntrean: "reguler",
        pengenalDiverifikasi: "nomor_rekam_medis_dan_tanggal_lahir",
        verifikasiTanggalLahir: "1992-08-23",
      },
    });
    assert.equal(tolakKunjunganGanda.statusCode, 409);

    // Pastikan dokter tujuan menerima notifikasi pekerjaan belum_dibaca
    const loginDokter = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "dokter.melati",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDokter = ambilCookieSesi(loginDokter.headers["set-cookie"]);
    const resNotifDokter = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: { cookie: cookieDokter },
    });
    assert.equal(resNotifDokter.statusCode, 200);
    const notifDokter =
      resNotifDokter.json<ResponsSuksesApi<DaftarNotifikasiRespons>>().data;
    assert.ok(
      notifDokter.jumlahBelumDibaca >= 1,
      "Dokter tujuan harus menerima notifikasi antrean pemeriksaan baru",
    );

    // Pembatalan kunjungan pemeriksaan oleh Petugas Pendaftaran dengan alasan wajib (AB-030)
    const batalkan = await app.inject({
      method: "POST",
      url: `/v1/patients/visits/${dataKunjungan.id}/cancel`,
      headers: { cookie: cookiePendaftaran },
      payload: {
        versi: 1,
        alasanPembatalan:
          "Pasien meminta penjadwalan ulang ke hari berikutnya karena urusan keluarga",
      },
    });
    assert.equal(batalkan.statusCode, 200);
    const dataBatal =
      batalkan.json<ResponsSuksesApi<EntitasKunjunganPemeriksaan>>().data;
    assert.equal(dataBatal.statusKunjungan, "dibatalkan");
    assert.equal(dataBatal.versi, 2);

    // Periksa ringkasan antrean kunjungan mencerminkan pembatalan
    const daftarAntrean = await app.inject({
      method: "GET",
      url: "/v1/patients/visits",
      headers: { cookie: cookiePendaftaran },
    });
    assert.equal(daftarAntrean.statusCode, 200);
    const dataAntrean =
      daftarAntrean.json<ResponsSuksesApi<DaftarKunjunganRespons>>().data;
    assert.equal(dataAntrean.ringkasanAntrean.menungguPemeriksaan, 1);
    assert.equal(dataAntrean.ringkasanAntrean.dibatalkanHariIni, 1);

    await app.close();
  });

  it("5. memvalidasi berkas migrasi SQL 001_tahap_2_pendaftaran_pasien.sql pada patient-service", async () => {
    const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
    const pathSqlTahap2 = path.resolve(
      dirSaatIni,
      "../database/migrations/001_tahap_2_pendaftaran_pasien.sql",
    );
    const isiSql = await readFile(pathSqlTahap2, "utf8");
    const daftarPernyataan = pisahkanPernyataanSql(isiSql);
    assert.equal(
      daftarPernyataan.length,
      6,
      "Migrasi 001_tahap_2_pendaftaran_pasien.sql harus memiliki 6 pernyataan CREATE TABLE",
    );
  });
});

