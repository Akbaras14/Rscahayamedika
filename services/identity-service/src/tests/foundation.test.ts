/**
 * @fileoverview Pengujian otomatis Tahap 0 (Konfigurasi & Fondasi) untuk HPNMS.
 * Menguji:
 * 1. Autentikasi positif & negatif (cookie HttpOnly, kata sandi salah, akun nonaktif, validasi input).
 * 2. Otorisasi berbasis peran & pemisahan Administrator dari akses klinis (AB-032).
 * 3. Penolakan akses lintas bangsal tanpa kewenangan (AGENTS.md Bagian 4 & 8).
 * 4. Kontrak lonceng notifikasi per pengguna (`belum_dibaca` vs `sudah_dibaca`, tidak otomatis baca saat dibuka).
 * 5. Idempotensi mutasi (`X-Idempotency-Key`) dan deteksi konflik payload.
 * 6. Penyamaran galat teknis backend/SQL agar tidak bocor ke klien (UI_UX.md Bagian 9).
 * 7. Gerbang penahanan rute Tahap 1–10 pada API Gateway (fail-closed).
 * 8. Validasi DDL migrasi MySQL, audit redaksi data sensitif, dan uji backup/restore sintetis.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  KODE_GALAT,
  type DaftarNotifikasiRespons,
  type ItemNotifikasiKontrak,
  type ResponsGalatApi,
  type ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { jalankanUjiCadanganDanPemulihanSintetis } from "../../../../scripts/backup-restore-check.ts";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { pisahkanPernyataanSql } from "../database/pool.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../database/seeds/master.seed.ts";
import { sanitasiMetadataAudit } from "../services/identity.service.ts";

function ambilCookieSesiDariHeader(
  setCookieHeader: string | string[] | undefined,
): string {
  const daftar = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const cocok = daftar.find((item) => item.startsWith("hpnms_session="));
  assert.ok(cocok, "Header Set-Cookie harus memuat hpnms_session");
  assert.ok(
    cocok.toLowerCase().includes("httponly"),
    "Cookie sesi wajib memiliki atribut HttpOnly",
  );
  return cocok.split(";")[0] ?? "";
}

describe("Tahap 0 — Fondasi Keamanan, Autentikasi, Otorisasi, Notifikasi, dan API Gateway", () => {
  it("1. menolak login dengan kata sandi salah (401) dan akun nonaktif (401)", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const resSalahSandi = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "admin.fondasi",
        kataSandi: "SandiSalah123!",
      },
    });
    assert.equal(resSalahSandi.statusCode, 401);
    const bodySalah = resSalahSandi.json<ResponsGalatApi>();
    assert.equal(bodySalah.sukses, false);
    assert.equal(bodySalah.galat.kode, KODE_GALAT.AUTENTIKASI_GAGAL);

    const resNonaktif = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "akun.nonaktif",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(resNonaktif.statusCode, 401);
    const bodyNonaktif = resNonaktif.json<ResponsGalatApi>();
    assert.equal(bodyNonaktif.sukses, false);
    assert.match(bodyNonaktif.galat.pesan, /tidak aktif/i);

    await app.close();
  });

  it("2. memvalidasi input login yang tidak sah dengan pesan Bahasa Indonesia (400)", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const resInvalid = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "a",
        kataSandi: "123",
      },
    });
    assert.equal(resInvalid.statusCode, 400);
    const body = resInvalid.json<ResponsGalatApi>();
    assert.equal(body.sukses, false);
    assert.equal(body.galat.kode, KODE_GALAT.VALIDASI_GAGAL);
    assert.ok(
      (body.galat.rincianValidasi?.length ?? 0) >= 1,
      "Harus menyertakan rincian validasi field",
    );

    await app.close();
  });

  it("3. memisahkan kewenangan Administrator dari izin klinis (AB-032)", async () => {
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
    assert.equal(loginAdmin.statusCode, 200);
    const cookieAdmin = ambilCookieSesiDariHeader(
      loginAdmin.headers["set-cookie"],
    );

    // Administrator boleh membaca konfigurasi teknis
    const cekKonfig = await app.inject({
      method: "POST",
      url: "/v1/auth/check-access",
      headers: { cookie: cookieAdmin },
      payload: { izinDibutuhkan: "admin:konfigurasi:baca" },
    });
    assert.equal(cekKonfig.statusCode, 200);

    // Administrator DILARANG mengesahkan instruksi diet klinis
    const cekKlinis = await app.inject({
      method: "POST",
      url: "/v1/auth/check-access",
      headers: { cookie: cookieAdmin },
      payload: {
        izinDibutuhkan: "dokter:instruksi_diet:sahkan",
        bangsalId: "BANGSAL-MELATI",
      },
    });
    assert.equal(cekKlinis.statusCode, 403);
    const bodyTolak = cekKlinis.json<ResponsGalatApi>();
    assert.equal(bodyTolak.galat.kode, KODE_GALAT.AKSES_DITOLAK);
    assert.equal(
      bodyTolak.galat.pesan,
      "Anda tidak memiliki izin untuk tindakan ini.",
    );

    await app.close();
  });

  it("4. menolak akses petugas lintas bangsal tanpa kewenangan (403)", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const loginPerawat = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "perawat.anggrek",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginPerawat.statusCode, 200);
    const cookiePerawat = ambilCookieSesiDariHeader(
      loginPerawat.headers["set-cookie"],
    );

    // Diizinkan pada bangsal penugasannya sendiri (BANGSAL-ANGGREK)
    const resBangsalSendiri = await app.inject({
      method: "POST",
      url: "/v1/auth/check-access",
      headers: { cookie: cookiePerawat },
      payload: {
        izinDibutuhkan: "perawat:keamanan_makanan:verifikasi",
        bangsalId: "BANGSAL-ANGGREK",
      },
    });
    assert.equal(resBangsalSendiri.statusCode, 200);

    // Ditolak pada bangsal lain (BANGSAL-MELATI)
    const resLintasBangsal = await app.inject({
      method: "POST",
      url: "/v1/auth/check-access",
      headers: { cookie: cookiePerawat },
      payload: {
        izinDibutuhkan: "perawat:keamanan_makanan:verifikasi",
        bangsalId: "BANGSAL-MELATI",
      },
    });
    assert.equal(resLintasBangsal.statusCode, 403);
    const bodyLintas = resLintasBangsal.json<ResponsGalatApi>();
    assert.equal(bodyLintas.galat.kode, KODE_GALAT.AKSES_DITOLAK);
    assert.equal(
      bodyLintas.galat.pesan,
      "Anda tidak memiliki izin untuk tindakan ini.",
    );

    await app.close();
  });

  it("5. mengelola status notifikasi belum_dibaca/sudah_dibaca per pengguna dan idempotensi", async () => {
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
    const cookieAdmin = ambilCookieSesiDariHeader(
      loginAdmin.headers["set-cookie"],
    );

    // Membuka daftar notifikasi TIDAK otomatis menandai semua sudah dibaca
    const ambil1 = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(ambil1.statusCode, 200);
    const data1 = ambil1.json<ResponsSuksesApi<DaftarNotifikasiRespons>>().data;
    assert.equal(data1.jumlahBelumDibaca, 1);

    // Panggilan GET kedua tetap mempertahankan jumlahBelumDibaca = 1
    const ambil2 = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(
      ambil2.json<ResponsSuksesApi<DaftarNotifikasiRespons>>().data
        .jumlahBelumDibaca,
      1,
    );

    // Menandai notifikasi milik pengguna lain (milik perawat.anggrek) wajib ditolak (403)
    const tolakMilikOrangLain = await app.inject({
      method: "PATCH",
      url: "/v1/notifications/notif-fondasi-003/read",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(tolakMilikOrangLain.statusCode, 403);

    // Menandai notifikasi milik sendiri dengan X-Idempotency-Key
    const tandai1 = await app.inject({
      method: "PATCH",
      url: "/v1/notifications/notif-fondasi-001/read",
      headers: {
        cookie: cookieAdmin,
        "x-idempotency-key": "idem-notif-001",
      },
    });
    assert.equal(tandai1.statusCode, 200);
    const itemDibaca =
      tandai1.json<ResponsSuksesApi<ItemNotifikasiKontrak>>().data;
    assert.equal(itemDibaca.statusBaca, "sudah_dibaca");
    assert.ok(itemDibaca.waktuDibaca, "waktuDibaca harus terisi");

    // Replay idempoten mengembalikan hasil yang sama dengan header x-idempotent-replay
    const tandaiReplay = await app.inject({
      method: "PATCH",
      url: "/v1/notifications/notif-fondasi-001/read",
      headers: {
        cookie: cookieAdmin,
        "x-idempotency-key": "idem-notif-001",
      },
    });
    assert.equal(tandaiReplay.statusCode, 200);
    assert.equal(tandaiReplay.headers["x-idempotent-replay"], "true");

    // Setelah ditandai dibaca, jumlahBelumDibaca menjadi 0
    const ambil3 = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(
      ambil3.json<ResponsSuksesApi<DaftarNotifikasiRespons>>().data
        .jumlahBelumDibaca,
      0,
    );

    await app.close();
  });

  it("6. menyamarkan error internal/SQL agar tidak pernah bocor ke pengguna (UI_UX.md Bagian 9)", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
      aktifkanRuteUjiGalat: true,
    });

    const resGalat = await app.inject({
      method: "GET",
      url: "/v1/_test/simulasi-galat-sql",
    });

    assert.equal(resGalat.statusCode, 500);
    const body = resGalat.json<ResponsGalatApi>();
    assert.equal(body.sukses, false);
    assert.equal(body.galat.kode, KODE_GALAT.GANGGUAN_INTERNAL);
    assert.equal(
      body.galat.pesan,
      "Sistem sedang mengalami gangguan. Silakan coba lagi.",
    );
    assert.match(body.galat.kodeLaporan, /^ERR-[A-Z0-9]+$/);

    const teksMentah = resGalat.body;
    assert.ok(!teksMentah.includes("ER_BAD_FIELD_ERROR"));
    assert.ok(!teksMentah.includes("SELECT *"));
    assert.ok(!teksMentah.includes("rahasia_pasien"));

    await app.close();
  });

  it("7. memblokir akses ke endpoint microservice Tahap berikutnya secara fail-closed", async () => {
    const { app } = await bangunAplikasiGateway({
      env: { NODE_ENV: "test" },
    });

    const resTahapBelumRilis = await app.inject({
      method: "GET",
      url: "/v1/external-integrations/sync",
    });
    assert.equal(resTahapBelumRilis.statusCode, 503);
    const body = resTahapBelumRilis.json<ResponsGalatApi>();
    assert.equal(body.sukses, false);
    assert.match(body.galat.pesan, /Integrasi eksternal tidak diaktifkan/i);

    await app.close();
  });

  it("8. memvalidasi berkas migrasi SQL (001 & 002), redaksi audit sensitif, dan prosedur backup/restore sintetis", async () => {
    const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
    const pathSql001 = path.resolve(
      dirSaatIni,
      "../database/migrations/001_initial_foundation.sql",
    );
    const pathSql002 = path.resolve(
      dirSaatIni,
      "../database/migrations/002_tahap_1_administrator.sql",
    );
    const [isiSql001, isiSql002] = await Promise.all([
      readFile(pathSql001, "utf8"),
      readFile(pathSql002, "utf8"),
    ]);
    assert.equal(pisahkanPernyataanSql(isiSql001).length, 12);
    assert.equal(pisahkanPernyataanSql(isiSql002).length, 1);

    const metadataTersaring = sanitasiMetadataAudit({
      alamatIp: "127.0.0.1",
      password: "RahasiaJanganTampil",
      diagnosis: "JanganSimpanDiLogAuditAkses",
      alergi: "Kacang",
    });
    assert.equal(metadataTersaring.alamatIp, "127.0.0.1");
    assert.equal(metadataTersaring.password, "[DIREDaksi]");
    assert.equal(metadataTersaring.diagnosis, "[DIREDaksi]");
    assert.equal(metadataTersaring.alergi, "[DIREDaksi]");

    const hasilBackup = await jalankanUjiCadanganDanPemulihanSintetis();
    assert.equal(hasilBackup.valid, true);
    assert.equal(hasilBackup.jumlahPeranDipulihkan, 10);
  });
});

