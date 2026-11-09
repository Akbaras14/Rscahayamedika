/**
 * @fileoverview Logika bisnis inti untuk Layanan Distribusi & Handover Makanan (Tahap 9).
 * Mengimplementasikan:
 * - AB-020: Verifikasi sedikitnya dua identitas pasien sebelum penyerahan makanan (nama lengkap + tanggal lahir/RM).
 * - AB-021: Pemeriksaan kesesuaian instruksi diet terkini sebelum penyerahan makanan.
 * - AB-022: Penahanan porsi makanan bila tidak sesuai / pasien puasa (dilarang diserahkan).
 * - AB-023: Makanan diserahkan tidak otomatis dianggap dikonsumsi.
 * - AB-030: Setiap alasan penahanan atau insiden wajib minimal 5 karakter.
 * - AB-032: Otorisasi ketat peran Petugas Distribusi dan batas bangsal (daftarBangsalId).
 */

import { randomUUID } from "node:crypto";
import {
  KODE_GALAT,
  type ProfilSesiPengguna,
  type RingkasanDistribusiOverviewDto,
  type SesiMakanDapur,
  type StatusSerahPorsi,
  type StatusTroliDistribusi,
  type ItemTroliDistribusiDto,
  type ItemPorsiDistribusiDto,
  type ItemLaporanInsidenDto,
  type JenisInsidenDistribusi,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type {
  ItemPorsiDistribusiEntitas,
  LaporanInsidenEntitas,
  TroliDistribusiEntitas,
  VerifikasiDuaIdentitasEntitas,
} from "../model/delivery.model.ts";
import type { DeliveryRepository } from "../repository/delivery.repository.ts";
import {
  skemaBuatTroli,
  skemaLaporInsiden,
  skemaTahanPorsiDistribusi,
  skemaVerifikasiDanSerah,
} from "../validators/delivery.validator.ts";

export interface KaitanDelivery {
  padaInsidenDilaporkan?: (insiden: LaporanInsidenEntitas) => Promise<void>;
  tinjauPesanan?: () => Promise<void>;
  periksaPenyerahan?: (porsi: ItemPorsiDistribusiEntitas) => Promise<void>;
}

export class DeliveryService {
  private readonly repository: DeliveryRepository;
  private readonly kaitan: KaitanDelivery;

  public constructor(repository: DeliveryRepository, kaitan: KaitanDelivery = {}) {
    this.repository = repository;
    this.kaitan = kaitan;
  }

  private antrianMutasi: Promise<void> = Promise.resolve();
  private async mutasi<T>(aksi: (service: DeliveryService) => Promise<T>): Promise<T> {
    let selesai!: () => void;
    const sebelumnya = this.antrianMutasi;
    this.antrianMutasi = new Promise<void>((resolve) => { selesai = resolve; });
    await sebelumnya;
    try { return this.repository.transaksi ? await this.repository.transaksi((repo) => aksi(new DeliveryService(repo, this.kaitan))) : await aksi(this); }
    finally { selesai(); }
  }
  public buatTroliDistribusi(pengguna: ProfilSesiPengguna, input: unknown) { return this.mutasi((service) => service.buatTroliDistribusiDalamTransaksi(pengguna, input)); }
  public berangkatkanTroli(pengguna: ProfilSesiPengguna, id: string) { return this.mutasi((service) => service.berangkatkanTroliDalamTransaksi(pengguna, id)); }
  public kembalikanTroli(pengguna: ProfilSesiPengguna, id: string) { return this.mutasi((service) => service.kembalikanTroliDalamTransaksi(pengguna, id)); }
  public verifikasiDanSerahkanPorsi(pengguna: ProfilSesiPengguna, id: string, input: unknown) { return this.mutasi((service) => service.verifikasiDanSerahkanPorsiDalamTransaksi(pengguna, id, input)); }
  public tahanPorsiDistribusi(pengguna: ProfilSesiPengguna, id: string, input: unknown) { return this.mutasi((service) => service.tahanPorsiDistribusiDalamTransaksi(pengguna, id, input)); }
  public buatLaporanInsiden(pengguna: ProfilSesiPengguna, input: unknown) { return this.mutasi((service) => service.buatLaporanInsidenDalamTransaksi(pengguna, input)); }

  /**
   * Validasi otorisasi peran Petugas Distribusi dan penugasan bangsal (AB-032).
   */
  public validasiIzinAksesDistribusi(
    pengguna: ProfilSesiPengguna,
    bangsalId?: string,
    operasi = "Operasi Distribusi Makanan",
  ): void {
    if (pengguna.peran !== "petugas_distribusi") {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna: "Anda tidak memiliki izin untuk tindakan ini.",
        pesanInternal: `Akses ditolak untuk peran ${pengguna.peran} (${pengguna.id}) pada operasi '${operasi}'. Memerlukan peran petugas_distribusi. (AB-032)`,
      });
    }

    if (bangsalId) {
      if (!pengguna.daftarBangsalId.includes(bangsalId)) {
        throw new AppError({
          kode: KODE_GALAT.AKSES_DITOLAK,
          statusHttp: 403,
          pesanPengguna: "Anda tidak memiliki izin untuk tindakan ini.",
          pesanInternal: `Akses ditolak: Petugas distribusi (${pengguna.namaLengkap}) tidak memiliki penugasan pada bangsal ${bangsalId}. (AB-032)`,
        });
      }
    }
  }

  /**
   * Mengambil ringkasan metrik operasional distribusi.
   */
  public async ambilOverviewDistribusi(
    pengguna: ProfilSesiPengguna,
  ): Promise<RingkasanDistribusiOverviewDto> {
    this.validasiIzinAksesDistribusi(pengguna, undefined, "Melihat Overview Distribusi");
    const bangsalFilter =
      pengguna.peran === "petugas_distribusi" ? pengguna.daftarBangsalId : undefined;
    return this.repository.ambilRingkasanOverview(bangsalFilter);
  }

  /**
   * Mengambil daftar troli pengantaran.
   */
  public async ambilDaftarTroli(
    pengguna: ProfilSesiPengguna,
    filter?: {
      bangsalId?: string;
      sesi?: SesiMakanDapur;
      status?: StatusTroliDistribusi;
      tanggal?: string;
    },
  ): Promise<ItemTroliDistribusiDto[]> {
    this.validasiIzinAksesDistribusi(pengguna, filter?.bangsalId, "Melihat Daftar Troli");
    const troliList = await this.repository.ambilDaftarTroli(filter);
    return troliList.filter((t) => pengguna.daftarBangsalId.includes(t.bangsalId)).map((t) => this.petakanTroliDto(t));
  }

  /**
   * Membuat troli pengantaran baru ke suatu bangsal.
   */
  private async buatTroliDistribusiDalamTransaksi(
    pengguna: ProfilSesiPengguna,
    input: unknown,
  ): Promise<ItemTroliDistribusiDto> {
    const parsed = skemaBuatTroli.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: parsed.error.issues[0]?.message ?? "Input buat troli distribusi tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const { bangsalId, namaBangsal, sesiMakan, tanggalDistribusi, porsiIds, catatan } =
      parsed.data;
    this.validasiIzinAksesDistribusi(pengguna, bangsalId, "Membuat Troli Distribusi");

    const nomorTroli = await this.repository.hitungNomorTroliBerikutnya(tanggalDistribusi);
    const troliId = `trl-${randomUUID().slice(0, 8)}`;

    const entitasTroli: TroliDistribusiEntitas = {
      id: troliId,
      nomorTroli,
      bangsalId,
      namaBangsal,
      sesiMakan,
      tanggalDistribusi,
      petugasDistribusiId: pengguna.id,
      petugasDistribusiNama: pengguna.namaLengkap,
      status: "persiapan",
      totalPorsi: porsiIds.length,
      totalTerserah: 0,
      totalDitahan: 0,
      waktuBerangkat: null,
      waktuKembali: null,
      catatan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const porsiTerpilih: ItemPorsiDistribusiEntitas[] = [];
    if (new Set(porsiIds).size !== porsiIds.length) throw new AppError({ kode: KODE_GALAT.VALIDASI_GAGAL, statusHttp: 400, pesanPengguna: "Porsi tidak boleh dipilih dua kali." });
    for (const id of porsiIds) {
      const porsi = await this.repository.ambilItemPorsiBerdasarkanId(id);
      if (!porsi || porsi.bangsalId !== bangsalId || porsi.sesiMakan !== sesiMakan || porsi.statusSerah !== "menunggu_pengiriman") throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Porsi harus siap dikirim pada bangsal dan sesi yang sama, serta belum berada di troli lain." });
      this.validasiIzinAksesDistribusi(pengguna, porsi.bangsalId);
      porsiTerpilih.push(porsi);
    }
    const tersimpan = await this.repository.simpanTroli(entitasTroli);
    for (const porsi of porsiTerpilih) await this.repository.perbaruiItemPorsi(porsi.id, { troliId, nomorTroli, statusSerah: "dalam_troli" });
    return this.petakanTroliDto(tersimpan);
  }

  /**
   * Memberangkatkan troli pengantaran menuju bangsal.
   */
  private async berangkatkanTroliDalamTransaksi(
    pengguna: ProfilSesiPengguna,
    troliId: string,
  ): Promise<ItemTroliDistribusiDto> {
    const troli = await this.repository.ambilTroliBerdasarkanId(troliId);
    if (!troli) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Troli ${troliId} tidak ditemukan.`,
        pesanInternal: `Troli dengan ID ${troliId} tidak ditemukan.`,
      });
    }
    this.validasiIzinAksesDistribusi(pengguna, troli.bangsalId, "Memberangkatkan Troli");

    if (troli.status !== "persiapan") {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna: `Troli ${troli.nomorTroli} sudah berstatus '${troli.status}' dan tidak dapat diberangkatkan lagi.`,
        pesanInternal: `Troli ${troli.id} memiliki status ${troli.status}`,
      });
    }

    const terupdate = await this.repository.perbaruiTroli(troliId, {
      status: "dalam_perjalanan",
      waktuBerangkat: new Date().toISOString(),
    });
    return this.petakanTroliDto(terupdate);
  }

  /**
   * Menyelesaikan rute pengantaran troli dan mengembalikannya ke dapur gizi.
   */
  private async kembalikanTroliDalamTransaksi(
    pengguna: ProfilSesiPengguna,
    troliId: string,
  ): Promise<ItemTroliDistribusiDto> {
    const troli = await this.repository.ambilTroliBerdasarkanId(troliId);
    if (!troli) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Troli ${troliId} tidak ditemukan.`,
        pesanInternal: `Troli dengan ID ${troliId} tidak ditemukan.`,
      });
    }
    this.validasiIzinAksesDistribusi(pengguna, troli.bangsalId, "Mengembalikan Troli");

    const terupdate = await this.repository.perbaruiTroli(troliId, {
      status: "selesai",
      waktuKembali: new Date().toISOString(),
    });
    return this.petakanTroliDto(terupdate);
  }

  /**
   * Mengambil daftar item porsi makanan dalam alur distribusi.
   */
  public async ambilDaftarItemPorsi(
    pengguna: ProfilSesiPengguna,
    filter?: {
      troliId?: string;
      bangsalId?: string;
      statusSerah?: StatusSerahPorsi;
      nomorRm?: string;
    },
  ): Promise<ItemPorsiDistribusiDto[]> {
    this.validasiIzinAksesDistribusi(pengguna, filter?.bangsalId, "Melihat Daftar Porsi Distribusi");
    await this.kaitan.tinjauPesanan?.();
    const items = await this.repository.ambilDaftarItemPorsi(filter);
    return items.filter((i) => pengguna.daftarBangsalId.includes(i.bangsalId)).map((i) => this.petakanItemPorsiDto(i));
  }

  /**
   * Verifikasi dua identitas pasien (AB-020) & pemeriksaan diet terkini (AB-021),
   * dilanjutkan dengan penyerahan makanan ke pasien/keluarga (AB-023).
   */
  private async verifikasiDanSerahkanPorsiDalamTransaksi(
    pengguna: ProfilSesiPengguna,
    porsiId: string,
    input: unknown,
  ): Promise<ItemPorsiDistribusiDto> {
    const parsed = skemaVerifikasiDanSerah.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: parsed.error.issues[0]?.message ?? "Input verifikasi penyerahan tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const {
      namaPasienVerifikasi,
      tanggalLahirVerifikasi,
      nomorRmVerifikasi,
      metodeVerifikasi,
      namaPenerima,
      hubunganPenerima,
      catatanVerifikasi,
    } = parsed.data;

    const porsi = await this.repository.ambilItemPorsiBerdasarkanId(porsiId);
    if (!porsi) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Porsi makanan ${porsiId} tidak ditemukan.`,
        pesanInternal: `Item porsi dengan ID ${porsiId} tidak ditemukan.`,
      });
    }
    this.validasiIzinAksesDistribusi(pengguna, porsi.bangsalId, "Verifikasi & Penyerahan Makanan");

    // AB-022: Makanan yang ditahan tidak dapat didistribusikan
    if (porsi.statusSerah === "ditahan_klinis") {
      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna: `Porsi ${porsi.nomorLabel} sedang ditahan klinis (${porsi.alasanGagalAtauTahan}). Dilarang diserahkan ke pasien! (AB-022)`,
        pesanInternal: `Porsi ${porsi.id} berstatus ditahan_klinis`,
      });
    }

    if (porsi.statusSerah === "berhasil_diserahkan") {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna: `Porsi ${porsi.nomorLabel} sudah berhasil diserahkan sebelumnya pada ${porsi.waktuSerah}.`,
        pesanInternal: `Porsi ${porsi.id} sudah berstatus berhasil_diserahkan`,
      });
    }

    if (!["menunggu_pengiriman", "dalam_troli"].includes(porsi.statusSerah)) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Porsi yang dibatalkan atau gagal diserahkan tidak boleh diserahkan kembali." });
    await this.kaitan.periksaPenyerahan?.(porsi);

    // AB-020: Verifikasi sedikitnya dua pengenal pasien
    // Pengenal 1: Nama Pasien (case-insensitive substring/match)
    const namaCocok =
      porsi.namaPasien.toLowerCase().trim().replace(/\s+/g, " ") === namaPasienVerifikasi.toLowerCase().trim().replace(/\s+/g, " ");

    // Pengenal 2: Tanggal Lahir atau Nomor RM
    const tglLahirCocok = porsi.tanggalLahirPasien === tanggalLahirVerifikasi;
    const nomorRmCocok = nomorRmVerifikasi
      ? porsi.nomorRm.toLowerCase().trim() === nomorRmVerifikasi.toLowerCase().trim()
      : false;

    const duaIdentitasValid = namaCocok && (tglLahirCocok || nomorRmCocok);

    // Simpan audit log verifikasi 2 identitas
    const verifikasiEntitas: VerifikasiDuaIdentitasEntitas = {
      id: `vrf-${randomUUID().slice(0, 8)}`,
      itemPorsiDistribusiId: porsi.id,
      namaPasienDiinput: namaPasienVerifikasi,
      tanggalLahirDiinput: tanggalLahirVerifikasi,
      nomorRmDiinput: nomorRmVerifikasi ?? "-",
      metodeVerifikasi,
      statusCocok: duaIdentitasValid,
      verifikatorId: pengguna.id,
      verifikatorNama: pengguna.namaLengkap,
      catatanVerifikasi: catatanVerifikasi || (duaIdentitasValid ? "Verifikasi 2 pengenal cocok" : "Verifikasi 2 pengenal gagal"),
      createdAt: new Date().toISOString(),
    };
    await this.repository.simpanVerifikasiDuaIdentitas(verifikasiEntitas);

    if (!duaIdentitasValid) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna: `Verifikasi dua identitas pasien gagal (AB-020). Nama ('${namaPasienVerifikasi}') atau tanggal lahir ('${tanggalLahirVerifikasi}') tidak cocok dengan data porsi pasien (${porsi.namaPasien}, ${porsi.tanggalLahirPasien}). Nomor kamar bukan satu-satunya pengenal.`,
        pesanInternal: `Verifikasi dua identitas gagal: namaCocok=${namaCocok}, tglLahirCocok=${tglLahirCocok}, nomorRmCocok=${nomorRmCocok}`,
      });
    }

    // AB-021: Pemeriksaan instruksi diet terkini
    if (
      porsi.statusKesesuaianDiet === "berubah_perlu_tahan" ||
      porsi.dietTerkiniPasien.toLowerCase().includes("npo") ||
      porsi.dietTerkiniPasien.toLowerCase().includes("puasa")
    ) {
      // Otomatis tahan makanan
      await this.repository.perbaruiItemPorsi(porsi.id, {
        statusSerah: "ditahan_klinis",
        statusKesesuaianDiet: "berubah_perlu_tahan",
        alasanGagalAtauTahan: `Instruksi diet pasien berubah: '${porsi.dietTerkiniPasien}'. Makanan lama tidak boleh diserahkan (AB-021).`,
      });

      if (porsi.troliId) {
        const troli = await this.repository.ambilTroliBerdasarkanId(porsi.troliId);
        if (troli) {
          await this.repository.perbaruiTroli(troli.id, {
            totalDitahan: troli.totalDitahan + 1,
          });
        }
      }

      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna: `Instruksi diet terkini pasien telah berubah menjadi '${porsi.dietTerkiniPasien}'. Makanan lama berlabel '${porsi.jenisDietLabel}' DILARANG diserahkan dan otomatis ditahan (AB-021, AB-022).`,
        pesanInternal: `Perubahan diet mendadak: ${porsi.dietTerkiniPasien}`,
      });
    }

    // Lolos semua syarat keselamatan -> Catat penyerahan (AB-023)
    const waktuSekarang = new Date().toISOString();
    const terupdate = await this.repository.perbaruiItemPorsi(porsi.id, {
      statusSerah: "berhasil_diserahkan",
      waktuSerah: waktuSekarang,
      namaPenerima,
      hubunganPenerima,
      duaIdentitasTerverifikasi: true,
      petugasDistribusiNama: pengguna.namaLengkap,
    });

    // Catat log riwayat penyerahan
    await this.repository.simpanRiwayatPenyerahan({
      id: `rwy-${randomUUID().slice(0, 8)}`,
      itemPorsiDistribusiId: porsi.id,
      troliId: porsi.troliId,
      statusSebelumnya: porsi.statusSerah,
      statusSesudahnya: "berhasil_diserahkan",
      namaPenerima,
      hubunganPenerima,
      petugasId: pengguna.id,
      petugasNama: pengguna.namaLengkap,
      waktuTransisi: waktuSekarang,
      keterangan: `Makanan berhasil diserahkan setelah verifikasi dua pengenal (${metodeVerifikasi}) dan konfirmasi diet cocok.`,
    });

    // Update counter troli
    if (porsi.troliId) {
      const troli = await this.repository.ambilTroliBerdasarkanId(porsi.troliId);
      if (troli) {
        await this.repository.perbaruiTroli(troli.id, {
          totalTerserah: troli.totalTerserah + 1,
        });
      }
    }

    return this.petakanItemPorsiDto(terupdate);
  }

  /**
   * Menahan porsi makanan saat pengantaran karena perubahan klinis atau instruksi medis (AB-022, AB-030).
   */
  private async tahanPorsiDistribusiDalamTransaksi(
    pengguna: ProfilSesiPengguna,
    porsiId: string,
    input: unknown,
  ): Promise<ItemPorsiDistribusiDto> {
    const parsed = skemaTahanPorsiDistribusi.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: parsed.error.issues[0]?.message ?? "Input alasan penahanan distribusi tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const { alasanPenahanan } = parsed.data;
    const porsi = await this.repository.ambilItemPorsiBerdasarkanId(porsiId);
    if (!porsi) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Porsi makanan ${porsiId} tidak ditemukan.`,
        pesanInternal: `Item porsi dengan ID ${porsiId} tidak ditemukan.`,
      });
    }
    this.validasiIzinAksesDistribusi(pengguna, porsi.bangsalId, "Menahan Porsi Distribusi");

    if (porsi.statusSerah === "berhasil_diserahkan") {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna: `Porsi ${porsi.nomorLabel} sudah berhasil diserahkan ke pasien dan tidak dapat ditahan di troli.`,
        pesanInternal: `Porsi ${porsi.id} sudah berhasil_diserahkan`,
      });
    }

    const waktuSekarang = new Date().toISOString();
    const terupdate = await this.repository.perbaruiItemPorsi(porsi.id, {
      statusSerah: "ditahan_klinis",
      alasanGagalAtauTahan: alasanPenahanan,
      petugasDistribusiNama: pengguna.namaLengkap,
    });

    await this.repository.simpanRiwayatPenyerahan({
      id: `rwy-${randomUUID().slice(0, 8)}`,
      itemPorsiDistribusiId: porsi.id,
      troliId: porsi.troliId,
      statusSebelumnya: porsi.statusSerah,
      statusSesudahnya: "ditahan_klinis",
      namaPenerima: "-",
      hubunganPenerima: "perawat_penanggung_jawab",
      petugasId: pengguna.id,
      petugasNama: pengguna.namaLengkap,
      waktuTransisi: waktuSekarang,
      keterangan: `Porsi ditahan saat pengantaran: ${alasanPenahanan}`,
    });

    if (porsi.troliId) {
      const troli = await this.repository.ambilTroliBerdasarkanId(porsi.troliId);
      if (troli) {
        await this.repository.perbaruiTroli(troli.id, {
          totalDitahan: troli.totalDitahan + 1,
        });
      }
    }

    return this.petakanItemPorsiDto(terupdate);
  }

  /**
   * Melaporkan insiden pengantaran makanan (AB-030).
   */
  private async buatLaporanInsidenDalamTransaksi(
    pengguna: ProfilSesiPengguna,
    input: unknown,
  ): Promise<ItemLaporanInsidenDto> {
    const parsed = skemaLaporInsiden.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: parsed.error.issues[0]?.message ?? "Input laporan insiden tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const {
      troliId,
      porsiDistribusiId,
      bangsalId,
      namaBangsal,
      jenisInsiden,
      deskripsiInsiden,
      tindakanKoreksi,
    } = parsed.data;

    this.validasiIzinAksesDistribusi(pengguna, bangsalId, "Melaporkan Insiden Distribusi");

    const nomorInsiden = await this.repository.hitungNomorInsidenBerikutnya();
    const insidenId = `ins-${randomUUID().slice(0, 8)}`;
    const waktuSekarang = new Date().toISOString();

    const entitasInsiden: LaporanInsidenEntitas = {
      id: insidenId,
      nomorInsiden,
      troliId: troliId ?? null,
      porsiDistribusiId: porsiDistribusiId ?? null,
      bangsalId,
      namaBangsal,
      jenisInsiden,
      deskripsiInsiden,
      tindakanKoreksi,
      dilaporkanOlehId: pengguna.id,
      dilaporkanOlehNama: pengguna.namaLengkap,
      waktuKejadian: waktuSekarang,
      statusPenyelesaian: "ditindaklanjuti",
      createdAt: waktuSekarang,
      updatedAt: waktuSekarang,
    };

    const tersimpan = await this.repository.simpanLaporanInsiden(entitasInsiden);
    await this.kaitan.padaInsidenDilaporkan?.(tersimpan);
    return this.petakanInsidenDto(tersimpan);
  }

  /**
   * Mengambil daftar laporan insiden distribusi makanan.
   */
  public async ambilDaftarLaporanInsiden(
    pengguna: ProfilSesiPengguna,
    filter?: {
      bangsalId?: string;
      jenis?: JenisInsidenDistribusi;
      status?: "terbuka" | "ditindaklanjuti" | "selesai";
    },
  ): Promise<ItemLaporanInsidenDto[]> {
    this.validasiIzinAksesDistribusi(pengguna, filter?.bangsalId, "Melihat Daftar Insiden Distribusi");
    const daftar = await this.repository.ambilDaftarLaporanInsiden(filter);
    return daftar.map((i) => this.petakanInsidenDto(i));
  }

  private petakanTroliDto(t: TroliDistribusiEntitas): ItemTroliDistribusiDto {
    return {
      id: t.id,
      nomorTroli: t.nomorTroli,
      bangsalId: t.bangsalId,
      namaBangsal: t.namaBangsal,
      sesiMakan: t.sesiMakan,
      tanggalDistribusi: t.tanggalDistribusi,
      petugasDistribusiId: t.petugasDistribusiId,
      petugasDistribusiNama: t.petugasDistribusiNama,
      status: t.status,
      totalPorsi: t.totalPorsi,
      totalTerserah: t.totalTerserah,
      totalDitahan: t.totalDitahan,
      waktuBerangkat: t.waktuBerangkat,
      waktuKembali: t.waktuKembali,
      catatan: t.catatan,
    };
  }

  private petakanItemPorsiDto(p: ItemPorsiDistribusiEntitas): ItemPorsiDistribusiDto {
    return {
      id: p.id,
      troliId: p.troliId,
      nomorTroli: p.nomorTroli,
      labelPorsiId: p.labelPorsiId,
      nomorLabel: p.nomorLabel,
      nomorPesanan: p.nomorPesanan,
      pasienId: p.pasienId,
      namaPasien: p.namaPasien,
      nomorRm: p.nomorRm,
      tanggalLahirPasien: p.tanggalLahirPasien,
      bangsalId: p.bangsalId,
      namaBangsal: p.namaBangsal,
      kamarBed: p.kamarBed,
      sesiMakan: p.sesiMakan,
      namaMenu: p.namaMenu,
      jenisDietLabel: p.jenisDietLabel,
      dietTerkiniPasien: p.dietTerkiniPasien,
      statusKesesuaianDiet: p.statusKesesuaianDiet,
      statusSerah: p.statusSerah,
      waktuSerah: p.waktuSerah,
      namaPenerima: p.namaPenerima,
      hubunganPenerima: p.hubunganPenerima,
      alasanGagalAtauTahan: p.alasanGagalAtauTahan,
      duaIdentitasTerverifikasi: p.duaIdentitasTerverifikasi,
      petugasDistribusiNama: p.petugasDistribusiNama,
    };
  }

  private petakanInsidenDto(i: LaporanInsidenEntitas): ItemLaporanInsidenDto {
    return {
      id: i.id,
      nomorInsiden: i.nomorInsiden,
      troliId: i.troliId,
      porsiDistribusiId: i.porsiDistribusiId,
      bangsalId: i.bangsalId,
      namaBangsal: i.namaBangsal,
      jenisInsiden: i.jenisInsiden,
      deskripsiInsiden: i.deskripsiInsiden,
      tindakanKoreksi: i.tindakanKoreksi,
      dilaporkanOlehNama: i.dilaporkanOlehNama,
      waktuKejadian: i.waktuKejadian,
      statusPenyelesaian: i.statusPenyelesaian,
    };
  }
}
