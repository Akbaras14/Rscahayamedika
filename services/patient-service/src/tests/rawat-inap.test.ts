/**
 * @fileoverview Pengujian integrasi otomatis untuk Tahap 4 — Peran Petugas Rawat Inap.
 * Acuan: BRD Versi 4.0 Bab IV.4.3 & IV.4.5, Bab XVIII (AB-002, AB-020, AB-030, AB-031, AB-032, AB-034).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import type {
  ItemEpisodeRawatInapDto,
  ItemPengajuanRawatInapDto,
  ItemTempatTidurDto,
  ResponsGalatApi,
  ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { InMemoryClinicalNutritionRepository } from "../../../clinical-nutrition-service/src/repository/clinical-nutrition.repository.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { InMemoryIdentityRepository } from "../../../identity-service/src/repository/identity.repository.ts";
import { InMemoryInpatientRepository } from "../repository/inpatient.repository.ts";
import { InMemoryPatientRepository } from "../repository/patient.repository.ts";

async function loginDenganKredensial(
  app: Awaited<ReturnType<typeof bangunAplikasiGateway>>["app"],
  namaPengguna: string,
  kataSandi: string = KATA_SANDI_UJI_SINTETIS,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { namaPengguna, kataSandi },
  });
  assert.equal(res.statusCode, 200, `Login gagal untuk ${namaPengguna}`);
  const setCookie = res.headers["set-cookie"];
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(cookieStr, "Cookie sesi harus tersedia pada respons login");
  return String(cookieStr).split(";")[0];
}

describe("Tahap 4 — Peran Petugas Rawat Inap (Penerimaan, Alokasi Bed, Perpindahan, & Pemulangan)", () => {
  test("1. menolak akses ke endpoint /v1/inpatient/* bagi Administrator (AB-032) dan Dokter tanpa izin penempatan (403)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieAdmin = await loginDenganKredensial(app, "admin.fondasi");
    const resAdmin = await app.inject({
      method: "GET",
      url: "/v1/inpatient/overview",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(resAdmin.statusCode, 403);
    const jsonAdmin = resAdmin.json<ResponsGalatApi>();
    assert.equal(jsonAdmin.sukses, false);
    assert.equal(jsonAdmin.galat.kode, "ERR_AKSES_DITOLAK");

    const cookieDokter = await loginDenganKredensial(app, "dokter.melati");
    const resDokter = await app.inject({
      method: "POST",
      url: "/v1/inpatient/admissions",
      headers: { cookie: cookieDokter },
      payload: {
        pengajuanId: "ri-sintetis-001",
        tempatTidurId: "bed-melati-101-2",
        konfirmasiTanggalLahir: "1980-04-12",
      },
    });
    assert.equal(resDokter.statusCode, 403);

    await app.close();
  });

  test("2. menerima pengajuan rawat inap dokter dan mengalokasikan tempat tidur tersedia (AB-002, AB-020)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieRawatInap = await loginDenganKredensial(app, "petugas.rawatinap");

    // Cek ketersediaan awal
    const resOverview = await app.inject({
      method: "GET",
      url: "/v1/inpatient/overview",
      headers: { cookie: cookieRawatInap },
    });
    assert.equal(resOverview.statusCode, 200);
    const jsonOverview = resOverview.json<
      ResponsSuksesApi<{
        daftarTempatTidur: readonly ItemTempatTidurDto[];
      }>
    >();
    const bed101B = jsonOverview.data.daftarTempatTidur.find(
      (b: ItemTempatTidurDto) => b.id === "bed-melati-101-2",
    );
    assert.ok(bed101B);
    assert.equal(bed101B.statusTempatTidur, "tersedia");

    // Alokasikan bed untuk pengajuan Siti Rahmawati (ri-sintetis-001, tglLahir: 1980-04-12)
    const resAdmit = await app.inject({
      method: "POST",
      url: "/v1/inpatient/admissions",
      headers: {
        cookie: cookieRawatInap,
        "x-idempotency-key": "idemp-admit-001",
      },
      payload: {
        pengajuanId: "ri-sintetis-001",
        tempatTidurId: "bed-melati-101-2",
        konfirmasiTanggalLahir: "1980-04-12",
        catatanPenempatan: "Ditempatkan di Bangsal Melati Kamar 101 Bed B",
      },
    });
    assert.equal(resAdmit.statusCode, 200);
    const jsonAdmit = resAdmit.json<
      ResponsSuksesApi<{
        episode: ItemEpisodeRawatInapDto;
        penempatanId: string;
      }>
    >();
    assert.equal(jsonAdmit.sukses, true);
    assert.match(jsonAdmit.data.episode.nomorEpisode, /^EP-2026/);
    assert.equal(jsonAdmit.data.episode.statusPerawatan, "aktif");
    assert.equal(jsonAdmit.data.episode.tempatTidurId, "bed-melati-101-2");

    // Verifikasi bed sekarang berstatus 'terisi'
    const resOverviewAfter = await app.inject({
      method: "GET",
      url: "/v1/inpatient/overview",
      headers: { cookie: cookieRawatInap },
    });
    const bed101BAfter = resOverviewAfter
      .json<ResponsSuksesApi<{ daftarTempatTidur: readonly ItemTempatTidurDto[] }>>()
      .data.daftarTempatTidur.find((b: ItemTempatTidurDto) => b.id === "bed-melati-101-2");
    assert.equal(bed101BAfter?.statusTempatTidur, "terisi");

    await app.close();
  });

  test("3. menahan keselamatan jika verifikasi dua pengenal (tanggal lahir) tidak cocok (AB-020 -> 422)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieRawatInap = await loginDenganKredensial(app, "petugas.rawatinap");

    // Coba tempatkan pengajuan ri-sintetis-002 (Ahmad Dahlan, tglLahir: 1985-08-20) dengan tgl lahir salah
    const resSalahTgl = await app.inject({
      method: "POST",
      url: "/v1/inpatient/admissions",
      headers: { cookie: cookieRawatInap },
      payload: {
        pengajuanId: "ri-sintetis-002",
        tempatTidurId: "bed-melati-102-1",
        konfirmasiTanggalLahir: "1999-01-01", // Tanggal lahir salah
      },
    });
    assert.equal(resSalahTgl.statusCode, 422);
    const jsonSalah = resSalahTgl.json<ResponsGalatApi>();
    assert.equal(jsonSalah.sukses, false);
    assert.equal(jsonSalah.galat.kode, "ERR_PENAHANAN_KESELAMATAN");
    assert.match(jsonSalah.galat.pesan, /AB-020/i);

    await app.close();
  });

  test("4. mencegah alokasi tempat tidur yang sudah terisi (konflik AB-002 / 409)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieRawatInap = await loginDenganKredensial(app, "petugas.rawatinap");

    // Coba tempatkan ke bed-melati-101-1 yang sudah terisi sejak awal oleh psn-sintetis-002
    const resKonflikBed = await app.inject({
      method: "POST",
      url: "/v1/inpatient/admissions",
      headers: { cookie: cookieRawatInap },
      payload: {
        pengajuanId: "ri-sintetis-001",
        tempatTidurId: "bed-melati-101-1",
        konfirmasiTanggalLahir: "1980-04-12",
      },
    });
    assert.equal(resKonflikBed.statusCode, 409);
    const jsonKonflik = resKonflikBed.json<ResponsGalatApi>();
    assert.equal(jsonKonflik.sukses, false);
    assert.equal(jsonKonflik.galat.kode, "ERR_KONFLIK_BISNIS");
    assert.match(jsonKonflik.galat.pesan, /AB-002/i);

    await app.close();
  });

  test("5. memindahkan pasien antar tempat tidur/bangsal dengan alasan wajib dan mencatat riwayat (AB-030, AB-034)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieRawatInap = await loginDenganKredensial(app, "petugas.rawatinap");

    // Ambil episode aktif awal (ep-sintetis-001 di bed-melati-101-1)
    const resEpisodes = await app.inject({
      method: "GET",
      url: "/v1/inpatient/episodes?status=aktif",
      headers: { cookie: cookieRawatInap },
    });
    assert.equal(resEpisodes.statusCode, 200);
    const epAktif = resEpisodes.json<
      ResponsSuksesApi<{ items: readonly ItemEpisodeRawatInapDto[] }>
    >().data.items[0];
    assert.ok(epAktif);
    assert.equal(epAktif.id, "ep-sintetis-001");

    // Pindahkan ke bed-melati-102-1 (tersedia)
    const resPindah = await app.inject({
      method: "POST",
      url: `/v1/inpatient/episodes/${epAktif.id}/transfer`,
      headers: { cookie: cookieRawatInap },
      payload: {
        tempatTidurTujuanId: "bed-melati-102-1",
        alasanPemindahan:
          "Pasien dipindahkan ke Kamar 102 karena memerlukan pemantauan dekat jendela",
        versi: epAktif.versi,
      },
    });
    assert.equal(resPindah.statusCode, 200);
    const jsonPindah = resPindah.json<
      ResponsSuksesApi<{
        episode: ItemEpisodeRawatInapDto;
        riwayatId: string;
      }>
    >();
    assert.equal(jsonPindah.data.episode.tempatTidurId, "bed-melati-102-1");
    assert.equal(jsonPindah.data.episode.versi, epAktif.versi + 1);

    // Verifikasi riwayat perpindahan tercatat
    const resRiwayat = await app.inject({
      method: "GET",
      url: `/v1/inpatient/transfers?episodeId=${epAktif.id}`,
      headers: { cookie: cookieRawatInap },
    });
    assert.equal(resRiwayat.statusCode, 200);
    const jsonRiwayat = resRiwayat.json<ResponsSuksesApi<{ items: unknown[] }>>();
    assert.ok(jsonRiwayat.data.items.length >= 1);

    await app.close();
  });

  test("6. memulangkan pasien secara administratif (AB-031, BRD Bab 11.1) dan membebaskan tempat tidur", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieRawatInap = await loginDenganKredensial(app, "petugas.rawatinap");

    // Ambil episode aktif
    const resEpisodes = await app.inject({
      method: "GET",
      url: "/v1/inpatient/episodes?status=aktif",
      headers: { cookie: cookieRawatInap },
    });
    const epAktif = resEpisodes.json<
      ResponsSuksesApi<{ items: readonly ItemEpisodeRawatInapDto[] }>
    >().data.items[0];
    assert.ok(epAktif);

    const bedDitempati = epAktif.tempatTidurId;

    // Pulangkan pasien
    const resPulang = await app.inject({
      method: "POST",
      url: `/v1/inpatient/episodes/${epAktif.id}/discharge`,
      headers: { cookie: cookieRawatInap },
      payload: {
        alasanPemulangan: "sembuh",
        catatanPemulangan:
          "Pasien diperbolehkan pulang oleh DPJP dengan kondisi stabil, diet lanjutan di rumah.",
        versi: epAktif.versi,
      },
    });
    assert.equal(resPulang.statusCode, 200);
    const jsonPulang = resPulang.json<ResponsSuksesApi<ItemEpisodeRawatInapDto>>();
    assert.equal(jsonPulang.data.statusPerawatan, "selesai");
    assert.equal(jsonPulang.data.alasanPemulangan, "sembuh");
    assert.ok(jsonPulang.data.waktuKeluar);

    // Verifikasi bed yang ditinggalkan kembali berstatus 'tersedia'
    const resOverview = await app.inject({
      method: "GET",
      url: "/v1/inpatient/overview",
      headers: { cookie: cookieRawatInap },
    });
    const bedBebas = resOverview
      .json<ResponsSuksesApi<{ daftarTempatTidur: readonly ItemTempatTidurDto[] }>>()
      .data.daftarTempatTidur.find((b: ItemTempatTidurDto) => b.id === bedDitempati);
    assert.equal(bedBebas?.statusTempatTidur, "tersedia");

    await app.close();
  });

  test("7. menunda dan menolak pengajuan rawat inap dengan alasan wajib", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiGateway({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieRawatInap = await loginDenganKredensial(app, "petugas.rawatinap");

    // Coba tolak tanpa alasan -> 400
    const resTolakTanpaAlasan = await app.inject({
      method: "POST",
      url: "/v1/inpatient/admission-requests/ri-sintetis-002/decide",
      headers: { cookie: cookieRawatInap },
      payload: {
        keputusan: "ditolak",
        alasan: "pend", // < 5 karakter
      },
    });
    assert.equal(resTolakTanpaAlasan.statusCode, 400);

    // Tolak dengan alasan sah
    const resTolakSah = await app.inject({
      method: "POST",
      url: "/v1/inpatient/admission-requests/ri-sintetis-002/decide",
      headers: { cookie: cookieRawatInap },
      payload: {
        keputusan: "ditolak",
        alasan:
          "Kapasitas bangsal isolasi penuh dan pasien dialihkan ke faskes rujukan",
      },
    });
    assert.equal(resTolakSah.statusCode, 200);
    const jsonTolak = resTolakSah.json<ResponsSuksesApi<ItemPengajuanRawatInapDto>>();
    assert.equal(jsonTolak.data.statusPengajuan, "ditolak");
    assert.equal(
      jsonTolak.data.alasanPenolakan,
      "Kapasitas bangsal isolasi penuh dan pasien dialihkan ke faskes rujukan",
    );

    await app.close();
  });

  test("8. memvalidasi berkas migrasi SQL 002_tahap_4_rawat_inap.sql pada patient-service", () => {
    const pathMigrasi = resolve(
      process.cwd(),
      "services/patient-service/src/database/migrations/002_tahap_4_rawat_inap.sql",
    );
    const isiSql = readFileSync(pathMigrasi, "utf-8");
    assert.match(isiSql, /CREATE TABLE IF NOT EXISTS bangsal/i);
    assert.match(isiSql, /CREATE TABLE IF NOT EXISTS kamar/i);
    assert.match(isiSql, /CREATE TABLE IF NOT EXISTS tempat_tidur/i);
    assert.match(isiSql, /CREATE TABLE IF NOT EXISTS episode_rawat_inap/i);
    assert.match(isiSql, /CREATE TABLE IF NOT EXISTS penempatan_tempat_tidur/i);
    assert.match(
      isiSql,
      /CREATE TABLE IF NOT EXISTS riwayat_perpindahan_tempat_tidur/i,
    );
    assert.doesNotMatch(isiSql, /^\s*DROP\s+TABLE/im);
    assert.doesNotMatch(isiSql, /^\s*TRUNCATE\s+/im);
  });
});
