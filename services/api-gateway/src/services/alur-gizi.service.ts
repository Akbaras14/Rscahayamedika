import { KODE_GALAT, type ItemKebutuhanBahanKalkulasiDto, type ProfilSesiPengguna } from "../../../../packages/shared-types/src/index.ts";
import type { ClinicalNutritionRepository } from "../../../clinical-nutrition-service/src/repository/clinical-nutrition.repository.ts";
import type { EntitasRencanaMenuIndividual } from "../../../clinical-nutrition-service/src/model/dietitian.model.ts";
import type { DeliveryRepository } from "../../../delivery-intake-service/src/repository/delivery.repository.ts";
import type { ItemPorsiDistribusiEntitas } from "../../../delivery-intake-service/src/model/delivery.model.ts";
import type { InventoryRepository } from "../../../inventory-service/src/repository/inventory.repository.ts";
import type { KitchenRepository } from "../../../kitchen-service/src/repository/kitchen.repository.ts";
import type { EntitasLabelPorsi, EntitasRencanaProduksi, InputBatchProduksiBaru } from "../../../kitchen-service/src/model/kitchen.model.ts";
import type { InpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import type { PatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";

export interface RepositoriAlurGizi {
  clinical: ClinicalNutritionRepository;
  kitchen: KitchenRepository;
  inventory: InventoryRepository;
  delivery: DeliveryRepository;
  inpatient: InpatientRepository;
  patient: PatientRepository;
}

function tahan(pesan: string): never {
  throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: pesan });
}

/** Menghubungkan pesanan individual dengan produksi, penyerahan, dan konsumsi lokal. */
export class AlurGiziService {
  private readonly repo: RepositoriAlurGizi;
  constructor(repo: RepositoriAlurGizi) { this.repo = repo; }

  async periksaMenu(menu: EntitasRencanaMenuIndividual) {
    const episode = await this.repo.inpatient.ambilEpisodeBerdasarkanId(menu.episodeId);
    const diet = await this.repo.clinical.ambilInstruksiDietAktif(menu.pasienId);
    if (!episode || episode.statusPerawatan !== "aktif" || episode.pasienId !== menu.pasienId) tahan("Episode perawatan tidak aktif. Pesanan makanan dihentikan.");
    if (!diet || diet.id !== menu.instruksiDietId || diet.statusInstruksi !== "aktif") tahan("Instruksi diet berubah atau belum sah. Tinjau kembali menu individual.");
    const sekarang = Date.now();
    if (Date.parse(diet.berlakuSejak) > sekarang || (diet.berlakuHingga && Date.parse(diet.berlakuHingga) <= sekarang)) tahan("Instruksi diet belum berlaku atau telah berakhir.");
    if (diet.statusPuasaNpo || diet.rutePemberian !== "oral") tahan("Instruksi melarang pemberian makanan melalui mulut.");
    if (menu.bentukMakanan !== diet.bentukMakanan || menu.statusKesesuaian !== "sesuai") tahan("Menu tidak sesuai tekstur atau pembatasan pasien.");
    const resep = await this.repo.clinical.ambilMenuResepBerdasarkanId(menu.menuId);
    if (!resep?.aktif) tahan("Resep menu tidak aktif.");
    const alergi = await this.repo.clinical.ambilDaftarAlergiPasien(menu.pasienId, true);
    const bahan = [...resep.alergen, ...resep.komposisiBahan.map((b) => b.namaBahan)].map((b) => b.toLowerCase());
    if (alergi.some((a) => bahan.some((b) => b.includes(a.namaAlergen.toLowerCase()) || a.namaAlergen.toLowerCase().includes(b)))) tahan("Menu mengandung alergen pasien. Pesanan ditahan.");
    const verifikasi = await this.repo.clinical.ambilVerifikasiKeamananTerakhir(episode.id);
    if (!verifikasi || verifikasi.keputusan !== "aman_lolos" || verifikasi.instruksiDietId !== diet.id) tahan("Verifikasi keamanan perawat untuk instruksi diet terkini belum lolos.");
    return { episode, diet, resep };
  }

