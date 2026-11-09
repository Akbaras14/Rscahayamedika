import { bangunAplikasiGateway } from "../app.ts";
import { InMemoryPatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { InMemoryInpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { test } from "node:test";
import { bangunAplikasiIdentity } from "../../../identity-service/src/app.ts";
import { InMemoryIdentityRepository } from "../../../identity-service/src/repository/identity.repository.ts";
import { SEED_PENGGUNA_SINTETIS, KATA_SANDI_UJI_SINTETIS } from "../../../identity-service/src/database/seeds/master.seed.ts";
import { MATRIKS_PERAN_MASTER } from "../../../../packages/contracts/src/index.ts";
import type { PeranPengguna, ProfilSesiPengguna } from "../../../../packages/shared-types/src/index.ts";
import { KitchenService } from "../../../kitchen-service/src/services/kitchen.service.ts";
import { InMemoryKitchenRepository } from "../../../kitchen-service/src/repository/kitchen.repository.ts";
import { DeliveryService } from "../../../delivery-intake-service/src/services/delivery.service.ts";
import { InMemoryDeliveryRepository } from "../../../delivery-intake-service/src/repository/delivery.repository.ts";
import { IncidentAuditService } from "../../../incident-audit-service/src/services/incident.service.ts";
import { InMemoryIncidentRepository } from "../../../incident-audit-service/src/repository/incident.repository.ts";
import { ambilGatewayAppBff } from "../../../../src/lib/server-gateway.ts";

function profil(peran: PeranPengguna): ProfilSesiPengguna {
  const akun = SEED_PENGGUNA_SINTETIS.find((u) => u.peran === peran && u.aktif)!;
  return { ...akun, labelPeran: MATRIKS_PERAN_MASTER[peran].nama, daftarIzin: [...MATRIKS_PERAN_MASTER[peran].izinDefault] };
}
const qc = { batchProduksiId: "batch-audit", suhuSajiCelsius: 65, ujiTekstur: "sesuai" as const, ujiAroma: "normal_segar" as const, ujiRasa: "sesuai_standar" as const, ujiTampilanVisual: "bersih_menarik" as const, statusMutu: "lolos_pemeriksaan" as const, catatanPemeriksaan: "Seluruh pemeriksaan akhir tercatat" };

test("kata sandi lama tidak dapat melewati hash akun yang telah diganti", async () => {
  const repository = new InMemoryIdentityRepository();
  const cari = repository.cariPenggunaBerdasarkanNamaPengguna.bind(repository);
  repository.cariPenggunaBerdasarkanNamaPengguna = async (nama) => {
    const akun = await cari(nama);
    return akun ? { ...akun, passwordHash: scryptSync("KataSandiBaruUji2026!", akun.passwordSalt, 64).toString("hex") } : null;
  };
  const { app } = await bangunAplikasiIdentity({ repository, env: { NODE_ENV: "test" } });
  try {
    const r = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { namaPengguna: "admin.fondasi", kataSandi: "FondasiHpnms2026!" } });
    assert.equal(r.statusCode, 401);
    const valid = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { namaPengguna: "admin.fondasi", kataSandi: "KataSandiBaruUji2026!" } });
    assert.equal(valid.statusCode, 200);
  } finally { await app.close(); }
});

test("BFF tetap menolak ketika database mati dan dapat mencoba koneksi lagi", async () => {
  const keys = ["NODE_ENV", "DB_HOST", "DB_PORT", "DB_CONNECT_TIMEOUT_MS"] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "development", DB_HOST: "127.0.0.1", DB_PORT: "1", DB_CONNECT_TIMEOUT_MS: "500" });
  globalThis.__hpnmsGatewayAppPromise = undefined;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(ambilGatewayAppBff().then(async (app) => { await app.close(); return app; }));
      assert.equal(globalThis.__hpnmsGatewayAppPromise, undefined);
    }
  } finally {
    globalThis.__hpnmsGatewayAppPromise = undefined;
    for (const key of keys) { if (before[key] === undefined) Reflect.deleteProperty(process.env, key); else Reflect.set(process.env, key, before[key]); }
  }
});

