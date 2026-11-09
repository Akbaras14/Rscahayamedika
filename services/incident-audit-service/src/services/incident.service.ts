/**
 * @fileoverview Logika bisnis inti untuk `incident-audit-service` (Tahap 10 — Kepala Instalasi Gizi).
 * Menerapkan:
 * - AB-028: Setiap tindak lanjut insiden wajib memiliki penanggung jawab dan batas waktu penyelesaian.
 * - AB-029: Closed-loop incident resolution (Investigasi RCA -> Rencana Tindakan -> Verifikasi -> Penutupan Sah).
 * - AB-030: Catatan investigasi, tindakan perbaikan, dan penutupan insiden wajib minimal 5 karakter.
 * - AB-032: Otorisasi peran kepala_instalasi_gizi tanpa pembatasan bangsal (pengawasan lintas unit).
 * - AB-033: Pengesahan rekonsiliasi pelayanan darurat pasca-downtime.
 * - BRD Bab X, XI, XVI: Evaluasi mutu pemenuhan gizi & sisa makanan bangsal (plate waste).
 */

import { randomUUID } from "node:crypto";
import {
  KODE_GALAT,
  type DerajatKeparahanInsiden,
  type IzinSistem,
  type ItemEvaluasiMutuGiziDto,
  type ItemInvestigasiInsidenDto,
  type ItemLaporanInsidenKeselamatanDto,
  type ItemRekonsiliasiDowntimeDto,
  type ItemTindakanKoreksiDto,
  type ProfilSesiPengguna,
  type RingkasanOversightOverviewDto,
  type StatusInsidenGizi,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type {
  EvaluasiMutuGiziEntitas,
  InvestigasiInsidenEntitas,
  LaporanInsidenKeselamatanEntitas,
  RekonsiliasiDowntimeEntitas,
  TindakanPerbaikanEntitas,
} from "../model/incident.model.ts";
import type { IncidentRepository } from "../repository/incident.repository.ts";
import {
  skemaEvaluasiMutuGizi,
  skemaInvestigasiInsiden,
  skemaKeputusanRekonsiliasi,
  skemaPenutupanInsiden,
  skemaRekonsiliasiDowntime,
  skemaTindakanKoreksi,
} from "../validators/incident.validator.ts";

export class IncidentAuditService {
  private readonly repository: IncidentRepository;

  constructor(repository: IncidentRepository) {
    this.repository = repository;
  }

  /**
   * Memvalidasi bahwa pengguna memiliki hak akses pengawasan mutu dan penanganan insiden gizi (AB-032).
   */
  public validasiIzinAksesKepala(
    pengguna: ProfilSesiPengguna,
    izinWajib: IzinSistem,
    aksiDeskripsi: string,
  ): void {
    if (pengguna.peran !== "kepala_instalasi_gizi") {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna: "Akses Terbatas: Khusus Kepala Instalasi Gizi (Tahap 10).",
        pesanInternal: `Akses ditolak untuk peran ${pengguna.peran} (${pengguna.id}) pada operasi '${aksiDeskripsi}'. (AB-032)`,
      });
    }

    if (!pengguna.daftarIzin.includes(izinWajib)) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna: "Anda tidak memiliki izin untuk tindakan ini.",
        pesanInternal: `Pengguna ${pengguna.id} tidak memiliki izin '${izinWajib}' untuk '${aksiDeskripsi}'.`,
      });
    }
  }

  /**
   * Mengambil ringkasan eksekutif metrik pengawasan mutu dan insiden instalasi gizi.
   */
  public async ambilOverviewOversight(
    pengguna: ProfilSesiPengguna,
  ): Promise<RingkasanOversightOverviewDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:pengawasan:baca",
      "Melihat Ringkasan Oversight Eksekutif Gizi",
    );

    const [daftarInsiden, daftarEvaluasi, daftarRekonsiliasi] = await Promise.all([
      this.repository.ambilSemuaInsiden(),
      this.repository.ambilSemuaEvaluasiMutu(),
      this.repository.ambilSemuaRekonsiliasiDowntime(),
    ]);

    const totalInsidenAktif = daftarInsiden.filter(
      (i) => i.statusInsiden !== "selesai_ditutup",
    ).length;

    const totalInsidenKritis = daftarInsiden.filter(
      (i) =>
        (i.derajatKeparahan === "kritis" || i.derajatKeparahan === "tinggi") &&
        i.statusInsiden !== "selesai_ditutup",
    ).length;

    const totalInsidenSelesaiDitutup = daftarInsiden.filter(
      (i) => i.statusInsiden === "selesai_ditutup",
    ).length;

    let rataRataPlateWasteBangsalPersen = 0;
    let kepatuhanCcpPusatPersen = 0;
    let kepatuhanIdentitasBedsidePersen = 0;

    if (daftarEvaluasi.length > 0) {
      const sumWaste = daftarEvaluasi.reduce(
        (acc, curr) => acc + curr.rataRataSisaMakananPersen,
        0,
      );
      const sumCcp = daftarEvaluasi.reduce(
        (acc, curr) => acc + curr.kepatuhanCcpSuhuPersen,
        0,
      );
      const sumId = daftarEvaluasi.reduce(
        (acc, curr) => acc + curr.kepatuhanDuaIdentitasPersen,
        0,
      );

      rataRataPlateWasteBangsalPersen = Number(
        (sumWaste / daftarEvaluasi.length).toFixed(1),
      );
      kepatuhanCcpPusatPersen = Number(
        (sumCcp / daftarEvaluasi.length).toFixed(1),
      );
      kepatuhanIdentitasBedsidePersen = Number(
        (sumId / daftarEvaluasi.length).toFixed(1),
      );
    }

    const totalRekonsiliasiDowntimePending = daftarRekonsiliasi.filter(
      (r) => r.statusRekonsiliasi === "menunggu_pengesahan",
    ).length;

    return {
      totalInsidenAktif,
      totalInsidenKritis,
      totalInsidenSelesaiDitutup,
      rataRataPlateWasteBangsalPersen,
      kepatuhanCcpPusatPersen,
      kepatuhanIdentitasBedsidePersen,
      totalRekonsiliasiDowntimePending,
    };
  }

  /**
   * Mengambil daftar laporan insiden keselamatan makanan dan pelayanan gizi.
   */
  public async ambilDaftarInsiden(
    pengguna: ProfilSesiPengguna,
    filter?: { status?: StatusInsidenGizi; derajat?: DerajatKeparahanInsiden },
  ): Promise<ItemLaporanInsidenKeselamatanDto[]> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:pengawasan:baca",
      "Melihat Daftar Laporan Insiden Gizi",
    );

    const entitasList = await this.repository.ambilSemuaInsiden(filter);
    return entitasList.map((e) => this.petakanInsidenDto(e));
  }

  /**
   * Mengambil detail lengkap insiden termasuk RCA investigasi dan rencana tindakan koreksi.
   */
  public async ambilDetailInsiden(
    pengguna: ProfilSesiPengguna,
    insidenId: string,
  ): Promise<{
    insiden: ItemLaporanInsidenKeselamatanDto;
    investigasi: ItemInvestigasiInsidenDto | null;
    daftarTindakan: ItemTindakanKoreksiDto[];
  }> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:pengawasan:baca",
      "Melihat Detail Insiden & Investigasi",
    );

    const insiden = await this.repository.ambilInsidenBerdasarkanId(insidenId);
    if (!insiden) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Laporan insiden dengan ID '${insidenId}' tidak ditemukan.`,
        pesanInternal: `Insiden ${insidenId} tidak ada di repositori.`,
      });
    }

    const [investigasi, daftarTindakan] = await Promise.all([
      this.repository.ambilInvestigasiBerdasarkanInsidenId(insiden.id),
      this.repository.ambilDaftarTindakanBerdasarkanInsidenId(insiden.id),
    ]);

    return {
      insiden: this.petakanInsidenDto(insiden),
      investigasi: investigasi ? this.petakanInvestigasiDto(investigasi) : null,
      daftarTindakan: daftarTindakan.map((t) => this.petakanTindakanDto(t)),
    };
  }

  /**
   * Mencatat investigasi penyebab insiden / Root Cause Analysis (RCA) (AB-029).
   */
  public async investigasiInsiden(
    pengguna: ProfilSesiPengguna,
    insidenId: string,
    input: unknown,
  ): Promise<ItemInvestigasiInsidenDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:insiden:kelola",
      "Mencatat Investigasi Insiden RCA (AB-029)",
    );

    const parsed = skemaInvestigasiInsiden.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          parsed.error.issues[0]?.message ?? "Input investigasi insiden tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const insiden = await this.repository.ambilInsidenBerdasarkanId(insidenId);
    if (!insiden) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Laporan insiden dengan ID '${insidenId}' tidak ditemukan.`,
        pesanInternal: `Insiden ${insidenId} tidak ditemukan untuk investigasi.`,
      });
    }

    if (insiden.statusInsiden === "selesai_ditutup") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Insiden telah resmi ditutup dan tidak dapat diinvestigasi ulang tanpa pembukaan kembali.",
        pesanInternal: `Insiden ${insiden.nomorInsiden} berstatus selesai_ditutup.`,
      });
    }

    const investigasiEntitas: InvestigasiInsidenEntitas = {
      id: `inv-${randomUUID().slice(0, 8)}`,
      insidenId: insiden.id,
      nomorInsiden: insiden.nomorInsiden,
      investigatorId: pengguna.id,
      investigatorNama: pengguna.namaLengkap,
      tanggalInvestigasi: new Date().toISOString(),
      akarMasalahRca: parsed.data.akarMasalahRca,
      faktorKontributor: parsed.data.faktorKontributor,
      rekomendasiSistemik: parsed.data.rekomendasiSistemik,
      createdAt: new Date().toISOString(),
    };

    const tersimpan = await this.repository.simpanInvestigasi(investigasiEntitas);

    if (insiden.statusInsiden === "dilaporkan") {
      await this.repository.perbaruiInsiden(insiden.id, {
        statusInsiden: "dalam_investigasi",
      });
    }

    return this.petakanInvestigasiDto(tersimpan);
  }

  /**
   * Menetapkan rencana tindakan perbaikan dan penanggung jawab (AB-028).
   */
  public async catatTindakanKoreksi(
    pengguna: ProfilSesiPengguna,
    insidenId: string,
    input: unknown,
  ): Promise<ItemTindakanKoreksiDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:insiden:kelola",
      "Menetapkan Tindakan Koreksi & Penanggung Jawab (AB-028)",
    );

    const parsed = skemaTindakanKoreksi.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          parsed.error.issues[0]?.message ?? "Input tindakan perbaikan tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const insiden = await this.repository.ambilInsidenBerdasarkanId(insidenId);
    if (!insiden) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Laporan insiden dengan ID '${insidenId}' tidak ditemukan.`,
        pesanInternal: `Insiden ${insidenId} tidak ditemukan untuk tindakan perbaikan.`,
      });
    }

    if (insiden.statusInsiden === "selesai_ditutup") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Insiden telah resmi ditutup dan tidak dapat ditambahkan tindakan koreksi baru.",
        pesanInternal: `Insiden ${insiden.nomorInsiden} berstatus selesai_ditutup.`,
      });
    }

    const tindakanEntitas: TindakanPerbaikanEntitas = {
      id: `act-${randomUUID().slice(0, 8)}`,
      insidenId: insiden.id,
      nomorInsiden: insiden.nomorInsiden,
      deskripsiTindakan: parsed.data.deskripsiTindakan,
      penanggungJawabId: parsed.data.penanggungJawabId,
      penanggungJawabNama: parsed.data.penanggungJawabNama,
      targetTanggalSelesai: parsed.data.targetTanggalSelesai,
      tanggalRealisasi: null,
      statusTindakan: "direncanakan",
      buktiPenyelesaian: null,
      createdAt: new Date().toISOString(),
    };

    const tersimpan = await this.repository.simpanTindakanKoreksi(tindakanEntitas);

    await this.repository.perbaruiInsiden(insiden.id, {
      statusInsiden: "tindakan_koreksi",
      penanggungJawabId: parsed.data.penanggungJawabId,
      penanggungJawabNama: parsed.data.penanggungJawabNama,
    });

    return this.petakanTindakanDto(tersimpan);
  }

  /**
   * Menutup insiden secara resmi dengan penegakan closed-loop resolution (AB-029).
   */
  public async tutupResmiInsiden(
    pengguna: ProfilSesiPengguna,
    insidenId: string,
    input: unknown,
  ): Promise<ItemLaporanInsidenKeselamatanDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:insiden:kelola",
      "Menutup Resmi Insiden Keselamatan Pasien Gizi (AB-029)",
    );

    const parsed = skemaPenutupanInsiden.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          parsed.error.issues[0]?.message ?? "Catatan penutupan insiden tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const insiden = await this.repository.ambilInsidenBerdasarkanId(insidenId);
    if (!insiden) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Laporan insiden dengan ID '${insidenId}' tidak ditemukan.`,
        pesanInternal: `Insiden ${insidenId} tidak ditemukan untuk penutupan.`,
      });
    }

    if (insiden.statusInsiden === "selesai_ditutup") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Insiden ${insiden.nomorInsiden} sudah berstatus selesai ditutup sebelumnya.`,
        pesanInternal: `Insiden ${insiden.id} sudah ditutup pada ${insiden.waktuPenutupan}.`,
      });
    }

    // AB-029: Closed-loop resolution check. Wajib ada investigasi dan minimal 1 tindakan.
    const [investigasi, daftarTindakan] = await Promise.all([
      this.repository.ambilInvestigasiBerdasarkanInsidenId(insiden.id),
      this.repository.ambilDaftarTindakanBerdasarkanInsidenId(insiden.id),
    ]);

    if (!investigasi) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna:
          "Insiden tidak dapat ditutup: Investigasi akar masalah (RCA) wajib diselesaikan terlebih dahulu (AB-029).",
        pesanInternal: `Insiden ${insiden.nomorInsiden} belum memiliki entri investigasi.`,
      });
    }

    if (daftarTindakan.length === 0) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna:
          "Insiden tidak dapat ditutup: Sedikitnya satu rencana tindakan perbaikan dan penanggung jawab wajib ditetapkan (AB-028, AB-029).",
        pesanInternal: `Insiden ${insiden.nomorInsiden} belum memiliki daftar tindakan koreksi.`,
      });
    }

    const waktuSekarang = new Date().toISOString();
    const terupdate = await this.repository.perbaruiInsiden(insiden.id, {
      statusInsiden: "selesai_ditutup",
      waktuPenutupan: waktuSekarang,
      catatanPenutupan: parsed.data.catatanPenutupan,
    });

    return this.petakanInsidenDto(terupdate);
  }

  /**
   * Mengambil daftar hasil evaluasi mutu pelayanan dan sisa makanan bangsal (BRD Bab X, XI).
   */
  public async ambilDaftarEvaluasiMutu(
    pengguna: ProfilSesiPengguna,
  ): Promise<ItemEvaluasiMutuGiziDto[]> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:mutu:evaluasi",
      "Melihat Daftar Evaluasi Mutu Pelayanan & Plate Waste",
    );

    const evaluasiList = await this.repository.ambilSemuaEvaluasiMutu();
    return evaluasiList.map((e) => this.petakanEvaluasiDto(e));
  }

  /**
   * Mencatat evaluasi mutu gizi berkala bangsal rawat inap.
   */
  public async catatEvaluasiMutu(
    pengguna: ProfilSesiPengguna,
    input: unknown,
  ): Promise<ItemEvaluasiMutuGiziDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:mutu:evaluasi",
      "Merekam Evaluasi Mutu & Analisis Plate Waste",
    );

    const parsed = skemaEvaluasiMutuGizi.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          parsed.error.issues[0]?.message ?? "Input evaluasi mutu gizi tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const {
      tanggalEvaluasi,
      bangsalId,
      namaBangsal,
      totalPorsiDisajikan,
      rataRataSisaMakananPersen,
      kepatuhanCcpSuhuPersen,
      kepatuhanDuaIdentitasPersen,
      catatanEvaluasi,
    } = parsed.data;

    let kategoriMutu: "sangat_baik" | "standar" | "perlu_perbaikan" = "standar";
    if (
      rataRataSisaMakananPersen <= 15 &&
      kepatuhanCcpSuhuPersen >= 95 &&
      kepatuhanDuaIdentitasPersen >= 98
    ) {
      kategoriMutu = "sangat_baik";
    } else if (
      rataRataSisaMakananPersen > 20 ||
      kepatuhanCcpSuhuPersen < 90 ||
      kepatuhanDuaIdentitasPersen < 95
    ) {
      kategoriMutu = "perlu_perbaikan";
    }

    const evaluasiEntitas: EvaluasiMutuGiziEntitas = {
      id: `ev-${randomUUID().slice(0, 8)}`,
      tanggalEvaluasi,
      bangsalId,
      namaBangsal,
      totalPorsiDisajikan,
      rataRataSisaMakananPersen,
      kepatuhanCcpSuhuPersen,
      kepatuhanDuaIdentitasPersen,
      kategoriMutu,
      catatanEvaluasi,
      evaluatorId: pengguna.id,
      evaluatorNama: pengguna.namaLengkap,
      createdAt: new Date().toISOString(),
    };

    const tersimpan = await this.repository.simpanEvaluasiMutu(evaluasiEntitas);
    return this.petakanEvaluasiDto(tersimpan);
  }

  /**
   * Mengambil daftar rekonsiliasi pelayanan darurat saat downtime (AB-033).
   */
  public async ambilDaftarRekonsiliasiDowntime(
    pengguna: ProfilSesiPengguna,
  ): Promise<ItemRekonsiliasiDowntimeDto[]> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:audit:rekonsiliasi",
      "Melihat Daftar Rekonsiliasi Pelayanan Downtime",
    );

    const list = await this.repository.ambilSemuaRekonsiliasiDowntime();
    return list.map((r) => this.petakanRekonsiliasiDto(r));
  }

  /**
   * Mendaftarkan pengajuan rekonsiliasi downtime baru pasca-pulihnya sistem.
   */
  public async catatPengajuanDowntime(
    pengguna: ProfilSesiPengguna,
    input: unknown,
  ): Promise<ItemRekonsiliasiDowntimeDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:audit:rekonsiliasi",
      "Mencatat Pengajuan Rekonsiliasi Downtime (AB-033)",
    );

    const parsed = skemaRekonsiliasiDowntime.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          parsed.error.issues[0]?.message ?? "Input rekonsiliasi downtime tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const nomorRekonsiliasi =
      await this.repository.hitungNomorRekonsiliasiBerikutnya();
    const entitas: RekonsiliasiDowntimeEntitas = {
      id: `rec-${randomUUID().slice(0, 8)}`,
      nomorRekonsiliasi,
      tanggalInsidenDowntime: parsed.data.tanggalInsidenDowntime,
      durasiDowntimeMenit: parsed.data.durasiDowntimeMenit,
      unitTerdampak: parsed.data.unitTerdampak,
      jumlahFormulirKertas: parsed.data.jumlahFormulirKertas,
      duplikasiTerdeteksi: parsed.data.duplikasiTerdeteksi,
      selisihPesananSelesai: parsed.data.selisihPesananSelesai,
      statusRekonsiliasi: "menunggu_pengesahan",
      disahkanOlehId: null,
      disahkanOlehNama: null,
      waktuPengesahan: null,
      catatanRekonsiliasi: parsed.data.catatanRekonsiliasi,
      createdAt: new Date().toISOString(),
    };

    const tersimpan = await this.repository.simpanRekonsiliasiDowntime(entitas);
    return this.petakanRekonsiliasiDto(tersimpan);
  }

  /**
   * Memutuskan pengesahan atau penolakan rekonsiliasi downtime (AB-033).
   */
  public async putuskanPengesahanRekonsiliasi(
    pengguna: ProfilSesiPengguna,
    id: string,
    input: unknown,
  ): Promise<ItemRekonsiliasiDowntimeDto> {
    this.validasiIzinAksesKepala(
      pengguna,
      "kepala_instalasi:audit:rekonsiliasi",
      "Mengesahkan Rekonsiliasi Pelayanan Downtime (AB-033)",
    );

    const parsed = skemaKeputusanRekonsiliasi.safeParse(input);
    if (!parsed.success) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          parsed.error.issues[0]?.message ?? "Keputusan rekonsiliasi tidak valid.",
        pesanInternal: JSON.stringify(parsed.error.format()),
      });
    }

    const rec = await this.repository.ambilRekonsiliasiBerdasarkanId(id);
    if (!rec) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Berkas rekonsiliasi downtime dengan ID '${id}' tidak ditemukan.`,
        pesanInternal: `Rekonsiliasi ${id} tidak ada di repositori.`,
      });
    }

    if (rec.statusRekonsiliasi !== "menunggu_pengesahan") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Rekonsiliasi ${rec.nomorRekonsiliasi} sudah diputuskan sebelumnya (${rec.statusRekonsiliasi}).`,
        pesanInternal: `Status saat ini: ${rec.statusRekonsiliasi}`,
      });
    }

    const sekarang = new Date().toISOString();
    const terupdate = await this.repository.perbaruiRekonsiliasiDowntime(rec.id, {
      statusRekonsiliasi: parsed.data.keputusan,
      disahkanOlehId: pengguna.id,
      disahkanOlehNama: pengguna.namaLengkap,
      waktuPengesahan: sekarang,
      catatanRekonsiliasi: `${rec.catatanRekonsiliasi} | Keputusan: ${parsed.data.keputusan.toUpperCase()} - ${parsed.data.catatan}`,
    });

    return this.petakanRekonsiliasiDto(terupdate);
  }

  // --- PEMETA ENTITAS KE DTO ---

  private petakanInsidenDto(
    e: LaporanInsidenKeselamatanEntitas,
  ): ItemLaporanInsidenKeselamatanDto {
    return {
      id: e.id,
      nomorInsiden: e.nomorInsiden,
      unitPelapor: e.unitPelapor,
      tanggalKejadian: e.tanggalKejadian,
      jenisInsiden: e.jenisInsiden,
      derajatKeparahan: e.derajatKeparahan,
      deskripsiKejadian: e.deskripsiKejadian,
      tindakanAwalSegera: e.tindakanAwalSegera,
      pasienTerdampakNama: e.pasienTerdampakNama,
      nomorRmPasien: e.nomorRmPasien,
      namaBangsal: e.namaBangsal,
      statusInsiden: e.statusInsiden,
      pelaporNama: e.pelaporNama,
      penanggungJawabNama: e.penanggungJawabNama,
      waktuPenutupan: e.waktuPenutupan,
      catatanPenutupan: e.catatanPenutupan,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private petakanInvestigasiDto(
    e: InvestigasiInsidenEntitas,
  ): ItemInvestigasiInsidenDto {
    return {
      id: e.id,
      insidenId: e.insidenId,
      nomorInsiden: e.nomorInsiden,
      investigatorId: e.investigatorId,
      investigatorNama: e.investigatorNama,
      tanggalInvestigasi: e.tanggalInvestigasi,
      akarMasalahRca: e.akarMasalahRca,
      faktorKontributor: e.faktorKontributor,
      rekomendasiSistemik: e.rekomendasiSistemik,
      createdAt: e.createdAt,
    };
  }

  private petakanTindakanDto(
    e: TindakanPerbaikanEntitas,
  ): ItemTindakanKoreksiDto {
    return {
      id: e.id,
      insidenId: e.insidenId,
      nomorInsiden: e.nomorInsiden,
      deskripsiTindakan: e.deskripsiTindakan,
      penanggungJawabId: e.penanggungJawabId,
      penanggungJawabNama: e.penanggungJawabNama,
      targetTanggalSelesai: e.targetTanggalSelesai,
      tanggalRealisasi: e.tanggalRealisasi,
      statusTindakan: e.statusTindakan,
      buktiPenyelesaian: e.buktiPenyelesaian,
      createdAt: e.createdAt,
    };
  }

  private petakanEvaluasiDto(
    e: EvaluasiMutuGiziEntitas,
  ): ItemEvaluasiMutuGiziDto {
    return {
      id: e.id,
      tanggalEvaluasi: e.tanggalEvaluasi,
      bangsalId: e.bangsalId,
      namaBangsal: e.namaBangsal,
      totalPorsiDisajikan: e.totalPorsiDisajikan,
      rataRataSisaMakananPersen: e.rataRataSisaMakananPersen,
      kepatuhanCcpSuhuPersen: e.kepatuhanCcpSuhuPersen,
      kepatuhanDuaIdentitasPersen: e.kepatuhanDuaIdentitasPersen,
      kategoriMutu: e.kategoriMutu,
      catatanEvaluasi: e.catatanEvaluasi,
      evaluatorNama: e.evaluatorNama,
    };
  }

  private petakanRekonsiliasiDto(
    e: RekonsiliasiDowntimeEntitas,
  ): ItemRekonsiliasiDowntimeDto {
    return {
      id: e.id,
      nomorRekonsiliasi: e.nomorRekonsiliasi,
      tanggalInsidenDowntime: e.tanggalInsidenDowntime,
      durasiDowntimeMenit: e.durasiDowntimeMenit,
      unitTerdampak: e.unitTerdampak,
      jumlahFormulirKertas: e.jumlahFormulirKertas,
      duplikasiTerdeteksi: e.duplikasiTerdeteksi,
      selisihPesananSelesai: e.selisihPesananSelesai,
      statusRekonsiliasi: e.statusRekonsiliasi,
      disahkanOlehNama: e.disahkanOlehNama,
      waktuPengesahan: e.waktuPengesahan,
      catatanRekonsiliasi: e.catatanRekonsiliasi,
      createdAt: e.createdAt,
    };
  }
}
