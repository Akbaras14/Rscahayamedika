/**
 * @fileoverview Pengujian integrasi otomatis untuk Tahap 5 — Peran Perawat (Asuhan Keperawatan & Verifikasi Keamanan Makanan).
 * Acuan: BRD Versi 4.0 Bab V.5.1, V.5.2, Bab X.10.1 & X.10.2, Bab XVIII (AB-003, AB-007, AB-008, AB-020, AB-032).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import type {
  ItemObservasiAsupanDto,
  ItemPasienBangsalPerawatDto,
  ItemSkriningGiziDto,
  ItemVerifikasiKeamananMakananDto,
  ResponsGalatApi,
  ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { bangunAplikasiClinicalNutrition } from "../app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { InMemoryIdentityRepository } from "../../../identity-service/src/repository/identity.repository.ts";
import { InMemoryInpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import { InMemoryPatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { InMemoryClinicalNutritionRepository } from "../repository/clinical-nutrition.repository.ts";

async function loginDenganKredensial(
  app: Awaited<ReturnType<typeof bangunAplikasiClinicalNutrition>>["app"],
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

describe("Tahap 5 — Peran Perawat (Asuhan Keperawatan, Verifikasi Keamanan Makanan & Observasi Asupan)", () => {
  test("1. menolak akses ke endpoint /v1/nursing/* bagi Administrator dan Petugas Pendaftaran (403, AB-032)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookieAdmin = await loginDenganKredensial(app, "admin.fondasi");
    const resAdmin = await app.inject({
      method: "GET",
      url: "/v1/nursing/patients",
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
      method: "GET",
      url: "/v1/nursing/patients",
      headers: { cookie: cookiePendaftaran },
    });
    assert.equal(resPendaftaran.statusCode, 403);

    await app.close();
  });

  test("2. menolak akses lintas bangsal (Cross-Ward Isolation) dengan HTTP 403 Forbidden (AB-032)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    // perawat.anggrek ditugaskan di BANGSAL-ANGGREK, mencoba akses BANGSAL-MELATI
    const cookiePerawatAnggrek = await loginDenganKredensial(
      app,
      "perawat.anggrek",
    );
    const resLuarBangsal = await app.inject({
      method: "GET",
      url: "/v1/nursing/patients?bangsalId=BANGSAL-MELATI",
      headers: { cookie: cookiePerawatAnggrek },
    });

    assert.equal(resLuarBangsal.statusCode, 403);
    const jsonLuarBangsal = resLuarBangsal.json<ResponsGalatApi>();
    assert.equal(jsonLuarBangsal.sukses, false);
    assert.equal(jsonLuarBangsal.galat.kode, "ERR_AKSES_DITOLAK");
    assert.match(jsonLuarBangsal.galat.pesan, /tidak memiliki wewenang/);

    await app.close();
  });

  test("3. menampilkan daftar pasien aktif di bangsal binaan perawat beserta status klinis & gizi terkini", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookiePerawat = await loginDenganKredensial(app, "perawat.anggrek");
    const res = await app.inject({
      method: "GET",
      url: "/v1/nursing/patients?bangsalId=BANGSAL-ANGGREK",
      headers: { cookie: cookiePerawat },
    });

    assert.equal(res.statusCode, 200);
    const json =
      res.json<ResponsSuksesApi<{ items: ItemPasienBangsalPerawatDto[] }>>();
    assert.equal(json.sukses, true);
    assert.ok(json.data.items.length >= 1);

    const budi = json.data.items.find(
      (p) => p.nomorRekamMedis === "RM-2026-0001",
    );
    assert.ok(budi, "Pasien Budi Santoso harus terdaftar di Bangsal Anggrek");
    assert.equal(budi.bangsalId, "BANGSAL-ANGGREK");
    assert.match(budi.namaPasien, /Budi Santoso/);
    assert.match(budi.nomorTempatTidur, /201/);
    assert.equal(budi.tanggalLahir, "1980-04-12");
    assert.ok(budi.usiaTahun > 0);

    await app.close();
  });

  test("4. verifikasi keamanan makanan: menolak dengan 422 bila konfirmasi tanggal lahir tidak cocok (AB-020 fail-closed)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookiePerawat = await loginDenganKredensial(app, "perawat.anggrek");

    // Masukkan tanggal lahir salah (1995-12-31, harusnya 1980-04-12)
    const resSalahDob = await app.inject({
      method: "POST",
      url: "/v1/nursing/food-safety-verifications",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        konfirmasiTanggalLahir: "1995-12-31",
        apakahIdentitasSesuai: true,
        apakahDietSesuai: true,
        apakahAlergiTerkonfirmasi: true,
        kemampuanMenelan: "normal",
        statusKesadaran: "kompos_mentis",
        statusPuasaNpo: "tidak_puasa",
        keputusan: "aman_lolos",
      },
    });

    assert.equal(resSalahDob.statusCode, 422);
    const jsonSalahDob = resSalahDob.json<ResponsGalatApi>();
    assert.equal(jsonSalahDob.sukses, false);
    assert.equal(jsonSalahDob.galat.kode, "ERR_VALIDASI_GAGAL");
    assert.match(
      jsonSalahDob.galat.pesan,
      /Verifikasi dua pengenal gagal/i,
    );

    await app.close();
  });

  test("5. verifikasi keamanan makanan: berhasil merekam aman_lolos dan ditahan_safety_hold dengan notifikasi kritis ke DPJP", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookiePerawat = await loginDenganKredensial(app, "perawat.anggrek");

    // 5a. Verifikasi Lolos Aman (Pass)
    const resPass = await app.inject({
      method: "POST",
      url: "/v1/nursing/food-safety-verifications",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        konfirmasiTanggalLahir: "1980-04-12",
        apakahIdentitasSesuai: true,
        apakahDietSesuai: true,
        apakahAlergiTerkonfirmasi: true,
        kemampuanMenelan: "normal",
        statusKesadaran: "kompos_mentis",
        statusPuasaNpo: "tidak_puasa",
        keputusan: "aman_lolos",
      },
    });

    assert.equal(resPass.statusCode, 201);
    const jsonPass =
      resPass.json<ResponsSuksesApi<ItemVerifikasiKeamananMakananDto>>();
    assert.equal(jsonPass.sukses, true);
    assert.equal(jsonPass.data.keputusan, "aman_lolos");
    assert.match(jsonPass.data.nomorVerifikasi, /^VKM-/);

    // 5b. Verifikasi Ditahan (Safety Hold) jika pasien mengeluh tersedak/disfagia berat
    const resHold = await app.inject({
      method: "POST",
      url: "/v1/nursing/food-safety-verifications",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        konfirmasiTanggalLahir: "1980-04-12",
        apakahIdentitasSesuai: true,
        apakahDietSesuai: true,
        apakahAlergiTerkonfirmasi: true,
        kemampuanMenelan: "disfagia_berat_tersedak",
        statusKesadaran: "somnolen",
        statusPuasaNpo: "puasa_npo_klinis",
        keputusan: "ditahan_safety_hold",
        alasanPenahanan:
          "Pasien tampak somnolen dan batuk tersedak saat menelan air; status puasa pre-operasi.",
        tindakanEskalasi:
          "Segera lapor DPJP dan eskalasi ke Ahli Gizi untuk evaluasi rute enteral/parenteral.",
      },
    });

    assert.equal(resHold.statusCode, 201);
    const jsonHold =
      resHold.json<ResponsSuksesApi<ItemVerifikasiKeamananMakananDto>>();
    assert.equal(jsonHold.sukses, true);
    assert.equal(jsonHold.data.keputusan, "ditahan_safety_hold");
    assert.ok(jsonHold.data.alasanPenahanan);

    // Pastikan notifikasi kritis dikirim ke dokter DPJP
    const notifikasiHasil = await identityRepo.ambilDaftarNotifikasi({
      penerimaId: "usr-sintetis-dokter-melati",
      halaman: 1,
      ukuranHalaman: 10,
    });
    const notifHold = notifikasiHasil.items.find((n) =>
      n.judul.includes("PENAHANAN KESELAMATAN MAKANAN"),
    );
    assert.ok(
      notifHold,
      "Notifikasi penahanan makanan harus diterima oleh Dokter DPJP",
    );
    assert.equal(notifHold.prioritas, "kritis");

    await app.close();
  });

  test("6. skrining gizi MST: menghitung skor secara akurat dan memicu rujukan gizi otomatis saat skor >= 2 (BRD Bab V.5.2)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookiePerawat = await loginDenganKredensial(app, "perawat.anggrek");

    // 6a. Kasus Risiko Rendah (Skor 0)
    const resRendah = await app.inject({
      method: "POST",
      url: "/v1/nursing/nutrition-screenings",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        penurunanBeratBadan: "tidak_ada",
        asupanMakanBerkurang: false,
        catatanSkrining: "Kondisi gizi stabil, nafsu makan baik.",
      },
    });

    assert.equal(resRendah.statusCode, 201);
    const jsonRendah = resRendah.json<ResponsSuksesApi<ItemSkriningGiziDto>>();
    assert.equal(jsonRendah.sukses, true);
    assert.equal(jsonRendah.data.totalSkor, 0);
    assert.equal(jsonRendah.data.kategoriRisiko, "risiko_rendah");
    assert.equal(jsonRendah.data.perluPenilaianLanjut, false);

    // 6b. Kasus Risiko Tinggi (Skor >= 2: BB turun 6-10kg [2] + asupan berkurang [1] = 3)
    const resTinggi = await app.inject({
      method: "POST",
      url: "/v1/nursing/nutrition-screenings",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        penurunanBeratBadan: "6_sampai_10_kg",
        asupanMakanBerkurang: true,
        catatanSkrining:
          "Pasien kehilangan 7 kg dalam 2 bulan terakhir, makan hanya 2-3 sendok.",
      },
    });

    assert.equal(resTinggi.statusCode, 201);
    const jsonTinggi = resTinggi.json<ResponsSuksesApi<ItemSkriningGiziDto>>();
    assert.equal(jsonTinggi.sukses, true);
    assert.equal(jsonTinggi.data.totalSkor, 3);
    assert.equal(jsonTinggi.data.kategoriRisiko, "risiko_tinggi");
    assert.equal(jsonTinggi.data.perluPenilaianLanjut, true);

    // Verifikasi notifikasi rujukan gizi otomatis
    const notifikasiHasil = await identityRepo.ambilDaftarNotifikasi({
      penerimaId: "usr-sintetis-dokter-melati",
      halaman: 1,
      ukuranHalaman: 10,
    });
    const notifMst = notifikasiHasil.items.find((n) =>
      n.judul.includes("RUJUKAN GIZI (MST >= 2)"),
    );
    assert.ok(
      notifMst,
      "Notifikasi rujukan gizi MST >= 2 harus dikirim ke Dokter DPJP",
    );

    await app.close();
  });

  test("7. observasi asupan Comstock: mencatat persentase piring dan memicu peringatan jika asupan <= 25% (BRD Bab X.10.1, 10.2)", async () => {
    const identityRepo = new InMemoryIdentityRepository();
    const patientRepo = new InMemoryPatientRepository();
    const inpatientRepo = new InMemoryInpatientRepository();
    const clinicalRepo = new InMemoryClinicalNutritionRepository();

    const { app } = await bangunAplikasiClinicalNutrition({
      repository: identityRepo,
      patientRepository: patientRepo,
      inpatientRepository: inpatientRepo,
      clinicalRepository: clinicalRepo,
    });

    const cookiePerawat = await loginDenganKredensial(app, "perawat.anggrek");

    // 7a. Observasi asupan penuh 100%
    const res100 = await app.inject({
      method: "POST",
      url: "/v1/nursing/intake-observations",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        tanggalMakan: "2026-11-08",
        jadwalMakan: "pagi",
        skalaComstock: "skala_100",
        kondisiPemberian: "dikonsumsi_seluruhnya",
        catatanObservasi: "Porsi bubur saring dan lauk tandas.",
      },
    });

    assert.equal(res100.statusCode, 201);
    const json100 =
      res100.json<ResponsSuksesApi<ItemObservasiAsupanDto>>();
    assert.equal(json100.sukses, true);
    assert.equal(json100.data.persentaseKonsumsi, 100);
    assert.equal(json100.data.peringatanAsupanRendah, false);

    // 7b. Observasi asupan rendah (skala 25% dengan alasan mual muntah)
    const res25 = await app.inject({
      method: "POST",
      url: "/v1/nursing/intake-observations",
      headers: { cookie: cookiePerawat },
      payload: {
        episodeId: "ep-sintetis-002",
        tanggalMakan: "2026-11-08",
        jadwalMakan: "siang",
        skalaComstock: "skala_25",
        kondisiPemberian: "dikonsumsi_sebagian",
        alasanTidakHabis: "mual_muntah",
        catatanObservasi: "Pasien mengeluh mual setelah 2 suap.",
      },
    });

    assert.equal(res25.statusCode, 201);
    const json25 = res25.json<ResponsSuksesApi<ItemObservasiAsupanDto>>();
    assert.equal(json25.sukses, true);
    assert.equal(json25.data.persentaseKonsumsi, 25);
    assert.equal(json25.data.peringatanAsupanRendah, true);

    // 7c. Ambil riwayat observasi asupan
    const resRiwayat = await app.inject({
      method: "GET",
      url: "/v1/nursing/intake-observations?episodeId=ep-sintetis-002",
      headers: { cookie: cookiePerawat },
    });

    assert.equal(resRiwayat.statusCode, 200);
    const jsonRiwayat =
      resRiwayat.json<ResponsSuksesApi<{ items: ItemObservasiAsupanDto[] }>>();
    assert.equal(jsonRiwayat.sukses, true);
    assert.ok(jsonRiwayat.data.items.length >= 2);

    await app.close();
  });

  test("8. integritas skrip migrasi SQL 002_tahap_5_nursing.sql (forward-only, idempotent)", () => {
    const jalurMigrasi = resolve(
      process.cwd(),
      "services/clinical-nutrition-service/src/database/migrations/002_tahap_5_nursing.sql",
    );
    const konten = readFileSync(jalurMigrasi, "utf-8");

    assert.ok(
      konten.includes("CREATE TABLE IF NOT EXISTS skrining_gizi"),
      "Tabel skrining_gizi harus didefinisikan secara idempotent",
    );
    assert.ok(
      konten.includes("CREATE TABLE IF NOT EXISTS verifikasi_keamanan_makanan"),
      "Tabel verifikasi_keamanan_makanan harus didefinisikan secara idempotent",
    );
    assert.ok(
      konten.includes(
        "CREATE TABLE IF NOT EXISTS observasi_asupan_keperawatan",
      ),
      "Tabel observasi_asupan_keperawatan harus didefinisikan secara idempotent",
    );
    assert.ok(
      konten.includes("metode_skrining"),
      "Skrining gizi harus memuat metode skrining (MST)",
    );
    assert.ok(
      konten.includes("skala_comstock"),
      "Observasi asupan harus memuat skala comstock visual",
    );
    assert.ok(
      konten.includes("konfirmasi_tanggal_lahir"),
      "Verifikasi makanan harus memuat verifikasi dua pengenal (AB-020)",
    );
  });
});
