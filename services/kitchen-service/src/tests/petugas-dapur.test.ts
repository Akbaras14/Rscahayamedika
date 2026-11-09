/**
 * @fileoverview Pengujian unit dan integrasi untuk Tahap 8 — Peran Petugas Dapur.
 * Menguji:
 * 1. Penolakan akses RBAC non-petugas-dapur (403, AB-032).
 * 2. Pembuatan dan pengesahan rencana produksi reguler H-1 & estimasi bahan (AB-012, AB-014).
 * 3. Pencatatan batch memasak dengan penelusuran nomor lot bahan gudang (AB-018).
 * 4. Perekaman suhu masak inti Critical Control Point (CCP >= 75 C, AB-019).
 * 5. Pemeriksaan mutu akhir organoleptik/suhu saji: lolos vs ditahan gagal mutu (AB-019, AB-022).
 * 6. Penolakan pemorsian untuk batch yang gagal mutu akhir (AB-019, AB-022 fail-closed 422).
 * 7. Penahanan pesanan akibat perubahan diet klinis (AB-010, AB-013) & penolakan distribusi saat ditahan (422).
 * 8. Ketertelusuran bahan baku gudang ke porsi pasien (Recall Traceability BRD 8.6).
 * 9. Integritas migrasi SQL 001_tahap_8_kitchen.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bangunAplikasiKitchen } from "../app.ts";
import { KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { pisahkanPernyataanSql } from "../../../identity-service/src/database/pool.ts";
import type {
  ItemBatchProduksiDto,
  ItemLabelPorsiPasienDto,
  ItemPemeriksaanMutuProduksiDto,
  ItemRencanaProduksiDto,
  ResponsApi,
  ResponsSuksesApi,
} from "../../../../packages/shared-types/src/index.ts";

describe("Tahap 8 — Peran Petugas Dapur (Perencanaan H-1, CCP Suhu, Mutu Akhir, Penahanan & Label Porsi)", () => {
  it("1. menolak akses ke endpoint /v1/kitchen/* bagi peran non-petugas-dapur (403, AB-032)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    // Login sebagai perawat (bukan petugas dapur)
    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "perawat.anggrek",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookiePerawat = loginRes.headers["set-cookie"] as string;

    const resTolak = await app.inject({
      method: "GET",
      url: "/v1/kitchen/production-plans",
      headers: { cookie: cookiePerawat },
    });
    assert.equal(resTolak.statusCode, 403, "Non-petugas-dapur harus ditolak HTTP 403 (AB-032)");

    await app.close();
  });

  it("2. membuat dan mengesahkan rencana produksi reguler H-1 beserta kalkulasi kebutuhan bahan (AB-012, AB-014)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    // Buat rencana produksi H-1 untuk makan siang besok
    const resBuat = await app.inject({
      method: "POST",
      url: "/v1/kitchen/production-plans",
      headers: { cookie: cookieDapur },
      payload: {
        tanggalPelayanan: "2026-11-11",
        sesiMakan: "siang",
        catatan: "Rencana produksi makan siang H-1 seluruh bangsal",
      },
    });
    assert.equal(resBuat.statusCode, 200);
    const rencana = resBuat.json<ResponsSuksesApi<ItemRencanaProduksiDto>>().data;
    assert.ok(rencana.nomorRencana.startsWith("RP-"));
    assert.equal(rencana.status, "draft");
    assert.equal(rencana.kebutuhanBahan.length, 0, "Tanpa pesanan individual, kebutuhan bahan tidak boleh direkayasa.");

    // Sahkan rencana produksi H-1
    const resApprove = await app.inject({
      method: "POST",
      url: `/v1/kitchen/production-plans/${rencana.id}/approve`,
      headers: { cookie: cookieDapur },
    });
    assert.equal(resApprove.statusCode, 200);
    const rencanaDisetujui = resApprove.json<ResponsSuksesApi<ItemRencanaProduksiDto>>().data;
    assert.equal(rencanaDisetujui.status, "disetujui");
    assert.ok(rencanaDisetujui.waktuDisetujui !== null);

    await app.close();
  });

  it("3. mencatat batch memasak baru dengan penelusuran nomor lot bahan baku gudang (AB-018)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    const resBatch = await app.inject({
      method: "POST",
      url: "/v1/kitchen/batches",
      headers: { cookie: cookieDapur },
      payload: {
        rencanaProduksiId: "rp-sintetis-001",
        resepId: "rsp-001",
        namaMasakan: "Sup Ayam Fillet Wortel Rendah Garam",
        sesiMakan: "siang",
        jumlahPorsiTarget: 35,
        chefPenanggungJawab: "Chef Sulaeman",
        catatanKoki: "Pengolahan sup kaldu ayam dengan api sedang.",
        lotBahanDigunakan: [
          {
            bahanId: "bhn-002",
            namaBahan: "Dada Ayam Fillet Segar",
            nomorLot: "LOT-20261109-002",
            jumlahDigunakan: 5.25,
            satuan: "kg",
          },
          {
            bahanId: "bhn-008",
            namaBahan: "Wortel Segar Super",
            nomorLot: "LOT-20261109-005",
            jumlahDigunakan: 3.5,
            satuan: "kg",
          },
        ],
      },
    });
    assert.equal(resBatch.statusCode, 200);
    const batch = resBatch.json<ResponsSuksesApi<ItemBatchProduksiDto>>().data;
    assert.ok(batch.nomorBatch.startsWith("BATCH-"));
    assert.equal(batch.status, "memasak");
    assert.equal(batch.lotBahanDigunakan.length, 2, "AB-018: Nomor lot bahan harus tercatat");
    assert.equal(batch.lotBahanDigunakan[0].nomorLot, "LOT-20261109-002");

    await app.close();
  });

  it("4. merekam suhu masak inti Critical Control Point (CCP >= 75 C, AB-019)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    // Catat CCP suhu inti 87.5 C pada batch 002
    const resCcp = await app.inject({
      method: "POST",
      url: "/v1/kitchen/batches/batch-sintetis-002/ccp-temp",
      headers: { cookie: cookieDapur },
      payload: {
        suhuMasakCcpCelsius: 87.5,
        catatanKoki: "Suhu inti masakan terukur stabil 87.5 C selama 10 menit.",
        jumlahPorsiRealisasi: 15,
      },
    });
    assert.equal(resCcp.statusCode, 200);
    const batchCcp = resCcp.json<ResponsSuksesApi<ItemBatchProduksiDto>>().data;
    assert.equal(batchCcp.suhuMasakCcpCelsius, 87.5);
    assert.equal(batchCcp.status, "selesai_masak");
    assert.ok(batchCcp.waktuSelesaiMasak !== null);

    await app.close();
  });

  it("5. melakukan pemeriksaan mutu akhir organoleptik/suhu saji: lolos vs ditahan gagal mutu (AB-019, AB-022)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    // Kasus 1: QC lolos pada batch-sintetis-002
    const resQcLolos = await app.inject({
      method: "POST",
      url: "/v1/kitchen/quality-inspections",
      headers: { cookie: cookieDapur },
      payload: {
        batchProduksiId: "batch-sintetis-002",
        suhuSajiCelsius: 65.0,
        ujiTekstur: "sesuai",
        ujiAroma: "normal_segar",
        ujiRasa: "sesuai_standar",
        ujiTampilanVisual: "bersih_menarik",
        statusMutu: "lolos_pemeriksaan",
        catatanPemeriksaan: "Nasi tim lunak pulen harum, suhu saji hangat 65 C, lolos uji organoleptik.",
      },
    });
    assert.equal(resQcLolos.statusCode, 200);
    const qcLolos = resQcLolos.json<ResponsSuksesApi<ItemPemeriksaanMutuProduksiDto>>().data;
    assert.equal(qcLolos.statusMutu, "lolos_pemeriksaan");

    // Kasus 2: Buat batch baru lalu uji QC gagal (ditahan_gagal_mutu)
    const resBatchBaru = await app.inject({
      method: "POST",
      url: "/v1/kitchen/batches",
      headers: { cookie: cookieDapur },
      payload: {
        rencanaProduksiId: "rp-sintetis-001",
        resepId: "rsp-003",
        namaMasakan: "Sayur Bening Bayam Jagung",
        sesiMakan: "siang",
        jumlahPorsiTarget: 20,
        chefPenanggungJawab: "Chef Agus",
        lotBahanDigunakan: [
          {
            bahanId: "bhn-008",
            namaBahan: "Wortel Segar Super",
            nomorLot: "LOT-20261109-005",
            jumlahDigunakan: 1.0,
            satuan: "kg",
          },
        ],
      },
    });
    const batchGagal = resBatchBaru.json<ResponsSuksesApi<ItemBatchProduksiDto>>().data;

    const resQcGagal = await app.inject({
      method: "POST",
      url: "/v1/kitchen/quality-inspections",
      headers: { cookie: cookieDapur },
      payload: {
        batchProduksiId: batchGagal.id,
        suhuSajiCelsius: 48.0, // Terlalu dingin
        ujiTekstur: "tidak_sesuai",
        ujiAroma: "menyimpang",
        ujiRasa: "tidak_sesuai",
        ujiTampilanVisual: "kurang_baik",
        statusMutu: "ditahan_gagal_mutu",
        catatanPemeriksaan: "Sayur layu kehitaman overcooked, suhu saji dingin < 50 C, aroma kurang sedap.",
      },
    });
    assert.equal(resQcGagal.statusCode, 200);
    const qcGagal = resQcGagal.json<ResponsSuksesApi<ItemPemeriksaanMutuProduksiDto>>().data;
    assert.equal(qcGagal.statusMutu, "ditahan_gagal_mutu");

    // Verifikasi status batch berubah menjadi gagal_qc
    const resCekBatch = await app.inject({
      method: "GET",
      url: "/v1/kitchen/batches",
      headers: { cookie: cookieDapur },
    });
    const daftarBatch = resCekBatch.json<ResponsSuksesApi<{ items: ItemBatchProduksiDto[] }>>().data.items;
    const batchTerkait = daftarBatch.find((b: ItemBatchProduksiDto) => b.id === batchGagal.id)!;
    assert.equal(batchTerkait.status, "gagal_qc", "Status batch harus menjadi gagal_qc saat QC gagal");

    await app.close();
  });

  it("6. menolak pemorsian / penyiapan distribusi untuk batch yang gagal mutu (AB-019, AB-022 fail-closed 422)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    // Buat batch dan tandai gagal QC
    const resBatchBaru = await app.inject({
      method: "POST",
      url: "/v1/kitchen/batches",
      headers: { cookie: cookieDapur },
      payload: {
        rencanaProduksiId: "rp-sintetis-001",
        resepId: "rsp-004",
        namaMasakan: "Ikan Kukus Jahe",
        sesiMakan: "siang",
        jumlahPorsiTarget: 10,
        chefPenanggungJawab: "Chef Agus",
        lotBahanDigunakan: [
          {
            bahanId: "bhn-001",
            namaBahan: "Beras Putih Premium",
            nomorLot: "LOT-20261109-001",
            jumlahDigunakan: 1.0,
            satuan: "kg",
          },
        ],
      },
    });
    const batchGagal = resBatchBaru.json<ResponsSuksesApi<ItemBatchProduksiDto>>().data;

    await app.inject({
      method: "POST",
      url: "/v1/kitchen/quality-inspections",
      headers: { cookie: cookieDapur },
      payload: {
        batchProduksiId: batchGagal.id,
        suhuSajiCelsius: 50.0,
        ujiTekstur: "tidak_sesuai",
        ujiAroma: "menyimpang",
        ujiRasa: "tidak_sesuai",
        ujiTampilanVisual: "kurang_baik",
        statusMutu: "ditahan_gagal_mutu",
        catatanPemeriksaan: "Ikan amis tidak segar, tidak lolos uji organoleptik.",
      },
    });

    // Coba siapkan porsi menggunakan batch gagal -> Wajib ditolak HTTP 422 (AB-022)
    const resSiapkanGagal = await app.inject({
      method: "POST",
      url: "/v1/kitchen/portion-labels/lbl-sintetis-002/ready",
      headers: { cookie: cookieDapur },
      payload: {
        batchProduksiId: batchGagal.id,
      },
    });
    assert.equal(resSiapkanGagal.statusCode, 422, "AB-022: Makanan gagal mutu dilarang diporsikan");
    const bodyGagal = resSiapkanGagal.json<ResponsApi<never>>();
    assert.equal(bodyGagal.sukses, false);
    assert.match(bodyGagal.galat.pesan, /GAGAL PEMERIKSAAN MUTU/i);

    await app.close();
  });

  it("7. menahan pesanan akibat perubahan diet klinis (AB-010, AB-013) & menolak distribusi saat ditahan (422)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    // lbl-sintetis-003 berstatus 'ditahan_perubahan_klinis' di seed
    // Percobaan distribusi harus ditolak HTTP 422
    const resTolakDistribusi = await app.inject({
      method: "POST",
      url: "/v1/kitchen/portion-labels/lbl-sintetis-003/ready",
      headers: { cookie: cookieDapur },
      payload: {
        batchProduksiId: "batch-sintetis-001",
      },
    });
    assert.equal(resTolakDistribusi.statusCode, 422);
    const bodyTolak = resTolakDistribusi.json<ResponsApi<never>>();
    assert.equal(bodyTolak.sukses, false);
    assert.match(bodyTolak.galat.pesan, /DITAHAN PERUBAHAN KLINIS/i);

    // Lepas penahanan setelah diet aman diverifikasi
    const resLepas = await app.inject({
      method: "POST",
      url: "/v1/kitchen/portion-labels/lbl-sintetis-003/release",
      headers: { cookie: cookieDapur },
    });
    assert.equal(resLepas.statusCode, 200);
    const labelLepas = resLepas.json<ResponsSuksesApi<ItemLabelPorsiPasienDto>>().data;
    assert.equal(labelLepas.statusPorsi, "siap_kemas");

    // Sekarang dapat disiapkan untuk distribusi
    const resSiap = await app.inject({
      method: "POST",
      url: "/v1/kitchen/portion-labels/lbl-sintetis-003/ready",
      headers: { cookie: cookieDapur },
      payload: {
        batchProduksiId: "batch-sintetis-001",
        suhuKemasanCelsius: 62.5,
      },
    });
    assert.equal(resSiap.statusCode, 200);
    const labelSiap = resSiap.json<ResponsSuksesApi<ItemLabelPorsiPasienDto>>().data;
    assert.equal(labelSiap.statusPorsi, "siap_distribusi");

    await app.close();
  });

  it("8. menelusuri ketertelusuran lot bahan baku gudang ke batch dan porsi pasien (Recall Traceability BRD 8.6)", async () => {
    const { app } = await bangunAplikasiKitchen({ env: { NODE_ENV: "test" } });

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        namaPengguna: "petugas.dapur",
        kataSandi: KATA_SANDI_UJI_SINTETIS,
      },
    });
    const cookieDapur = loginRes.headers["set-cookie"] as string;

    // Telusuri LOT-20261109-002 (Dada Ayam Fillet Segar)
    const resTrace = await app.inject({
      method: "GET",
      url: "/v1/kitchen/traceability/lots/LOT-20261109-002",
      headers: { cookie: cookieDapur },
    });
    assert.equal(resTrace.statusCode, 200);
    const trace = resTrace.json<ResponsSuksesApi<{
      nomorLot: string;
      batchTerdampak: ItemBatchProduksiDto[];
      porsiTerdampak: ItemLabelPorsiPasienDto[];
    }>>().data;

    assert.equal(trace.nomorLot, "LOT-20261109-002");
    assert.ok(trace.batchTerdampak.length > 0, "Harus menemukan batch masak terkait");
    assert.equal(trace.batchTerdampak[0].nomorBatch, "BATCH-20261110-SIANG-01");
    assert.ok(trace.porsiTerdampak.length > 0, "Harus menemukan pasien terdampak yang mengonsumsi");

    await app.close();
  });

  it("9. memvalidasi berkas migrasi SQL 001_tahap_8_kitchen.sql", async () => {
    const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
    const pathSql = path.resolve(dirSaatIni, "../database/migrations/001_tahap_8_kitchen.sql");
    const isiSql = await readFile(pathSql, "utf8");
    const pernyataan = pisahkanPernyataanSql(isiSql);

    assert.equal(
      pernyataan.length,
      5,
      "Migrasi Tahap 8 harus berisi tepat 5 pernyataan DDL (rencana, batch, lot_use, qc, label)",
    );
    assert.ok(isiSql.includes("rencana_produksi_h1"));
    assert.ok(isiSql.includes("batch_produksi_dapur"));
    assert.ok(isiSql.includes("penggunaan_lot_bahan_batch"));
    assert.ok(isiSql.includes("pemeriksaan_mutu_produksi"));
    assert.ok(isiSql.includes("label_porsi_makanan"));
  });
});

