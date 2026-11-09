/**
 * @fileoverview Pengujian unit dan integrasi untuk Tahap 9 — Peran Petugas Distribusi.
 * Menguji:
 * 1. Penolakan akses RBAC non-petugas-distribusi (403, AB-032).
 * 2. Penolakan akses petugas distribusi lintas bangsal di luar penugasan (403, AB-032).
 * 3. Pengambilan overview dasbor dan daftar troli pengantaran.
 * 4. Pembuatan troli pengantaran baru dan pembaruan status keberangkatan/kembali.
 * 5. Penolakan penyerahan makanan bila verifikasi 2 identitas pasien gagal (422, AB-020).
 * 6. Penolakan penyerahan makanan bila instruksi diet berubah/NPO (422, AB-021) & otomatis menahan porsi (AB-022).
 * 7. Keberhasilan penyerahan makanan saat 2 identitas & diet cocok (AB-020, AB-021, AB-023).
 * 8. Penahanan porsi makanan dengan alasan wajib minimal 5 karakter (AB-022, AB-030).
 * 9. Pencatatan laporan insiden distribusi makanan (AB-030).
 * 10. Validasi berkas migrasi SQL 001_tahap_9_delivery.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bangunAplikasiDelivery } from "../app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { pisahkanPernyataanSql } from "../../../identity-service/src/database/pool.ts";
import type {
  ItemLaporanInsidenDto,
  ItemPorsiDistribusiDto,
  ItemTroliDistribusiDto,
  RingkasanDistribusiOverviewDto,
  ResponsApi,
  ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";

describe("Tahap 9 — Peran Petugas Distribusi (Troli Bangsal, Verifikasi 2 Identitas & Serah Makanan)", () => {
  it("1. menolak akses ke endpoint /v1/delivery-intake/* bagi peran non-petugas-distribusi (403, AB-032)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    // Login sebagai petugas pendaftaran (bukan petugas distribusi)
    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.pendaftaran",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookiePendaftaran = loginRes.headers["set-cookie"] as string;

    const resTolak = await app.inject({
      method: "GET",
      url: "/v1/delivery-intake/trolleys",
      headers: { cookie: cookiePendaftaran },
    });
    assert.equal(resTolak.statusCode, 403, "Non-petugas-distribusi harus ditolak HTTP 403 (AB-032)");

    await app.close();
  });

  it("2. menolak akses petugas distribusi ke bangsal di luar daftar penugasannya (403, AB-032)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // Coba membuat troli untuk bangsal Teratai (tidak ada di penugasan ["bng-001", "bng-002"])
    const resTolakBangsal = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/trolleys",
      headers: { cookie: cookieDistribusi },
      payload: {
        bangsalId: "bng-999-teratai",
        namaBangsal: "Bangsal Teratai VIP",
        sesiMakan: "siang",
        tanggalDistribusi: "2026-11-10",
        porsiIds: [],
        catatan: "Pengantaran di luar wilayah penugasan",
      },
    });
    assert.equal(resTolakBangsal.statusCode, 403, "Akses bangsal di luar penugasan harus ditolak HTTP 403 (AB-032)");

    await app.close();
  });

  it("3. mengambil overview dasbor distribusi dan daftar troli pengantaran", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // Ambil overview
    const resOverview = await app.inject({
      method: "GET",
      url: "/v1/delivery-intake/overview",
      headers: { cookie: cookieDistribusi },
    });
    assert.equal(resOverview.statusCode, 200);
    const bodyOverview = resOverview.json<ResponsSuksesApi<RingkasanDistribusiOverviewDto>>();
    assert.equal(bodyOverview.sukses, true);
    assert.ok(bodyOverview.data.totalTroliAktif >= 1);
    assert.ok(bodyOverview.data.totalPorsiSiapKirim >= 1);

    // Ambil daftar troli
    const resTroli = await app.inject({
      method: "GET",
      url: "/v1/delivery-intake/trolleys",
      headers: { cookie: cookieDistribusi },
    });
    assert.equal(resTroli.statusCode, 200);
    const bodyTroli = resTroli.json<ResponsSuksesApi<{ items: ItemTroliDistribusiDto[] }>>();
    assert.ok(bodyTroli.data.items.length >= 2);

    await app.close();
  });

  it("4. membuat troli pengantaran baru dan memberangkatkan troli ke bangsal", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // Buat troli baru untuk Bangsal Mawar (bng-002)
    const resBuat = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/trolleys",
      headers: { cookie: cookieDistribusi },
      payload: {
        bangsalId: "bng-002",
        namaBangsal: "Bangsal Mawar (Bedah Umum)",
        sesiMakan: "siang",
        tanggalDistribusi: "2026-11-10",
        porsiIds: ["item-porsi-004"],
        catatan: "Troli kloter siang Bangsal Mawar",
      },
    });
    assert.equal(resBuat.statusCode, 200);
    const bodyBuat = resBuat.json<ResponsSuksesApi<ItemTroliDistribusiDto>>();
    assert.equal(bodyBuat.sukses, true);
    assert.equal(bodyBuat.data.status, "persiapan");
    assert.equal(bodyBuat.data.totalPorsi, 1);
    const troliBaruId = bodyBuat.data.id;

    // Berangkatkan troli
    const resBerangkat = await app.inject({
      method: "POST",
      url: `/v1/delivery-intake/trolleys/${troliBaruId}/depart`,
      headers: { cookie: cookieDistribusi },
    });
    assert.equal(resBerangkat.statusCode, 200);
    const bodyBerangkat = resBerangkat.json<ResponsSuksesApi<ItemTroliDistribusiDto>>();
    assert.equal(bodyBerangkat.data.status, "dalam_perjalanan");
    assert.ok(bodyBerangkat.data.waktuBerangkat !== null);

    await app.close();
  });

  it("5. menolak penyerahan makanan bila verifikasi dua identitas pasien gagal (422, AB-020)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // item-porsi-001 adalah Tn. Budi Santoso (1980-05-15, RM-2026-0001)
    // Coba verifikasi dengan data identitas yang SALAH
    const resGagalId = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/items/item-porsi-001/verify-and-handover",
      headers: { cookie: cookieDistribusi },
      payload: {
        namaPasienVerifikasi: "Tn. Slamet Riyadi", // Salah
        tanggalLahirVerifikasi: "1990-01-01", // Salah
        nomorRmVerifikasi: "RM-999-9999", // Salah
        metodeVerifikasi: "gelang_pasien",
        namaPenerima: "Tn. Slamet Riyadi",
        hubunganPenerima: "pasien_sendiri",
        catatanVerifikasi: "Uji coba verifikasi dua identitas salah",
      },
    });

    assert.equal(resGagalId.statusCode, 422);
    const bodyGagal = resGagalId.json<ResponsApi<unknown>>();
    assert.equal(bodyGagal.sukses, false);
    assert.match((!bodyGagal.sukses ? bodyGagal.galat.pesan : ""), /AB-020/);

    await app.close();
  });

  it("6. menolak penyerahan makanan bila instruksi diet rekam medis berubah/puasa (422, AB-021) dan otomatis menahan porsi (AB-022)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // item-porsi-002 adalah Ny. Siti Rahma yang diet terkini di rekam medis telah diubah menjadi NPO (Puasa)
    const resDietBerubah = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/items/item-porsi-002/verify-and-handover",
      headers: { cookie: cookieDistribusi },
      payload: {
        namaPasienVerifikasi: "Ny. Siti Rahma",
        tanggalLahirVerifikasi: "1975-08-20",
        nomorRmVerifikasi: "RM-2026-0002",
        metodeVerifikasi: "gelang_pasien",
        namaPenerima: "Ny. Siti Rahma",
        hubunganPenerima: "pasien_sendiri",
        catatanVerifikasi: "Pengecekan di ranjang pasien",
      },
    });

    assert.equal(resDietBerubah.statusCode, 422);
    const bodyDiet = resDietBerubah.json<ResponsApi<unknown>>();
    assert.equal(bodyDiet.sukses, false);
    assert.match((!bodyDiet.sukses ? bodyDiet.galat.pesan : ""), /Dilarang diserahkan ke pasien|DILARANG diserahkan dan otomatis ditahan/i);

    await app.close();
  });

  it("7. berhasil menyerahkan makanan saat verifikasi dua identitas dan diet cocok (AB-020, AB-021, AB-023)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // item-porsi-001 (Tn. Budi Santoso, 1980-05-15, RM-2026-0001, Diet Rendah Garam II cocok)
    const resSerah = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/items/item-porsi-001/verify-and-handover",
      headers: { cookie: cookieDistribusi },
      payload: {
        namaPasienVerifikasi: "Tn. Budi Santoso",
        tanggalLahirVerifikasi: "1980-05-15",
        nomorRmVerifikasi: "RM-2026-0001",
        metodeVerifikasi: "gelang_pasien",
        namaPenerima: "Tn. Budi Santoso",
        hubunganPenerima: "pasien_sendiri",
        catatanVerifikasi: "Dua pengenal (gelang pasien dan konfirmasi lisan) cocok. Makanan diserahkan dalam keadaan hangat.",
      },
    });

    assert.equal(resSerah.statusCode, 200);
    const bodySerah = resSerah.json<ResponsSuksesApi<ItemPorsiDistribusiDto>>();
    assert.equal(bodySerah.sukses, true);
    assert.equal(bodySerah.data.statusSerah, "berhasil_diserahkan");
    assert.equal(bodySerah.data.duaIdentitasTerverifikasi, true);
    assert.ok(bodySerah.data.waktuSerah !== null);
    assert.equal(bodySerah.data.namaPenerima, "Tn. Budi Santoso");

    await app.close();
  });

  it("8. menahan porsi makanan saat pengantaran dengan alasan wajib minimal 5 karakter (AB-022, AB-030)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // Uji alasan terlalu pendek (< 5 karakter)
    const resTahanPendek = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/items/item-porsi-004/hold",
      headers: { cookie: cookieDistribusi },
      payload: {
        alasanPenahanan: "NPO", // 3 karakter -> ditolak AB-030
      },
    });
    assert.equal(resTahanPendek.statusCode, 400);

    // Tahan porsi dengan alasan valid >= 5 karakter
    const resTahanValid = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/items/item-porsi-004/hold",
      headers: { cookie: cookieDistribusi },
      payload: {
        alasanPenahanan: "Pasien dijadwalkan tindakan endoskopi cito, instruksi NPO puasa mendadak.",
      },
    });
    assert.equal(resTahanValid.statusCode, 200);
    const bodyTahan = resTahanValid.json<ResponsSuksesApi<ItemPorsiDistribusiDto>>();
    assert.equal(bodyTahan.data.statusSerah, "ditahan_klinis");

    await app.close();
  });

  it("9. mencatat laporan insiden distribusi makanan dengan deskripsi & koreksi valid (AB-030)", async () => {
    const { app } = await bangunAplikasiDelivery({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.distribusi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDistribusi = loginRes.headers["set-cookie"] as string;

    // Catat insiden makanan tumpah di lorong bangsal
    const resInsiden = await app.inject({
      method: "POST",
      url: "/v1/delivery-intake/incidents",
      headers: { cookie: cookieDistribusi },
      payload: {
        troliId: "trl-sintetis-001",
        bangsalId: "bng-001",
        namaBangsal: "Bangsal Melati",
        jenisInsiden: "makanan_tumpah_rusak",
        deskripsiInsiden: "Troli terbentur pintu koridor bangsal Melati lantai 2, 1 porsi sup kaldu tumpah.",
        tindakanKoreksi: "Area langsung dibersihkan, porsi pengganti dimintakan segera ke dapur pengolahan.",
      },
    });

    assert.equal(resInsiden.statusCode, 200);
    const bodyInsiden = resInsiden.json<ResponsSuksesApi<ItemLaporanInsidenDto>>();
    assert.equal(bodyInsiden.sukses, true);
    assert.equal(bodyInsiden.data.jenisInsiden, "makanan_tumpah_rusak");
    assert.ok(bodyInsiden.data.nomorInsiden.startsWith("INS-"));

    // Ambil daftar insiden
    const resDaftarInsiden = await app.inject({
      method: "GET",
      url: "/v1/delivery-intake/incidents",
      headers: { cookie: cookieDistribusi },
    });
    assert.equal(resDaftarInsiden.statusCode, 200);
    const bodyDaftar = resDaftarInsiden.json<ResponsSuksesApi<{ items: ItemLaporanInsidenDto[] }>>();
    assert.ok(bodyDaftar.data.items.length >= 2);

    await app.close();
  });

  it("10. memvalidasi berkas migrasi SQL 001_tahap_9_delivery.sql pada delivery-intake-service", async () => {
    const direktoriUji = path.dirname(fileURLToPath(import.meta.url));
    const pathSql = path.resolve(
      direktoriUji,
      "../database/migrations/001_tahap_9_delivery.sql",
    );
    const isiSql = await readFile(pathSql, "utf8");

    const daftarPernyataan = pisahkanPernyataanSql(isiSql);
    assert.equal(
      daftarPernyataan.length,
      5,
      "Migrasi Tahap 9 harus terdiri dari tepat 5 pernyataan DDL tabel",
    );

    assert.ok(isiSql.includes("CREATE TABLE IF NOT EXISTS troli_distribusi_bangsal"));
    assert.ok(isiSql.includes("CREATE TABLE IF NOT EXISTS item_porsi_distribusi"));
    assert.ok(isiSql.includes("CREATE TABLE IF NOT EXISTS verifikasi_dua_identitas_serah"));
    assert.ok(isiSql.includes("CREATE TABLE IF NOT EXISTS riwayat_penyerahan_makanan"));
    assert.ok(isiSql.includes("CREATE TABLE IF NOT EXISTS laporan_insiden_distribusi"));
  });
});
