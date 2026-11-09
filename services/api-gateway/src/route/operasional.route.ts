import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { BENTUK_MAKANAN, JADWAL_MAKAN_MENU, KATEGORI_MENU, KODE_GALAT, type JenisUnitPelapor, type PeranPengguna } from "../../../../packages/shared-types/src/index.ts";
import { buatPreHandlerWajibAutentikasi, buatResponsSukses } from "../../../identity-service/src/middleware/security.middleware.ts";
import { AppError, buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import { validasiSkemaMasukan } from "../../../identity-service/src/validators/identity.validator.ts";
import type { bangunAplikasiIdentity } from "../../../identity-service/src/app.ts";
import type { IncidentRepository } from "../../../incident-audit-service/src/repository/incident.repository.ts";
import type { AlurGiziService, RepositoriAlurGizi } from "../services/alur-gizi.service.ts";

const tanggal = z.iso.date();
const skemaResep = z.object({
  kodeMenu: z.string().trim().min(2).max(32), namaMenu: z.string().trim().min(3).max(160),
  kategoriMakanan: z.enum(KATEGORI_MENU), bentukMakanan: z.enum(BENTUK_MAKANAN),
  jenisDietTerkait: z.string().min(2).max(64),
  energiKkal: z.number().int().nonnegative().max(10000),
  proteinGram: z.number().nonnegative().max(1000), lemakGram: z.number().nonnegative().max(1000), karbohidratGram: z.number().nonnegative().max(1000),
  komposisiBahan: z.array(z.object({ kodeBahan: z.string().min(1), namaBahan: z.string().min(1), jumlah: z.number().positive().max(100000), satuan: z.string().min(1).max(16) })).min(1).max(100).refine((items) => new Set(items.map((item) => item.kodeBahan.trim().toLowerCase())).size === items.length, "Bahan resep tidak boleh berulang."),
  alergen: z.array(z.string().trim().min(1).max(80)).max(40),
});
const skemaAwal = z.object({ episodeId: z.string().min(1), menuId: z.string().min(1), tanggalPelayanan: tanggal, jadwalMakan: z.enum(JADWAL_MAKAN_MENU) });

export async function kabariKepala(identity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>, insidenId: string): Promise<void> {
  const kepala = await identity.repository.ambilDaftarPenggunaAdmin({ peran: "kepala_instalasi_gizi", aktif: true, halaman: 1, ukuranHalaman: 100 });
  for (const user of kepala.items) await identity.repository.simpanNotifikasiBaru({ id: "notif-" + randomUUID(), peristiwaId: insidenId, penerimaId: user.id, judul: "Insiden pelayanan gizi baru", ringkasan: "Laporan baru memerlukan penanggung jawab, investigasi, dan tindak lanjut.", kategori: "keselamatan", prioritas: "tinggi", statusBaca: "belum_dibaca", tautanTujuan: "/kepala-instalasi", waktuDibuat: new Date().toISOString(), waktuDibaca: null });
}

export async function daftarkanRuteOperasional(app: FastifyInstance, identity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>, repo: RepositoriAlurGizi, alur: AlurGiziService, incident: IncidentRepository): Promise<void> {
  const auth = buatPreHandlerWajibAutentikasi(identity.service, identity.env.SESSION_COOKIE_NAME);
  function profil(request: FastifyRequest, peran: PeranPengguna[]) {
    const user = request.profilSesi;
    if (!user) throw buatGalatSesiBerakhir();
    if (!peran.includes(user.peran)) throw new AppError({ kode: KODE_GALAT.AKSES_DITOLAK, statusHttp: 403, pesanPengguna: "Tindakan ini berada di luar kewenangan peran Anda." });
    return user;
  }
  async function audit(request: FastifyRequest, tindakan: string, objekId: string) {
    const user = request.profilSesi!;
    await identity.repository.simpanCatatanAudit({ id: "aud-" + randomUUID(), waktuKejadian: new Date().toISOString(), aktorPenggunaId: user.id, aktorPeran: user.peran, tindakan, objekTipe: "pelayanan_gizi", objekId, statusHasil: "berhasil", alasan: "Tindakan operasional sesuai kewenangan", correlationId: request.correlationId ?? "-", metadataTersanitasi: {} });
  }
  app.get("/v1/operasional/episodes", { preHandler: [auth] }, async (request) => {
    const user = profil(request, ["dokter", "perawat", "ahli_gizi", "kepala_instalasi_gizi"]);
    const episodes = (await repo.inpatient.ambilSemuaEpisode()).filter((e) => user.peran === "kepala_instalasi_gizi" || user.daftarBangsalId.includes(e.bangsalId));
    const items = [];
    for (const e of episodes) {
      const pasien = await repo.patient.cariPasienBerdasarkanId(e.pasienId);
      items.push({ id: e.id, nomorEpisode: e.nomorEpisode, namaPasien: pasien?.namaLengkap ?? "-", nomorRm: pasien?.nomorRekamMedis ?? "-", status: e.statusPerawatan });
    }
    return buatResponsSukses(request, { items });
  });
  app.get("/v1/operasional/recipes", { preHandler: [auth] }, async (request) => {
    profil(request, ["perawat", "ahli_gizi", "petugas_dapur", "kepala_instalasi_gizi"]);
    return buatResponsSukses(request, { items: await repo.clinical.ambilKatalogMenuResep({ aktifHanya: true }) });
  });
  app.get("/v1/operasional/ingredients", { preHandler: [auth] }, async (request) => {
    profil(request, ["ahli_gizi", "petugas_dapur", "petugas_gudang"]);
    const bahan = await repo.inventory.ambilSemuaBahan();
    return buatResponsSukses(request, { items: bahan.map((b) => ({ id: b.id, kodeBahan: b.kodeBahan, namaBahan: b.namaBahan, satuan: b.satuan, alergen: b.daftarAlergen })) });
  });
  app.post("/v1/operasional/ingredients", { preHandler: [auth] }, async (request, reply) => {
    profil(request, ["petugas_gudang"]);
    const input = validasiSkemaMasukan(z.object({
      kodeBahan: z.string().trim().min(2).max(32), namaBahan: z.string().trim().min(3).max(128),
      kategori: z.enum(["makanan_pokok", "lauk_hewani", "lauk_nabati", "sayuran", "buah", "bumbu_minyak", "khusus_enteral", "lainnya"]),
      satuan: z.enum(["kg", "gram", "liter", "ml", "butir", "bungkus", "kaleng"]),
      suhuPenyimpanan: z.enum(["suhu_ruang", "chiller_dingin", "freezer_beku"]),
      stokMinimum: z.number().nonnegative().max(100000), daftarAlergen: z.array(z.string().trim().min(1).max(80)).max(40),
      kaloriPer100g: z.number().nonnegative().max(1000), proteinPer100g: z.number().nonnegative().max(100), lemakPer100g: z.number().nonnegative().max(100), karbohidratPer100g: z.number().nonnegative().max(100),
    }), request.body);
    if (await repo.inventory.ambilBahanBerdasarkanKode(input.kodeBahan)) throw new AppError({ kode: KODE_GALAT.KONFLIK_BISNIS, statusHttp: 409, pesanPengguna: "Kode bahan sudah digunakan." });
    const now = new Date().toISOString(), id = "bhn-" + randomUUID();
    await repo.inventory.simpanBahan({ ...input, id, stokFisik: 0, stokLayak: 0, stokDialokasikan: 0, stokDitahan: 0, versi: 1, dibuatPada: now, diperbaruiPada: now });
    await audit(request, "BUAT_MASTER_BAHAN", id);
    reply.code(201);
    return buatResponsSukses(request, { id });
  });
  app.get("/v1/operasional/issued-lots", { preHandler: [auth] }, async (request) => {
    profil(request, ["petugas_dapur"]);
    const requests = await repo.inventory.ambilSemuaPermintaan({ status: "dikeluarkan" });
    const lots = new Map<string, { bahanId: string; namaBahan: string; nomorLot: string; satuan: string; jumlahTersedia: number }>();
    for (const item of requests.flatMap((r) => r.daftarItem)) {
      for (const lot of item.lotDialokasikan ?? []) {
        const value = lots.get(lot.nomorLot) ?? { bahanId: item.bahanId, namaBahan: item.namaBahan, nomorLot: lot.nomorLot, satuan: item.satuan, jumlahTersedia: 0 };
        value.jumlahTersedia += lot.jumlah;
        lots.set(lot.nomorLot, value);
      }
    }
    for (const lot of lots.values()) {
      const used = await repo.kitchen.ambilBatchBerdasarkanNomorLot(lot.nomorLot);
      lot.jumlahTersedia = Number((lot.jumlahTersedia - used.reduce((n, p) => n + p.jumlahDigunakan, 0)).toFixed(4));
    }
    return buatResponsSukses(request, { items: [...lots.values()].filter((l) => l.jumlahTersedia > 0) });
  });
  app.post("/v1/operasional/recipes", { preHandler: [auth] }, async (request, reply) => {
    profil(request, ["ahli_gizi"]);
    const input = validasiSkemaMasukan(skemaResep, request.body);
    if ((await repo.clinical.ambilKatalogMenuResep()).some((m) => m.kodeMenu === input.kodeMenu)) throw new AppError({ kode: KODE_GALAT.KONFLIK_BISNIS, statusHttp: 409, pesanPengguna: "Kode resep sudah digunakan. Gunakan kode baru untuk versi resep berikutnya." });
    for (const item of input.komposisiBahan) {
      const bahan = await repo.inventory.ambilBahanBerdasarkanKode(item.kodeBahan);
      if (!bahan) throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Bahan resep harus tersedia pada master gudang." });
      if (bahan.daftarAlergen.some((a) => !input.alergen.some((v) => v.toLowerCase() === a.toLowerCase()))) throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Seluruh alergen bahan wajib dicantumkan pada resep." });
    }
    const id = "menu-" + randomUUID();
    await repo.clinical.simpanMenuResep({ ...input, id, aktif: true, dibuatPada: new Date().toISOString() });
    await audit(request, "BUAT_RESEP_BARU", id);
    reply.code(201);
    return buatResponsSukses(request, { id });
  });
  app.post("/v1/operasional/initial-meals", { preHandler: [auth] }, async (request) => {
    const user = profil(request, ["perawat"]);
    const input = validasiSkemaMasukan(skemaAwal, request.body);
    const episode = await repo.inpatient.ambilEpisodeBerdasarkanId(input.episodeId);
    if (!episode || !user.daftarBangsalId.includes(episode.bangsalId)) throw new AppError({ kode: KODE_GALAT.AKSES_DITOLAK, statusHttp: 403, pesanPengguna: "Episode berada di luar bangsal penugasan." });
    const diet = await repo.clinical.ambilInstruksiDietAktif(episode.pasienId);
    const resep = await repo.clinical.ambilMenuResepBerdasarkanId(input.menuId);
    const pasien = await repo.patient.cariPasienBerdasarkanId(episode.pasienId);
    const aliasDiet: Record<string, string> = { diet_biasa: "makanan_biasa", diet_lunak: "makanan_lunak", diet_diabetes: "diabetes_melitus" };
    if (!diet || !resep || !pasien || (aliasDiet[resep.jenisDietTerkait] ?? resep.jenisDietTerkait.replace(/^diet_/, "")) !== diet.jenisDiet) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Menu awal harus sesuai jenis diet dokter. Minta ahli gizi menyiapkan resep yang sesuai." });
    const existing = (await repo.clinical.ambilDaftarRencanaMenuIndividual({ episodeId: episode.id, tanggalPelayanan: input.tanggalPelayanan })).find((m) => m.menuId === resep.id && m.jadwalMakan === input.jadwalMakan && m.instruksiDietId === diet.id);
    const now = new Date().toISOString();
    const menu = existing ?? { id: "rmi-" + randomUUID(), episodeId: episode.id, pasienId: pasien.id, nomorRekamMedis: pasien.nomorRekamMedis, namaPasien: pasien.namaLengkap, asuhanGiziId: "diet-awal", instruksiDietId: diet.id, tanggalPelayanan: input.tanggalPelayanan, jadwalMakan: input.jadwalMakan, menuId: resep.id, namaMenu: resep.namaMenu, bentukMakanan: resep.bentukMakanan, porsi: 1, energiKkal: resep.energiKkal, proteinGram: resep.proteinGram, lemakGram: resep.lemakGram, karbohidratGram: resep.karbohidratGram, statusKesesuaian: "sesuai" as const, alasanTidakSesuai: null, statusPengesahan: "disahkan" as const, disahkanOleh: user.id, disahkanPada: now, catatanKhusus: "Pesanan diet awal berdasarkan instruksi dokter dan verifikasi keamanan perawat.", versi: 1, dibuatPada: now, diperbaruiPada: now };
    await alur.periksaMenu(menu);
    if (!existing) await repo.clinical.simpanRencanaMenuIndividual(menu);
    await alur.buatPesanan(menu, user);
    await audit(request, "PROSES_DIET_AWAL", menu.id);
    return buatResponsSukses(request, { id: menu.id, pesan: "Pesanan awal tersedia di daftar dapur." });
  });
  app.post("/v1/operasional/material-requests", { preHandler: [auth] }, async (request) => {
    const user = profil(request, ["petugas_dapur"]);
    const { rencanaId } = validasiSkemaMasukan(z.object({ rencanaId: z.string().min(1) }), request.body);
    const rencana = await repo.kitchen.ambilRencanaProduksiBerdasarkanId(rencanaId);
    if (!rencana || rencana.status !== "disetujui") throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Pilih rencana produksi yang telah disetujui." });
    const id = "req-" + rencanaId;
    const existing = await repo.inventory.ambilPermintaanBerdasarkanId(id);
    if (existing) return buatResponsSukses(request, { id: existing.id });
    const kalkulasi = await alur.hitungRencana(rencana);
    if (!kalkulasi.kebutuhanBahan.length) throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Belum ada kebutuhan bahan dari pesanan yang sah." });
    const daftarItem = await Promise.all(kalkulasi.kebutuhanBahan.map(async (item) => {
      const bahan = await repo.inventory.ambilBahanBerdasarkanId(item.bahanId);
      if (!bahan) throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Lengkapi master bahan sebelum mengajukan permintaan." });
      return { bahanId: bahan.id, kodeBahan: bahan.kodeBahan, namaBahan: bahan.namaBahan, jumlahDiminta: item.jumlahDibutuhkan, jumlahDialokasikan: 0, jumlahDikeluarkan: 0, satuan: bahan.satuan };
    }));
    await repo.inventory.simpanPermintaanBahan({ id, nomorPermintaan: await repo.inventory.hitungNomorPermintaanBerikutnya(), tanggalKebutuhan: rencana.tanggalPelayanan, unitPeminta: "Dapur", keterangan: "Rencana " + rencana.nomorRencana, status: "menunggu", alasanPenolakan: null, daftarItem, catatanSelisih: null, waktuPermintaan: new Date().toISOString(), waktuAlokasi: null, waktuPengeluaran: null, petugasGudangId: null, petugasGudangNama: null });
    await audit(request, "AJUKAN_BAHAN_RENCANA", id);
    return buatResponsSukses(request, { id, pemohon: user.namaLengkap });
  });
  app.get("/v1/operasional/nutrition", { preHandler: [auth] }, async (request) => {
    const user = profil(request, ["dokter", "perawat", "ahli_gizi", "kepala_instalasi_gizi"]);
    const query = validasiSkemaMasukan(z.object({ episodeId: z.string().min(1), tanggal }), request.query);
    const episode = await repo.inpatient.ambilEpisodeBerdasarkanId(query.episodeId);
    if (!episode || (user.peran !== "kepala_instalasi_gizi" && !user.daftarBangsalId.includes(episode.bangsalId))) throw new AppError({ kode: KODE_GALAT.AKSES_DITOLAK, statusHttp: 403, pesanPengguna: "Episode berada di luar kewenangan Anda." });
    const asuhan = (await repo.clinical.ambilDaftarAsuhanGizi({ episodeId: episode.id })).filter((a) => a.waktuBerlaku.slice(0, 10) <= query.tanggal).sort((a, b) => b.waktuBerlaku.localeCompare(a.waktuBerlaku))[0];
    const menus = await repo.clinical.ambilDaftarRencanaMenuIndividual({ episodeId: episode.id, tanggalPelayanan: query.tanggal, statusPengesahan: "disahkan" });
    const porsi = await repo.delivery.ambilDaftarItemPorsi({ statusSerah: "berhasil_diserahkan" });
    const observasi = [...await repo.clinical.ambilDaftarObservasiAsupan({ episodeId: episode.id, tanggal: query.tanggal })].sort((a, b) => b.diobservasiPada.localeCompare(a.diobservasiPada));
    const total = (list: typeof menus) => ({ energiKkal: list.reduce((n, m) => n + m.energiKkal, 0), proteinGram: Number(list.reduce((n, m) => n + m.proteinGram, 0).toFixed(1)) });
    const disajikan = menus.filter((m) => porsi.some((p) => p.nomorPesanan === m.id));
    let energi = 0, protein = 0, belumDicatat = 0;
    for (const menu of disajikan) {
      const serah = porsi.find((p) => p.nomorPesanan === menu.id);
      const obs = observasi.find((o) => o.jadwalMakan.replace("selingan_", "snack_") === menu.jadwalMakan && serah?.waktuSerah && new Date(o.diobservasiPada).getTime() >= new Date(serah.waktuSerah).getTime());
      if (!obs || obs.skalaComstock === "belum_diobservasi") { belumDicatat++; continue; }
      energi += menu.energiKkal * obs.persentaseKonsumsi / 100;
      protein += menu.proteinGram * obs.persentaseKonsumsi / 100;
    }
    return buatResponsSukses(request, { tanggal: query.tanggal, episodeId: episode.id, dibutuhkan: asuhan ? { energiKkal: asuhan.targetEnergiKkal, proteinGram: asuhan.targetProteinGram } : null, direncanakan: total(menus), disajikan: total(disajikan), dikonsumsi: belumDicatat || !disajikan.length ? null : { energiKkal: Math.round(energi), proteinGram: Number(protein.toFixed(1)) }, belumDicatat, porsiDisajikan: disajikan.length });
  });
  app.post("/v1/operasional/incidents", { preHandler: [auth] }, async (request, reply) => {
    const user = profil(request, ["dokter", "perawat", "ahli_gizi", "petugas_gudang", "petugas_dapur", "petugas_distribusi", "kepala_instalasi_gizi"]);
    const input = validasiSkemaMasukan(z.object({ jenisInsiden: z.string().trim().min(3).max(100), derajatKeparahan: z.enum(["rendah", "sedang", "tinggi", "kritis"]), deskripsiKejadian: z.string().trim().min(10).max(5000), tindakanAwalSegera: z.string().trim().min(5).max(5000) }), request.body);
    const unit: Partial<Record<PeranPengguna, JenisUnitPelapor>> = { dokter: "dokter", perawat: "perawat", ahli_gizi: "ahli_gizi", petugas_gudang: "gudang", petugas_dapur: "dapur", petugas_distribusi: "distribusi", kepala_instalasi_gizi: "ahli_gizi" };
    const now = new Date().toISOString(), id = "inc-" + randomUUID();
    await incident.simpanInsiden({ ...input, id, nomorInsiden: await incident.hitungNomorInsidenBerikutnya(), unitPelapor: unit[user.peran]!, tanggalKejadian: now, pasienTerdampakNama: null, nomorRmPasien: null, namaBangsal: null, statusInsiden: "dilaporkan", pelaporId: user.id, pelaporNama: user.namaLengkap, penanggungJawabId: null, penanggungJawabNama: null, waktuPenutupan: null, catatanPenutupan: null, createdAt: now, updatedAt: now });
    await kabariKepala(identity, id);
    await audit(request, "LAPORKAN_INSIDEN", id);
    reply.code(201);
    return buatResponsSukses(request, { id });
  });
}