  async buatPesanan(menu: EntitasRencanaMenuIndividual, pengguna: ProfilSesiPengguna): Promise<void> {
    const { episode, diet, resep } = await this.periksaMenu(menu);
    const id = "lbl-" + menu.id;
    if (await this.repo.kitchen.ambilLabelPorsiBerdasarkanId(id)) return;
    const bed = await this.repo.inpatient.ambilTempatTidurBerdasarkanId(episode.tempatTidurId);
    await this.repo.kitchen.simpanLabelPorsi({
      id, nomorLabel: "LBL-" + menu.id, nomorPesanan: menu.id,
      batchProduksiId: null, nomorBatch: null,
      pasienId: menu.pasienId, namaPasien: menu.namaPasien, nomorRm: menu.nomorRekamMedis,
      bangsalKamarBed: episode.bangsalId + " / " + (bed?.nomorTempatTidur ?? episode.tempatTidurId),
      tanggalPelayanan: menu.tanggalPelayanan, sesiMakan: menu.jadwalMakan,
      namaMenu: menu.namaMenu, bentukMakanan: menu.bentukMakanan, jenisDiet: diet.jenisDiet,
      informasiAlergen: resep.alergen.join(", ") || "Tidak ada alergen pada resep",
      suhuKemasanCelsius: null, statusPorsi: "terencana", alasanPenahanan: null,
      waktuCetakLabel: new Date().toISOString(), petugasLabelNama: pengguna.namaLengkap, versi: 1,
    });
  }

  async tinjauPesanan(pasienId?: string): Promise<void> {
    const labels = await this.repo.kitchen.ambilDaftarLabelPorsi({ pasienId });
    for (const label of labels) {
      if (label.statusPorsi === "batal") continue;
      const menu = await this.repo.clinical.ambilRencanaMenuIndividualBerdasarkanId(label.nomorPesanan);
      if (!menu) continue;
      const porsi = await this.repo.delivery.ambilItemPorsiBerdasarkanLabelId(label.id);
      if (porsi?.statusSerah === "berhasil_diserahkan") continue;
      try {
        if (menu.statusPengesahan !== "disahkan") tahan("Rencana menu tidak lagi disahkan.");
        await this.periksaMenu(menu);
      } catch (error) {
        if (!(error instanceof AppError) || error.statusHttp !== 422) throw error;
        await this.repo.kitchen.perbaruiStatusLabelPorsi(label.id, "ditahan_perubahan_klinis", { alasanPenahanan: error.pesanPengguna });
        if (porsi) await this.repo.delivery.perbaruiItemPorsi(porsi.id, {
          statusSerah: "ditahan_klinis", statusKesesuaianDiet: "berubah_perlu_tahan",
          alasanGagalAtauTahan: error.pesanPengguna,
        });
      }
    }
  }

  async hitungRencana(rencana: EntitasRencanaProduksi): Promise<{ total: number; kebutuhanBahan: ItemKebutuhanBahanKalkulasiDto[] }> {
    const menus = await this.repo.clinical.ambilDaftarRencanaMenuIndividual({ tanggalPelayanan: rencana.tanggalPelayanan, statusPengesahan: "disahkan" });
    const kebutuhan = new Map<string, ItemKebutuhanBahanKalkulasiDto>();
    let total = 0;
    for (const menu of menus) {
      if (menu.jadwalMakan !== rencana.sesiMakan) continue;
      try { await this.periksaMenu(menu); } catch (error) {
        if (error instanceof AppError && error.statusHttp === 422) continue;
        throw error;
      }
      total += 1;
      const resep = await this.repo.clinical.ambilMenuResepBerdasarkanId(menu.menuId);
      for (const bahanResep of resep!.komposisiBahan) {
        const bahan = await this.repo.inventory.ambilBahanBerdasarkanKode(bahanResep.kodeBahan);
        const satuan = bahan?.satuan ?? bahanResep.satuan;
        let jumlah = bahanResep.jumlah * menu.porsi;
        if (["gram", "g"].includes(bahanResep.satuan) && satuan === "kg") jumlah /= 1000;
        else if (bahanResep.satuan === "ml" && satuan === "liter") jumlah /= 1000;
        else if (bahanResep.satuan !== satuan) tahan("Konversi satuan bahan belum ditetapkan: " + bahanResep.namaBahan);
        const item = kebutuhan.get(bahanResep.kodeBahan) ?? {
          bahanId: bahan?.id ?? "", kodeBahan: bahanResep.kodeBahan, namaBahan: bahanResep.namaBahan,
          satuan, jumlahDibutuhkan: 0, stokTersediaGudang: bahan ? Math.max(0, bahan.stokLayak - bahan.stokDialokasikan) : 0,
          statusKecukupan: "kurang" as "cukup" | "kurang",
        };
        item.jumlahDibutuhkan = Number((item.jumlahDibutuhkan + jumlah).toFixed(4));
        item.statusKecukupan = item.stokTersediaGudang >= item.jumlahDibutuhkan ? "cukup" : "kurang";
        kebutuhan.set(item.kodeBahan, item);
      }
    }
    return { total, kebutuhanBahan: [...kebutuhan.values()] };
  }

