/**
 * @fileoverview Pengujian integrasi otomatis untuk Tahap 6 — Peran Ahli Gizi / Dietisien (Asuhan Gizi ADIME & Perencanaan Menu Individual).
 * Acuan: BRD Versi 4.0 Bab V.5.3, V.5.4, V.5.5, V.5.6, Bab XI, serta AB-007, AB-009, AB-010, AB-011, AB-014, AB-020, AB-026, AB-027, AB-028, AB-032.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import type {
  ItemAsuhanGiziAdimeDto,
  ItemEvaluasiAsuhanGiziDto,
  ItemKatalogMenuResepDto,
  ItemPasienDietisienDto,
  ItemRencanaMenuIndividualDto,
  ResponsGalatApi,
  ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { InMemoryIdentityRepository } from "../../../identity-service/src/repository/identity.repository.ts";
import { InMemoryInpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import { InMemoryPatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { InMemoryClinicalNutritionRepository } from "../repository/clinical-nutrition.repository.ts";

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

describe("Tahap 6 — Peran Ahli Gizi / Dietisien (Asuhan Gizi ADIME & Perencanaan Menu Individual)", () => {
  test("1. menolak akses ke endpoint /v1/dietitian/* dan /v1/meal-planning/* bagi peran non-ahli-gizi (403, AB-032)", async () => {
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
      url: "/v1/dietitian/patients",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(resAdmin.statusCode, 403);
    const jsonAdmin = resAdmin.json<ResponsGalatApi>();
    assert.equal(jsonAdmin.sukses, false);
    assert.equal(jsonAdmin.galat.kode, "ERR_AKSES_DITOLAK");

    const cookiePendaftaran = await loginDenganKredensial(
      app,
      "petugas.pendaftaran",
    );
    const resPendaftaran = await app.inject({
      method: "POST",
      url: "/v1/dietitian/nutrition-care",
      headers: { cookie: cookiePendaftaran },
      payload: {
        episodeId: "ep-sintetis-002",
        pasienId: "psn-sintetis-001",
        konfirmasiTanggalLahir: "1980-04-12",
        diagnosisGiziPes: "PES valid minimal 10 karakter untuk uji otorisasi",
        targetEnergiKkal: 1800,
        targetProteinGram: 60,
        targetLemakGram: 45,
        targetKarbohidratGram: 250,
        tujuanIntervensi: "Intervensi uji",
        rencanaIntervensi: "Rencana uji",
        rencanaMonitoringEvaluasi: "Monev uji",
        tanggalEvaluasiUlang: "2026-11-12",
      },
    });
    assert.equal(resPendaftaran.statusCode, 403);
  });

  test("2. mengambil daftar pasien konsultasi asuhan gizi bagi Ahli Gizi (Tahap 6)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    const res = await app.inject({
      method: "GET",
      url: "/v1/dietitian/patients",
      headers: { cookie: cookieDietisien },
    });

    assert.equal(res.statusCode, 200);
    const body =
      res.json<ResponsSuksesApi<{ items: ItemPasienDietisienDto[] }>>();
    assert.equal(body.sukses, true);
    assert.ok(Array.isArray(body.data.items));
    assert.ok(body.data.items.length >= 1);

    const pasienBudi = body.data.items.find(
      (p) => p.nomorRekamMedis === "RM-2026-0001",
    );
    assert.ok(pasienBudi, "Pasien Budi Santoso harus ada di daftar asuhan");
    assert.match(pasienBudi.namaPasien, /Budi Santoso/i);
    assert.ok(Array.isArray(pasienBudi.daftarAlergi));
  });

  test("3. menolak perekaman asuhan gizi ADIME jika konfirmasi tanggal lahir tidak cocok (AB-020 fail-closed 422)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    // Tanggal lahir RM-2026-0001 di DB adalah 1980-04-12, kita kirim 1995-05-15
    const res = await app.inject({
      method: "POST",
      url: "/v1/dietitian/nutrition-care",
      headers: { cookie: cookieDietisien },
      payload: {
        episodeId: "ep-sintetis-002",
        pasienId: "psn-sintetis-001",
        konfirmasiTanggalLahir: "1995-05-15",
        antropometriBbKg: 58,
        antropometriTbCm: 156,
        diagnosisGiziPes:
          "NI-5.4 Asupan karbohidrat tidak konsisten berkaitan dengan edukasi kurang dibuktikan dengan GDS 180",
        targetEnergiKkal: 1700,
        targetProteinGram: 65,
        targetLemakGram: 45,
        targetKarbohidratGram: 250,
        tujuanIntervensi: "Stabilisasi gula darah dan edukasi diet diabetes",
        rencanaIntervensi: "Diet DM 1700 kkal lunak",
        rencanaMonitoringEvaluasi: "Monitoring gula darah berkala",
        tanggalEvaluasiUlang: "2026-11-12",
      },
    });

    assert.equal(res.statusCode, 422);
    const json = res.json<ResponsGalatApi>();
    assert.equal(json.sukses, false);
    assert.equal(json.galat.kode, "ERR_PENAHANAN_KESELAMATAN");
    assert.match(json.galat.pesan, /tanggal lahir tidak cocok/i);
  });

  test("4. merekam asuhan gizi ADIME, menghitung IMT otomatis, dan menetapkan target nutrisi sah (BRD Bab V.5.3, AB-027)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    const res = await app.inject({
      method: "POST",
      url: "/v1/dietitian/nutrition-care",
      headers: { cookie: cookieDietisien },
      payload: {
        episodeId: "ep-sintetis-002",
        pasienId: "psn-sintetis-001",
        konfirmasiTanggalLahir: "1980-04-12",
        antropometriBbKg: 60,
        antropometriTbCm: 160,
        biokimia: "GDS 165 mg/dL",
        klinisFisik: "Compos mentis, TD 120/80",
        riwayatDiet: "Pola makan 3x sehari",
        diagnosisGiziPes:
          "NI-5.1 Peningkatan kebutuhan protein berkaitan dengan pemulihan jaringan dibuktikan dengan albumin 3.2",
        targetEnergiKkal: 1850,
        targetProteinGram: 75,
        targetLemakGram: 50,
        targetKarbohidratGram: 275,
        targetCairanMl: 2000,
        targetSeratGram: 28,
        targetNatriumMg: 1800,
        tujuanIntervensi: "Meningkatkan asupan protein dan memulihkan albumin",
        rencanaIntervensi: "Diet Tinggi Kalori Tinggi Protein (TKTP) lunak",
        rencanaMonitoringEvaluasi: "Cek asupan makan harian dan biokimia",
        tanggalEvaluasiUlang: "2026-11-14",
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json<ResponsSuksesApi<ItemAsuhanGiziAdimeDto>>();
    assert.equal(body.sukses, true);
    assert.ok(body.data.nomorAsuhan.startsWith("ADIME-"));
    // IMT: 60 / (1.6 * 1.6) = 23.44 -> Overweight (Kelebihan)
    assert.equal(body.data.antropometriImt, 23.44);
    assert.equal(body.data.klasifikasiImt, "Overweight (Kelebihan)");
    assert.equal(body.data.targetEnergiKkal, 1850);
    assert.equal(body.data.targetProteinGram, 75);
    assert.equal(body.data.statusAsuhan, "aktif");
  });

  test("5. mengambil katalog menu dan resep standar rumah sakit (AB-014)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    const res = await app.inject({
      method: "GET",
      url: "/v1/meal-planning/recipes",
      headers: { cookie: cookieDietisien },
    });

    assert.equal(res.statusCode, 200);
    const body =
      res.json<ResponsSuksesApi<{ items: ItemKatalogMenuResepDto[] }>>();
    assert.equal(body.sukses, true);
    assert.ok(body.data.items.length >= 5);

    const menuOmelet = body.data.items.find((m) => m.kodeMenu === "MN-LKH-03");
    assert.ok(menuOmelet, "Menu omelet harus ada");
    assert.ok(menuOmelet.alergen.includes("telur"));
    assert.ok(menuOmelet.komposisiBahan.length >= 1);
  });

  test("6. menahan dan menolak pengesahan rencana menu jika bertabrakan dengan alergen pasien (AB-007, AB-011)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    // Pasien Siti Rahmawati (psn-sintetis-001) memiliki alergi "Udang & Seafood" pada seed alergi.
    // Menu "menu-011" (Tumis Udang Buncis Rendah Garam) mengandung alergen "udang".
    const resBuat = await app.inject({
      method: "POST",
      url: "/v1/meal-planning/individual-menus",
      headers: { cookie: cookieDietisien },
      payload: {
        episodeId: "ep-sintetis-002",
        pasienId: "psn-sintetis-001",
        asuhanGiziId: "asuhan-sintetis-001",
        instruksiDietId: "diet-sintetis-001",
        tanggalPelayanan: "2026-11-09",
        jadwalMakan: "pagi",
        menuId: "menu-011", // Tumis Udang (alergen udang & seafood)
        porsi: 1.0,
      },
    });

    assert.equal(resBuat.statusCode, 201);
    const bodyBuat =
      resBuat.json<ResponsSuksesApi<ItemRencanaMenuIndividualDto>>();
    assert.equal(bodyBuat.sukses, true);
    assert.equal(bodyBuat.data.statusKesesuaian, "tidak_sesuai_alergi");
    assert.match(String(bodyBuat.data.alasanTidakSesuai), /alergen pasien/i);

    // Pengesahan harus ditolak dengan fail-closed 422
    const resApprove = await app.inject({
      method: "POST",
      url: `/v1/meal-planning/individual-menus/${bodyBuat.data.id}/approve`,
      headers: { cookie: cookieDietisien },
    });

    assert.equal(resApprove.statusCode, 422);
    const jsonApprove = resApprove.json<ResponsGalatApi>();
    assert.equal(jsonApprove.sukses, false);
    assert.equal(jsonApprove.galat.kode, "ERR_PENAHANAN_KESELAMATAN");
    assert.match(jsonApprove.galat.pesan, /alergen pasien/i);
  });

  test("7. membuat dan mengesahkan rencana menu individual yang aman dan sesuai (AB-011)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    // Menu-002: Nasi Tim Lunak Kaldu Ayam (tidak ada alergen udang)
    const resBuat = await app.inject({
      method: "POST",
      url: "/v1/meal-planning/individual-menus",
      headers: { cookie: cookieDietisien },
      payload: {
        episodeId: "ep-sintetis-002",
        pasienId: "psn-sintetis-001",
        asuhanGiziId: "asuhan-sintetis-001",
        instruksiDietId: "diet-sintetis-001",
        tanggalPelayanan: "2026-11-10",
        jadwalMakan: "pagi",
        menuId: "menu-002",
        porsi: 1.0,
      },
    });

    assert.equal(resBuat.statusCode, 201);
    const bodyBuat =
      resBuat.json<ResponsSuksesApi<ItemRencanaMenuIndividualDto>>();
    assert.equal(bodyBuat.data.statusKesesuaian, "sesuai");

    const resApprove = await app.inject({
      method: "POST",
      url: `/v1/meal-planning/individual-menus/${bodyBuat.data.id}/approve`,
      headers: { cookie: cookieDietisien },
    });

    assert.equal(resApprove.statusCode, 200);
    const bodyApprove =
      resApprove.json<ResponsSuksesApi<ItemRencanaMenuIndividualDto>>();
    assert.equal(bodyApprove.data.statusPengesahan, "disahkan");
    assert.ok(bodyApprove.data.disahkanPada);
  });

  test("8. merekam evaluasi asuhan gizi berkala dan mengirim notifikasi rekomendasi ke dokter (BRD Bab XI, AB-026, AB-028)", async () => {
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

    const cookieDietisien = await loginDenganKredensial(
      app,
      "dietisien.klinis",
    );

    const res = await app.inject({
      method: "POST",
      url: "/v1/dietitian/evaluations",
      headers: { cookie: cookieDietisien },
      payload: {
        asuhanGiziId: "asuhan-sintetis-001",
        episodeId: "ep-sintetis-002",
        pasienId: "psn-sintetis-001",
        tanggalEvaluasi: "2026-11-10",
        evaluasiAsupan:
          "Asupan makan pasien baru mencapai 50% porsi karena keluhan mual ringan.",
        persentasePemenuhanAsupan: 50,
        hambatanAsupan: "Mual di pagi hari",
        keputusanTindakLanjut: "rujuk_dpjp",
        rekomendasiKeDokter:
          "Mohon pertimbangan antiemetik oral sebelum makan pagi.",
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json<ResponsSuksesApi<ItemEvaluasiAsuhanGiziDto>>();
    assert.equal(body.sukses, true);
    assert.equal(body.data.keputusanTindakLanjut, "rujuk_dpjp");

    // Periksa bahwa dokter penanggung jawab menerima notifikasi rekomendasi
    const notifDokter = await identityRepo.ambilDaftarNotifikasi({
      penerimaId: "usr-sintetis-dokter-melati",
      halaman: 1,
      ukuranHalaman: 10,
    });
    const notifRekomendasi = notifDokter.items.find((n) =>
      n.judul.includes("Rekomendasi Modifikasi Terapi Gizi"),
    );
    assert.ok(
      notifRekomendasi,
      "Dokter DPJP harus menerima notifikasi rekomendasi dari dietisien",
    );
  });

  test("9. memvalidasi berkas migrasi SQL 003_tahap_6_dietitian.sql pada clinical-nutrition-service", () => {
    const jalurMigrasi = resolve(
      process.cwd(),
      "services/clinical-nutrition-service/src/database/migrations/003_tahap_6_dietitian.sql",
    );
    const konten = readFileSync(jalurMigrasi, "utf-8");

    assert.ok(konten.length > 0, "Berkas migrasi SQL tidak boleh kosong.");
    assert.ok(
      konten.includes("CREATE TABLE IF NOT EXISTS asuhan_gizi_adime"),
      "Tabel asuhan_gizi_adime wajib didefinisikan.",
    );
    assert.ok(
      konten.includes("CREATE TABLE IF NOT EXISTS katalog_menu_resep"),
      "Tabel katalog_menu_resep wajib didefinisikan.",
    );
    assert.ok(
      konten.includes("CREATE TABLE IF NOT EXISTS rencana_menu_individual"),
      "Tabel rencana_menu_individual wajib didefinisikan.",
    );
    assert.ok(
      konten.includes("CREATE TABLE IF NOT EXISTS evaluasi_asuhan_gizi"),
      "Tabel evaluasi_asuhan_gizi wajib didefinisikan.",
    );
    assert.ok(
      !konten.toUpperCase().includes("DROP TABLE"),
      "Migrasi forward-only tidak boleh memuat DROP TABLE.",
    );
  });
});
