/**
 * @fileoverview Layanan logika bisnis untuk Peran Petugas Dapur (Tahap 8).
 * Mengimplementasikan:
 * - Perencanaan produksi H-1 & estimasi kebutuhan bahan (AB-012, AB-014)
 * - Penahanan pesanan akibat perubahan diet klinis (AB-010, AB-013)
 * - Perekaman batch memasak ber-CCP suhu >= 75 C (AB-018, AB-019)
 * - Pemeriksaan mutu akhir organoleptik/suhu (AB-019, AB-022)
 * - Pengepakan, pembuatan label porsi pasien terlacak, dan kesiapan distribusi (BRD 8.5)
 * - Ketertelusuran bahan baku gudang ke pasien (Recall Traceability BRD 8.6)
 */

import { randomUUID } from "node:crypto";
import {
  KODE_GALAT,
  type ItemBatchProduksiDto,
  type ItemKebutuhanBahanKalkulasiDto,
  type ItemLabelPorsiPasienDto,
  type ItemPemeriksaanMutuProduksiDto,
  type ItemRencanaProduksiDto,
  type ProfilSesiPengguna,
  type RingkasanDapurOverviewDto,
  type SesiMakanDapur,
  type StatusPorsiPasien,
  type StatusRencanaProduksi,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type {
  EntitasBatchProduksi,
  EntitasLabelPorsi,
  EntitasPemeriksaanMutu,
  EntitasPenggunaanLotBahan,
  EntitasRencanaProduksi,
  InputBatchProduksiBaru,
  InputCatatCcpSuhu,
  InputCetakLabelPorsi,
  InputPemeriksaanMutuBaru,
  InputRencanaProduksiBaru,
  InputTahanPorsiKlinis,
} from "../model/kitchen.model.ts";
import type { KitchenRepository } from "../repository/kitchen.repository.ts";
import {
  skemaInputBatchProduksi,
  skemaInputCatatCcpSuhu,
  skemaInputCetakLabelPorsi,
  skemaInputPemeriksaanMutu,
  skemaInputRencanaProduksi,
  skemaInputTahanPorsiKlinis,
} from "../validators/kitchen.validator.ts";

export interface KaitanKitchen {
  hitungRencana?: (rencana: EntitasRencanaProduksi) => Promise<{ total: number; kebutuhanBahan: ItemKebutuhanBahanKalkulasiDto[] }>;
  periksaBatch?: (input: InputBatchProduksiBaru) => Promise<void>;
  tinjauPesanan?: () => Promise<void>;
  periksaPorsi?: (label: EntitasLabelPorsi, batch?: EntitasBatchProduksi) => Promise<void>;
  padaPorsiSiap?: (label: EntitasLabelPorsi) => Promise<void>;
}

export class KitchenService {
  private readonly repository: KitchenRepository;
  private readonly kaitan: KaitanKitchen;

  public constructor(repository: KitchenRepository, kaitan: KaitanKitchen = {}) {
    this.repository = repository;
    this.kaitan = kaitan;
  }

  private antrianMutasi: Promise<void> = Promise.resolve();
  private async mutasi<T>(aksi: (service: KitchenService) => Promise<T>): Promise<T> {
    let selesai!: () => void;
    const sebelumnya = this.antrianMutasi;
    this.antrianMutasi = new Promise<void>((resolve) => { selesai = resolve; });
    await sebelumnya;
    try { return this.repository.transaksi ? await this.repository.transaksi((repo) => aksi(new KitchenService(repo, this.kaitan))) : await aksi(this); }
    finally { selesai(); }
  }
  public buatRencanaProduksi(input: InputRencanaProduksiBaru, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.buatRencanaProduksiDalamTransaksi(input, profil)); }
  public setujuiRencanaProduksi(id: string, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.setujuiRencanaProduksiDalamTransaksi(id, profil)); }
  public buatBatchProduksi(input: InputBatchProduksiBaru, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.buatBatchProduksiDalamTransaksi(input, profil)); }
  public catatCcpSuhuMasak(id: string, input: InputCatatCcpSuhu, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.catatCcpSuhuMasakDalamTransaksi(id, input, profil)); }
  public catatPemeriksaanMutu(input: InputPemeriksaanMutuBaru, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.catatPemeriksaanMutuDalamTransaksi(input, profil)); }
  public siapkanPorsiDistribusi(id: string, input: InputCetakLabelPorsi, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.siapkanPorsiDistribusiDalamTransaksi(id, input, profil)); }
  public tahanPorsiKarenaPerubahanKlinis(id: string, input: InputTahanPorsiKlinis, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.tahanPorsiKarenaPerubahanKlinisDalamTransaksi(id, input, profil)); }
  public lepasPenahananPorsi(id: string, profil: ProfilSesiPengguna) { return this.mutasi((service) => service.lepasPenahananPorsiDalamTransaksi(id, profil)); }

  /**
   * Validasi otorisasi server-side khusus peran Petugas Dapur (AB-032).
   */
  public validasiIzinAksesDapur(
    profil: ProfilSesiPengguna | undefined,
    operasi: string,
  ): void {
    if (!profil) {
      throw new AppError({
        kode: KODE_GALAT.AUTENTIKASI_GAGAL,
        statusHttp: 401,
        pesanPengguna: "Sesi login Petugas Dapur tidak valid atau telah berakhir.",
        pesanInternal: `Akses ditolak pada operasi '${operasi}': sesi pengguna kosong.`,
      });
    }

    const bolehAkses =
      profil.peran === "petugas_dapur" ||
      profil.daftarIzin.includes("dapur:produksi:kelola");

    if (!bolehAkses) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akses ditolak: Operasi ini hanya boleh dilakukan oleh Petugas Dapur resmi (AB-032).",
        pesanInternal: `Pengguna ${profil.id} (${profil.peran}) tidak memiliki izin pada '${operasi}'.`,
      });
    }
  }

  /**
   * Mengambil ringkasan metrik dasbor dapur (overview).
   */
  public async ambilOverviewDapur(
    profil?: ProfilSesiPengguna,
  ): Promise<RingkasanDapurOverviewDto> {
    if (profil) {
      this.validasiIzinAksesDapur(profil, "Melihat Overview Dapur");
    }

    const [rencana, batchList, labels, qcList] = await Promise.all([
      this.repository.ambilDaftarRencanaProduksi(),
      this.repository.ambilDaftarBatchProduksi(),
      this.repository.ambilDaftarLabelPorsi(),
      this.repository.ambilSemuaPemeriksaanMutu(),
    ]);

    const totalRencanaH1 = rencana.length;
    const totalBatchMemasak = batchList.filter(
      (b) => b.status === "memasak" || b.status === "persiapan",
    ).length;
    const totalPorsiSiapDistribusi = labels.filter(
      (l) => l.statusPorsi === "siap_distribusi",
    ).length;
    const totalPesananDitahanKlinis = labels.filter(
      (l) => l.statusPorsi === "ditahan_perubahan_klinis",
    ).length;
    const pemeriksaanMutuLolos = qcList.filter(
      (q) => q.statusMutu === "lolos_pemeriksaan",
    ).length;
    const pemeriksaanMutuDitahan = qcList.filter(
      (q) => q.statusMutu === "ditahan_gagal_mutu",
    ).length;

    return {
      totalRencanaH1,
      totalBatchMemasak,
      totalPorsiSiapDistribusi,
      totalPesananDitahanKlinis,
      pemeriksaanMutuLolos,
      pemeriksaanMutuDitahan,
    };
  }

  /**
   * Mengambil daftar rencana produksi reguler H-1.
   */
  public async ambilDaftarRencana(
    filter?: { tanggal?: string; sesi?: SesiMakanDapur; status?: StatusRencanaProduksi },
    profil?: ProfilSesiPengguna,
  ): Promise<ItemRencanaProduksiDto[]> {
    if (profil) {
      this.validasiIzinAksesDapur(profil, "Melihat Daftar Rencana Produksi");
    }

    const daftar = await this.repository.ambilDaftarRencanaProduksi(filter);
    return Promise.all(daftar.map((r) => this.petakanRencanaKeDto(r)));
  }

  /**
   * Membuat rencana produksi H-1 baru beserta kalkulasi kebutuhan bahan baku (AB-012, AB-014).
   */
  private async buatRencanaProduksiDalamTransaksi(
    inputMentah: InputRencanaProduksiBaru,
    profil: ProfilSesiPengguna,
  ): Promise<ItemRencanaProduksiDto> {
    this.validasiIzinAksesDapur(profil, "Membuat Rencana Produksi H-1");
    const validasi = skemaInputRencanaProduksi.safeParse(inputMentah);
    if (!validasi.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: validasi.error.issues[0]?.message ?? "Validasi rencana produksi gagal.",
        pesanInternal: JSON.stringify(validasi.error.format()),
      });
    }

    const input = validasi.data;
    const hariIni = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    if (input.tanggalPelayanan < hariIni || (input.jenisRencana === "reguler" && input.tanggalPelayanan <= hariIni) || (input.jenisRencana === "mendadak" && (!input.catatan || input.catatan.trim().length < 5))) {
      throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Rencana reguler dibuat sebelum hari pelayanan. Pesanan mendadak memerlukan alasan minimal 5 karakter dan tidak boleh bertanggal lampau." });
    }
    const nomorRencana = await this.repository.hitungNomorRencanaBerikutnya();
    const estimasiPorsi = (input.daftarPesananPasienId?.length ?? 0) > 0
      ? input.daftarPesananPasienId!.length
      : 0;

    const entitas: EntitasRencanaProduksi = {
      id: `rp-${randomUUID()}`,
      nomorRencana,
      tanggalPelayanan: input.tanggalPelayanan,
      sesiMakan: input.sesiMakan,
      status: "draft",
      totalEstimasiPorsi: estimasiPorsi,
      catatan: (input.jenisRencana === "mendadak" ? "[MENDADAK] " : "") + (input.catatan ?? "Rencana produksi makanan pasien rawat inap H-1"),
      penanggungJawabId: profil.id,
      penanggungJawabNama: profil.namaLengkap,
      waktuDibuat: new Date().toISOString(),
      waktuDisetujui: null,
      versi: 1,
    };

    if (this.kaitan.hitungRencana) entitas.totalEstimasiPorsi = (await this.kaitan.hitungRencana(entitas)).total;
    const tersimpan = await this.repository.simpanRencanaProduksi(entitas);
    return this.petakanRencanaKeDto(tersimpan);
  }

  /**
   * Menyetujui rencana produksi H-1 secara resmi oleh penanggung jawab dapur (AB-012).
   */
  private async setujuiRencanaProduksiDalamTransaksi(
    id: string,
    profil: ProfilSesiPengguna,
  ): Promise<ItemRencanaProduksiDto> {
    this.validasiIzinAksesDapur(profil, "Menyetujui Rencana Produksi H-1");

    const ada = await this.repository.ambilRencanaProduksiBerdasarkanId(id);
    if (!ada) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Rencana produksi ${id} tidak ditemukan.`,
        pesanInternal: `ID rencana produksi '${id}' tidak ada di basis data.`,
      });
    }

    if (ada.status === "disetujui") {
      return this.petakanRencanaKeDto(ada);
    }

    const terbarui = await this.repository.perbaruiRencanaProduksi(id, {
      status: "disetujui",
      waktuDisetujui: new Date().toISOString(),
    });

    return this.petakanRencanaKeDto(terbarui);
  }

  /**
   * Mengambil daftar batch memasak.
   */
  public async ambilDaftarBatch(
    filter?: { rencanaProduksiId?: string; sesi?: SesiMakanDapur },
    profil?: ProfilSesiPengguna,
  ): Promise<ItemBatchProduksiDto[]> {
    if (profil) {
      this.validasiIzinAksesDapur(profil, "Melihat Daftar Batch Memasak");
    }

    const daftar = await this.repository.ambilDaftarBatchProduksi(filter);
    const hasil: ItemBatchProduksiDto[] = [];
    for (const b of daftar) {
      const lots = await this.repository.ambilPenggunaanLotBerdasarkanBatch(b.id);
      hasil.push(this.petakanBatchKeDto(b, lots));
    }
    return hasil;
  }

  /**
   * Mencatat batch memasak baru dengan penelusuran lot bahan baku gudang (AB-018).
   */
  private async buatBatchProduksiDalamTransaksi(
    inputMentah: InputBatchProduksiBaru,
    profil: ProfilSesiPengguna,
  ): Promise<ItemBatchProduksiDto> {
    this.validasiIzinAksesDapur(profil, "Mencatat Batch Memasak Baru");
    const validasi = skemaInputBatchProduksi.safeParse(inputMentah);
    if (!validasi.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: validasi.error.issues[0]?.message ?? "Validasi batch memasak gagal.",
        pesanInternal: JSON.stringify(validasi.error.format()),
      });
    }

    const input = validasi.data;
    await this.kaitan.periksaBatch?.(input);
    const nomorBatch = await this.repository.hitungNomorBatchBerikutnya(input.sesiMakan);
    const batchId = `batch-${randomUUID()}`;

    const entitasBatch: EntitasBatchProduksi = {
      id: batchId,
      nomorBatch,
      rencanaProduksiId: input.rencanaProduksiId,
      resepId: input.resepId,
      namaMasakan: input.namaMasakan,
      sesiMakan: input.sesiMakan,
      jumlahPorsiTarget: input.jumlahPorsiTarget,
      jumlahPorsiRealisasi: 0,
      suhuMasakCcpCelsius: null,
      waktuMulaiMasak: new Date().toISOString(),
      waktuSelesaiMasak: null,
      status: "memasak",
      catatanKoki: input.catatanKoki ?? "Proses pengolahan makanan dimulai.",
      chefPenanggungJawab: input.chefPenanggungJawab,
      waktuDibuat: new Date().toISOString(),
      versi: 1,
    };

    const entitasLots: EntitasPenggunaanLotBahan[] = input.lotBahanDigunakan.map((item) => ({
      id: `lot-use-${randomUUID()}`,
      batchProduksiId: batchId,
      bahanId: item.bahanId,
      namaBahan: item.namaBahan,
      nomorLot: item.nomorLot,
      jumlahDigunakan: item.jumlahDigunakan,
      satuan: item.satuan,
      waktuPencatatan: new Date().toISOString(),
    }));

    const tersimpan = await this.repository.simpanBatchProduksi(entitasBatch);
    await this.repository.simpanPenggunaanLotBahan(entitasLots);

    return this.petakanBatchKeDto(tersimpan, entitasLots);
  }

  /**
   * Mencatat pencapaian suhu Critical Control Point (CCP) memasak (AB-019).
   * Standar keamanan pangan rumah sakit mensyaratkan suhu masak inti minimal 75 C.
   */
  private async catatCcpSuhuMasakDalamTransaksi(
    batchId: string,
    inputMentah: InputCatatCcpSuhu,
    profil: ProfilSesiPengguna,
  ): Promise<ItemBatchProduksiDto> {
    this.validasiIzinAksesDapur(profil, "Mencatat Suhu CCP Memasak");
    const validasi = skemaInputCatatCcpSuhu.safeParse(inputMentah);
    if (!validasi.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: validasi.error.issues[0]?.message ?? "Validasi suhu CCP gagal.",
        pesanInternal: JSON.stringify(validasi.error.format()),
      });
    }

    const input = validasi.data;
    const batch = await this.repository.ambilBatchProduksiBerdasarkanId(batchId);
    if (!batch) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Batch produksi ${batchId} tidak ditemukan.`,
        pesanInternal: `ID batch '${batchId}' tidak ada di database.`,
      });
    }

    const suhu = input.suhuMasakCcpCelsius;
    const porsiRealisasi = input.jumlahPorsiRealisasi ?? batch.jumlahPorsiTarget;
    if (porsiRealisasi > batch.jumlahPorsiTarget) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Hasil produksi melebihi target dan bahan yang dicatat. Koreksi batch terlebih dahulu." });
    if (batch.status === "lolos_qc") throw new AppError({ kode: KODE_GALAT.KONFLIK_BISNIS, statusHttp: 409, pesanPengguna: "Batch yang telah lolos QC tidak dapat diubah tanpa pemeriksaan ulang." });
    const catatan = input.catatanKoki ?? batch.catatanKoki;

    const terbarui = await this.repository.perbaruiBatchProduksi(batchId, {
      suhuMasakCcpCelsius: suhu,
      jumlahPorsiRealisasi: porsiRealisasi,
      waktuSelesaiMasak: new Date().toISOString(),
      status: "selesai_masak",
      catatanKoki: catatan,
    });

    const lots = await this.repository.ambilPenggunaanLotBerdasarkanBatch(batchId);
    return this.petakanBatchKeDto(terbarui, lots);
  }

  /**
   * Mencatat pemeriksaan mutu akhir organoleptik dan suhu saji sebelum distribusi (AB-019, AB-022).
   */
  private async catatPemeriksaanMutuDalamTransaksi(
    inputMentah: InputPemeriksaanMutuBaru,
    profil: ProfilSesiPengguna,
  ): Promise<ItemPemeriksaanMutuProduksiDto> {
    this.validasiIzinAksesDapur(profil, "Mencatat Pemeriksaan Mutu Akhir Makanan");
    const validasi = skemaInputPemeriksaanMutu.safeParse(inputMentah);
    if (!validasi.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: validasi.error.issues[0]?.message ?? "Validasi pemeriksaan mutu gagal.",
        pesanInternal: JSON.stringify(validasi.error.format()),
      });
    }

    const input = validasi.data;
    const batch = await this.repository.ambilBatchProduksiBerdasarkanId(input.batchProduksiId);
    if (!batch) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Batch produksi ${input.batchProduksiId} tidak ditemukan.`,
        pesanInternal: `ID batch '${input.batchProduksiId}' tidak valid.`,
      });
    }

    if (input.statusMutu === "lolos_pemeriksaan" && (batch.suhuMasakCcpCelsius === null || batch.jumlahPorsiRealisasi <= 0 || !["selesai_masak", "lolos_qc", "gagal_qc"].includes(batch.status))) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Selesaikan pencatatan hasil masak dan pengukuran CCP sebelum meluluskan QC." });
    if (input.statusMutu === "lolos_pemeriksaan" && (input.ujiTekstur !== "sesuai" || input.ujiAroma !== "normal_segar" || input.ujiRasa !== "sesuai_standar" || input.ujiTampilanVisual !== "bersih_menarik")) {
      input.statusMutu = "ditahan_gagal_mutu";
    }
    const entitasQC: EntitasPemeriksaanMutu = {
      id: `qc-${randomUUID()}`,
      batchProduksiId: input.batchProduksiId,
      suhuSajiCelsius: input.suhuSajiCelsius,
      ujiTekstur: input.ujiTekstur,
      ujiAroma: input.ujiAroma,
      ujiRasa: input.ujiRasa,
      ujiTampilanVisual: input.ujiTampilanVisual,
      statusMutu: input.statusMutu,
      catatanPemeriksaan: input.catatanPemeriksaan,
      pemeriksaId: profil.id,
      pemeriksaNama: profil.namaLengkap,
      waktuPemeriksaan: new Date().toISOString(),
    };

    const tersimpan = await this.repository.simpanPemeriksaanMutu(entitasQC);

    // Sinkronkan status batch: lolos_qc vs gagal_qc (AB-022)
    const statusBaru = input.statusMutu === "lolos_pemeriksaan" ? "lolos_qc" : "gagal_qc";
    await this.repository.perbaruiBatchProduksi(input.batchProduksiId, {
      status: statusBaru,
    });

    return {
      id: tersimpan.id,
      batchProduksiId: tersimpan.batchProduksiId,
      nomorBatch: batch.nomorBatch,
      namaMasakan: batch.namaMasakan,
      suhuSajiCelsius: tersimpan.suhuSajiCelsius,
      ujiTekstur: tersimpan.ujiTekstur,
      ujiAroma: tersimpan.ujiAroma,
      ujiRasa: tersimpan.ujiRasa,
      ujiTampilanVisual: tersimpan.ujiTampilanVisual,
      statusMutu: tersimpan.statusMutu,
      catatanPemeriksaan: tersimpan.catatanPemeriksaan,
      pemeriksaId: tersimpan.pemeriksaId,
      pemeriksaNama: tersimpan.pemeriksaNama,
      waktuPemeriksaan: tersimpan.waktuPemeriksaan,
    };
  }

  /**
   * Mengambil riwayat pemeriksaan mutu akhir.
   */
  public async ambilSemuaPemeriksaanMutu(
    profil?: ProfilSesiPengguna,
  ): Promise<ItemPemeriksaanMutuProduksiDto[]> {
    if (profil) {
      this.validasiIzinAksesDapur(profil, "Melihat Hasil Pemeriksaan Mutu");
    }

    const qcList = await this.repository.ambilSemuaPemeriksaanMutu();
    const batchList = await this.repository.ambilDaftarBatchProduksi();
    const batchMap = new Map(batchList.map((b) => [b.id, b]));

    return qcList.map((q) => {
      const b = batchMap.get(q.batchProduksiId);
      return {
        id: q.id,
        batchProduksiId: q.batchProduksiId,
        nomorBatch: b?.nomorBatch ?? "-",
        namaMasakan: b?.namaMasakan ?? "-",
        suhuSajiCelsius: q.suhuSajiCelsius,
        ujiTekstur: q.ujiTekstur,
        ujiAroma: q.ujiAroma,
        ujiRasa: q.ujiRasa,
        ujiTampilanVisual: q.ujiTampilanVisual,
        statusMutu: q.statusMutu,
        catatanPemeriksaan: q.catatanPemeriksaan,
        pemeriksaId: q.pemeriksaId,
        pemeriksaNama: q.pemeriksaNama,
        waktuPemeriksaan: q.waktuPemeriksaan,
      };
    });
  }

  /**
   * Mengambil daftar label porsi makanan pasien.
   */
  public async ambilDaftarLabelPorsi(
    filter?: {
      tanggal?: string;
      sesi?: SesiMakanDapur;
      status?: StatusPorsiPasien;
      pasienId?: string;
      batchProduksiId?: string;
    },
    profil?: ProfilSesiPengguna,
  ): Promise<ItemLabelPorsiPasienDto[]> {
    if (profil) {
      this.validasiIzinAksesDapur(profil, "Melihat Daftar Label Porsi Pasien");
    }

    await this.kaitan.tinjauPesanan?.();
    const daftar = await this.repository.ambilDaftarLabelPorsi(filter);
    return daftar.map((l) => this.petakanLabelKeDto(l));
  }

  /**
   * Mencetak dan menandai porsi pasien siap distribusi (BRD 8.5, AB-019, AB-022).
   * Makanan yang gagal QC dilarang diporsikan atau disiapkan distribusi.
   * Makanan dengan status 'ditahan_perubahan_klinis' dilarang didistribusikan (AB-010, AB-013).
   */
  private async siapkanPorsiDistribusiDalamTransaksi(
    labelId: string,
    inputMentah: InputCetakLabelPorsi,
    profil: ProfilSesiPengguna,
  ): Promise<ItemLabelPorsiPasienDto> {
    this.validasiIzinAksesDapur(profil, "Menyiapkan Porsi Makanan untuk Distribusi");
    const validasi = skemaInputCetakLabelPorsi.safeParse(inputMentah);
    if (!validasi.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: validasi.error.issues[0]?.message ?? "Validasi penyiapan porsi gagal.",
        pesanInternal: JSON.stringify(validasi.error.format()),
      });
    }

    const label = await this.repository.ambilLabelPorsiBerdasarkanId(labelId);
    if (!label) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Label porsi ${labelId} tidak ditemukan.`,
        pesanInternal: `ID label porsi '${labelId}' tidak valid.`,
      });
    }

    if (label.statusPorsi === "batal") throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Label yang dibatalkan tidak dapat digunakan kembali." });
    if (label.statusPorsi === "siap_distribusi" && label.batchProduksiId !== validasi.data.batchProduksiId) throw new AppError({ kode: KODE_GALAT.KONFLIK_BISNIS, statusHttp: 409, pesanPengguna: "Label yang telah diproses tidak dapat dipindahkan ke batch lain." });
    // AB-010 & AB-013: Makanan yang ditahan klinis TIDAK BOLEH didistribusikan!
    if (label.statusPorsi === "ditahan_perubahan_klinis") {
      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna: `Makanan untuk pasien ${label.namaPasien} (${label.nomorRm}) sedang DITAHAN PERUBAHAN KLINIS. Dilarang didistribusikan sebelum diet baru disesuaikan (AB-010, AB-013). Alasan: ${label.alasanPenahanan}`,
        pesanInternal: `Penolakan distribusi porsi ${labelId}: status = ditahan_perubahan_klinis.`,
      });
    }

    // AB-019 & AB-022: Verifikasi status QC batch masak
    const batch = await this.repository.ambilBatchProduksiBerdasarkanId(validasi.data.batchProduksiId);
    if (!batch) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Batch produksi ${validasi.data.batchProduksiId} tidak ditemukan.`,
        pesanInternal: `Batch tidak ditemukan untuk label ${labelId}.`,
      });
    }

    if (batch.status === "gagal_qc") {
      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna: `Batch ${batch.nomorBatch} ('${batch.namaMasakan}') GAGAL PEMERIKSAAN MUTU AKHIR. Dilarang diporsikan dan dilarang dialirkan ke distribusi (AB-019, AB-022).`,
        pesanInternal: `Penolakan pemorsian batch ${batch.id}: status batch gagal_qc.`,
      });
    }

    if (batch.status !== "lolos_qc") {
      throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Batch wajib lolos pemeriksaan akhir sebelum dikemas." });
    }
    await this.kaitan.periksaPorsi?.(label, batch);
    if (label.statusPorsi === "siap_distribusi") {
      await this.kaitan.padaPorsiSiap?.(label);
      return this.petakanLabelKeDto(label);
    }
    const terbarui = await this.repository.perbaruiStatusLabelPorsi(
      labelId,
      "siap_distribusi",
      {
        batchProduksiId: batch.id,
        nomorBatch: batch.nomorBatch,
        suhuKemasanCelsius: validasi.data.suhuKemasanCelsius ?? null,
      },
    );

    await this.kaitan.padaPorsiSiap?.(terbarui);
    return this.petakanLabelKeDto(terbarui);
  }

  /**
   * Menahan porsi makanan pasien akibat perubahan diet / alergi / puasa klinis (AB-010, AB-013).
   */
  private async tahanPorsiKarenaPerubahanKlinisDalamTransaksi(
    labelId: string,
    inputMentah: InputTahanPorsiKlinis,
    profil: ProfilSesiPengguna,
  ): Promise<ItemLabelPorsiPasienDto> {
    this.validasiIzinAksesDapur(profil, "Menahan Porsi Makanan Akibat Perubahan Klinis");
    const validasi = skemaInputTahanPorsiKlinis.safeParse(inputMentah);
    if (!validasi.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: validasi.error.issues[0]?.message ?? "Validasi alasan penahanan gagal.",
        pesanInternal: JSON.stringify(validasi.error.format()),
      });
    }

    const label = await this.repository.ambilLabelPorsiBerdasarkanId(labelId);
    if (!label) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Label porsi ${labelId} tidak ditemukan.`,
        pesanInternal: `Label '${labelId}' tidak ditemukan.`,
      });
    }

    const terbarui = await this.repository.perbaruiStatusLabelPorsi(
      labelId,
      "ditahan_perubahan_klinis",
      {
        alasanPenahanan: validasi.data.alasanPenahanan,
      },
    );

    return this.petakanLabelKeDto(terbarui);
  }

  /**
   * Melepas penahanan porsi setelah diet baru divalidasi aman (AB-013).
   */
  private async lepasPenahananPorsiDalamTransaksi(
    labelId: string,
    profil: ProfilSesiPengguna,
  ): Promise<ItemLabelPorsiPasienDto> {
    this.validasiIzinAksesDapur(profil, "Melepas Penahanan Porsi Makanan");

    const label = await this.repository.ambilLabelPorsiBerdasarkanId(labelId);
    if (!label) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Label porsi ${labelId} tidak ditemukan.`,
        pesanInternal: `Label '${labelId}' tidak ditemukan.`,
      });
    }

    await this.kaitan.periksaPorsi?.(label);
    const terbarui = await this.repository.perbaruiStatusLabelPorsi(
      labelId,
      "siap_kemas",
      {
        alasanPenahanan: null,
      },
    );

    return this.petakanLabelKeDto(terbarui);
  }

  /**
   * Menelusuri seluruh batch memasak dan pasien terdampak dari nomor lot bahan gudang tertentu (Recall Traceability BRD 8.6).
   */
  public async telusuriKetertelusuranLot(
    nomorLot: string,
    profil?: ProfilSesiPengguna,
  ): Promise<{
    nomorLot: string;
    batchTerdampak: ItemBatchProduksiDto[];
    porsiTerdampak: ItemLabelPorsiPasienDto[];
  }> {
    if (profil) {
      this.validasiIzinAksesDapur(profil, "Menelusuri Riwayat Lot Bahan (Traceability)");
    }

    const penggunaanLot = await this.repository.ambilBatchBerdasarkanNomorLot(nomorLot);
    const batchIds = [...new Set(penggunaanLot.map((p) => p.batchProduksiId))];

    const batchTerdampak: ItemBatchProduksiDto[] = [];
    const porsiTerdampak: ItemLabelPorsiPasienDto[] = [];

    for (const bId of batchIds) {
      const b = await this.repository.ambilBatchProduksiBerdasarkanId(bId);
      if (b) {
        const lots = await this.repository.ambilPenggunaanLotBerdasarkanBatch(b.id);
        batchTerdampak.push(this.petakanBatchKeDto(b, lots));
      }
      const labels = await this.repository.ambilLabelBerdasarkanBatch(bId);
      for (const lbl of labels) {
        porsiTerdampak.push(this.petakanLabelKeDto(lbl));
      }
    }

    return {
      nomorLot,
      batchTerdampak,
      porsiTerdampak,
    };
  }

  // --- Helper Mapping Methods ---

  private async petakanRencanaKeDto(r: EntitasRencanaProduksi): Promise<ItemRencanaProduksiDto> {
    const kalkulasi = await this.kaitan.hitungRencana?.(r);
    const kebutuhanBahan = kalkulasi?.kebutuhanBahan ?? [];

    return {
      id: r.id,
      nomorRencana: r.nomorRencana,
      tanggalPelayanan: r.tanggalPelayanan,
      sesiMakan: r.sesiMakan,
      status: r.status,
      totalEstimasiPorsi: r.totalEstimasiPorsi,
      catatan: r.catatan,
      waktuDibuat: r.waktuDibuat,
      waktuDisetujui: r.waktuDisetujui,
      penanggungJawabId: r.penanggungJawabId,
      penanggungJawabNama: r.penanggungJawabNama,
      kebutuhanBahan,
    };
  }

  private petakanBatchKeDto(
    b: EntitasBatchProduksi,
    lots: EntitasPenggunaanLotBahan[],
  ): ItemBatchProduksiDto {
    return {
      id: b.id,
      nomorBatch: b.nomorBatch,
      rencanaProduksiId: b.rencanaProduksiId,
      resepId: b.resepId,
      namaMasakan: b.namaMasakan,
      sesiMakan: b.sesiMakan,
      jumlahPorsiTarget: b.jumlahPorsiTarget,
      jumlahPorsiRealisasi: b.jumlahPorsiRealisasi,
      suhuMasakCcpCelsius: b.suhuMasakCcpCelsius,
      waktuMulaiMasak: b.waktuMulaiMasak,
      waktuSelesaiMasak: b.waktuSelesaiMasak,
      status: b.status,
      catatanKoki: b.catatanKoki,
      chefPenanggungJawab: b.chefPenanggungJawab,
      lotBahanDigunakan: lots.map((l) => ({
        bahanId: l.bahanId,
        namaBahan: l.namaBahan,
        nomorLot: l.nomorLot,
        jumlahDigunakan: l.jumlahDigunakan,
        satuan: l.satuan,
      })),
    };
  }

  private petakanLabelKeDto(l: EntitasLabelPorsi): ItemLabelPorsiPasienDto {
    return {
      id: l.id,
      nomorLabel: l.nomorLabel,
      nomorPesanan: l.nomorPesanan,
      batchProduksiId: l.batchProduksiId,
      nomorBatch: l.nomorBatch,
      pasienId: l.pasienId,
      namaPasien: l.namaPasien,
      nomorRm: l.nomorRm,
      bangsalKamarBed: l.bangsalKamarBed,
      tanggalPelayanan: l.tanggalPelayanan,
      sesiMakan: l.sesiMakan,
      namaMenu: l.namaMenu,
      bentukMakanan: l.bentukMakanan,
      jenisDiet: l.jenisDiet,
      informasiAlergen: l.informasiAlergen,
      suhuKemasanCelsius: l.suhuKemasanCelsius,
      statusPorsi: l.statusPorsi,
      alasanPenahanan: l.alasanPenahanan,
      waktuCetakLabel: l.waktuCetakLabel,
      petugasLabelNama: l.petugasLabelNama,
    };
  }
}
