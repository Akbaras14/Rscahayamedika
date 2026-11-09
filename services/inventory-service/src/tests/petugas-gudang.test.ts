/**
 * @fileoverview Pengujian unit dan integrasi untuk Tahap 7 — Peran Petugas Gudang.
 * Menguji:
 * 1. Penolakan akses RBAC non-petugas-gudang (403, AB-032).
 * 2. Pengambilan katalog bahan baku & monitoring safety stock minimum.
 * 3. Penerimaan lot bahan baku dengan inspeksi mutu lolos (tambah stok fisik & layak).
 * 4. Penerimaan lot ditolak/karantina (AB-015: dilarang masuk stok layak, masuk stok ditahan).
 * 5. Alokasi bahan dapur memvalidasi stok (AB-016: alokasi tidak langsung memotong stok fisik).
 * 6. Penolakan pengeluaran melebihi stok layak tersedia (AB-017: fail-closed 422).
 * 7. Pengeluaran aktual FEFO/FIFO mencatat nomor lot terlacak (AB-018).
 * 8. Stok opname fisik dengan alasan wajib (BRD 7.6, AB-030).
 * 9. Integritas migrasi SQL 001_tahap_7_inventory.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bangunAplikasiGateway } from "../../../api-gateway/src/app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { pisahkanPernyataanSql } from "../../../identity-service/src/database/pool.ts";
import type {
  ItemKartuStokMutasiDto,
  ItemKatalogBahanDto,
  ItemPenerimaanLotDto,
  ItemPenyesuaianStokOpnameDto,
  ItemPermintaanBahanDto,
  ItemRincianPermintaanBahanDto,
  ResponsApi,
  ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";

describe("Tahap 7 — Peran Petugas Gudang (Manajemen Inventaris, Mutu Bahan & Pengendalian Stok FEFO)", () => {
  it("1. menolak akses ke endpoint /v1/inventory/* bagi peran non-petugas-gudang (403, AB-032)", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    // Login sebagai administrator (bukan petugas gudang)
    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "admin.fondasi",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieAdmin = loginRes.headers["set-cookie"] as string;

    const resTolak = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieAdmin },
    });
    assert.equal(resTolak.statusCode, 403);
    const bodyTolak = resTolak.json<ResponsApi<never>>();
    assert.equal(bodyTolak.sukses, false);
    assert.match(bodyTolak.galat.pesan, /Petugas Gudang/i);

    await app.close();
  });

  it("2. mengambil katalog bahan baku beserta status ketersediaan stok fisik vs layak vs dialokasikan", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    const res = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json<ResponsApi<{ items: ItemKatalogBahanDto[]; total: number }>>();
    assert.equal(body.sukses, true);
    assert.ok(body.data.total >= 10, "Katalog bahan master harus berisi minimal 10 bahan");

    const beras = body.data.items.find((b) => b.kodeBahan === "BHN-BERAS-01");
    assert.ok(beras, "Beras harus terdaftar dalam katalog master");
    assert.equal(beras.satuan, "kg");
    assert.equal(beras.suhuPenyimpanan, "suhu_ruang");
    assert.ok(beras.stokTersedia >= beras.stokMinimum, "Stok beras harus tersedia");

    await app.close();
  });

  it("3. mencatat penerimaan lot bahan baku dengan inspeksi mutu lolos (menambah stok fisik & layak)", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    // Ambil stok awal ayam
    const resAwal = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const ayamAwal = resAwal
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-002")!;

    // Catat penerimaan 20 kg dada ayam fillet segar
    const resPenerimaan = await app.inject({
      method: "POST",
      url: "/v1/inventory/lots",
      headers: { cookie: cookieGudang },
      payload: {
        bahanId: "bhn-002",
        namaPemasok: "PT Sejahtera Unggas Abadi",
        jumlahMasuk: 20.0,
        tanggalPenerimaan: "2026-11-09",
        tanggalKedaluwarsa: "2026-12-09",
        statusMutu: "layak_diterima",
        catatanPemeriksaan: "Suhu beku -18.5 C, kemasan vakum kedap udara rapat, warna daging merah segar normal.",
        suhuTercatatCelsius: -18.5,
      },
    });
    assert.equal(resPenerimaan.statusCode, 200);
    const lotBaru = resPenerimaan.json<ResponsSuksesApi<ItemPenerimaanLotDto>>().data;
    assert.ok(lotBaru.nomorLot.startsWith("LOT-"), "Nomor lot harus berformat LOT-YYYYMMDD-XXX");
    assert.equal(lotBaru.statusMutu, "layak_diterima");
    assert.equal(lotBaru.statusLot, "aktif");

    // Verifikasi stok bertambah pada katalog
    const resAkhir = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const ayamAkhir = resAkhir
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-002")!;
    assert.equal(ayamAkhir.stokFisik, ayamAwal.stokFisik + 20.0);
    assert.equal(ayamAkhir.stokLayak, ayamAwal.stokLayak + 20.0);

    await app.close();
  });

  it("4. mencatat penerimaan lot ditolak / karantina (AB-015: dilarang masuk stok layak, masuk stok ditahan)", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    const resAwal = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const kakapAwal = resAwal
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-003")!;

    // Terima 10 kg kakap tetapi rusak/berbau asam
    const resTolak = await app.inject({
      method: "POST",
      url: "/v1/inventory/lots",
      headers: { cookie: cookieGudang },
      payload: {
        bahanId: "bhn-003",
        namaPemasok: "CV Sumber Ikan Rusak",
        jumlahMasuk: 10.0,
        tanggalPenerimaan: "2026-11-09",
        tanggalKedaluwarsa: "2026-11-15",
        statusMutu: "ditolak_rusak",
        catatanPemeriksaan: "Ikan tidak beku sempurna (-2 C), tekstur lembek berlendir, aroma asam menyengat.",
        suhuTercatatCelsius: -2.0,
      },
    });
    assert.equal(resTolak.statusCode, 200);
    const lotTolak = resTolak.json<ResponsSuksesApi<ItemPenerimaanLotDto>>().data;
    assert.equal(lotTolak.statusMutu, "ditolak_rusak");

    // AB-015: Stok layak TIDAK bertambah, hanya stok fisik dan stok ditahan yang bertambah
    const resAkhir = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const kakapAkhir = resAkhir
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-003")!;
    assert.equal(kakapAkhir.stokLayak, kakapAwal.stokLayak, "Stok layak TIDAK boleh bertambah bila mutu ditolak");
    assert.equal(kakapAkhir.stokDitahan, kakapAwal.stokDitahan + 10.0, "Stok ditahan harus bertambah");
    assert.equal(kakapAkhir.stokFisik, kakapAwal.stokFisik + 10.0);

    await app.close();
  });

  it("5. alokasi bahan dapur memvalidasi stok layak (AB-016: alokasi tidak memotong stok fisik secara langsung)", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    // Buat permintaan bahan dapur sintetis: Beras 10 kg
    const resReq = await app.inject({
      method: "POST",
      url: "/v1/inventory/requests",
      headers: { cookie: cookieGudang },
      payload: {
        tanggalKebutuhan: "2026-11-10",
        unitPeminta: "Dapur Pengolahan Utama",
        keterangan: "Permintaan makan siang pasien",
        daftarItem: [{ bahanId: "bhn-001", jumlahDiminta: 10.0 }],
      },
    });
    assert.equal(resReq.statusCode, 200);
    const req = resReq.json<ResponsSuksesApi<ItemPermintaanBahanDto>>().data;

    // Ambil stok sebelum alokasi
    const resKatalog1 = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const beras1 = resKatalog1
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-001")!;

    // Alokasikan stok bahan
    const resAlokasi = await app.inject({
      method: "POST",
      url: `/v1/inventory/requests/${req.id}/allocate`,
      headers: { cookie: cookieGudang },
    });
    assert.equal(resAlokasi.statusCode, 200);
    const reqDialokasikan = resAlokasi.json<ResponsSuksesApi<ItemPermintaanBahanDto>>().data;
    assert.equal(reqDialokasikan.status, "dialokasikan");

    // AB-016: Stok dialokasikan bertambah 10 kg, stok fisik TETAP
    const resKatalog2 = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const beras2 = resKatalog2
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-001")!;

    assert.equal(beras2.stokFisik, beras1.stokFisik, "AB-016: Stok fisik belum boleh berkurang saat alokasi");
    assert.equal(beras2.stokDialokasikan, beras1.stokDialokasikan + 10.0);
    assert.equal(beras2.stokTersedia, beras1.stokTersedia - 10.0);

    await app.close();
  });

  it("6. menolak pengeluaran atau alokasi yang melebihi stok layak tersedia (AB-017 fail-closed 422)", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    // Buat permintaan bahan melebihi stok tersedia: Kakap 9999 kg
    const resReq = await app.inject({
      method: "POST",
      url: "/v1/inventory/requests",
      headers: { cookie: cookieGudang },
      payload: {
        tanggalKebutuhan: "2026-11-10",
        unitPeminta: "Dapur Pengolahan Utama",
        keterangan: "Permintaan berlebihan untuk uji AB-017",
        daftarItem: [{ bahanId: "bhn-003", jumlahDiminta: 9999.0 }],
      },
    });
    assert.equal(resReq.statusCode, 200);
    const req = resReq.json<ResponsSuksesApi<ItemPermintaanBahanDto>>().data;

    // Alokasi harus ditolak HTTP 422
    const resAlokasiGagal = await app.inject({
      method: "POST",
      url: `/v1/inventory/requests/${req.id}/allocate`,
      headers: { cookie: cookieGudang },
    });
    assert.equal(resAlokasiGagal.statusCode, 422);
    const bodyGagal = resAlokasiGagal.json<ResponsApi<never>>();
    assert.equal(bodyGagal.sukses, false);
    assert.match(bodyGagal.galat.pesan, /tidak mencukupi/i);

    await app.close();
  });

  it("7. pengeluaran aktual FEFO memotong lot terdekat ED, mencatat nomor lot terlacak (AB-018), dan memotong stok fisik", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    // Buat dan alokasikan permintaan: Wortel 5 kg
    const resReq = await app.inject({
      method: "POST",
      url: "/v1/inventory/requests",
      headers: { cookie: cookieGudang },
      payload: {
        tanggalKebutuhan: "2026-11-10",
        unitPeminta: "Dapur Pengolahan Utama",
        keterangan: "Kebutuhan sayur sup wortel",
        daftarItem: [{ bahanId: "bhn-008", jumlahDiminta: 5.0 }],
      },
    });
    const req = resReq.json<ResponsSuksesApi<ItemPermintaanBahanDto>>().data;

    await app.inject({
      method: "POST",
      url: `/v1/inventory/requests/${req.id}/allocate`,
      headers: { cookie: cookieGudang },
    });

    // Ambil stok fisik wortel sebelum pengeluaran
    const resKatalog1 = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const wortel1 = resKatalog1
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-008")!;

    // Eksekusi pengeluaran fisik (dispatch)
    const resDispatch = await app.inject({
      method: "POST",
      url: `/v1/inventory/requests/${req.id}/dispatch`,
      headers: { cookie: cookieGudang },
      payload: { catatanPengeluaran: "Diserahkan ke Chef Dapur Utama dalam kondisi prima." },
    });
    assert.equal(resDispatch.statusCode, 200);
    const reqDispatched = resDispatch.json<ResponsSuksesApi<ItemPermintaanBahanDto>>().data;
    assert.equal(reqDispatched.status, "dikeluarkan");

    // AB-018: Rincian item harus memiliki lot yang digunakan
    const itemWortel = reqDispatched.daftarItem.find((i: ItemRincianPermintaanBahanDto) => i.bahanId === "bhn-008")!;
    assert.equal(itemWortel.jumlahDikeluarkan, 5.0);
    assert.ok(itemWortel.lotDialokasikan && itemWortel.lotDialokasikan.length > 0);
    assert.ok(itemWortel.lotDialokasikan[0].nomorLot.startsWith("LOT-"));

    // Verifikasi stok fisik sekarang BERKURANG 5 kg
    const resKatalog2 = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const wortel2 = resKatalog2
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-008")!;
    assert.equal(wortel2.stokFisik, wortel1.stokFisik - 5.0);
    assert.equal(wortel2.stokLayak, wortel1.stokLayak - 5.0);
    assert.equal(wortel2.stokDialokasikan, 0.0);

    // Verifikasi mutasi kartu stok tercatat
    const resLedger = await app.inject({
      method: "GET",
      url: "/v1/inventory/ledger?bahanId=bhn-008",
      headers: { cookie: cookieGudang },
    });
    const ledger = resLedger.json<ResponsSuksesApi<{ items: ItemKartuStokMutasiDto[] }>>().data.items;
    assert.ok(ledger.length > 0);
    assert.equal(ledger[0].jenisMutasi, "pengeluaran");

    await app.close();
  });

  it("8. mencatat penyesuaian stok fisik (stok opname) dengan alasan wajib (BRD 7.6, AB-030)", async () => {
    const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.gudang",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieGudang = loginRes.headers["set-cookie"] as string;

    // Gagal jika alasan < 5 karakter
    const resGagal = await app.inject({
      method: "POST",
      url: "/v1/inventory/stock-opname",
      headers: { cookie: cookieGudang },
      payload: {
        bahanId: "bhn-001",
        stokFisikAktual: 245.0,
        alasanWajib: "rusk", // < 5 karakter
      },
    });
    assert.equal(resGagal.statusCode, 400);

    // Berhasil jika alasan lengkap
    const resSukses = await app.inject({
      method: "POST",
      url: "/v1/inventory/stock-opname",
      headers: { cookie: cookieGudang },
      payload: {
        bahanId: "bhn-001",
        stokFisikAktual: 245.0,
        alasanWajib: "Penyusutan kelembaban beras karung 5 kg saat penyimpanan ruang gudang.",
      },
    });
    assert.equal(resSukses.statusCode, 200);
    const opname = resSukses.json<ResponsSuksesApi<ItemPenyesuaianStokOpnameDto>>().data;
    assert.equal(opname.stokFisikAktual, 245.0);

    // Verifikasi stok bahan terbarui
    const resKatalog = await app.inject({
      method: "GET",
      url: "/v1/inventory/items",
      headers: { cookie: cookieGudang },
    });
    const beras = resKatalog
      .json<ResponsSuksesApi<{ items: ItemKatalogBahanDto[] }>>()
      .data.items.find((b: ItemKatalogBahanDto) => b.id === "bhn-001")!;
    assert.equal(beras.stokFisik, 245.0);

    await app.close();
  });

  it("9. memvalidasi berkas migrasi SQL 001_tahap_7_inventory.sql", async () => {
    const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
    const pathSql = path.resolve(dirSaatIni, "../database/migrations/001_tahap_7_inventory.sql");
    const isiSql = await readFile(pathSql, "utf8");
    const pernyataan = pisahkanPernyataanSql(isiSql);

    assert.equal(
      pernyataan.length,
      5,
      "Migrasi Tahap 7 harus berisi tepat 5 pernyataan DDL (katalog, lot, mutasi, permintaan, opname)",
    );
    assert.ok(isiSql.includes("katalog_bahan_baku"));
    assert.ok(isiSql.includes("penerimaan_lot_bahan"));
    assert.ok(isiSql.includes("kartu_stok_mutasi"));
    assert.ok(isiSql.includes("permintaan_bahan_dapur"));
    assert.ok(isiSql.includes("penyesuaian_stok_opname"));
  });
});
