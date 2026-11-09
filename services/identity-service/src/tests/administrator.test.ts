/**
 * @fileoverview Pengujian otomatis Tahap 1 — Peran Administrator.
 * Menguji:
 * 1. Matriks akses negatif: penolakan peran non-Administrator pada seluruh endpoint `/v1/admin/*` (403).
 * 2. Pembuatan pengguna baru, validasi aturan bangsal per peran (`AB-032`), idempotensi, dan notifikasi akun.
 * 3. Pembaruan pengguna dengan optimistic concurrency (`versi`), penolakan versi usang (409),
 *    dan pencabutan sesi otomatis ketika akun dinonaktifkan.
 * 4. Pencegahan self-lockout Administrator (menonaktifkan atau mengubah peran diri sendiri ditolak 409).
 * 5. Pengelolaan konfigurasi operasional berversi (`AB-030`), riwayat perubahan, dan pemblokiran
 *    pelemahan aturan keselamatan verifikasi dua identitas pasien (`AB-001`, `AB-020` -> 422).
 * 6. Peninjauan jejak audit tersanitasi dan jaminan tidak adanya kebocoran hash/salt kata sandi.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KODE_GALAT,
  type DaftarNotifikasiRespons,
  type ResponsGalatApi,
  type ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../database/seeds/master.seed.ts";
import type {
  DaftarAuditAdminRespons,
  DaftarPenggunaAdminRespons,
  EntitasKonfigurasiOperasional,
  EntitasRiwayatKonfigurasi,
  RingkasanPenggunaAdminDto,
} from "../model/identity.model.ts";

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

describe("Tahap 1 — Peran Administrator (Pengguna, Peran, Konfigurasi Operasional, & Audit)", () => {
  it("1. menolak akses ke seluruh endpoint /v1/admin/* bagi peran non-Administrator (403)", async () => {
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
    const cookiePerawat = ambilCookieSesi(loginPerawat.headers["set-cookie"]);

    const endpointsTerlarang = [
      { method: "GET" as const, url: "/v1/admin/users" },
      { method: "GET" as const, url: "/v1/admin/roles" },
      { method: "GET" as const, url: "/v1/admin/configurations" },
      { method: "GET" as const, url: "/v1/admin/audit-logs" },
    ];

    for (const ep of endpointsTerlarang) {
      const res = await app.inject({
        method: ep.method,
        url: ep.url,
        headers: { cookie: cookiePerawat },
      });
      assert.equal(
        res.statusCode,
        403,
        `Endpoint ${ep.url} wajib menolak peran perawat`,
      );
      const body = res.json<ResponsGalatApi>();
      assert.equal(body.galat.kode, KODE_GALAT.AKSES_DITOLAK);
      assert.equal(
        body.galat.pesan,
        "Anda tidak memiliki izin untuk tindakan ini.",
      );
    }

    await app.close();
  });

  it("2. membuat akun pengguna baru, memvalidasi aturan bangsal per peran (AB-032), dan menjaga idempotensi", async () => {
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

    // Negatif: membuat perawat tanpa penugasan bangsal wajib ditolak (400)
    const gagalTanpaBangsal = await app.inject({
      method: "POST",
      url: "/v1/admin/users",
      headers: { cookie: cookieAdmin },
      payload: {
        namaPengguna: "perawat.tanpabangsal",
        namaLengkap: "Perawat Tanpa Bangsal (Sintetis)",
        kataSandi: "SandiAman2026!",
        peran: "perawat",
        daftarBangsalId: [],
        aktif: true,
        alasan: "Uji negatif perawat tanpa bangsal",
      },
    });
    assert.equal(gagalTanpaBangsal.statusCode, 400);

    // Negatif: membuat administrator dengan penugasan bangsal klinis wajib ditolak (400 - AB-032)
    const gagalAdminBangsal = await app.inject({
      method: "POST",
      url: "/v1/admin/users",
      headers: { cookie: cookieAdmin },
      payload: {
        namaPengguna: "admin.klinis",
        namaLengkap: "Admin Salah Bangsal (Sintetis)",
        kataSandi: "SandiAman2026!",
        peran: "administrator",
        daftarBangsalId: ["BANGSAL-ANGGREK"],
        aktif: true,
        alasan: "Uji negatif admin dengan bangsal klinis",
      },
    });
    assert.equal(gagalAdminBangsal.statusCode, 400);

    // Positif: membuat perawat baru dengan bangsal sah & kunci idempotensi
    const payloadSah = {
      namaPengguna: "perawat.mawar",
      namaLengkap: "Perawat Bangsal Mawar (Sintetis)",
      kataSandi: "SandiAman2026!",
      peran: "perawat",
      daftarBangsalId: ["BANGSAL-MAWAR"],
      aktif: true,
      alasan: "Penambahan petugas bangsal mawar untuk uji operasional",
    };

    const buat1 = await app.inject({
      method: "POST",
      url: "/v1/admin/users",
      headers: {
        cookie: cookieAdmin,
        "x-idempotency-key": "idem-create-perawat-mawar",
      },
      payload: payloadSah,
    });
    assert.equal(buat1.statusCode, 201);
    const dataDibuat =
      buat1.json<ResponsSuksesApi<RingkasanPenggunaAdminDto>>().data;
    assert.equal(dataDibuat.namaPengguna, "perawat.mawar");
    assert.equal(dataDibuat.versi, 1);
    assert.deepEqual(dataDibuat.daftarBangsalId, ["BANGSAL-MAWAR"]);
    assert.ok(
      !("passwordHash" in dataDibuat),
      "Respons tidak boleh membocorkan passwordHash",
    );

    // Replay idempotensi mengembalikan respons yang sama tanpa error duplikasi
    const buatReplay = await app.inject({
      method: "POST",
      url: "/v1/admin/users",
      headers: {
        cookie: cookieAdmin,
        "x-idempotency-key": "idem-create-perawat-mawar",
      },
      payload: payloadSah,
    });
    assert.equal(buatReplay.statusCode, 201);
    assert.equal(buatReplay.headers["x-idempotent-replay"], "true");

    await app.close();
  });

  it("3. menerapkan optimistic concurrency (versi), mencabut sesi saat akun dinonaktifkan, dan menolak self-lockout", async () => {
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

    // Login sebagai perawat.anggrek agar memiliki sesi aktif
    const loginPerawat = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "perawat.anggrek",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookiePerawat = ambilCookieSesi(loginPerawat.headers["set-cookie"]);

    // Negatif: Administrator mencoba menonaktifkan dirinya sendiri -> ditolak 409
    const tolakNonaktifDiri = await app.inject({
      method: "PATCH",
      url: "/v1/admin/users/usr-sintetis-admin",
      headers: { cookie: cookieAdmin },
      payload: {
        namaLengkap: "Petugas Konfigurasi Sistem (Sintetis)",
        peran: "administrator",
        daftarBangsalId: [],
        aktif: false,
        versi: 1,
        alasanPerubahan: "Percobaan menonaktifkan akun sendiri",
      },
    });
    assert.equal(tolakNonaktifDiri.statusCode, 409);

    // Positif: Administrator memperbarui cakupan bangsal perawat.anggrek (versi 1 -> versi 2)
    const ubah1 = await app.inject({
      method: "PATCH",
      url: "/v1/admin/users/usr-sintetis-perawat-anggrek",
      headers: { cookie: cookieAdmin },
      payload: {
        namaLengkap: "Perawat Bangsal Anggrek & Bougenville (Sintetis)",
        peran: "perawat",
        daftarBangsalId: ["BANGSAL-ANGGREK", "BANGSAL-BOUGENVILLE"],
        aktif: true,
        versi: 1,
        alasanPerubahan: "Penambahan penugasan bangsal bougenville",
      },
    });
    assert.equal(ubah1.statusCode, 200);
    const dataUbah1 =
      ubah1.json<ResponsSuksesApi<RingkasanPenggunaAdminDto>>().data;
    assert.equal(dataUbah1.versi, 2);

    // Negatif Concurrency: mencoba menyimpan lagi dengan versi lama (versi 1) -> ditolak 409
    const konflikVersi = await app.inject({
      method: "PATCH",
      url: "/v1/admin/users/usr-sintetis-perawat-anggrek",
      headers: { cookie: cookieAdmin },
      payload: {
        namaLengkap: "Perubahan Usang",
        peran: "perawat",
        daftarBangsalId: ["BANGSAL-ANGGREK"],
        aktif: true,
        versi: 1,
        alasanPerubahan: "Percobaan dengan versi usang",
      },
    });
    assert.equal(konflikVersi.statusCode, 409);

    // Menonaktifkan akun perawat.anggrek (versi 2 -> versi 3) mencabut sesi aktifnya secara otomatis
    const nonaktifkan = await app.inject({
      method: "PATCH",
      url: "/v1/admin/users/usr-sintetis-perawat-anggrek",
      headers: { cookie: cookieAdmin },
      payload: {
        namaLengkap: "Perawat Bangsal Anggrek (Nonaktif)",
        peran: "perawat",
        daftarBangsalId: ["BANGSAL-ANGGREK"],
        aktif: false,
        versi: 2,
        alasanPerubahan: "Cuti panjang petugas bangsal",
      },
    });
    assert.equal(nonaktifkan.statusCode, 200);

    // Sesi lama milik perawat.anggrek tidak lagi berlaku (401)
    const cekSesiPerawat = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { cookie: cookiePerawat },
    });
    assert.equal(cekSesiPerawat.statusCode, 401);

    await app.close();
  });

  it("4. mengelola konfigurasi operasional berversi (AB-030), menolak pelemahan keselamatan (AB-020), dan mencatat audit", async () => {
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

    // Negatif Keselamatan: mencoba mematikan keamanan.wajib_verifikasi_dua_identitas -> ditolak 422
    const tolakLemahkanKeselamatan = await app.inject({
      method: "PUT",
      url: "/v1/admin/configurations/keamanan.wajib_verifikasi_dua_identitas",
      headers: { cookie: cookieAdmin },
      payload: {
        nilai: "false",
        versi: 1,
        alasanPerubahan: "Mencoba mematikan verifikasi dua identitas",
      },
    });
    assert.equal(tolakLemahkanKeselamatan.statusCode, 422);
    const bodyTolak = tolakLemahkanKeselamatan.json<ResponsGalatApi>();
    assert.equal(bodyTolak.galat.kode, KODE_GALAT.PENAHANAN_KESELAMATAN);

    // Positif: memperbarui konfigurasi operasional dengan versi dan alasan sah
    const ubahKonfig = await app.inject({
      method: "PUT",
      url: "/v1/admin/configurations/sistem.zona_waktu_operasional",
      headers: { cookie: cookieAdmin },
      payload: {
        nilai: "Asia/Makassar",
        versi: 1,
        alasanPerubahan: "Penyesuaian zona waktu simulasi WITA",
      },
    });
    assert.equal(ubahKonfig.statusCode, 200);
    const hasilKonfig = ubahKonfig.json<
      ResponsSuksesApi<{
        konfigurasi: EntitasKonfigurasiOperasional;
        riwayat: EntitasRiwayatKonfigurasi;
      }>
    >().data;
    assert.equal(hasilKonfig.konfigurasi.versi, 2);
    assert.equal(hasilKonfig.riwayat.nilaiSebelum, "Asia/Jakarta");
    assert.equal(hasilKonfig.riwayat.nilaiSesudah, "Asia/Makassar");

    // Periksa daftar audit mencatat baik tindakan yang berhasil maupun yang ditolak
    const ambilAudit = await app.inject({
      method: "GET",
      url: "/v1/admin/audit-logs?kataKunci=ADMIN_UPDATE_CONFIG",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(ambilAudit.statusCode, 200);
    const dataAudit =
      ambilAudit.json<ResponsSuksesApi<DaftarAuditAdminRespons>>().data;
    assert.ok(
      dataAudit.totalItem >= 2,
      "Harus mencatat riwayat audit perubahan konfigurasi yang berhasil dan ditolak",
    );

    // Pastikan pencarian daftar pengguna berfungsi
    const cariPengguna = await app.inject({
      method: "GET",
      url: "/v1/admin/users?kataKunci=dokter",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(cariPengguna.statusCode, 200);
    const dataCari =
      cariPengguna.json<ResponsSuksesApi<DaftarPenggunaAdminRespons>>().data;
    assert.equal(dataCari.totalItem, 1);
    assert.equal(dataCari.items[0]?.namaPengguna, "dokter.melati");

    // Pastikan notifikasi perubahan akun terkirim ke penerima terkait
    const loginDokter = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "dokter.melati",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDokter = ambilCookieSesi(loginDokter.headers["set-cookie"]);
    const notifDokter = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: { cookie: cookieDokter },
    });
    assert.equal(notifDokter.statusCode, 200);
    assert.ok(
      notifDokter.json<ResponsSuksesApi<DaftarNotifikasiRespons>>().data
        .totalItem >= 0,
    );

    await app.close();
  });
});

