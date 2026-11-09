import { ambilRuteUtamaPeran, KATALOG_NAVIGASI_SISTEM, MATRIKS_PERAN_MASTER, saringNavigasiBerdasarkanIzin } from "../../../../packages/contracts/src/index.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { bangunAplikasiGateway } from "../app.ts";
import { InMemoryClinicalNutritionRepository } from "../../../clinical-nutrition-service/src/repository/clinical-nutrition.repository.ts";
import { InMemoryInventoryRepository } from "../../../inventory-service/src/repository/inventory.repository.ts";
import { InMemoryKitchenRepository } from "../../../kitchen-service/src/repository/kitchen.repository.ts";
import { InMemoryDeliveryRepository } from "../../../delivery-intake-service/src/repository/delivery.repository.ts";
import { KATA_SANDI_UJI_SINTETIS, SEED_PENGGUNA_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { parameterMysql } from "../../../../packages/database/src/mysql.ts";
import type { PeranPengguna } from "../../../../packages/shared-types/src/index.ts";
import { AlurGiziService } from "../services/alur-gizi.service.ts";
import { InMemoryPatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { InMemoryInpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import { SEED_PASIEN_SINTETIS } from "../../../patient-service/src/database/seeds/patient.seed.ts";
import { SEED_EPISODE_RAWAT_INAP_SINTETIS } from "../../../patient-service/src/database/seeds/inpatient.seed.ts";
import { SEED_VERIFIKASI_KEAMANAN_SINTETIS } from "../../../clinical-nutrition-service/src/database/seeds/nursing.seed.ts";
import { SEED_INSTRUKSI_DIET_SINTETIS } from "../../../clinical-nutrition-service/src/database/seeds/clinical-nutrition.seed.ts";
import { SEED_RENCANA_MENU_INDIVIDUAL, SEED_KATALOG_MENU_RESEP } from "../../../clinical-nutrition-service/src/database/seeds/dietitian.seed.ts";

test("parameter waktu MySQL tidak mengubah DATE, JSON, atau angka", () => {
  assert.deepEqual(parameterMysql(["2026-11-08T08:00:00.000Z", "2026-11-08", '{"waktu":"2026-11-08T08:00:00.000Z"}', 0, null]), ["2026-11-08 08:00:00.000", "2026-11-08", '{"waktu":"2026-11-08T08:00:00.000Z"}', 0, null]);
  assert.throws(() => parameterMysql([undefined]), TypeError);
});

test("simulasi 500 pesanan individual menghitung bahan resep tanpa mengurangi stok", async () => {
  const clinical = new InMemoryClinicalNutritionRepository(), inventory = new InMemoryInventoryRepository();
  const kitchen = new InMemoryKitchenRepository(), delivery = new InMemoryDeliveryRepository();
  const patient = new InMemoryPatientRepository(), inpatient = new InMemoryInpatientRepository();
  const alur = new AlurGiziService({ clinical, inventory, kitchen, delivery, patient, inpatient });
  const tanggal = "2099-01-02";
  await clinical.simpanMenuResep({ ...SEED_KATALOG_MENU_RESEP[1], id: "menu-volume", komposisiBahan: [{ kodeBahan: "BHN-BERAS-01", namaBahan: "Beras", jumlah: 100, satuan: "gram" }] });
  for (let n = 0; n < 500; n++) {
    const pasienId = "volume-pasien-" + n, episodeId = "volume-episode-" + n, dietId = "volume-diet-" + n;
    await patient.simpanPasienBaru({ ...SEED_PASIEN_SINTETIS[0], id: pasienId, nomorRekamMedis: "VOLUME-" + n, nomorIdentitasNasional: null });
    await inpatient.simpanEpisodeRawatInap({ ...SEED_EPISODE_RAWAT_INAP_SINTETIS[1], id: episodeId, pasienId, tempatTidurId: "volume-bed-" + n });
    await clinical.simpanInstruksiDiet({ ...SEED_INSTRUKSI_DIET_SINTETIS[0], id: dietId, pasienId });
    await clinical.simpanVerifikasiKeamananMakanan({ ...SEED_VERIFIKASI_KEAMANAN_SINTETIS[0], id: "volume-verifikasi-" + n, episodeId, pasienId, instruksiDietId: dietId });
    await clinical.simpanRencanaMenuIndividual({ ...SEED_RENCANA_MENU_INDIVIDUAL[0], id: "volume-menu-" + n, episodeId, pasienId, instruksiDietId: dietId, menuId: "menu-volume", tanggalPelayanan: tanggal, jadwalMakan: "siang", bentukMakanan: "lunak", porsi: 1, statusKesesuaian: "sesuai", statusPengesahan: "disahkan" });
  }
  const sebelum = (await inventory.ambilBahanBerdasarkanId("bhn-001"))!.stokFisik;
  const hasil = await alur.hitungRencana({ id: "rencana-volume", nomorRencana: "RP-VOLUME", tanggalPelayanan: tanggal, sesiMakan: "siang", status: "draft", totalEstimasiPorsi: 0, catatan: "Simulasi kalkulasi 500 pesanan sah", penanggungJawabId: "petugas", penanggungJawabNama: "Petugas Uji", waktuDibuat: new Date().toISOString(), waktuDisetujui: null, versi: 1 });
  assert.equal(hasil.total, 500);
  assert.equal(hasil.kebutuhanBahan[0].jumlahDibutuhkan, 50);
  assert.equal((await inventory.ambilBahanBerdasarkanId("bhn-001"))!.stokFisik, sebelum);
});

test("diet awal sampai konsumsi: idempotensi, stok aktual, QC, dua identitas, empat tahap, dan NPO", async () => {
  const clinical = new InMemoryClinicalNutritionRepository(), inventory = new InMemoryInventoryRepository();
  const kitchen = new InMemoryKitchenRepository(), delivery = new InMemoryDeliveryRepository();
  for (const menu of await clinical.ambilDaftarRencanaMenuIndividual()) await clinical.perbaruiStatusPengesahanMenu(menu.id, "draf", "fixture", new Date().toISOString());
  const { app } = await bangunAplikasiGateway({ env: { NODE_ENV: "test", LOG_LEVEL: "silent", RATE_LIMIT_MAX_GLOBAL: 1000, RATE_LIMIT_MAX_LOGIN: 50 }, clinicalRepository: clinical, inventoryRepository: inventory, kitchenRepository: kitchen, deliveryRepository: delivery });
  const cookies = new Map<PeranPengguna, string>();
  const hari = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  async function request(peran: PeranPengguna, method: "GET" | "POST", url: string, payload?: object) {
    if (!cookies.has(peran)) {
      const akun = SEED_PENGGUNA_SINTETIS.find((a) => a.peran === peran && a.aktif && (!["perawat", "petugas_distribusi"].includes(peran) || a.daftarBangsalId.includes("BANGSAL-ANGGREK")))!;
      const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { namaPengguna: akun.namaPengguna, kataSandi: KATA_SANDI_UJI_SINTETIS } });
      assert.equal(login.statusCode, 200);
      const header = login.headers["set-cookie"];
      cookies.set(peran, (Array.isArray(header) ? header[0] : String(header)).split(";")[0]);
    }
    return app.inject({ method, url, headers: { cookie: cookies.get(peran)! }, ...(payload ? { payload } : {}) });
  }
  async function sukses(peran: PeranPengguna, method: "GET" | "POST", url: string, payload?: object) {
    const response = await request(peran, method, url, payload);
    assert.ok(response.statusCode >= 200 && response.statusCode < 300, url + ": " + response.body);
    return response.json().data;
  }
  try {
    const resep = { kodeMenu: "UJI-DM-LUNAK", namaMenu: "Nasi Tim Uji", kategoriMakanan: "makanan_pokok", bentukMakanan: "lunak", jenisDietTerkait: "diabetes_melitus", energiKkal: 200, proteinGram: 5, lemakGram: 2, karbohidratGram: 40, komposisiBahan: [{ kodeBahan: "BHN-BERAS-01", namaBahan: "Beras", jumlah: 100, satuan: "gram" }], alergen: [] };
    const dibuat = await sukses("ahli_gizi", "POST", "/v1/operasional/recipes", resep);
    const awal = { episodeId: "ep-sintetis-002", menuId: dibuat.id, tanggalPelayanan: hari, jadwalMakan: "siang" };
    const pesanan = await sukses("perawat", "POST", "/v1/operasional/initial-meals", awal);
    const ulang = await sukses("perawat", "POST", "/v1/operasional/initial-meals", awal);
    assert.equal(ulang.id, pesanan.id);
    assert.equal((await kitchen.ambilDaftarLabelPorsi()).filter((p) => p.nomorPesanan === pesanan.id).length, 1);
    const observasi = { episodeId: "ep-sintetis-002", tanggalMakan: hari, jadwalMakan: "siang", skalaComstock: "skala_0", kondisiPemberian: "tidak_dikonsumsi", alasanTidakHabis: "mual_muntah" };
    assert.equal((await request("perawat", "POST", "/v1/nursing/intake-observations", observasi)).statusCode, 422);
    const stokAwal = (await inventory.ambilBahanBerdasarkanId("bhn-001"))!.stokFisik;
    const plan = await sukses("petugas_dapur", "POST", "/v1/kitchen/production-plans", { tanggalPelayanan: hari, sesiMakan: "siang", jenisRencana: "mendadak", catatan: "Pesanan mendadak lokal yang telah diverifikasi" });
    assert.equal(plan.totalEstimasiPorsi, 1);
    assert.equal(plan.kebutuhanBahan[0].jumlahDibutuhkan, 0.1);
    assert.equal((await inventory.ambilBahanBerdasarkanId("bhn-001"))!.stokFisik, stokAwal);
    await sukses("petugas_dapur", "POST", "/v1/kitchen/production-plans/" + plan.id + "/approve");
    const req = await sukses("petugas_dapur", "POST", "/v1/operasional/material-requests", { rencanaId: plan.id });
    await sukses("petugas_gudang", "POST", "/v1/inventory/requests/" + req.id + "/allocate");
    assert.equal((await inventory.ambilBahanBerdasarkanId("bhn-001"))!.stokFisik, stokAwal);
    const keluar = await sukses("petugas_gudang", "POST", "/v1/inventory/requests/" + req.id + "/dispatch", { catatanPengeluaran: "Bahan diterima dapur sesuai permintaan" });
    assert.equal((await inventory.ambilBahanBerdasarkanId("bhn-001"))!.stokFisik, Number((stokAwal - 0.1).toFixed(2)));
    const lot = keluar.daftarItem[0].lotDialokasikan[0];
    const batch = await sukses("petugas_dapur", "POST", "/v1/kitchen/batches", { rencanaProduksiId: plan.id, resepId: dibuat.id, namaMasakan: resep.namaMenu, sesiMakan: "siang", jumlahPorsiTarget: 1, chefPenanggungJawab: "Petugas Uji", lotBahanDigunakan: [{ bahanId: "bhn-001", namaBahan: "Beras", nomorLot: lot.nomorLot, jumlahDigunakan: 0.1, satuan: "kg" }] });
    const labelId = "lbl-" + pesanan.id;
    assert.equal((await request("petugas_dapur", "POST", "/v1/kitchen/portion-labels/" + labelId + "/ready", { batchProduksiId: batch.id })).statusCode, 422);
    await sukses("petugas_dapur", "POST", "/v1/kitchen/batches/" + batch.id + "/ccp-temp", { suhuMasakCcpCelsius: 85, jumlahPorsiRealisasi: 1 });
    await sukses("petugas_dapur", "POST", "/v1/kitchen/quality-inspections", { batchProduksiId: batch.id, suhuSajiCelsius: 65, ujiTekstur: "sesuai", ujiAroma: "normal_segar", ujiRasa: "sesuai_standar", ujiTampilanVisual: "bersih_menarik", statusMutu: "lolos_pemeriksaan", catatanPemeriksaan: "Seluruh pemeriksaan akhir sesuai" });
    await sukses("petugas_dapur", "POST", "/v1/kitchen/portion-labels/" + labelId + "/ready", { batchProduksiId: batch.id, suhuKemasanCelsius: 65 });
    const porsi = await delivery.ambilItemPorsiBerdasarkanLabelId(labelId);
    assert.ok(porsi);
    const serah = { namaPasienVerifikasi: porsi.namaPasien, tanggalLahirVerifikasi: porsi.tanggalLahirPasien, metodeVerifikasi: "gelang_pasien", namaPenerima: porsi.namaPasien, hubunganPenerima: "pasien_sendiri" };
    const wrong = await request("petugas_distribusi", "POST", "/v1/delivery-intake/items/" + porsi.id + "/verify-and-handover", { ...serah, namaPasienVerifikasi: "Pasien Salah" });
    assert.equal(wrong.statusCode, 422);
    await sukses("petugas_distribusi", "POST", "/v1/delivery-intake/items/" + porsi.id + "/verify-and-handover", serah);
    const reportUrl = "/v1/operasional/nutrition?episodeId=ep-sintetis-002&tanggal=" + hari;
    const belum = await sukses("perawat", "GET", reportUrl);
    assert.equal(belum.disajikan.energiKkal, 200);
    assert.equal(belum.dikonsumsi, null);
    await sukses("perawat", "POST", "/v1/nursing/intake-observations", observasi);
    assert.equal((await sukses("perawat", "GET", reportUrl)).dikonsumsi.energiKkal, 0);
    const malam = await sukses("perawat", "POST", "/v1/operasional/initial-meals", { ...awal, jadwalMakan: "malam" });
    const diet = (await clinical.ambilInstruksiDietAktif("psn-sintetis-001"))!;
    const revisi = await clinical.perbaruiVersiInstruksiDiet(diet.id, { ...diet, id: "diet-npo-uji", statusPuasaNpo: true, versi: diet.versi + 1 }, { id: "riwayat-npo-uji", instruksiDietId: diet.id, pasienId: diet.pasienId, versi: diet.versi, snapshotData: diet, alasanPerubahan: "Puasa medis saat pelayanan", diubahOlehId: "dokter-uji", diubahOlehNama: "Dokter Uji", diubahPada: new Date().toISOString() });
    assert.equal(revisi.berhasil, true);
    await sukses("petugas_dapur", "GET", "/v1/kitchen/portion-labels");
    assert.equal((await kitchen.ambilLabelPorsiBerdasarkanId("lbl-" + malam.id))!.statusPorsi, "ditahan_perubahan_klinis");
    const bangsal = await sukses("perawat", "GET", "/v1/nursing/patients?bangsalId=BANGSAL-ANGGREK");
    assert.equal(bangsal.items.find((p: { pasienId: string }) => p.pasienId === "psn-sintetis-001").statusVerifikasiKeamanan, "ditahan_safety_hold");
    assert.equal((await delivery.ambilItemPorsiBerdasarkanId(porsi.id))!.statusSerah, "berhasil_diserahkan");
    assert.equal((await request("administrator", "GET", "/v1/kitchen/production-plans")).statusCode, 403);
    assert.equal((await request("administrator", "GET", reportUrl)).statusCode, 403);
  } finally { await app.close(); }
});


test("navigasi final memakai halaman peran tanpa konsol fondasi", () => {
  for (const peran of Object.keys(MATRIKS_PERAN_MASTER) as PeranPengguna[]) {
    const rute = ambilRuteUtamaPeran(peran);
    assert.doesNotMatch(rute, /tahap|fondasi/);
    assert.ok(saringNavigasiBerdasarkanIzin(MATRIKS_PERAN_MASTER[peran].izinDefault).some((item) => item.href === rute));
  }
  assert.ok(KATALOG_NAVIGASI_SISTEM.every((item) => item.href !== "/" && !/tahap|fondasi/i.test(item.label + item.href)));
});
