/**
 * @fileoverview Layanan orkestrasi bisnis untuk Layanan Inventaris & Gudang (Tahap 7).
 * Mengimplementasikan:
 * 1. Manajemen katalog bahan baku dan monitoring batas stok minimum (safety stock).
 * 2. Penerimaan lot bahan baku dengan inspeksi mutu (AB-015: bahan tidak layak dilarang untuk produksi).
 * 3. Alokasi stok bahan dapur (AB-016: alokasi dibedakan dari pengeluaran aktual).
 * 4. Pengeluaran aktual bahan secara FEFO (First Expired First Out) & FIFO (AB-017, AB-018).
 * 5. Stok opname fisik berkala dengan alasan wajib dan jejak audit mutasi (BRD 7.6, AB-030).
 */

import {
  KODE_GALAT,
  type ItemKartuStokMutasiDto,
  type ItemKatalogBahanDto,
  type ItemPenerimaanLotDto,
  type ItemPenyesuaianStokOpnameDto,
  type ItemPermintaanBahanDto,
  type ProfilSesiPengguna,
  type StatusKetersediaanStok,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type {
  EntitasPenerimaanLot,
  EntitasPenyesuaianStokOpname,
  EntitasPermintaanBahanDapur,
  InputPenerimaanLotBaru,
  InputPenyesuaianOpnameBaru,
  InputPermintaanBahanBaru,
  RincianPermintaanItemEntitas,
} from "../model/inventory.model.ts";
import type { InventoryRepository } from "../repository/inventory.repository.ts";
import {
  skemaInputPembuanganLot,
  skemaInputPenerimaanLot,
  skemaInputPenyesuaianOpname,
  skemaInputPermintaanBahan,
} from "../validators/inventory.validator.ts";

export class InventoryService {
  private readonly repository: InventoryRepository;

  constructor(repository: InventoryRepository) {
    this.repository = repository;
  }

  private antrianMutasi: Promise<void> = Promise.resolve();
  private async mutasi<T>(aksi: (service: InventoryService) => Promise<T>): Promise<T> {
    let selesai!: () => void;
    const sebelumnya = this.antrianMutasi;
    this.antrianMutasi = new Promise<void>((resolve) => { selesai = resolve; });
    await sebelumnya;
    try {
      return this.repository.transaksi
        ? await this.repository.transaksi((repo) => aksi(new InventoryService(repo)))
        : await aksi(this);
    } finally { selesai(); }
  }

  public catatPenerimaanLot(input: InputPenerimaanLotBaru, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.catatPenerimaanLotDalamTransaksi(input, profil));
  }
  public buatPermintaanSintetisDapur(input: InputPermintaanBahanBaru, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.buatPermintaanSintetisDapurDalamTransaksi(input, profil));
  }
  public alokasikanBahanPermintaan(permintaanId: string, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.alokasikanBahanPermintaanDalamTransaksi(permintaanId, profil));
  }
  public keluarkanBahanPermintaan(permintaanId: string, catatanPengeluaran?: string, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.keluarkanBahanPermintaanDalamTransaksi(permintaanId, catatanPengeluaran, profil));
  }
  public tolakPermintaanBahan(permintaanId: string, alasanPenolakan: string, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.tolakPermintaanBahanDalamTransaksi(permintaanId, alasanPenolakan, profil));
  }
  public catatPenyesuaianOpname(input: InputPenyesuaianOpnameBaru, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.catatPenyesuaianOpnameDalamTransaksi(input, profil));
  }
  public buangBahanKedaluwarsa(lotId: string, alasan: string, profil?: ProfilSesiPengguna | null) {
    return this.mutasi((service) => service.buangBahanKedaluwarsaDalamTransaksi(lotId, alasan, profil));
  }

  /**
   * Validasi otorisasi peran Petugas Gudang (AB-032 Fail-Closed).
   */
  public validasiIzinAksesGudang(profil?: ProfilSesiPengguna | null, aksi = "Operasi Inventaris"): void {
    if (!profil) {
      throw new AppError({
        kode: KODE_GALAT.AUTENTIKASI_GAGAL,
        statusHttp: 401,
        pesanPengguna: "Sesi otentikasi telah berakhir. Silakan masuk kembali.",
        pesanInternal: "Token sesi tidak ditemukan pada cookie permintaan.",
      });
    }

    const berwenang =
      profil.peran === "petugas_gudang" ||
      profil.daftarIzin.includes("gudang:persediaan:kelola") ||
      profil.daftarIzin.includes("gudang:penerimaan:catat");

    if (!berwenang) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akses ditolak: Operasi inventaris dan penerimaan bahan baku hanya dapat dilakukan oleh Petugas Gudang berwenang.",
        pesanInternal: `Akses ditolak untuk peran ${profil.peran} (${profil.id}) pada aksi '${aksi}'.`,
      });
    }
  }

  /**
   * Mengambil seluruh katalog bahan baku beserta status ketersediaan stok fisik vs layak vs dialokasikan.
   */
  public async ambilKatalogBahan(profil?: ProfilSesiPengguna | null): Promise<ItemKatalogBahanDto[]> {
    this.validasiIzinAksesGudang(profil, "Melihat Katalog Bahan Baku & Stok");

    const daftarBahan = await this.repository.ambilSemuaBahan();

    return daftarBahan.map((b) => {
      const stokTersedia = Math.max(0, Number((b.stokLayak - b.stokDialokasikan).toFixed(2)));
      let statusStok: StatusKetersediaanStok = "aman";
      if (stokTersedia <= 0) {
        statusStok = "habis";
      } else if (stokTersedia <= b.stokMinimum) {
        statusStok = "menipis";
      }

      return {
        id: b.id,
        kodeBahan: b.kodeBahan,
        namaBahan: b.namaBahan,
        kategori: b.kategori,
        satuan: b.satuan,
        suhuPenyimpanan: b.suhuPenyimpanan,
        stokMinimum: b.stokMinimum,
        stokFisik: b.stokFisik,
        stokLayak: b.stokLayak,
        stokDialokasikan: b.stokDialokasikan,
        stokDitahan: b.stokDitahan,
        stokTersedia,
        daftarAlergen: b.daftarAlergen,
        kaloriPer100g: b.kaloriPer100g,
        proteinPer100g: b.proteinPer100g,
        lemakPer100g: b.lemakPer100g,
        karbohidratPer100g: b.karbohidratPer100g,
        statusStok,
        dibuatPada: b.dibuatPada,
        diperbaruiPada: b.diperbaruiPada,
      };
    });
  }

  /**
   * Mencatat penerimaan lot bahan baku dengan inspeksi kualitas (AB-015, AB-018).
   */
  private async catatPenerimaanLotDalamTransaksi(
    input: InputPenerimaanLotBaru,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPenerimaanLotDto> {
    this.validasiIzinAksesGudang(profil, "Mencatat Penerimaan Lot Bahan Baku");

    const valid = skemaInputPenerimaanLot.safeParse(input);
    if (!valid.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: valid.error.issues[0]?.message ?? "Data penerimaan bahan tidak valid.",
        pesanInternal: JSON.stringify(valid.error.issues),
      });
    }

    const bahan = await this.repository.ambilBahanBerdasarkanId(valid.data.bahanId);
    if (!bahan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Bahan baku yang dipilih tidak terdaftar dalam katalog master.",
        pesanInternal: `Bahan ID ${valid.data.bahanId} tidak ditemukan di katalog_bahan_baku.`,
      });
    }

    const nomorLot = await this.repository.hitungNomorLotBerikutnya();
    const sekarang = new Date().toISOString();
    const petugasId = profil?.id ?? "usr-sintetis-gudang";
    const petugasNama = profil?.namaLengkap ?? "Petugas Gudang";

    const lotBaru: EntitasPenerimaanLot = {
      id: `lot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nomorLot,
      bahanId: bahan.id,
      namaPemasok: valid.data.namaPemasok,
      jumlahMasuk: valid.data.jumlahMasuk,
      sisaStokLot: valid.data.jumlahMasuk,
      satuan: bahan.satuan,
      tanggalPenerimaan: valid.data.tanggalPenerimaan,
      tanggalKedaluwarsa: valid.data.tanggalKedaluwarsa,
      statusMutu: valid.data.statusMutu,
      catatanPemeriksaan: valid.data.catatanPemeriksaan,
      suhuTercatatCelsius: valid.data.suhuTercatatCelsius ?? null,
      petugasPenerimaId: petugasId,
      petugasPenerimaNama: petugasNama,
      statusLot: valid.data.statusMutu === "layak_diterima" ? "aktif" : "kedaluwarsa",
      dibuatPada: sekarang,
      diperbaruiPada: sekarang,
    };

    // AB-015: Bahan tidak layak dilarang untuk produksi
    if (valid.data.statusMutu === "layak_diterima") {
      const stokFisikBaru = Number((bahan.stokFisik + valid.data.jumlahMasuk).toFixed(2));
      const stokLayakBaru = Number((bahan.stokLayak + valid.data.jumlahMasuk).toFixed(2));
      await this.repository.perbaruiStokBahan(bahan.id, {
        stokFisik: stokFisikBaru,
        stokLayak: stokLayakBaru,
      });

      // Catat mutasi kartu stok
      await this.repository.catatMutasiKartuStok({
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bahanId: bahan.id,
        nomorLot,
        jenisMutasi: "penerimaan",
        referensiDokumen: nomorLot,
        jumlahMasuk: valid.data.jumlahMasuk,
        jumlahKeluar: 0,
        saldoAkhir: stokFisikBaru,
        keterangan: `Penerimaan lolos uji mutu dari ${valid.data.namaPemasok}. Catatan: ${valid.data.catatanPemeriksaan}`,
        petugasNama,
        waktuPencatatan: sekarang,
      });
    } else {
      // Ditolak / Dikarungtina: Catat stok ditahan, TIDAK masuk stok layak
      const stokFisikBaru = Number((bahan.stokFisik + valid.data.jumlahMasuk).toFixed(2));
      const stokDitahanBaru = Number((bahan.stokDitahan + valid.data.jumlahMasuk).toFixed(2));
      await this.repository.perbaruiStokBahan(bahan.id, {
        stokFisik: stokFisikBaru,
        stokDitahan: stokDitahanBaru,
      });

      await this.repository.catatMutasiKartuStok({
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bahanId: bahan.id,
        nomorLot,
        jenisMutasi: "penerimaan",
        referensiDokumen: nomorLot,
        jumlahMasuk: valid.data.jumlahMasuk,
        jumlahKeluar: 0,
        saldoAkhir: stokFisikBaru,
        keterangan: `[PENAHANAN KESELAMATAN] Bahan ${valid.data.statusMutu.toUpperCase()} dari ${valid.data.namaPemasok}. Catatan: ${valid.data.catatanPemeriksaan}`,
        petugasNama,
        waktuPencatatan: sekarang,
      });
    }

    const disimpan = await this.repository.simpanPenerimaanLot(lotBaru);

    return {
      ...disimpan,
      kodeBahan: bahan.kodeBahan,
      namaBahan: bahan.namaBahan,
    };
  }

  /**
   * Mengambil daftar lot penerimaan bahan baku.
   */
  public async ambilDaftarLot(
    filter?: { bahanId?: string; statusLot?: string },
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPenerimaanLotDto[]> {
    this.validasiIzinAksesGudang(profil, "Melihat Daftar Lot Bahan");

    const lots = await this.repository.ambilSemuaLot(filter);
    const bahanList = await this.repository.ambilSemuaBahan();
    const bahanMap = new Map(bahanList.map((b) => [b.id, b]));

    return lots.map((l) => {
      const b = bahanMap.get(l.bahanId);
      return {
        ...l,
        kodeBahan: b?.kodeBahan ?? "UNKNOWN",
        namaBahan: b?.namaBahan ?? "UNKNOWN",
      };
    });
  }

  /**
   * Mengajukan permintaan bahan dapur sintetis (Tahap 7 pengujian pengeluaran).
   */
  private async buatPermintaanSintetisDapurDalamTransaksi(
    input: InputPermintaanBahanBaru,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPermintaanBahanDto> {
    this.validasiIzinAksesGudang(profil, "Membuat Permintaan Bahan Dapur");

    const valid = skemaInputPermintaanBahan.safeParse(input);
    if (!valid.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: valid.error.issues[0]?.message ?? "Data permintaan bahan tidak valid.",
        pesanInternal: JSON.stringify(valid.error.issues),
      });
    }

    const nomorPermintaan = await this.repository.hitungNomorPermintaanBerikutnya();
    const sekarang = new Date().toISOString();

    const rincianItems: RincianPermintaanItemEntitas[] = [];
    for (const item of valid.data.daftarItem) {
      const b = await this.repository.ambilBahanBerdasarkanId(item.bahanId);
      if (!b) {
        throw new AppError({
          kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
          statusHttp: 404,
          pesanPengguna: `Bahan baku dengan ID ${item.bahanId} tidak ditemukan.`,
          pesanInternal: `Bahan ID ${item.bahanId} tidak valid.`,
        });
      }
      rincianItems.push({
        bahanId: b.id,
        kodeBahan: b.kodeBahan,
        namaBahan: b.namaBahan,
        jumlahDiminta: item.jumlahDiminta,
        jumlahDialokasikan: 0,
        jumlahDikeluarkan: 0,
        satuan: b.satuan,
      });
    }

    const permintaanBaru: EntitasPermintaanBahanDapur = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nomorPermintaan,
      tanggalKebutuhan: valid.data.tanggalKebutuhan,
      unitPeminta: valid.data.unitPeminta,
      keterangan: valid.data.keterangan,
      status: "menunggu",
      alasanPenolakan: null,
      daftarItem: rincianItems,
      catatanSelisih: null,
      waktuPermintaan: sekarang,
      waktuAlokasi: null,
      waktuPengeluaran: null,
      petugasGudangId: null,
      petugasGudangNama: null,
    };

    const disimpan = await this.repository.simpanPermintaanBahan(permintaanBaru);
    return { ...disimpan };
  }

  /**
   * Mengambil daftar permintaan bahan dapur.
   */
  public async ambilSemuaPermintaan(
    filter?: { status?: string; tanggal?: string },
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPermintaanBahanDto[]> {
    this.validasiIzinAksesGudang(profil, "Melihat Daftar Permintaan Bahan Dapur");
    return this.repository.ambilSemuaPermintaan(filter);
  }

  /**
   * Mengalokasikan bahan baku untuk permintaan dapur (AB-016: alokasi memindahkan stok layak ke dialokasikan).
   */
  private async alokasikanBahanPermintaanDalamTransaksi(
    permintaanId: string,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPermintaanBahanDto> {
    this.validasiIzinAksesGudang(profil, "Mengalokasikan Stok Permintaan Dapur");

    const permintaan = await this.repository.ambilPermintaanBerdasarkanId(permintaanId);
    if (!permintaan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Permintaan bahan dapur tidak ditemukan.",
        pesanInternal: `Permintaan ID ${permintaanId} tidak ditemukan.`,
      });
    }

    if (permintaan.status !== "menunggu") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 400,
        pesanPengguna: `Permintaan ini berstatus '${permintaan.status}' dan tidak dapat dialokasikan ulang.`,
        pesanInternal: `Status permintaan saat ini: ${permintaan.status}.`,
      });
    }

    // AB-016 & AB-017: Cek ketersediaan stok layak untuk semua item
    for (const item of permintaan.daftarItem) {
      const b = await this.repository.ambilBahanBerdasarkanId(item.bahanId);
      if (!b) {
        throw new AppError({
          kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
          statusHttp: 404,
          pesanPengguna: `Bahan ${item.namaBahan} tidak ditemukan.`,
          pesanInternal: `Bahan ID ${item.bahanId} hilang.`,
        });
      }

      const stokTersedia = Number((b.stokLayak - b.stokDialokasikan).toFixed(2));
      if (stokTersedia < item.jumlahDiminta) {
        throw new AppError({
          kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
          statusHttp: 422,
          pesanPengguna: `Stok layak tersedia untuk bahan '${b.namaBahan}' tidak mencukupi (Tersedia: ${stokTersedia} ${b.satuan}, Diminta: ${item.jumlahDiminta} ${b.satuan}). Lakukan pengadaan atau tolak permintaan.`,
          pesanInternal: `AB-017 pelanggaran stok: bahan ${b.id} stokTersedia ${stokTersedia} < requested ${item.jumlahDiminta}.`,
        });
      }
    }

    // Eksekusi alokasi: pindahkan ke stokDialokasikan, stokFisik TETAP (AB-016)
    const itemTerbarui: RincianPermintaanItemEntitas[] = [];
    for (const item of permintaan.daftarItem) {
      const b = (await this.repository.ambilBahanBerdasarkanId(item.bahanId))!;
      const stokDialokasikanBaru = Number((b.stokDialokasikan + item.jumlahDiminta).toFixed(2));
      await this.repository.perbaruiStokBahan(b.id, {
        stokDialokasikan: stokDialokasikanBaru,
      });

      // Catat mutasi alokasi
      await this.repository.catatMutasiKartuStok({
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bahanId: b.id,
        nomorLot: null,
        jenisMutasi: "alokasi",
        referensiDokumen: permintaan.nomorPermintaan,
        jumlahMasuk: 0,
        jumlahKeluar: item.jumlahDiminta,
        saldoAkhir: b.stokFisik, // Stok fisik tidak berkurang saat alokasi (AB-016)
        keterangan: `Alokasi untuk ${permintaan.unitPeminta} (${permintaan.nomorPermintaan})`,
        petugasNama: profil?.namaLengkap ?? "Petugas Gudang",
        waktuPencatatan: new Date().toISOString(),
      });

      itemTerbarui.push({
        ...item,
        jumlahDialokasikan: item.jumlahDiminta,
      });
    }

    const updated = await this.repository.perbaruiPermintaan(permintaan.id, {
      status: "dialokasikan",
      daftarItem: itemTerbarui,
      waktuAlokasi: new Date().toISOString(),
      petugasGudangId: profil?.id ?? "usr-sintetis-gudang",
      petugasGudangNama: profil?.namaLengkap ?? "Petugas Gudang",
    });

    return { ...updated };
  }

  /**
   * Mengeluarkan bahan secara aktual dari gudang ke dapur berbasis FEFO (AB-017, AB-018).
   */
  private async keluarkanBahanPermintaanDalamTransaksi(
    permintaanId: string,
    catatanPengeluaran?: string,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPermintaanBahanDto> {
    this.validasiIzinAksesGudang(profil, "Mengeluarkan Bahan Baku Dapur (FEFO)");

    const permintaan = await this.repository.ambilPermintaanBerdasarkanId(permintaanId);
    if (!permintaan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Permintaan bahan dapur tidak ditemukan.",
        pesanInternal: `Permintaan ID ${permintaanId} tidak ditemukan.`,
      });
    }

    if (permintaan.status !== "dialokasikan") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 400,
        pesanPengguna: `Bahan belum dapat dikeluarkan karena status permintaan masih '${permintaan.status}' (wajib dialokasikan terlebih dahulu).`,
        pesanInternal: `Status permintaan saat ini: ${permintaan.status}.`,
      });
    }

    for (const item of permintaan.daftarItem) {
      const lotLayak = await this.repository.ambilLotAktifLayakFEFO(item.bahanId);
      if (lotLayak.reduce((jumlah, lot) => jumlah + lot.sisaStokLot, 0) < item.jumlahDialokasikan) {
        throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Lot layak tidak cukup. Pengeluaran dibatalkan tanpa mengurangi stok." });
      }
    }
    const sekarang = new Date().toISOString();
    const petugasNama = profil?.namaLengkap ?? "Petugas Gudang";
    const itemDikeluarkan: RincianPermintaanItemEntitas[] = [];

    for (const item of permintaan.daftarItem) {
      const b = (await this.repository.ambilBahanBerdasarkanId(item.bahanId))!;
      const jumlahTarget = item.jumlahDialokasikan;
      let sisaKebutuhan = jumlahTarget;

      // Ambil lot FEFO aktif dan layak
      const lots = await this.repository.ambilLotAktifLayakFEFO(b.id);
      const lotTerpakai: { lotId: string; nomorLot: string; jumlah: number }[] = [];

      for (const lot of lots) {
        if (sisaKebutuhan <= 0) break;
        const ambil = Math.min(lot.sisaStokLot, sisaKebutuhan);
        const sisaLotBaru = Number((lot.sisaStokLot - ambil).toFixed(2));
        const statusLotBaru = sisaLotBaru <= 0 ? "habis" : "aktif";

        await this.repository.perbaruiLot(lot.id, {
          sisaStokLot: sisaLotBaru,
          statusLot: statusLotBaru,
        });

        lotTerpakai.push({
          lotId: lot.id,
          nomorLot: lot.nomorLot,
          jumlah: ambil,
        });

        sisaKebutuhan = Number((sisaKebutuhan - ambil).toFixed(2));
      }

      if (sisaKebutuhan > 0) {
        throw new AppError({
          kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
          statusHttp: 422,
          pesanPengguna: `Lot fisik yang layak untuk bahan '${b.namaBahan}' tidak mencukupi untuk pengeluaran aktual (kurang ${sisaKebutuhan} ${b.satuan}).`,
          pesanInternal: `AB-017: Lot layak habis sebelum pemenuhan selesai.`,
        });
      }

      // Potong stok fisik, stok layak, dan kosongkan stok dialokasikan
      const stokFisikBaru = Math.max(0, Number((b.stokFisik - jumlahTarget).toFixed(2)));
      const stokLayakBaru = Math.max(0, Number((b.stokLayak - jumlahTarget).toFixed(2)));
      const stokDialokasikanBaru = Math.max(0, Number((b.stokDialokasikan - jumlahTarget).toFixed(2)));

      await this.repository.perbaruiStokBahan(b.id, {
        stokFisik: stokFisikBaru,
        stokLayak: stokLayakBaru,
        stokDialokasikan: stokDialokasikanBaru,
      });

      // AB-018: Catat mutasi kartu stok dengan nomor lot terlacak
      const nomorLotString = lotTerpakai.map((l) => `${l.nomorLot} (${l.jumlah} ${b.satuan})`).join(", ");
      await this.repository.catatMutasiKartuStok({
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bahanId: b.id,
        nomorLot: lotTerpakai[0]?.nomorLot ?? null,
        jenisMutasi: "pengeluaran",
        referensiDokumen: permintaan.nomorPermintaan,
        jumlahMasuk: 0,
        jumlahKeluar: jumlahTarget,
        saldoAkhir: stokFisikBaru,
        keterangan: `Pengeluaran FEFO ke ${permintaan.unitPeminta}. Lot: ${nomorLotString}`,
        petugasNama,
        waktuPencatatan: sekarang,
      });

      itemDikeluarkan.push({
        ...item,
        jumlahDikeluarkan: jumlahTarget,
        lotDialokasikan: lotTerpakai,
      });
    }

    const updated = await this.repository.perbaruiPermintaan(permintaan.id, {
      status: "dikeluarkan",
      daftarItem: itemDikeluarkan,
      catatanSelisih: catatanPengeluaran ?? null,
      waktuPengeluaran: sekarang,
    });

    return { ...updated };
  }

  /**
   * Menolak permintaan bahan dapur.
   */
  private async tolakPermintaanBahanDalamTransaksi(
    permintaanId: string,
    alasanPenolakan: string,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPermintaanBahanDto> {
    this.validasiIzinAksesGudang(profil, "Menolak Permintaan Bahan Dapur");

    const permintaan = await this.repository.ambilPermintaanBerdasarkanId(permintaanId);
    if (!permintaan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Permintaan bahan dapur tidak ditemukan.",
        pesanInternal: `Permintaan ID ${permintaanId} tidak ditemukan.`,
      });
    }

    if (permintaan.status === "dikeluarkan") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 400,
        pesanPengguna: "Permintaan yang sudah dikeluarkan tidak dapat ditolak.",
        pesanInternal: "Permintaan sudah dikeluarkan secara fisik.",
      });
    }

    // Jika sebelumnya sudah dialokasikan, kembalikan stokDialokasikan
    if (permintaan.status === "dialokasikan") {
      for (const item of permintaan.daftarItem) {
        const b = await this.repository.ambilBahanBerdasarkanId(item.bahanId);
        if (b) {
          const dialokasikanBaru = Math.max(0, Number((b.stokDialokasikan - item.jumlahDialokasikan).toFixed(2)));
          await this.repository.perbaruiStokBahan(b.id, {
            stokDialokasikan: dialokasikanBaru,
          });
        }
      }
    }

    const updated = await this.repository.perbaruiPermintaan(permintaan.id, {
      status: "ditolak",
      alasanPenolakan,
    });

    return { ...updated };
  }

  /**
   * Mencatat penyesuaian stok fisik (stok opname) dengan alasan wajib (BRD 7.6, AB-030).
   */
  private async catatPenyesuaianOpnameDalamTransaksi(
    input: InputPenyesuaianOpnameBaru,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPenyesuaianStokOpnameDto> {
    this.validasiIzinAksesGudang(profil, "Mencatat Penyesuaian Stok Opname");

    const valid = skemaInputPenyesuaianOpname.safeParse(input);
    if (!valid.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: valid.error.issues[0]?.message ?? "Data stok opname tidak valid.",
        pesanInternal: JSON.stringify(valid.error.issues),
      });
    }

    const b = await this.repository.ambilBahanBerdasarkanId(valid.data.bahanId);
    if (!b) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Bahan baku tidak ditemukan dalam katalog.",
        pesanInternal: `Bahan ID ${valid.data.bahanId} tidak ditemukan.`,
      });
    }

    const sekarang = new Date().toISOString();
    const petugasNama = profil?.namaLengkap ?? "Petugas Gudang";
    const petugasId = profil?.id ?? "usr-sintetis-gudang";
    const selisih = Number((valid.data.stokFisikAktual - b.stokFisik).toFixed(2));

    const opnameBaru: EntitasPenyesuaianStokOpname = {
      id: `opn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bahanId: b.id,
      stokSistemSebelum: b.stokFisik,
      stokFisikAktual: valid.data.stokFisikAktual,
      selisih,
      alasanWajib: valid.data.alasanWajib,
      petugasId,
      petugasNama,
      waktuPencatatan: sekarang,
    };

    // Sesuaikan stok fisik & layak
    const selisihAbsolut = Math.abs(selisih);
    const stokLayakBaru = Math.max(0, Number((b.stokLayak + selisih).toFixed(2)));

    await this.repository.perbaruiStokBahan(b.id, {
      stokFisik: valid.data.stokFisikAktual,
      stokLayak: stokLayakBaru,
    });

    // Catat kartu stok mutasi
    await this.repository.catatMutasiKartuStok({
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bahanId: b.id,
      nomorLot: null,
      jenisMutasi: "penyesuaian_opname",
      referensiDokumen: opnameBaru.id,
      jumlahMasuk: selisih > 0 ? selisihAbsolut : 0,
      jumlahKeluar: selisih < 0 ? selisihAbsolut : 0,
      saldoAkhir: valid.data.stokFisikAktual,
      keterangan: `Stok Opname Fisik: Selisih ${selisih > 0 ? `+${selisih}` : selisih} ${b.satuan}. Alasan: ${valid.data.alasanWajib}`,
      petugasNama,
      waktuPencatatan: sekarang,
    });

    await this.repository.simpanPenyesuaianOpname(opnameBaru);

    return {
      ...opnameBaru,
      kodeBahan: b.kodeBahan,
      namaBahan: b.namaBahan,
    };
  }

  /**
   * Membuang lot bahan yang kedaluwarsa atau rusak (Disposal/Karantina).
   */
  private async buangBahanKedaluwarsaDalamTransaksi(
    lotId: string,
    alasan: string,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPenerimaanLotDto> {
    this.validasiIzinAksesGudang(profil, "Membuang Bahan Kedaluwarsa/Rusak");

    const valid = skemaInputPembuanganLot.safeParse({ alasanPembuangan: alasan });
    if (!valid.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna: valid.error.issues[0]?.message ?? "Alasan pembuangan tidak valid.",
        pesanInternal: JSON.stringify(valid.error.issues),
      });
    }

    const lot = await this.repository.ambilLotBerdasarkanId(lotId);
    if (!lot) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Lot bahan tidak ditemukan.",
        pesanInternal: `Lot ID ${lotId} tidak ditemukan.`,
      });
    }

    if (lot.statusLot === "dibuang") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 400,
        pesanPengguna: "Lot bahan ini sudah pernah dibuang sebelumnya.",
        pesanInternal: `Lot ID ${lotId} sudah berstatus dibuang.`,
      });
    }

    const b = (await this.repository.ambilBahanBerdasarkanId(lot.bahanId))!;
    const sekarang = new Date().toISOString();
    const sisa = lot.sisaStokLot;
    const petugasNama = profil?.namaLengkap ?? "Petugas Gudang";

    // Potong dari stok fisik dan stok layak / stok ditahan
    const stokFisikBaru = Math.max(0, Number((b.stokFisik - sisa).toFixed(2)));
    const stokLayakBaru =
      lot.statusMutu === "layak_diterima"
        ? Math.max(0, Number((b.stokLayak - sisa).toFixed(2)))
        : b.stokLayak;
    const stokDitahanBaru =
      lot.statusMutu !== "layak_diterima"
        ? Math.max(0, Number((b.stokDitahan - sisa).toFixed(2)))
        : b.stokDitahan;

    await this.repository.perbaruiStokBahan(b.id, {
      stokFisik: stokFisikBaru,
      stokLayak: stokLayakBaru,
      stokDitahan: stokDitahanBaru,
    });

    const updatedLot = await this.repository.perbaruiLot(lot.id, {
      sisaStokLot: 0,
      statusLot: "dibuang",
      catatanPemeriksaan: `${lot.catatanPemeriksaan} [DIBUANG: ${alasan}]`,
    });

    await this.repository.catatMutasiKartuStok({
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bahanId: b.id,
      nomorLot: lot.nomorLot,
      jenisMutasi: "pembuangan",
      referensiDokumen: lot.nomorLot,
      jumlahMasuk: 0,
      jumlahKeluar: sisa,
      saldoAkhir: stokFisikBaru,
      keterangan: `Pembuangan bahan rusak/kedaluwarsa. Alasan: ${alasan}`,
      petugasNama,
      waktuPencatatan: sekarang,
    });

    return {
      ...updatedLot,
      kodeBahan: b.kodeBahan,
      namaBahan: b.namaBahan,
    };
  }

  /**
   * Mengambil riwayat mutasi kartu stok untuk audit trail (AB-030).
   */
  public async ambilKartuStok(
    bahanId?: string,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemKartuStokMutasiDto[]> {
    this.validasiIzinAksesGudang(profil, "Melihat Kartu Stok Audit Mutasi");

    const mutasi = await this.repository.ambilKartuStok(bahanId);
    const bahanList = await this.repository.ambilSemuaBahan();
    const bahanMap = new Map(bahanList.map((b) => [b.id, b]));

    return mutasi.map((m) => {
      const b = bahanMap.get(m.bahanId);
      return {
        id: m.id,
        bahanId: m.bahanId,
        kodeBahan: b?.kodeBahan ?? "UNKNOWN",
        namaBahan: b?.namaBahan ?? "UNKNOWN",
        nomorLot: m.nomorLot,
        jenisMutasi: m.jenisMutasi,
        referensiDokumen: m.referensiDokumen,
        jumlahMasuk: m.jumlahMasuk,
        jumlahKeluar: m.jumlahKeluar,
        saldoAkhir: m.saldoAkhir,
        keterangan: m.keterangan,
        waktuPencatatan: m.waktuPencatatan,
        petugasNama: m.petugasNama,
      };
    });
  }

  /**
   * Mengambil riwayat rekonsiliasi stok opname.
   */
  public async ambilSemuaOpname(
    bahanId?: string,
    profil?: ProfilSesiPengguna | null,
  ): Promise<ItemPenyesuaianStokOpnameDto[]> {
    this.validasiIzinAksesGudang(profil, "Melihat Riwayat Stok Opname");

    const opnames = await this.repository.ambilSemuaOpname(bahanId);
    const bahanList = await this.repository.ambilSemuaBahan();
    const bahanMap = new Map(bahanList.map((b) => [b.id, b]));

    return opnames.map((o) => {
      const b = bahanMap.get(o.bahanId);
      return {
        id: o.id,
        bahanId: o.bahanId,
        kodeBahan: b?.kodeBahan ?? "UNKNOWN",
        namaBahan: b?.namaBahan ?? "UNKNOWN",
        stokSistemSebelum: o.stokSistemSebelum,
        stokFisikAktual: o.stokFisikAktual,
        selisih: o.selisih,
        alasanWajib: o.alasanWajib,
        petugasId: o.petugasId,
        petugasNama: o.petugasNama,
        waktuPencatatan: o.waktuPencatatan,
      };
    });
  }
}