  async periksaBatch(input: InputBatchProduksiBaru): Promise<void> {
    const rencana = await this.repo.kitchen.ambilRencanaProduksiBerdasarkanId(input.rencanaProduksiId);
    if (!rencana || !["disetujui", "dalam_proses"].includes(rencana.status) || rencana.sesiMakan !== input.sesiMakan) tahan("Produksi memerlukan rencana yang telah disetujui untuk sesi yang sama.");
    const menus = await this.repo.clinical.ambilDaftarRencanaMenuIndividual({ tanggalPelayanan: rencana.tanggalPelayanan, statusPengesahan: "disahkan" });
    const pesanan = menus.filter((m) => m.menuId === input.resepId && m.jadwalMakan === input.sesiMakan);
    for (const menu of pesanan) await this.periksaMenu(menu);
    if (!pesanan.length || input.jumlahPorsiTarget > pesanan.reduce((n, m) => n + m.porsi, 0)) tahan("Jumlah produksi melebihi pesanan individual sah untuk resep ini.");
    const batches = await this.repo.kitchen.ambilDaftarBatchProduksi();
    const sudahDirencanakan = batches.filter((b) => b.resepId === input.resepId && b.sesiMakan === input.sesiMakan && b.status !== "gagal_qc");
    let totalTarget = input.jumlahPorsiTarget;
    for (const batch of sudahDirencanakan) {
      const plan = await this.repo.kitchen.ambilRencanaProduksiBerdasarkanId(batch.rencanaProduksiId);
      if (plan?.tanggalPelayanan === rencana.tanggalPelayanan) totalTarget += batch.jumlahPorsiTarget;
    }
    if (totalTarget > pesanan.reduce((n, m) => n + m.porsi, 0)) tahan("Akumulasi batch melebihi pesanan individual sah pada tanggal dan sesi ini.");
    const resep = await this.repo.clinical.ambilMenuResepBerdasarkanId(input.resepId);
    if (!resep) tahan("Resep produksi tidak ditemukan.");
    for (const bahan of resep.komposisiBahan) {
      const master = await this.repo.inventory.ambilBahanBerdasarkanKode(bahan.kodeBahan);
      if (!master) tahan("Master bahan resep belum lengkap.");
      let jumlah = bahan.jumlah * input.jumlahPorsiTarget;
      if (["gram", "g"].includes(bahan.satuan) && master.satuan === "kg") jumlah /= 1000;
      else if (bahan.satuan === "ml" && master.satuan === "liter") jumlah /= 1000;
      else if (bahan.satuan !== master.satuan) tahan("Satuan bahan resep tidak sesuai master.");
      const digunakan = input.lotBahanDigunakan.filter((l) => l.bahanId === master.id);
      if (digunakan.some((l) => l.satuan !== master.satuan) || digunakan.reduce((n, l) => n + l.jumlahDigunakan, 0) + 0.0001 < jumlah) tahan("Bahan yang dicatat belum memenuhi komposisi resep: " + bahan.namaBahan);
    }
    for (const item of input.lotBahanDigunakan) {
      const lot = await this.repo.inventory.ambilLotBerdasarkanNomor(item.nomorLot);
      if (!lot || lot.bahanId !== item.bahanId || lot.statusMutu !== "layak_diterima" || ["ditahan", "dibuang"].includes(lot.statusLot) || lot.tanggalKedaluwarsa < rencana.tanggalPelayanan) tahan("Lot bahan tidak layak atau sudah kedaluwarsa.");
      const permintaan = await this.repo.inventory.ambilSemuaPermintaan({ tanggal: rencana.tanggalPelayanan });
      const dikeluarkan = permintaan.filter((p) => p.status === "dikeluarkan").flatMap((p) => p.daftarItem)
        .flatMap((p) => p.lotDialokasikan ?? []).filter((l) => l.nomorLot === item.nomorLot).reduce((n, l) => n + l.jumlah, 0);
      const terpakai = await this.repo.kitchen.ambilBatchBerdasarkanNomorLot(item.nomorLot);
      if (dikeluarkan - terpakai.reduce((n, p) => n + p.jumlahDigunakan, 0) < item.jumlahDigunakan) tahan("Pemakaian lot melebihi bahan yang telah dikeluarkan gudang.");
    }
  }