test("QC tidak bisa lolos sebelum penyelesaian masak dan rekaman CCP", async () => {
  const repo = new InMemoryKitchenRepository();
  const batch = (await repo.ambilDaftarBatchProduksi())[0];
  await repo.simpanBatchProduksi({ ...batch, id: "batch-audit", nomorBatch: "BATCH-AUDIT", status: "memasak", suhuMasakCcpCelsius: null, jumlahPorsiRealisasi: 0 });
  const service = new KitchenService(repo);
  await assert.rejects(service.catatPemeriksaanMutu(qc, profil("petugas_dapur")), { statusHttp: 422 });
});

test("batch menolak lot berulang dan hasil produksi yang melebihi target", async () => {
  const repo = new InMemoryKitchenRepository(); const service = new KitchenService(repo);
  const lot = { bahanId: "bhn-001", namaBahan: "Beras", nomorLot: "LOT-AUDIT", jumlahDigunakan: 1, satuan: "kg" };
  await assert.rejects(service.buatBatchProduksi({ rencanaProduksiId: "rp-sintetis-001", resepId: "resep-uji", namaMasakan: "Resep Uji", sesiMakan: "siang", jumlahPorsiTarget: 1, chefPenanggungJawab: "Chef Uji", lotBahanDigunakan: [lot, lot] }, profil("petugas_dapur")), { statusHttp: 400 });
  const batch = (await repo.ambilDaftarBatchProduksi())[0];
  await assert.rejects(service.catatCcpSuhuMasak(batch.id, { suhuMasakCcpCelsius: 85, jumlahPorsiRealisasi: batch.jumlahPorsiTarget + 1 }, profil("petugas_dapur")), { statusHttp: 422 });
});

test("dua serah terima bersamaan tidak menggandakan penyerahan", async () => {
  const repo = new InMemoryDeliveryRepository(); const service = new DeliveryService(repo);
  const item = (await repo.ambilDaftarItemPorsi()).find((p) => p.statusSerah !== "berhasil_diserahkan" && p.statusSerah !== "ditahan_klinis" && !/npo|puasa/i.test(p.dietTerkiniPasien))!;
  const petugas = { ...profil("petugas_distribusi"), daftarBangsalId: [item.bangsalId] };
  const input = { namaPasienVerifikasi: item.namaPasien, tanggalLahirVerifikasi: item.tanggalLahirPasien, metodeVerifikasi: "gelang_pasien", namaPenerima: item.namaPasien, hubunganPenerima: "pasien_sendiri" };
  const results = await Promise.allSettled([service.verifikasiDanSerahkanPorsi(petugas, item.id, input), service.verifikasiDanSerahkanPorsi(petugas, item.id, input)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await repo.ambilRiwayatPenyerahanBerdasarkanPorsiId(item.id)).length, 1);
});

test("insiden belum dapat ditutup ketika tindakan koreksi belum selesai", async () => {
  const repo = new InMemoryIncidentRepository(); const service = new IncidentAuditService(repo);
  await assert.rejects(service.tutupResmiInsiden(profil("kepala_instalasi_gizi"), "ins-001", { catatanPenutupan: "Insiden dinyatakan selesai" }), { statusHttp: 422 });
});


test("permintaan lintas situs tidak mendapat akses CORS atau mutasi", async () => {
  const { app } = await bangunAplikasiIdentity({ env: { NODE_ENV: "test" } });
  try {
    const read = await app.inject({ method: "GET", url: "/v1/health", headers: { origin: "https://asing.invalid" } });
    assert.equal(read.headers["access-control-allow-origin"], undefined);
    const write = await app.inject({ method: "POST", url: "/v1/auth/login", headers: { origin: "https://asing.invalid" }, payload: { namaPengguna: "admin.fondasi", kataSandi: "KataSandiUji2026!" } });
    assert.equal(write.statusCode, 403);
    const local = await app.inject({ method: "GET", url: "/v1/health", headers: { origin: "http://localhost:3000" } });
    assert.equal(local.headers["access-control-allow-origin"], "http://localhost:3000");
  } finally { await app.close(); }
});

