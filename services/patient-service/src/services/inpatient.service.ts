/**
 * @fileoverview Layanan logika bisnis domain Rawat Inap (Tahap 4 — Petugas Rawat Inap).
 * Menegakkan aturan keselamatan pasien dan aturan bisnis:
 * - AB-002: Setiap rawat inap memiliki episode perawatan yang jelas dan alokasi tempat tidur tidak bertabrakan.
 * - AB-020: Verifikasi dua pengenal pasien saat penempatan rawat inap.
 * - AB-030 & AB-034: Rekam riwayat perpindahan tempat tidur dan audit perubahan lokasi.
 * - AB-031: Pemulangan menghentikan episode dan memicu penghentian pesanan mendatang.
 * - AB-032: Pemisahan kewenangan server-side.
 */

import {
  KODE_GALAT,
  type KategoriNotifikasi,
  type PeranPengguna,
  type PrioritasNotifikasi,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type {
  EntitasEpisodeRawatInap,
  EntitasPenempatanTempatTidur,
  EntitasRiwayatPerpindahanTempatTidur,
  ItemBangsalDto,
  ItemEpisodeRawatInapDto,
  ItemKamarDto,
  ItemPengajuanRawatInapDto,
  ItemRiwayatPerpindahanDto,
  ItemTempatTidurDto,
  ParameterKeputusanPengajuan,
  ParameterPemindahanTempatTidur,
  ParameterPemulanganPasien,
  ParameterPenerimaanDanPenempatan,
  RingkasanKapasitasRawatInap,
} from "../model/inpatient.model.ts";
import type { InpatientRepository } from "../repository/inpatient.repository.ts";
import type { PatientRepository } from "../repository/patient.repository.ts";

export interface DependensiLayananInpatient {
  catatAuditAkses: (param: {
    aktorId: string;
    peranAktor: PeranPengguna;
    tindakan: string;
    sumberDaya: string;
    idSumberDaya?: string;
    keputusan: "DIIZINKAN" | "DITOLAK";
    alasan?: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  kirimNotifikasiPengguna: (notifikasi: {
    id: string;
    penerimaId: string;
    judul: string;
    pesan: string;
    kategori: KategoriNotifikasi;
    prioritas: PrioritasNotifikasi;
    tautanAksi?: string;
    dibuatPada: string;
  }) => Promise<void>;
}

export class InpatientService {
  private readonly inpatientRepo: InpatientRepository;
  private readonly patientRepo: PatientRepository;
  private readonly deps: DependensiLayananInpatient;

  constructor(
    inpatientRepo: InpatientRepository,
    patientRepo: PatientRepository,
    deps: DependensiLayananInpatient,
  ) {
    this.inpatientRepo = inpatientRepo;
    this.patientRepo = patientRepo;
    this.deps = deps;
  }

  private antrianMutasi: Promise<void> = Promise.resolve();
  private async mutasi<T>(aksi: (service: InpatientService) => Promise<T>): Promise<T> {
    let selesai!: () => void;
    const sebelumnya = this.antrianMutasi;
    this.antrianMutasi = new Promise<void>((resolve) => { selesai = resolve; });
    await sebelumnya;
    try {
      return this.inpatientRepo.transaksi
        ? await this.inpatientRepo.transaksi((repo) => aksi(new InpatientService(repo, this.patientRepo, this.deps)))
        : await aksi(this);
    } finally { selesai(); }
  }

  public putuskanPengajuan(param: ParameterKeputusanPengajuan) { return this.mutasi((service) => service.putuskanPengajuanDalamTransaksi(param)); }
  public terimaDanAlokasikanTempatTidur(param: ParameterPenerimaanDanPenempatan) { return this.mutasi((service) => service.terimaDanAlokasikanTempatTidurDalamTransaksi(param)); }
  public pindahkanTempatTidur(param: ParameterPemindahanTempatTidur) { return this.mutasi((service) => service.pindahkanTempatTidurDalamTransaksi(param)); }
  public pulangkanPasien(param: ParameterPemulanganPasien) { return this.mutasi((service) => service.pulangkanPasienDalamTransaksi(param)); }

  /**
   * Mengambil ringkasan kapasitas dan ketersediaan bangsal serta tempat tidur.
   */
  public async ambilKapasitasDanKetersediaan(): Promise<{
    ringkasan: RingkasanKapasitasRawatInap;
    daftarBangsal: readonly ItemBangsalDto[];
    daftarKamar: readonly ItemKamarDto[];
    daftarTempatTidur: readonly ItemTempatTidurDto[];
  }> {
    const [semuaBangsal, semuaKamar, semuaBed, semuaEpisode, semuaPengajuan] =
      await Promise.all([
        this.inpatientRepo.ambilSemuaBangsal(),
        this.inpatientRepo.ambilSemuaKamar(),
        this.inpatientRepo.ambilSemuaTempatTidur(),
        this.inpatientRepo.ambilSemuaEpisode({ status: "aktif" }),
        this.inpatientRepo.ambilSemuaPengajuan("menunggu_penempatan"),
      ]);

    const petaPasienPerBed = new Map<
      string,
      {
        pasienId: string;
        nomorRekamMedis: string;
        namaPasien: string;
        episodeId: string;
        waktuMasuk: string;
      }
    >();

    for (const ep of semuaEpisode) {
      const psn = await this.patientRepo.cariPasienBerdasarkanId(ep.pasienId);
      if (psn) {
        petaPasienPerBed.set(ep.tempatTidurId, {
          pasienId: ep.pasienId,
          nomorRekamMedis: psn.nomorRekamMedis,
          namaPasien: psn.namaLengkap,
          episodeId: ep.id,
          waktuMasuk: ep.waktuMasuk,
        });
      }
    }

    const petaKamar = new Map(semuaKamar.map((k) => [k.id, k]));
    const petaBangsal = new Map(semuaBangsal.map((b) => [b.id, b]));

    const daftarTempatTidurDto: ItemTempatTidurDto[] = semuaBed.map((b) => {
      const kmr = petaKamar.get(b.kamarId);
      const bng = petaBangsal.get(b.bangsalId);
      const dataPasien = petaPasienPerBed.get(b.id);
      return {
        id: b.id,
        kamarId: b.kamarId,
        bangsalId: b.bangsalId,
        namaBangsal: bng ? bng.namaBangsal : b.bangsalId,
        nomorKamar: kmr ? kmr.nomorKamar : "-",
        nomorTempatTidur: b.nomorTempatTidur,
        statusTempatTidur: b.statusTempatTidur,
        pasienId: dataPasien?.pasienId,
        nomorRekamMedis: dataPasien?.nomorRekamMedis,
        namaPasien: dataPasien?.namaPasien,
        episodeId: dataPasien?.episodeId,
        waktuMasuk: dataPasien?.waktuMasuk,
        aktif: b.aktif,
        diperbaruiPada: b.diperbaruiPada,
      };
    });

    const daftarBangsalDto: ItemBangsalDto[] = semuaBangsal.map((b) => {
      const bedDiBangsal = daftarTempatTidurDto.filter(
        (t) => t.bangsalId === b.id,
      );
      const tersedia = bedDiBangsal.filter(
        (t) => t.statusTempatTidur === "tersedia",
      ).length;
      const terisi = bedDiBangsal.filter(
        (t) => t.statusTempatTidur === "terisi",
      ).length;
      const pemeliharaan = bedDiBangsal.filter(
        (t) => t.statusTempatTidur === "pemeliharaan",
      ).length;

      return {
        id: b.id,
        kodeBangsal: b.kodeBangsal,
        namaBangsal: b.namaBangsal,
        kelasPelayanan: b.kelasPelayanan,
        kapasitasTempatTidur: b.kapasitasTempatTidur,
        jumlahTersedia: tersedia,
        jumlahTerisi: terisi,
        jumlahPemeliharaan: pemeliharaan,
        aktif: b.aktif,
      };
    });

    const daftarKamarDto: ItemKamarDto[] = semuaKamar.map((k) => {
      const bng = petaBangsal.get(k.bangsalId);
      return {
        id: k.id,
        bangsalId: k.bangsalId,
        namaBangsal: bng ? bng.namaBangsal : k.bangsalId,
        nomorKamar: k.nomorKamar,
        namaKamar: k.namaKamar,
        kapasitasTempatTidur: k.kapasitasTempatTidur,
        aktif: k.aktif,
      };
    });

    const totalTempatTidur = daftarTempatTidurDto.length;
    const totalTersedia = daftarTempatTidurDto.filter(
      (t) => t.statusTempatTidur === "tersedia",
    ).length;
    const totalTerisi = daftarTempatTidurDto.filter(
      (t) => t.statusTempatTidur === "terisi",
    ).length;
    const totalPemeliharaan = daftarTempatTidurDto.filter(
      (t) => t.statusTempatTidur === "pemeliharaan",
    ).length;

    const ringkasan: RingkasanKapasitasRawatInap = {
      totalTempatTidur,
      totalTersedia,
      totalTerisi,
      totalPemeliharaan,
      totalPasienAktif: semuaEpisode.length,
      totalPengajuanMenunggu: semuaPengajuan.length,
    };

    return {
      ringkasan,
      daftarBangsal: daftarBangsalDto,
      daftarKamar: daftarKamarDto,
      daftarTempatTidur: daftarTempatTidurDto,
    };
  }

  /**
   * Mengambil daftar pengajuan rawat inap dari dokter.
   */
  public async ambilDaftarPengajuan(
    status?: string,
  ): Promise<readonly ItemPengajuanRawatInapDto[]> {
    return this.inpatientRepo.ambilSemuaPengajuan(status);
  }

  /**
   * Mengambil satu pengajuan rawat inap berdasarkan ID.
   */
  public async ambilPengajuanBerdasarkanId(
    id: string,
  ): Promise<ItemPengajuanRawatInapDto> {
    const pengajuan = await this.inpatientRepo.ambilPengajuanBerdasarkanId(id);
    if (!pengajuan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Pengajuan rawat inap tidak ditemukan dalam sistem.",
        pesanInternal: `Pengajuan ID ${id} tidak ditemukan.`,
      });
    }
    return pengajuan;
  }

  /**
   * Menetapkan keputusan atas pengajuan rawat inap (diterima / ditunda / ditolak).
   */
  private async putuskanPengajuanDalamTransaksi(
    param: ParameterKeputusanPengajuan,
  ): Promise<ItemPengajuanRawatInapDto> {
    const pengajuan = await this.ambilPengajuanBerdasarkanId(param.pengajuanId);

    if (
      pengajuan.statusPengajuan === "ditempatkan" ||
      pengajuan.statusPengajuan === "ditolak"
    ) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Pengajuan tidak dapat diubah karena berstatus '${pengajuan.statusPengajuan}'.`,
        pesanInternal: `Pengajuan ${param.pengajuanId} sudah berstatus final '${pengajuan.statusPengajuan}'.`,
      });
    }

    await this.inpatientRepo.perbaruiStatusPengajuan(
      param.pengajuanId,
      param.keputusan,
      param.alasan,
    );

    await this.deps.catatAuditAkses({
      aktorId: param.petugasId,
      peranAktor: "petugas_rawat_inap",
      tindakan: "KEPUTUSAN_PENGAJUAN_RAWAT_INAP",
      sumberDaya: "pengajuan_rawat_inap",
      idSumberDaya: param.pengajuanId,
      keputusan: "DIIZINKAN",
      alasan: param.alasan,
      correlationId: param.correlationId,
      metadata: {
        nomorPengajuan: pengajuan.nomorPengajuan,
        keputusan: param.keputusan,
        alasan: param.alasan,
      },
    });

    // Kirim notifikasi jika ditunda atau ditolak ke dokter pengaju
    if (param.keputusan === "ditunda" || param.keputusan === "ditolak") {
      await this.deps.kirimNotifikasiPengguna({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        penerimaId: pengajuan.dokterPengajuId,
        judul: `Pengajuan Rawat Inap ${pengajuan.nomorPengajuan} ${param.keputusan.toUpperCase()}`,
        pesan: `Pengajuan rawat inap pasien ${pengajuan.namaPasien} (${pengajuan.nomorRekamMedis}) ${param.keputusan} oleh Admisi. Alasan: ${param.alasan}`,
        kategori: "operasional",
        prioritas: param.keputusan === "ditolak" ? "kritis" : "tinggi",
        tautanAksi: "/dokter",
        dibuatPada: new Date().toISOString(),
      });
    }

    return this.ambilPengajuanBerdasarkanId(param.pengajuanId);
  }

  /**
   * Menerima pasien dan mengalokasikan tempat tidur rawat inap (AB-002, AB-020).
   */
  private async terimaDanAlokasikanTempatTidurDalamTransaksi(
    param: ParameterPenerimaanDanPenempatan,
  ): Promise<{
    episode: EntitasEpisodeRawatInap;
    penempatan: EntitasPenempatanTempatTidur;
  }> {
    const pengajuan = await this.ambilPengajuanBerdasarkanId(param.pengajuanId);

    if (pengajuan.statusPengajuan === "ditempatkan") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Pasien pada pengajuan ini telah ditempatkan di tempat tidur rawat inap.",
        pesanInternal: `Pengajuan ${param.pengajuanId} sudah berstatus ditempatkan.`,
      });
    }

    if (pengajuan.statusPengajuan === "ditolak") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Pengajuan rawat inap ini telah ditolak dan tidak dapat ditempatkan.",
        pesanInternal: `Pengajuan ${param.pengajuanId} ditolak sebelumnya.`,
      });
    }

    // Ambil data pasien untuk verifikasi dua pengenal (AB-020)
    const pasien = await this.patientRepo.cariPasienBerdasarkanId(
      pengajuan.pasienId,
    );
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data identitas pasien tidak ditemukan dalam sistem.",
        pesanInternal: `Pasien ${pengajuan.pasienId} tidak ditemukan di patient repository.`,
      });
    }

    // Pemeriksaan Keselamatan AB-020: Verifikasi dua pengenal
    if (pasien.tanggalLahir !== param.konfirmasiTanggalLahir.trim()) {
      await this.deps.catatAuditAkses({
        aktorId: param.petugasId,
        peranAktor: "petugas_rawat_inap",
        tindakan: "VERIFIKASI_DUA_PENGENAL_ADMISI_GAGAL",
        sumberDaya: "penempatan_tempat_tidur",
        idSumberDaya: param.pengajuanId,
        keputusan: "DITOLAK",
        alasan: `Konfirmasi tanggal lahir gagal: '${param.konfirmasiTanggalLahir}' vs DB '${pasien.tanggalLahir}'.`,
        correlationId: param.correlationId,
      });

      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna:
          "Penahanan Keselamatan (AB-020): Verifikasi dua pengenal gagal. Tanggal lahir yang dikonfirmasi tidak sesuai dengan rekam medis pasien.",
        pesanInternal: `Verifikasi gagal untuk pasien ${pasien.nomorRekamMedis}: input '${param.konfirmasiTanggalLahir}' vs DB '${pasien.tanggalLahir}'.`,
      });
    }

    // Ambil tempat tidur dan periksa ketersediaan (AB-002: Tempat tidur tidak boleh dialokasikan bertabrakan)
    const tempatTidur = await this.inpatientRepo.ambilTempatTidurBerdasarkanId(
      param.tempatTidurId,
    );
    if (!tempatTidur || !tempatTidur.aktif) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna:
          "Tempat tidur yang dipilih tidak ditemukan atau sedang tidak aktif.",
        pesanInternal: `Tempat tidur ${param.tempatTidurId} tidak ditemukan/tidak aktif.`,
      });
    }

    if (tempatTidur.statusTempatTidur !== "tersedia") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Aturan Keselamatan (AB-002): Tempat tidur ${tempatTidur.nomorTempatTidur} saat ini berstatus '${tempatTidur.statusTempatTidur}' dan tidak tersedia untuk alokasi baru.`,
        pesanInternal: `Konflik alokasi bed: bed ${param.tempatTidurId} berstatus ${tempatTidur.statusTempatTidur}.`,
      });
    }

    // Cek apakah ada penempatan aktif yang bertabrakan di tempat tidur ini
    const penempatanAktifAda =
      await this.inpatientRepo.ambilPenempatanAktifBerdasarkanBed(
        param.tempatTidurId,
      );
    if (penempatanAktifAda) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Aturan Keselamatan (AB-002): Tempat tidur ${tempatTidur.nomorTempatTidur} masih tercatat memiliki penempatan aktif oleh pasien lain.`,
        pesanInternal: `Bed ${param.tempatTidurId} memiliki penempatan aktif ${penempatanAktifAda.id}.`,
      });
    }

    // Buat nomor episode unik
    const sekarang = new Date();
    const stempelWaktu = sekarang.toISOString();
    const tglKode = stempelWaktu.split("T")[0].replace(/-/g, "");
    const randAcak = Math.floor(1000 + Math.random() * 9000);
    const nomorEpisode = `EP-${tglKode}-${randAcak}`;
    const episodeId = `ep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const penempatanId = `plt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const entitasEpisode: EntitasEpisodeRawatInap = {
      id: episodeId,
      nomorEpisode,
      pasienId: pengajuan.pasienId,
      kunjunganId: pengajuan.kunjunganId,
      pengajuanId: pengajuan.id,
      dokterDpjpId: pengajuan.dokterPengajuId,
      dokterDpjpNama: pengajuan.dokterPengajuNama,
      diagnosisUtama: pengajuan.diagnosisUtama,
      bangsalId: tempatTidur.bangsalId,
      kamarId: tempatTidur.kamarId,
      tempatTidurId: tempatTidur.id,
      waktuMasuk: stempelWaktu,
      waktuKeluar: null,
      statusPerawatan: "aktif",
      alasanPemulangan: null,
      catatanPemulangan: null,
      dipulangkanOlehId: null,
      dipulangkanOlehNama: null,
      versi: 1,
      dibuatPada: stempelWaktu,
      diperbaruiPada: stempelWaktu,
    };

    const entitasPenempatan: EntitasPenempatanTempatTidur = {
      id: penempatanId,
      episodeRawatInapId: episodeId,
      pasienId: pengajuan.pasienId,
      tempatTidurId: tempatTidur.id,
      bangsalId: tempatTidur.bangsalId,
      kamarId: tempatTidur.kamarId,
      waktuMasuk: stempelWaktu,
      waktuKeluar: null,
      statusPenempatan: "aktif",
      dicatatOlehId: param.petugasId,
      dicatatOlehNama: param.petugasNama,
      dibuatPada: stempelWaktu,
    };

    // Eksekusi mutasi
    await this.inpatientRepo.simpanEpisodeRawatInap(entitasEpisode);
    await this.inpatientRepo.simpanPenempatanTempatTidur(entitasPenempatan);
    await this.inpatientRepo.perbaruiStatusTempatTidur(tempatTidur.id, "terisi");
    await this.inpatientRepo.perbaruiStatusPengajuan(
      pengajuan.id,
      "ditempatkan",
    );

    // Audit trail
    await this.deps.catatAuditAkses({
      aktorId: param.petugasId,
      peranAktor: "petugas_rawat_inap",
      tindakan: "PENERIMAAN_DAN_PENEMPATAN_RAWAT_INAP",
      sumberDaya: "episode_rawat_inap",
      idSumberDaya: episodeId,
      keputusan: "DIIZINKAN",
      alasan: param.catatanPenempatan ?? "Penempatan pasien ke tempat tidur",
      correlationId: param.correlationId,
      metadata: {
        nomorEpisode,
        pasienId: pengajuan.pasienId,
        tempatTidurId: tempatTidur.id,
        nomorTempatTidur: tempatTidur.nomorTempatTidur,
        bangsalId: tempatTidur.bangsalId,
      },
    });

    // Notifikasi ke Perawat Bangsal terkait (BRD Bab 4.5 & Bab XIV)
    await this.deps.kirimNotifikasiPengguna({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      penerimaId: "usr-sintetis-perawat-anggrek", // Broadcast ke grup perawat / perawat bangsal
      judul: `Pasien Baru Masuk di ${tempatTidur.nomorTempatTidur}`,
      pesan: `Pasien ${pengajuan.namaPasien} (${pengajuan.nomorRekamMedis}) telah ditempatkan di ${tempatTidur.nomorTempatTidur}. Lakukan verifikasi keamanan makanan dan skrining gizi awal.`,
      kategori: "keselamatan",
      prioritas: "tinggi",
      tautanAksi: "/perawat",
      dibuatPada: stempelWaktu,
    });

    return {
      episode: entitasEpisode,
      penempatan: entitasPenempatan,
    };
  }

  /**
   * Melakukan pemindahan tempat tidur / bangsal (AB-002, AB-030, AB-034).
   */
  private async pindahkanTempatTidurDalamTransaksi(
    param: ParameterPemindahanTempatTidur,
  ): Promise<{
    episode: EntitasEpisodeRawatInap;
    riwayat: EntitasRiwayatPerpindahanTempatTidur;
  }> {
    const episode = await this.inpatientRepo.ambilEpisodeBerdasarkanId(
      param.episodeId,
    );
    if (!episode) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Episode rawat inap tidak ditemukan dalam sistem.",
        pesanInternal: `Episode ID ${param.episodeId} tidak ditemukan.`,
      });
    }

    if (episode.statusPerawatan !== "aktif") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Pasien tidak dapat dipindahkan karena episode rawat inap berstatus '${episode.statusPerawatan}'.`,
        pesanInternal: `Episode ${param.episodeId} berstatus '${episode.statusPerawatan}'.`,
      });
    }

    // Optimistic Concurrency Control (AB-030)
    if (episode.versi !== param.versi) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Data episode telah diubah oleh pengguna lain. Silakan muat ulang data terbaru sebelum memindahkan pasien.",
        pesanInternal: `Optimistic concurrency conflict: episode.versi (${episode.versi}) !== param.versi (${param.versi}).`,
      });
    }

    if (episode.tempatTidurId === param.tempatTidurTujuanId) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 400,
        pesanPengguna:
          "Tempat tidur tujuan tidak boleh sama dengan tempat tidur saat ini.",
        pesanInternal: "Tempat tidur asal dan tujuan identik.",
      });
    }

    // Validasi tempat tidur tujuan
    const bedTujuan = await this.inpatientRepo.ambilTempatTidurBerdasarkanId(
      param.tempatTidurTujuanId,
    );
    if (!bedTujuan || !bedTujuan.aktif) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna:
          "Tempat tidur tujuan tidak ditemukan atau sedang tidak aktif.",
        pesanInternal: `Bed tujuan ${param.tempatTidurTujuanId} tidak ditemukan/tidak aktif.`,
      });
    }

    if (bedTujuan.statusTempatTidur !== "tersedia") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Aturan Keselamatan (AB-002): Tempat tidur tujuan ${bedTujuan.nomorTempatTidur} saat ini berstatus '${bedTujuan.statusTempatTidur}' dan tidak tersedia untuk pemindahan pasien.`,
        pesanInternal: `Bed tujuan ${param.tempatTidurTujuanId} berstatus ${bedTujuan.statusTempatTidur}.`,
      });
    }

    const stempelWaktu = new Date().toISOString();
    const bedAsalId = episode.tempatTidurId;
    const kamarAsalId = episode.kamarId;
    const bangsalAsalId = episode.bangsalId;

    // Selesaikan penempatan aktif di bed lama
    await this.inpatientRepo.selesaikanPenempatanAktif(bedAsalId, stempelWaktu);

    // Bebaskan bed lama menjadi 'tersedia'
    await this.inpatientRepo.perbaruiStatusTempatTidur(bedAsalId, "tersedia");

    // Alokasikan bed baru menjadi 'terisi'
    await this.inpatientRepo.perbaruiStatusTempatTidur(bedTujuan.id, "terisi");

    // Buka penempatan aktif baru di bed tujuan
    const penempatanBaruId = `plt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await this.inpatientRepo.simpanPenempatanTempatTidur({
      id: penempatanBaruId,
      episodeRawatInapId: episode.id,
      pasienId: episode.pasienId,
      tempatTidurId: bedTujuan.id,
      bangsalId: bedTujuan.bangsalId,
      kamarId: bedTujuan.kamarId,
      waktuMasuk: stempelWaktu,
      waktuKeluar: null,
      statusPenempatan: "aktif",
      dicatatOlehId: param.petugasId,
      dicatatOlehNama: param.petugasNama,
      dibuatPada: stempelWaktu,
    });

    // Catat riwayat perpindahan (AB-030, AB-034)
    const riwayatId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const entitasRiwayat: EntitasRiwayatPerpindahanTempatTidur = {
      id: riwayatId,
      episodeRawatInapId: episode.id,
      pasienId: episode.pasienId,
      bangsalAsalId,
      kamarAsalId,
      tempatTidurAsalId: bedAsalId,
      bangsalTujuanId: bedTujuan.bangsalId,
      kamarTujuanId: bedTujuan.kamarId,
      tempatTidurTujuanId: bedTujuan.id,
      alasanPemindahan: param.alasanPemindahan,
      dipindahkanOlehId: param.petugasId,
      dipindahkanOlehNama: param.petugasNama,
      waktuPemindahan: stempelWaktu,
    };
    await this.inpatientRepo.simpanRiwayatPerpindahan(entitasRiwayat);

    // Update lokasi pada episode dan naikkan versi
    const versiBaru = episode.versi + 1;
    await this.inpatientRepo.perbaruiLokasiEpisode(
      episode.id,
      bedTujuan.bangsalId,
      bedTujuan.kamarId,
      bedTujuan.id,
      versiBaru,
    );

    // Audit log
    await this.deps.catatAuditAkses({
      aktorId: param.petugasId,
      peranAktor: "petugas_rawat_inap",
      tindakan: "PEMINDAHAN_TEMPAT_TIDUR_RAWAT_INAP",
      sumberDaya: "episode_rawat_inap",
      idSumberDaya: episode.id,
      keputusan: "DIIZINKAN",
      alasan: param.alasanPemindahan,
      correlationId: param.correlationId,
      metadata: {
        episodeId: episode.id,
        bedAsalId,
        bedTujuanId: bedTujuan.id,
        alasanPemindahan: param.alasanPemindahan,
        versiBaru,
      },
    });

    // Notifikasi ke staf distribusi dan perawat bahwa pasien telah pindah lokasi
    await this.deps.kirimNotifikasiPengguna({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      penerimaId: "usr-sintetis-perawat-anggrek",
      judul: `Perpindahan Pasien: ${bedTujuan.nomorTempatTidur}`,
      pesan: `Pasien ${episode.diagnosisUtama} telah dipindahkan ke ${bedTujuan.nomorTempatTidur}. Alasan: ${param.alasanPemindahan}. Distribusi makanan dan observasi harap diarahkan ke lokasi baru.`,
      kategori: "keselamatan",
      prioritas: "tinggi",
      tautanAksi: "/perawat",
      dibuatPada: stempelWaktu,
    });

    const episodeTerbaru =
      (await this.inpatientRepo.ambilEpisodeBerdasarkanId(episode.id))!;
    return {
      episode: episodeTerbaru,
      riwayat: entitasRiwayat,
    };
  }

  /**
   * Melakukan pemulangan administratif pasien (AB-031, BRD Bab 11.1).
   * Membebaskan tempat tidur dan memicu penghentian pesanan makanan mendatang.
   */
  private async pulangkanPasienDalamTransaksi(
    param: ParameterPemulanganPasien,
  ): Promise<EntitasEpisodeRawatInap> {
    const episode = await this.inpatientRepo.ambilEpisodeBerdasarkanId(
      param.episodeId,
    );
    if (!episode) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Episode rawat inap tidak ditemukan dalam sistem.",
        pesanInternal: `Episode ID ${param.episodeId} tidak ditemukan.`,
      });
    }

    if (episode.statusPerawatan !== "aktif") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Pasien sudah berstatus '${episode.statusPerawatan}' dan tidak dapat dipulangkan ulang.`,
        pesanInternal: `Episode ${param.episodeId} sudah '${episode.statusPerawatan}'.`,
      });
    }

    // Optimistic Concurrency Control
    if (episode.versi !== param.versi) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Data episode telah diubah oleh pengguna lain. Silakan muat ulang data terbaru sebelum memulangkan pasien.",
        pesanInternal: `Optimistic concurrency conflict: episode.versi (${episode.versi}) !== param.versi (${param.versi}).`,
      });
    }

    const stempelWaktu = new Date().toISOString();

    // Selesaikan penempatan tempat tidur aktif
    await this.inpatientRepo.selesaikanPenempatanAktif(
      episode.tempatTidurId,
      stempelWaktu,
    );

    // Bebaskan tempat tidur menjadi 'tersedia'
    await this.inpatientRepo.perbaruiStatusTempatTidur(
      episode.tempatTidurId,
      "tersedia",
    );

    // Pulangkan episode
    const versiBaru = episode.versi + 1;
    await this.inpatientRepo.pulangkanEpisode(episode.id, {
      alasan: param.alasanPemulangan,
      catatan: param.catatanPemulangan,
      dipulangkanOlehId: param.petugasId,
      dipulangkanOlehNama: param.petugasNama,
      waktuKeluar: stempelWaktu,
      versiBaru,
    });

    // Audit log
    await this.deps.catatAuditAkses({
      aktorId: param.petugasId,
      peranAktor: "petugas_rawat_inap",
      tindakan: "PEMULANGAN_ADMINISTRATIF_PASIEN",
      sumberDaya: "episode_rawat_inap",
      idSumberDaya: episode.id,
      keputusan: "DIIZINKAN",
      alasan: param.catatanPemulangan,
      correlationId: param.correlationId,
      metadata: {
        nomorEpisode: episode.nomorEpisode,
        alasanPemulangan: param.alasanPemulangan,
        tempatTidurDibebaskan: episode.tempatTidurId,
        versiBaru,
      },
    });

    // Aturan Keselamatan AB-031: Pemulangan menghentikan pesanan makanan berikutnya
    await this.deps.kirimNotifikasiPengguna({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      penerimaId: "usr-sintetis-dokter-melati",
      judul: `Pasien Dipulangkan: Episode ${episode.nomorEpisode}`,
      pesan: `Pasien pada episode ${episode.nomorEpisode} telah dipulangkan (${param.alasanPemulangan}). Catatan: ${param.catatanPemulangan}. Sesuai AB-031, seluruh jadwal pesanan makanan mendatang dihentikan.`,
      kategori: "keselamatan",
      prioritas: "tinggi",
      tautanAksi: "/dokter",
      dibuatPada: stempelWaktu,
    });

    return (await this.inpatientRepo.ambilEpisodeBerdasarkanId(episode.id))!;
  }

  /**
   * Mengambil daftar episode rawat inap berpaginasi / difilter.
   */
  public async ambilDaftarEpisode(filter?: {
    status?: string;
    bangsalId?: string;
  }): Promise<readonly ItemEpisodeRawatInapDto[]> {
    const semuaEpisode = await this.inpatientRepo.ambilSemuaEpisode(filter);
    const semuaBangsal = await this.inpatientRepo.ambilSemuaBangsal();
    const semuaKamar = await this.inpatientRepo.ambilSemuaKamar();
    const semuaBed = await this.inpatientRepo.ambilSemuaTempatTidur();

    const petaBangsal = new Map(semuaBangsal.map((b) => [b.id, b]));
    const petaKamar = new Map(semuaKamar.map((k) => [k.id, k]));
    const petaBed = new Map(semuaBed.map((b) => [b.id, b]));

    const hasil: ItemEpisodeRawatInapDto[] = [];
    for (const ep of semuaEpisode) {
      const psn = await this.patientRepo.cariPasienBerdasarkanId(ep.pasienId);
      const bng = petaBangsal.get(ep.bangsalId);
      const kmr = petaKamar.get(ep.kamarId);
      const bed = petaBed.get(ep.tempatTidurId);

      hasil.push({
        id: ep.id,
        nomorEpisode: ep.nomorEpisode,
        pasienId: ep.pasienId,
        kunjunganId: ep.kunjunganId,
        pengajuanId: ep.pengajuanId,
        nomorRekamMedis: psn ? psn.nomorRekamMedis : "-",
        namaPasien: psn ? psn.namaLengkap : "-",
        tanggalLahir: psn ? psn.tanggalLahir : "-",
        jenisKelamin: psn ? psn.jenisKelamin : "laki_laki",
        dokterDpjpId: ep.dokterDpjpId,
        dokterDpjpNama: ep.dokterDpjpNama,
        diagnosisUtama: ep.diagnosisUtama,
        bangsalId: ep.bangsalId,
        namaBangsal: bng ? bng.namaBangsal : ep.bangsalId,
        kamarId: ep.kamarId,
        nomorKamar: kmr ? kmr.nomorKamar : "-",
        tempatTidurId: ep.tempatTidurId,
        nomorTempatTidur: bed ? bed.nomorTempatTidur : "-",
        waktuMasuk: ep.waktuMasuk,
        waktuKeluar: ep.waktuKeluar,
        statusPerawatan: ep.statusPerawatan,
        alasanPemulangan: ep.alasanPemulangan,
        catatanPemulangan: ep.catatanPemulangan,
        dipulangkanOlehNama: ep.dipulangkanOlehNama,
        versi: ep.versi,
        dibuatPada: ep.dibuatPada,
        diperbaruiPada: ep.diperbaruiPada,
      });
    }

    return hasil;
  }

  /**
   * Mengambil riwayat perpindahan tempat tidur.
   */
  public async ambilRiwayatPerpindahan(
    episodeId?: string,
  ): Promise<readonly ItemRiwayatPerpindahanDto[]> {
    const riwayatList =
      await this.inpatientRepo.ambilSemuaRiwayatPerpindahan(episodeId);
    const semuaBangsal = await this.inpatientRepo.ambilSemuaBangsal();
    const semuaKamar = await this.inpatientRepo.ambilSemuaKamar();
    const semuaBed = await this.inpatientRepo.ambilSemuaTempatTidur();

    const petaBangsal = new Map(semuaBangsal.map((b) => [b.id, b]));
    const petaKamar = new Map(semuaKamar.map((k) => [k.id, k]));
    const petaBed = new Map(semuaBed.map((b) => [b.id, b]));

    const hasil: ItemRiwayatPerpindahanDto[] = [];
    for (const r of riwayatList) {
      const ep = await this.inpatientRepo.ambilEpisodeBerdasarkanId(
        r.episodeRawatInapId,
      );
      const psn = await this.patientRepo.cariPasienBerdasarkanId(r.pasienId);
      const bAsal = petaBangsal.get(r.bangsalAsalId);
      const kAsal = petaKamar.get(r.kamarAsalId);
      const tAsal = petaBed.get(r.tempatTidurAsalId);
      const bTuj = petaBangsal.get(r.bangsalTujuanId);
      const kTuj = petaKamar.get(r.kamarTujuanId);
      const tTuj = petaBed.get(r.tempatTidurTujuanId);

      hasil.push({
        id: r.id,
        episodeRawatInapId: r.episodeRawatInapId,
        nomorEpisode: ep ? ep.nomorEpisode : "-",
        pasienId: r.pasienId,
        nomorRekamMedis: psn ? psn.nomorRekamMedis : "-",
        namaPasien: psn ? psn.namaLengkap : "-",
        bangsalAsalNama: bAsal ? bAsal.namaBangsal : r.bangsalAsalId,
        kamarAsalNomor: kAsal ? kAsal.nomorKamar : "-",
        tempatTidurAsalNomor: tAsal ? tAsal.nomorTempatTidur : "-",
        bangsalTujuanNama: bTuj ? bTuj.namaBangsal : r.bangsalTujuanId,
        kamarTujuanNomor: kTuj ? kTuj.nomorKamar : "-",
        tempatTidurTujuanNomor: tTuj ? tTuj.nomorTempatTidur : "-",
        alasanPemindahan: r.alasanPemindahan,
        dipindahkanOlehNama: r.dipindahkanOlehNama,
        waktuPemindahan: r.waktuPemindahan,
      });
    }

    return hasil;
  }
}