  async siapkanDistribusi(label: EntitasLabelPorsi): Promise<void> {
    const menu = await this.repo.clinical.ambilRencanaMenuIndividualBerdasarkanId(label.nomorPesanan);
    if (!menu) tahan("Label tidak terhubung ke pesanan individual yang sah.");
    const { episode, diet } = await this.periksaMenu(menu);
    const pasien = await this.repo.patient.cariPasienBerdasarkanId(menu.pasienId);
    if (!pasien) tahan("Identitas pasien tidak ditemukan.");
    const bangsal = await this.repo.inpatient.ambilBangsalBerdasarkanId(episode.bangsalId);
    const bed = await this.repo.inpatient.ambilTempatTidurBerdasarkanId(episode.tempatTidurId);
    if (await this.repo.delivery.ambilItemPorsiBerdasarkanLabelId(label.id)) return;
    const sekarang = new Date().toISOString();
    await this.repo.delivery.simpanItemPorsi({
      id: "dist-" + menu.id, troliId: null, nomorTroli: null, labelPorsiId: label.id,
      nomorLabel: label.nomorLabel, nomorPesanan: menu.id, pasienId: pasien.id, namaPasien: pasien.namaLengkap,
      nomorRm: pasien.nomorRekamMedis, tanggalLahirPasien: pasien.tanggalLahir,
      bangsalId: episode.bangsalId, namaBangsal: bangsal?.namaBangsal ?? episode.bangsalId,
      kamarBed: bed?.nomorTempatTidur ?? episode.tempatTidurId, sesiMakan: label.sesiMakan, namaMenu: label.namaMenu,
      jenisDietLabel: diet.jenisDiet, dietTerkiniPasien: diet.jenisDiet, statusKesesuaianDiet: "sesuai",
      statusSerah: "menunggu_pengiriman", waktuSerah: null, namaPenerima: null, hubunganPenerima: null,
      alasanGagalAtauTahan: null, duaIdentitasTerverifikasi: false, petugasDistribusiNama: null,
      createdAt: sekarang, updatedAt: sekarang,
    });
  }

  async periksaPenyerahan(porsi: ItemPorsiDistribusiEntitas): Promise<void> {
    await this.tinjauPesanan(porsi.pasienId);
    const menu = await this.repo.clinical.ambilRencanaMenuIndividualBerdasarkanId(porsi.nomorPesanan);
    if (!menu) tahan("Porsi tidak terhubung ke pesanan individual.");
    const { episode } = await this.periksaMenu(menu);
    const bed = await this.repo.inpatient.ambilTempatTidurBerdasarkanId(episode.tempatTidurId);
    if (episode.bangsalId !== porsi.bangsalId || (bed?.nomorTempatTidur ?? episode.tempatTidurId) !== porsi.kamarBed) tahan("Pasien berpindah lokasi. Perbarui rute distribusi sebelum penyerahan.");
    const label = await this.repo.kitchen.ambilLabelPorsiBerdasarkanId(porsi.labelPorsiId);
    const batch = label?.batchProduksiId ? await this.repo.kitchen.ambilBatchProduksiBerdasarkanId(label.batchProduksiId) : null;
    if (!label || label.statusPorsi !== "siap_distribusi" || batch?.status !== "lolos_qc") tahan("Makanan belum lolos pemeriksaan akhir atau sedang ditahan.");
    if (menu.tanggalPelayanan !== new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })) tahan("Tanggal pelayanan porsi tidak sesuai hari penyerahan.");
  }
}