test("porsi dibatalkan tidak dapat diserahkan dan label siap tidak boleh diganti batch", async () => {
  const repo = new InMemoryDeliveryRepository(); const service = new DeliveryService(repo);
  const item = (await repo.ambilDaftarItemPorsi())[0];
  await repo.perbaruiItemPorsi(item.id, { statusSerah: "dibatalkan" });
  const petugas = { ...profil("petugas_distribusi"), daftarBangsalId: [item.bangsalId] };
  await assert.rejects(service.verifikasiDanSerahkanPorsi(petugas, item.id, { namaPasienVerifikasi: item.namaPasien, tanggalLahirVerifikasi: item.tanggalLahirPasien, metodeVerifikasi: "gelang_pasien", namaPenerima: item.namaPasien, hubunganPenerima: "pasien_sendiri" }), { statusHttp: 422 });
  const kitchen = new InMemoryKitchenRepository(); const dapur = new KitchenService(kitchen);
  const label = (await kitchen.ambilDaftarLabelPorsi())[0];
  await kitchen.perbaruiStatusLabelPorsi(label.id, "siap_distribusi", { batchProduksiId: "batch-sintetis-001" });
  await assert.rejects(dapur.siapkanPorsiDistribusi(label.id, { batchProduksiId: "batch-sintetis-002" }, profil("petugas_dapur")), { statusHttp: 409 });
  await kitchen.perbaruiStatusLabelPorsi(label.id, "siap_kemas");
  const packed = await dapur.siapkanPorsiDistribusi(label.id, { batchProduksiId: "batch-sintetis-001" }, profil("petugas_dapur"));
  assert.equal(packed.suhuKemasanCelsius, null);
});

test("penutupan insiden memerlukan bukti tindakan dan mempertahankan verifikasi final", async () => {
  const repo = new InMemoryIncidentRepository(); const service = new IncidentAuditService(repo);
  const kepala = profil("kepala_instalasi_gizi");
  await assert.rejects(service.verifikasiTindakanKoreksi(kepala, "ins-001", "act-002", { buktiPenyelesaian: "Bukti pelaksanaan pemeriksaan efektif" }), { statusHttp: 404 });
  await assert.rejects(service.verifikasiTindakanKoreksi(kepala, "ins-001", "act-001", { buktiPenyelesaian: "" }), { statusHttp: 400 });
  await assert.rejects(service.verifikasiTindakanKoreksi(profil("administrator"), "ins-001", "act-001", { buktiPenyelesaian: "Bukti pelaksanaan pemeriksaan efektif" }), { statusHttp: 403 });
  const verified = await service.verifikasiTindakanKoreksi(kepala, "ins-001", "act-001", { buktiPenyelesaian: "Bukti pelaksanaan pemeriksaan efektif" });
  assert.equal(verified.statusTindakan, "selesai_efektif");
  assert.ok(verified.buktiPenyelesaian?.includes(kepala.id));
  const closed = await service.tutupResmiInsiden(kepala, "ins-001", { catatanPenutupan: "Seluruh bukti diverifikasi dan insiden selesai" });
  assert.equal(closed.statusInsiden, "selesai_ditutup");
  await assert.rejects(service.verifikasiTindakanKoreksi(kepala, "ins-001", "act-001", { buktiPenyelesaian: "Mengubah bukti yang telah terverifikasi" }), { statusHttp: 409 });
});


test("daftar 500 episode tidak memenuhi antrean koneksi database", async () => {
  const patient = new InMemoryPatientRepository(); const inpatient = new InMemoryInpatientRepository();
  const source = (await inpatient.ambilSemuaEpisode())[0];
  inpatient.ambilSemuaEpisode = async () => Array.from({ length: 500 }, (_, index) => ({ ...source, id: "audit-capacity-" + index }));
  const original = patient.cariPasienBerdasarkanId.bind(patient); let pending = 0, maximum = 0;
  patient.cariPasienBerdasarkanId = async (id) => {
    pending++; maximum = Math.max(maximum, pending);
    try { if (pending > 4) throw new Error("Antrean koneksi penuh"); await new Promise<void>((resolve) => setImmediate(resolve)); return original(id); }
    finally { pending--; }
  };
  const { app } = await bangunAplikasiGateway({ patientRepository: patient, inpatientRepository: inpatient, env: { NODE_ENV: "test" } });
  try {
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { namaPengguna: "kepala.gizi", kataSandi: KATA_SANDI_UJI_SINTETIS } });
    assert.equal(login.statusCode, 200); const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const response = await app.inject({ method: "GET", url: "/v1/operasional/episodes", headers: { cookie } });
    assert.equal(response.statusCode, 200); assert.equal(response.json().data.items.length, 500); assert.ok(maximum <= 4);
  } finally { await app.close(); }
});
