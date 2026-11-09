/**
 * @fileoverview Pengujian unit dan integrasi untuk Tahap 3 — Peran Dokter (`clinical-nutrition-service`).
 * Menguji:
 * 1. Menolak akses ke endpoint `/v1/clinical-nutrition/*` bagi peran non-Dokter (AB-032).
 * 2. Memverifikasi dua pengenal pasien sebelum pemeriksaan klinis disimpan (AB-020).
 * 3. Mencatat hasil pemeriksaan klinis, diagnosis klinis primer, dan alergi makanan/obat (AB-006, AB-007).
 * 4. Menetapkan dan mengesahkan instruksi diet awal sah berstempel waktu & berversi (AB-003, AB-004, AB-005, AB-008, AB-009) serta idempotensi.
 * 5. Menerapkan koreksi versi instruksi diet bertingkat (versi) dengan riwayat audit lengkap (AB-010, AB-030).
 * 6. Menerbitkan pengajuan rawat inap berprioritas berstatus menunggu penempatan (BRD Bab IV.4.3).
 * 7. Memvalidasi berkas migrasi SQL 001_tahap_3_clinical_nutrition.sql.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { describe } from "node:test";
import type { FastifyInstance } from "fastify";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { InMemoryIdentityRepository } from "../../../identity-service/src/repository/identity.repository.ts";
import { InMemoryPatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { InMemoryClinicalNutritionRepository } from "../repository/clinical-nutrition.repository.ts";

async function loginDenganKredensial(
  app: FastifyInstance,
  namaPengguna: string,
  kataSandi: string,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { namaPengguna, kataSandi },
  });
  assert.equal(res.statusCode, 200);
  const setCookie = res.headers["set-cookie"];
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(cookieStr, "Cookie sesi harus tersedia pada respons login");
  return cookieStr.split(";")[0];
}

describe("Tahap 3 — Peran Dokter (Pemeriksaan Klinis, Alergi, Instruksi Diet Sah, & Pengajuan Rawat Inap)", () => {
  test("1. menolak akses ke endpoint /v1/clinical-nutrition/* bagi Administrator (AB-032) dan Petugas Pendaftaran (403)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      clinicalRepository: clinicalRepo,
    });

    // Login sebagai Administrator teknis (tanpa hak klinis AB-032)
    const cookieAdmin = await loginDenganKredensial(
      app,
      "admin.fondasi",
      KATA_SANDI_UJI_SINTETIS,
    );

    const resAdminQueue = await app.inject({
      method: "GET",
      url: "/v1/clinical-nutrition/queue",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(
      resAdminQueue.statusCode,
      403,
      "Administrator harus ditolak dari antrean dokter (AB-032)",
    );
    const bodyAdmin = JSON.parse(resAdminQueue.body);
    assert.equal(bodyAdmin.sukses, false);
    assert.equal(bodyAdmin.galat.kode, "ERR_AKSES_DITOLAK");

    // Login sebagai Petugas Pendaftaran
    const cookiePendaftaran = await loginDenganKredensial(
      app,
      "petugas.pendaftaran",
      KATA_SANDI_UJI_SINTETIS,
    );

    const resPendaftaranDiet = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/diet-orders",
      headers: { cookie: cookiePendaftaran },
      payload: {
        kunjunganId: "knj-sintetis-001",
        pasienId: "psn-sintetis-001",
        jenisDiet: "makanan_biasa",
        bentukMakanan: "biasa",
        rutePemberian: "oral",
      },
    });
    assert.equal(
      resPendaftaranDiet.statusCode,
      403,
      "Petugas pendaftaran harus ditolak dari pengesahan diet klinis (AB-032)",
    );
  });

  test("2. memverifikasi dua pengenal (AB-020) sebelum menyimpan hasil pemeriksaan klinis dokter", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieDokter = await loginDenganKredensial(
      app,
      "dokter.melati",
      KATA_SANDI_UJI_SINTETIS,
    );

    // Kasus Gagal AB-020: Tanggal lahir salah (1990-01-01 bukan 1985-04-12)
    const resGagalDuaPengenal = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/examinations",
      headers: { cookie: cookieDokter },
      payload: {
        kunjunganId: "knj-sintetis-001",
        pasienId: "psn-sintetis-001",
        verifikasiTanggalLahir: "1990-01-01",
        keluhanUtama: "Pasien mengeluh pusing dan mual",
        diagnosisKlinisPrimer: "Dispepsia Fungsional",
        tindakLanjut: "selesai_rawat_jalan",
      },
    });

    assert.equal(
      resGagalDuaPengenal.statusCode,
      422,
      "Harus ditolak 422 saat verifikasi dua pengenal tidak cocok",
    );
    const bodyGagal = JSON.parse(resGagalDuaPengenal.body);
    assert.equal(bodyGagal.galat.kode, "ERR_PENAHANAN_KESELAMATAN");
    assert.match(bodyGagal.galat.pesan, /Verifikasi dua pengenal gagal/);

    // Kasus Sukses AB-020: Tanggal lahir cocok (1980-04-12)
    const resSukses = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/examinations",
      headers: { cookie: cookieDokter },
      payload: {
        kunjunganId: "knj-sintetis-001",
        pasienId: "psn-sintetis-001",
        verifikasiTanggalLahir: "1980-04-12",
        keluhanUtama: "Badan lemas terasa berat sejak 3 hari, riwayat DM tipe 2",
        tekananDarahSistol: 130,
        tekananDarahDiastol: 85,
        denyutNadi: 80,
        frekuensiNafas: 18,
        suhuTubuh: 36.6,
        beratBadanKg: 60.0,
        tinggiBadanCm: 156.0,
        diagnosisKlinisPrimer: "Diabetes Melitus Tipe 2 Tidak Terkontrol",
        diagnosisKlinisSekunder: "Gastritis Akut",
        catatanKlinisRelevanGizi: "Diet DM terkontrol, hindari makanan bergas dan asam.",
        tindakLanjut: "anjuran_rawat_inap",
      },
    });

    assert.equal(resSukses.statusCode, 201);
    const bodySukses = JSON.parse(resSukses.body);
    assert.equal(bodySukses.sukses, true);
    assert.equal(
      bodySukses.data.diagnosisKlinisPrimer,
      "Diabetes Melitus Tipe 2 Tidak Terkontrol",
    );
    assert.equal(bodySukses.data.dokterId, "usr-sintetis-dokter-melati");
  });

  test("3. mencatat alergi makanan/obat (AB-007) dan mengambil riwayat alergi aktif pasien", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieDokter = await loginDenganKredensial(
      app,
      "dokter.melati",
      KATA_SANDI_UJI_SINTETIS,
    );

    const resCatatAlergi = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/patients/psn-sintetis-001/allergies",
      headers: { cookie: cookieDokter },
      payload: {
        kategoriAlergen: "makanan",
        namaAlergen: "Kacang Kedelai & Olahan",
        tingkatKeparahan: "sedang",
        reaksiAlergi: "Ruam eritema dan mual muntah.",
      },
    });

    assert.equal(resCatatAlergi.statusCode, 201);
    const bodyAlergi = JSON.parse(resCatatAlergi.body);
    assert.equal(bodyAlergi.sukses, true);
    assert.equal(bodyAlergi.data.namaAlergen, "Kacang Kedelai & Olahan");

    // Ambil daftar alergi aktif
    const resDaftarAlergi = await app.inject({
      method: "GET",
      url: "/v1/clinical-nutrition/patients/psn-sintetis-001/allergies",
      headers: { cookie: cookieDokter },
    });
    assert.equal(resDaftarAlergi.statusCode, 200);
    const bodyDaftar = JSON.parse(resDaftarAlergi.body);
    assert.ok(
      bodyDaftar.data.items.some(
        (a: { namaAlergen: string }) => a.namaAlergen === "Kacang Kedelai & Olahan",
      ),
    );
  });

  test("4. menetapkan instruksi diet awal sah (AB-003, AB-005, AB-008, AB-009), memvalidasi NPO/puasa, dan menguji idempotensi", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieDokter = await loginDenganKredensial(
      app,
      "dokter.melati",
      KATA_SANDI_UJI_SINTETIS,
    );

    // Pasien baru tanpa diet awal: psn-sintetis-002 (Bambang Prakoso)
    // Kasus AB-008: Puasa NPO dicentang tapi alasan kosong -> ditolak
    const resGagalNpo = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/diet-orders",
      headers: { cookie: cookieDokter },
      payload: {
        kunjunganId: "knj-sintetis-002",
        pasienId: "psn-sintetis-002",
        jenisDiet: "lambung",
        bentukMakanan: "lunak",
        rutePemberian: "oral",
        statusPuasaNpo: true,
        alasanPuasa: "", // kosong
      },
    });
    assert.equal(resGagalNpo.statusCode, 400);

    // Kasus Sukses Pengesahan Diet Awal Sah dengan Idempotensi
    const idempotencyKey = "idemp-test-diet-001";
    const payloadDietSah = {
      kunjunganId: "knj-sintetis-002",
      pasienId: "psn-sintetis-002",
      jenisDiet: "rendah_garam",
      bentukMakanan: "lunak",
      rutePemberian: "oral",
      statusPuasaNpo: false,
      targetEnergiKkal: 1800,
      targetProteinGram: 65.0,
      pembatasanCairanMl: 1800,
      pembatasanNatriumMg: 1500,
      instruksiKhusus: "Diet RG II. Batasi natrium ketat, bebas MSG.",
    };

    const resDiet1 = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/diet-orders",
      headers: {
        cookie: cookieDokter,
        "x-idempotency-key": idempotencyKey,
      },
      payload: payloadDietSah,
    });

    assert.equal(resDiet1.statusCode, 201);
    const bodyDiet1 = JSON.parse(resDiet1.body);
    assert.equal(bodyDiet1.sukses, true);
    assert.equal(bodyDiet1.data.versi, 1);
    assert.equal(bodyDiet1.data.statusInstruksi, "aktif");
    assert.match(bodyDiet1.data.nomorInstruksi, /^DIET-\d{8}-\d{4}$/);

    // Uji Idempotensi: Kirim ulang dengan kunci yang sama
    const resDietUlang = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/diet-orders",
      headers: {
        cookie: cookieDokter,
        "x-idempotency-key": idempotencyKey,
      },
      payload: payloadDietSah,
    });

    assert.equal(resDietUlang.statusCode, 201);
    const bodyDietUlang = JSON.parse(resDietUlang.body);
    assert.equal(
      bodyDietUlang.data.nomorInstruksi,
      bodyDiet1.data.nomorInstruksi,
      "Idempotensi harus mengembalikan instruksi yang sama",
    );
  });

  test("5. menerapkan koreksi berversi (versi) pada instruksi diet dan menyimpan riwayat lengkap (AB-004, AB-010, AB-030)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieDokter = await loginDenganKredensial(
      app,
      "dokter.melati",
      KATA_SANDI_UJI_SINTETIS,
    );

    // diet-sintetis-001 saat ini versi 1
    // Kasus Konflik Konkurensi: Kirim versiSebelum salah (misal versi 9)
    const resKonflikVersi = await app.inject({
      method: "PATCH",
      url: "/v1/clinical-nutrition/diet-orders/diet-sintetis-001",
      headers: { cookie: cookieDokter },
      payload: {
        versiSebelum: 9,
        alasanPerubahan: "Pasien membaik, beralih ke makanan lunak",
        jenisDiet: "diabetes_melitus",
        bentukMakanan: "lunak",
        rutePemberian: "oral",
      },
    });
    assert.equal(
      resKonflikVersi.statusCode,
      409,
      "Harus tolak 409 saat versiSebelum tidak cocok (AB-030)",
    );

    // Kasus Sukses Pembaruan ke Versi 2
    const resKoreksi = await app.inject({
      method: "PATCH",
      url: "/v1/clinical-nutrition/diet-orders/diet-sintetis-001",
      headers: { cookie: cookieDokter },
      payload: {
        versiSebelum: 1,
        alasanPerubahan:
          "Evaluasi gula darah stabil (GDS 145), naik bertahap dari bubur saring ke makanan lunak (AB-010).",
        jenisDiet: "diabetes_melitus",
        bentukMakanan: "biasa",
        rutePemberian: "oral",
        targetEnergiKkal: 1900,
        targetProteinGram: 65,
      },
    });

    assert.equal(resKoreksi.statusCode, 200);
    const bodyKoreksi = JSON.parse(resKoreksi.body);
    assert.equal(bodyKoreksi.sukses, true);
    assert.equal(bodyKoreksi.data.versi, 2);
    assert.equal(bodyKoreksi.data.bentukMakanan, "biasa");

    // Ambil riwayat versi diet
    const resRiwayat = await app.inject({
      method: "GET",
      url: "/v1/clinical-nutrition/diet-orders/diet-sintetis-001/history",
      headers: { cookie: cookieDokter },
    });
    assert.equal(resRiwayat.statusCode, 200);
    const bodyRiwayat = JSON.parse(resRiwayat.body);
    assert.ok(bodyRiwayat.data.items.length >= 2);
    assert.equal(bodyRiwayat.data.items[0].versi, 2);
  });

  test("6. menerbitkan pengajuan rawat inap (BRD Bab IV.4.3) berstatus menunggu penempatan untuk Tahap 4", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieDokter = await loginDenganKredensial(
      app,
      "dokter.melati",
      KATA_SANDI_UJI_SINTETIS,
    );

    // Siapkan kunjungan sintetis untuk psn-sintetis-002 pada antrean dokter
    await patientRepo.simpanKunjunganBaru({
      id: "knj-sintetis-002",
      nomorKunjungan: "KNJ-20261108-0002",
      pasienId: "psn-sintetis-002",
      tanggalKunjungan: "2026-11-08",
      nomorAntreanHarian: 2,
      kodeAntrean: "POLI-PD-002",
      unitTujuan: "Poliklinik Penyakit Dalam",
      dokterTujuanId: "usr-sintetis-dokter-melati",
      dokterTujuanNama: "Dokter Penanggung Jawab Melati (Sintetis)",
      keluhanAdministratif: "Hipertensi kontrol",
      prioritasAntrean: "mendesak",
      statusKunjungan: "menunggu_pemeriksaan",
      pengenalDiverifikasi: "nomor_rekam_medis_dan_tanggal_lahir",
      alasanPembatalan: null,
      dibatalkanOlehId: null,
      dibatalkanPada: null,
      versi: 1,
      didaftarkanOlehId: "usr-sintetis-pendaftaran",
      didaftarkanOlehNama: "Petugas Pendaftaran Pasien (Sintetis)",
      waktuMasukAntrean: new Date().toISOString(),
      diperbaruiPada: new Date().toISOString(),
    });

    // Pasien psn-sintetis-002 belum ada pengajuan rawat inap
    const resPengajuan = await app.inject({
      method: "POST",
      url: "/v1/clinical-nutrition/admission-requests",
      headers: { cookie: cookieDokter },
      payload: {
        kunjunganId: "knj-sintetis-002",
        pasienId: "psn-sintetis-002",
        diagnosisUtama: "Hipertensi Stage 2 dengan Cephalea Akut",
        alasanRawatInap:
          "Memerlukan observasi ketat tekanan darah dan penyesuaian terapi antihipertensi parenteral.",
        prioritasRawatInap: "mendesak",
        rekomendasiBangsal: "BANGSAL-MELATI",
        kebutuhanKhusus: "Observasi tensi tiap 4 jam, Diet Rendah Garam II",
      },
    });

    assert.equal(resPengajuan.statusCode, 201);
    const bodyPengajuan = JSON.parse(resPengajuan.body);
    assert.equal(bodyPengajuan.sukses, true);
    assert.equal(bodyPengajuan.data.statusPengajuan, "menunggu_penempatan");
    assert.match(bodyPengajuan.data.nomorPengajuan, /^RI-\d{8}-\d{4}$/);
    assert.equal(bodyPengajuan.data.rekomendasiBangsal, "BANGSAL-MELATI");

    // Periksa daftar pengajuan rawat inap
    const resDaftarRi = await app.inject({
      method: "GET",
      url: "/v1/clinical-nutrition/admission-requests?statusPengajuan=menunggu_penempatan",
      headers: { cookie: cookieDokter },
    });
    assert.equal(resDaftarRi.statusCode, 200);
    const bodyDaftarRi = JSON.parse(resDaftarRi.body);
    assert.ok(bodyDaftarRi.data.items.length >= 2);
  });

  test("7. memvalidasi berkas migrasi SQL 001_tahap_3_clinical_nutrition.sql", () => {
    const berkasMigrasiPath = resolve(
      process.cwd(),
      "services/clinical-nutrition-service/src/database/migrations/001_tahap_3_clinical_nutrition.sql",
    );
    const konten = readFileSync(berkasMigrasiPath, "utf-8");

    assert.ok(konten.length > 500, "Berkas migrasi SQL Tahap 3 harus memiliki konten yang memadai");
    assert.match(konten, /CREATE TABLE IF NOT EXISTS skema_migrasi_clinical/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS pemeriksaan_klinis/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS alergi_pasien/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS instruksi_diet/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS riwayat_versi_instruksi_diet/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS pengajuan_rawat_inap/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS kunci_idempotensi_clinical/i);
    assert.match(konten, /CREATE TABLE IF NOT EXISTS outbox_peristiwa_clinical/i);
  });
});
