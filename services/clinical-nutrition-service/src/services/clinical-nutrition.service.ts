/**
 * @fileoverview Layanan logika bisnis dan orkestrasi klinis untuk `clinical-nutrition-service`.
 * Mengimplementasikan aturan BRD Versi 4.0:
 * - Pemeriksaan awal dokter & diagnosis klinis (BRD Bab IV.4.2)
 * - Verifikasi dua pengenal pasien sebelum pemeriksaan (AB-020)
 * - Pencatatan alergi makanan/obat (AB-007)
 * - Penetapan instruksi diet awal sah berstempel waktu & berversi (AB-003, AB-004, AB-005)
 * - Larangan makan atau minum melalui mulut / NPO memblokir pesanan oral (AB-008)
 * - Diet awal sah dan aman dapat diproses sebelum penilaian lengkap ahli gizi (AB-009)
 * - Koreksi instruksi diet berversi mempertahankan riwayat (AB-010, AB-030)
 * - Pengajuan rawat inap berprioritas untuk ditindaklanjuti Tahap 4 (BRD Bab IV.4.3)
 * - Pembatasan akses berbasis peran dan wilayah bangsal (AB-032)
 */

import { randomUUID } from "node:crypto";
import {
  KODE_GALAT,
  type ItemObservasiAsupanDto,
  type ItemPasienBangsalPerawatDto,
  type ItemSkriningGiziDto,
  type ItemVerifikasiKeamananMakananDto,
  type JadwalMakan,
  type KategoriPenurunanBb,
  type KategoriRisikoGizi,
  type KategoriNotifikasi,
  type KemampuanMenelan,
  type KeputusanKeamananMakanan,
  type KondisiPemberianMakanan,
  type PeranPengguna,
  type PrioritasNotifikasi,
  type ProfilSesiPengguna,
  type SkalaComstock,
  type StatusKesadaran,
  type StatusPuasaNpo,
  type ItemAsuhanGiziAdimeDto,
  type ItemEvaluasiAsuhanGiziDto,
  type ItemKatalogMenuResepDto,
  type ItemPasienDietisienDto,
  type ItemRencanaMenuIndividualDto,
} from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type { InpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import type { PatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import type {
  DaftarAntreanDokterRespons,
  DetailKlinisPasienRespons,
  EntitasAlergiPasien,
  EntitasInstruksiDiet,
  EntitasPemeriksaanKlinis,
  EntitasPengajuanRawatInap,
  EntitasRiwayatVersiInstruksiDiet,
  ItemAntreanDokterDto,
} from "../model/clinical-nutrition.model.ts";
import type {
  EntitasObservasiAsupanKeperawatan,
  EntitasSkriningGizi,
  EntitasVerifikasiKeamananMakanan,
} from "../model/nursing.model.ts";
import type {
  EntitasAsuhanGiziAdime,
  EntitasEvaluasiAsuhanGizi,
  EntitasRencanaMenuIndividual,
} from "../model/dietitian.model.ts";
import type {
  ClinicalNutritionRepository,
  ParameterDaftarPengajuanRawatInap,
} from "../repository/clinical-nutrition.repository.ts";
import type {
  InputCatatAlergiPasien,
  InputKoreksiInstruksiDiet,
  InputPengajuanRawatInap,
  InputSahkanInstruksiDiet,
  InputSimpanPemeriksaanKlinis,
} from "../validators/clinical-nutrition.validator.ts";
import type {
  InputObservasiAsupan,
  InputSkriningGizi,
  InputVerifikasiKeamananMakanan,
} from "../validators/nursing.validator.ts";
import {
  validasiInputAsuhanGizi,
  validasiInputEvaluasiAsuhanGizi,
  validasiInputRencanaMenuIndividual,
} from "../validators/dietitian.validator.ts";

export interface DependensiLayananClinicalNutrition {
  padaPerubahanDiet?: (pasienId: string) => Promise<void>;
  periksaMenu?: (menu: EntitasRencanaMenuIndividual) => Promise<unknown>;
  padaMenuDisahkan?: (menu: EntitasRencanaMenuIndividual, profil: ProfilSesiPengguna) => Promise<void>;
  sebelumObservasi?: (input: InputObservasiAsupan) => Promise<void>;

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

export class ClinicalNutritionService {
  private readonly clinicalRepo: ClinicalNutritionRepository;
  private readonly patientRepo: PatientRepository;
  private readonly inpatientRepo?: InpatientRepository;
  private readonly deps: DependensiLayananClinicalNutrition;

  constructor(
    clinicalRepo: ClinicalNutritionRepository,
    patientRepo: PatientRepository,
    depsOrInpatientRepo: InpatientRepository | DependensiLayananClinicalNutrition,
    depsParam?: DependensiLayananClinicalNutrition,
  ) {
    this.clinicalRepo = clinicalRepo;
    this.patientRepo = patientRepo;
    if (depsParam) {
      this.inpatientRepo = depsOrInpatientRepo as InpatientRepository;
      this.deps = depsParam;
    } else {
      this.deps = depsOrInpatientRepo as DependensiLayananClinicalNutrition;
    }
  }

  /**
   * Mengambil daftar antrean pasien dokter dari `patient-service` yang diperkaya
   * dengan status pemeriksaan klinis, instruksi diet, dan pengajuan rawat inap.
   * Menolak peran non-Dokter (AB-032).
   */
  public async ambilAntreanDokter(param: {
    aktor: ProfilSesiPengguna;
    halaman?: number;
    ukuranHalaman?: number;
    kataKunci?: string;
    statusKunjungan?: string;
    correlationId?: string;
  }): Promise<DaftarAntreanDokterRespons> {
    this.validasiIzinAksesDokter(param.aktor, "Melihat Antrean Kunjungan Dokter");

    const hlm = Math.max(1, param.halaman ?? 1);
    const ukuran = Math.max(1, Math.min(100, param.ukuranHalaman ?? 10));

    // Ambil daftar kunjungan dari patient-service
    const hasilKunjungan = await this.patientRepo.cariDaftarKunjungan({
      halaman: hlm,
      ukuranHalaman: ukuran,
      kataKunci: param.kataKunci,
    });

    const itemsDto: ItemAntreanDokterDto[] = [];
    for (const k of hasilKunjungan.items) {
      // Periksa apakah kunjungan ini sudah memiliki pemeriksaan klinis
      const pmx =
        await this.clinicalRepo.ambilPemeriksaanBerdasarkanKunjungan(k.id);
      // Periksa apakah pasien ini memiliki instruksi diet aktif
      const dietAktif =
        await this.clinicalRepo.ambilInstruksiDietAktif(k.pasienId);
      // Periksa apakah pasien ini memiliki pengajuan rawat inap aktif
      const pengajuanRi =
        await this.clinicalRepo.ambilPengajuanRawatInapAktif(k.pasienId);

      itemsDto.push({
        kunjunganId: k.id,
        nomorKunjungan: k.nomorKunjungan,
        pasienId: k.pasienId,
        nomorRekamMedis: k.pasien.nomorRekamMedis,
        namaLengkap: k.pasien.namaLengkap,
        tanggalLahir: k.pasien.tanggalLahir,
        jenisKelamin: k.pasien.jenisKelamin,
        kodeAntrean: k.kodeAntrean,
        nomorAntreanHarian: k.nomorAntreanHarian,
        prioritasAntrean: k.prioritasAntrean,
        statusKunjungan: k.statusKunjungan,
        keluhanAdministratif: k.keluhanAdministratif,
        unitTujuan: k.unitTujuan,
        dokterTujuanId: k.dokterTujuanId,
        dokterTujuanNama: k.dokterTujuanNama,
        waktuMasukAntrean: k.waktuMasukAntrean,
        sudahDiperiksa: pmx !== null,
        adaInstruksiDietAktif: dietAktif !== null,
        adaPengajuanRawatInap: pengajuanRi !== null,
      });
    }

    return {
      items: itemsDto,
      totalItem: hasilKunjungan.totalItem,
      halaman: hlm,
      ukuranHalaman: ukuran,
      ringkasan: {
        menungguPemeriksaan: hasilKunjungan.ringkasanAntrean.menungguPemeriksaan,
        sedangDiperiksa: hasilKunjungan.ringkasanAntrean.sedangDiperiksa,
        selesaiPemeriksaan: itemsDto.filter(
          (i) => i.statusKunjungan === "selesai_pemeriksaan",
        ).length,
        diajukanRawatInap: itemsDto.filter(
          (i) => i.statusKunjungan === "diajukan_rawat_inap",
        ).length,
      },
    };
  }

  /**
   * Menyimpan hasil pemeriksaan klinis pasien (BRD Bab IV.4.2).
   * Memverifikasi sedikitnya dua pengenal pasien (AB-020).
   * Menegakkan isolasi penugasan bangsal (AB-032).
   */
  public async simpanPemeriksaanKlinis(
    input: InputSimpanPemeriksaanKlinis,
    aktor: ProfilSesiPengguna,
    correlationId?: string,
  ): Promise<EntitasPemeriksaanKlinis> {
    this.validasiIzinAksesDokter(
      aktor,
      "Menyimpan Hasil Pemeriksaan Klinis Pasien",
    );

    // 1. Ambil data pasien dari patient-service
    const pasien = await this.patientRepo.cariPasienBerdasarkanId(input.pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan pada sistem registrasi.",
        pesanInternal: `Pasien ${input.pasienId} tidak ditemukan saat pemeriksaan klinis.`,
      });
    }

    // 2. Verifikasi Dua Pengenal (AB-020)
    if (
      input.verifikasiTanggalLahir.trim() !== pasien.tanggalLahir.trim()
    ) {
      await this.deps.catatAuditAkses({
        aktorId: aktor.id,
        peranAktor: aktor.peran,
        tindakan: "PEMERIKSAAN_KLINIS_DITOLAK_DUA_PENGENAL",
        sumberDaya: "pemeriksaan_klinis",
        idSumberDaya: input.pasienId,
        keputusan: "DITOLAK",
        alasan: "Tanggal lahir verifikasi tidak cocok dengan data pasien (AB-020)",
        correlationId,
      });

      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna:
          "Penahanan Keselamatan (AB-020): Verifikasi dua pengenal gagal. Tanggal lahir verifikasi yang diinput tidak sesuai dengan data rekam medis pasien.",
        pesanInternal: `Verifikasi gagal untuk pasien ${pasien.nomorRekamMedis}: input '${input.verifikasiTanggalLahir}' vs DB '${pasien.tanggalLahir}'.`,
      });
    }

    // 3. Ambil data kunjungan pemeriksaan
    const kunjungan = await this.patientRepo.cariKunjunganBerdasarkanId(
      input.kunjunganId,
    );
    if (!kunjungan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data kunjungan pemeriksaan tidak ditemukan.",
      });
    }

    // 4. Periksa batas penugasan bangsal jika dokter memiliki batas bangsal (AB-032)
    const bangsalDokter =
      aktor.daftarBangsalId.length > 0 ? aktor.daftarBangsalId[0] : null;

    const sekarang = new Date().toISOString();
    const pemeriksaanId = `pmx-${randomUUID()}`;

    const entitasPemeriksaan: EntitasPemeriksaanKlinis = {
      id: pemeriksaanId,
      kunjunganId: kunjungan.id,
      pasienId: pasien.id,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      tanggalLahirPasien: pasien.tanggalLahir,
      dokterId: aktor.id,
      dokterNama: aktor.namaLengkap,
      unitPelayanan: kunjungan.unitTujuan,
      bangsalId: bangsalDokter,
      keluhanUtama: input.keluhanUtama.trim(),
      riwayatPenyakitSekarang: input.riwayatPenyakitSekarang?.trim() ?? null,
      tandaVital: {
        tekananDarahSistol: input.tekananDarahSistol ?? null,
        tekananDarahDiastol: input.tekananDarahDiastol ?? null,
        denyutNadi: input.denyutNadi ?? null,
        frekuensiNafas: input.frekuensiNafas ?? null,
        suhuTubuh: input.suhuTubuh ?? null,
        beratBadanKg: input.beratBadanKg ?? null,
        tinggiBadanCm: input.tinggiBadanCm ?? null,
      },
      diagnosisKlinisPrimer: input.diagnosisKlinisPrimer.trim(),
      diagnosisKlinisSekunder: input.diagnosisKlinisSekunder?.trim() ?? null,
      catatanKlinisRelevanGizi: input.catatanKlinisRelevanGizi?.trim() ?? null,
      tindakLanjut: input.tindakLanjut,
      dibuatPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const hasilSimpan =
      await this.clinicalRepo.simpanPemeriksaanKlinis(entitasPemeriksaan);

    await this.deps.catatAuditAkses({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "SIMPAN_PEMERIKSAAN_KLINIS",
      sumberDaya: "pemeriksaan_klinis",
      idSumberDaya: hasilSimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Pemeriksaan klinis dokter DPJP tersimpan untuk pasien ${pasien.nomorRekamMedis}`,
      correlationId,
      metadata: {
        kunjunganId: kunjungan.id,
        diagnosisUtama: hasilSimpan.diagnosisKlinisPrimer,
        tindakLanjut: hasilSimpan.tindakLanjut,
      },
    });

    await this.clinicalRepo.simpanOutbox(
      "pemeriksaan_klinis_diselesaikan",
      hasilSimpan.id,
      {
        kunjunganId: kunjungan.id,
        pasienId: pasien.id,
        dokterId: aktor.id,
        diagnosis: hasilSimpan.diagnosisKlinisPrimer,
      },
    );

    return hasilSimpan;
  }

  /**
   * Mencatat riwayat alergi makanan atau obat pasien (AB-007).
   */
  public async catatAlergiPasien(
    pasienId: string,
    input: InputCatatAlergiPasien,
    aktor: ProfilSesiPengguna,
    correlationId?: string,
  ): Promise<EntitasAlergiPasien> {
    this.validasiIzinAksesDokter(aktor, "Mencatat Riwayat Alergi Pasien");

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan.",
      });
    }

    const entitasAlergi: EntitasAlergiPasien = {
      id: `alg-${randomUUID()}`,
      pasienId: pasien.id,
      pemeriksaanId: input.pemeriksaanId ?? null,
      kategoriAlergen: input.kategoriAlergen,
      namaAlergen: input.namaAlergen.trim(),
      tingkatKeparahan: input.tingkatKeparahan,
      reaksiAlergi: input.reaksiAlergi?.trim() ?? null,
      statusAktif: true,
      dicatatOlehId: aktor.id,
      dicatatOlehNama: aktor.namaLengkap,
      dicatatPada: new Date().toISOString(),
    };

    const hasil = await this.clinicalRepo.simpanAlergiPasien(entitasAlergi);

    await this.deps.catatAuditAkses({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "CATAT_ALERGI_PASIEN",
      sumberDaya: "alergi_pasien",
      idSumberDaya: hasil.id,
      keputusan: "DIIZINKAN",
      alasan: `Pencatatan alergi ${hasil.kategoriAlergen}: ${hasil.namaAlergen} untuk pasien ${pasien.nomorRekamMedis}`,
      correlationId,
    });

    return hasil;
  }

  /**
   * Mengambil riwayat alergi pasien.
   */
  public async ambilDaftarAlergi(
    pasienId: string,
    aktor: ProfilSesiPengguna,
  ): Promise<EntitasAlergiPasien[]> {
    this.validasiIzinAksesDokter(aktor, "Melihat Riwayat Alergi Pasien");
    return this.clinicalRepo.ambilDaftarAlergiPasien(pasienId, true);
  }

  /**
   * Mengambil detail lengkap klinis pasien untuk ruang kerja dokter.
   */
  public async ambilDetailKlinisPasien(
    kunjunganId: string,
    aktor: ProfilSesiPengguna,
  ): Promise<DetailKlinisPasienRespons> {
    this.validasiIzinAksesDokter(aktor, "Melihat Detail Klinis Pasien");

    const kunjungan = await this.patientRepo.cariKunjunganBerdasarkanId(
      kunjunganId,
    );
    if (!kunjungan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data kunjungan tidak ditemukan.",
      });
    }

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(kunjungan.pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan.",
      });
    }

    const pemeriksaanTerbaru =
      await this.clinicalRepo.ambilPemeriksaanBerdasarkanKunjungan(kunjunganId);
    const alergiAktif = await this.clinicalRepo.ambilDaftarAlergiPasien(
      pasien.id,
      true,
    );
    const instruksiDietAktif =
      await this.clinicalRepo.ambilInstruksiDietAktif(pasien.id);

    let riwayatVersiDiet: EntitasRiwayatVersiInstruksiDiet[] = [];
    if (instruksiDietAktif) {
      riwayatVersiDiet = await this.clinicalRepo.ambilRiwayatVersiDiet(
        instruksiDietAktif.id,
      );
    }

    const pengajuanRawatInapAktif =
      await this.clinicalRepo.ambilPengajuanRawatInapAktif(pasien.id);

    return {
      kunjunganId: kunjungan.id,
      pasienId: pasien.id,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      tanggalLahirPasien: pasien.tanggalLahir,
      pemeriksaanTerbaru,
      alergiAktif,
      instruksiDietAktif,
      riwayatVersiDiet,
      pengajuanRawatInapAktif,
    };
  }

  /**
   * Menetapkan dan mengesahkan instruksi diet awal oleh Dokter DPJP (AB-003, AB-004, AB-005, AB-008, AB-009).
   * Menjaga idempotensi jika header `X-Idempotency-Key` disertakan.
   */
  public async sahkanInstruksiDietAwal(
    input: InputSahkanInstruksiDiet,
    aktor: ProfilSesiPengguna,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<EntitasInstruksiDiet> {
    this.validasiIzinAksesDokter(
      aktor,
      "Mengesahkan Instruksi Diet Awal (AB-003)",
    );

    // Cek Idempotensi
    if (idempotencyKey) {
      const rekaman = await this.clinicalRepo.ambilRekamanIdempotensi(
        idempotencyKey,
      );
      if (rekaman) {
        return JSON.parse(rekaman.tubuhRespons) as EntitasInstruksiDiet;
      }
    }

    // 1. Validasi pasien dan kunjungan
    const pasien = await this.patientRepo.cariPasienBerdasarkanId(input.pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan.",
      });
    }

    // 2. Periksa apakah pasien sudah memiliki instruksi diet aktif
    const dietAktifSaatIni =
      await this.clinicalRepo.ambilInstruksiDietAktif(pasien.id);
    if (dietAktifSaatIni) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Pasien ${pasien.nomorRekamMedis} sudah memiliki instruksi diet aktif (${dietAktifSaatIni.nomorInstruksi} Versi ${dietAktifSaatIni.versi}). Gunakan menu koreksi/perubahan versi diet (AB-004, AB-010) jika ingin mengubah instruksi.`,
      });
    }

    // 3. Batas wilayah bangsal dokter DPJP (AB-032)
    const bangsalDokter =
      aktor.daftarBangsalId.length > 0 ? aktor.daftarBangsalId[0] : null;

    // 4. Nomor instruksi unik (DIET-YYYYMMDD-XXXX)
    const nomorInstruksi =
      await this.clinicalRepo.hitungNomorInstruksiBerikutnya();
    const sekarang = new Date().toISOString();
    const instruksiId = `diet-${randomUUID()}`;

    const instruksiDiet: EntitasInstruksiDiet = {
      id: instruksiId,
      nomorInstruksi,
      pasienId: pasien.id,
      kunjunganId: input.kunjunganId,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      dokterPengesahId: aktor.id,
      dokterPengesahNama: aktor.namaLengkap,
      bangsalId: bangsalDokter,
      jenisDiet: input.jenisDiet,
      namaDietKustom: input.namaDietKustom?.trim() ?? null,
      bentukMakanan: input.bentukMakanan,
      rutePemberian: input.rutePemberian,
      statusPuasaNpo: input.statusPuasaNpo ?? false,
      alasanPuasa: input.statusPuasaNpo ? input.alasanPuasa?.trim() ?? null : null,
      targetEnergiKkal: input.targetEnergiKkal ?? null,
      targetProteinGram: input.targetProteinGram ?? null,
      pembatasanCairanMl: input.pembatasanCairanMl ?? null,
      pembatasanNatriumMg: input.pembatasanNatriumMg ?? null,
      instruksiKhusus: input.instruksiKhusus?.trim() ?? null,
      statusInstruksi: "aktif",
      versi: 1,
      berlakuSejak: input.berlakuSejak ?? sekarang,
      berlakuHingga: null,
      disahkanPada: sekarang,
      dibuatPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const hasilSimpan =
      await this.clinicalRepo.simpanInstruksiDiet(instruksiDiet);

    // Rekam versi 1 ke riwayat
    const riwayatVersi1: EntitasRiwayatVersiInstruksiDiet = {
      id: `rv-${randomUUID()}`,
      instruksiDietId: hasilSimpan.id,
      pasienId: pasien.id,
      versi: 1,
      snapshotData: { ...hasilSimpan },
      alasanPerubahan:
        "Penetapan dan pengesahan instruksi diet awal sah oleh Dokter DPJP (AB-003, AB-009).",
      diubahOlehId: aktor.id,
      diubahOlehNama: aktor.namaLengkap,
      diubahPada: sekarang,
    };
    await this.clinicalRepo.perbaruiVersiInstruksiDiet(
      hasilSimpan.id,
      hasilSimpan,
      riwayatVersi1,
    );

    // Simpan kunci idempotensi bila disediakan
    if (idempotencyKey) {
      await this.clinicalRepo.simpanRekamanIdempotensi({
        id: `idemp-${randomUUID()}`,
        kunci: idempotencyKey,
        aktorId: aktor.id,
        metodeHttp: "POST",
        jalurPermintaan: "/v1/clinical-nutrition/diet-orders",
        kodeStatusRespons: 201,
        tubuhRespons: JSON.stringify(hasilSimpan),
        waktuDibuat: sekarang,
      });
    }

    // Catat Audit & Outbox
    await this.deps.catatAuditAkses({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "PENGESAHAN_INSTRUKSI_DIET_AWAL",
      sumberDaya: "instruksi_diet",
      idSumberDaya: hasilSimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Instruksi diet awal sah ${hasilSimpan.nomorInstruksi} disahkan untuk pasien ${pasien.nomorRekamMedis}`,
      correlationId,
      metadata: {
        nomorInstruksi: hasilSimpan.nomorInstruksi,
        jenisDiet: hasilSimpan.jenisDiet,
        puasaNpo: hasilSimpan.statusPuasaNpo,
      },
    });

    // Kirim notifikasi konfirmasi ke dokter
    await this.deps.kirimNotifikasiPengguna({
      id: `notif-diet-${randomUUID()}`,
      penerimaId: aktor.id,
      judul: "Instruksi Diet Awal Sah Diterbitkan",
      pesan: `Instruksi diet ${hasilSimpan.nomorInstruksi} (${hasilSimpan.jenisDiet}, bentuk ${hasilSimpan.bentukMakanan}) untuk pasien ${pasien.namaLengkap} telah sah dan aktif pada sistem.`,
      kategori: "operasional",
      prioritas: "normal",
      dibuatPada: sekarang,
    });

    return hasilSimpan;
  }

  /**
   * Mengoreksi atau memperbarui instruksi diet pasien dengan nomor versi bertingkat (AB-004, AB-010, AB-030).
   * Menerapkan optimistic concurrency control pada `versiSebelum`.
   */
  public async koreksiInstruksiDietBerversi(
    instruksiDietId: string,
    input: InputKoreksiInstruksiDiet,
    aktor: ProfilSesiPengguna,
    correlationId?: string,
  ): Promise<EntitasInstruksiDiet> {
    this.validasiIzinAksesDokter(
      aktor,
      "Mengubah Versi Instruksi Diet Pasien (AB-004, AB-010)",
    );

    const instruksiLama =
      await this.clinicalRepo.ambilInstruksiDietBerdasarkanId(instruksiDietId);
    if (!instruksiLama) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data instruksi diet tidak ditemukan.",
      });
    }

    if (instruksiLama.statusInstruksi !== "aktif") {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna:
          "Hanya instruksi diet berstatus aktif yang dapat diperbarui versinya.",
      });
    }

    // Optimistic Concurrency Control (AB-030)
    if (instruksiLama.versi !== input.versiSebelum) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Konflik versi diet (AB-030): Versi yang ingin diperbarui (${input.versiSebelum}) tidak cocok dengan versi terkini di sistem (Versi ${instruksiLama.versi}). Muat ulang halaman dan periksa perubahan terbaru.`,
      });
    }

    const sekarang = new Date().toISOString();
    const versiBaru = instruksiLama.versi + 1;
    const bangsalDokter =
      aktor.daftarBangsalId.length > 0
        ? aktor.daftarBangsalId[0]
        : instruksiLama.bangsalId;

    const instruksiBaru: EntitasInstruksiDiet = {
      ...instruksiLama,
      id: `diet-${randomUUID()}`,
      bangsalId: bangsalDokter,
      jenisDiet: input.jenisDiet,
      namaDietKustom: input.namaDietKustom?.trim() ?? null,
      bentukMakanan: input.bentukMakanan,
      rutePemberian: input.rutePemberian,
      statusPuasaNpo: input.statusPuasaNpo ?? false,
      alasanPuasa: input.statusPuasaNpo ? input.alasanPuasa?.trim() ?? null : null,
      targetEnergiKkal: input.targetEnergiKkal ?? null,
      targetProteinGram: input.targetProteinGram ?? null,
      pembatasanCairanMl: input.pembatasanCairanMl ?? null,
      pembatasanNatriumMg: input.pembatasanNatriumMg ?? null,
      instruksiKhusus: input.instruksiKhusus?.trim() ?? null,
      statusInstruksi: "aktif",
      versi: versiBaru,
      berlakuSejak: sekarang,
      berlakuHingga: null,
      disahkanPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const riwayatPerubahan: EntitasRiwayatVersiInstruksiDiet = {
      id: `rv-${randomUUID()}`,
      instruksiDietId: instruksiLama.id,
      pasienId: instruksiLama.pasienId,
      versi: versiBaru,
      snapshotData: { ...instruksiBaru },
      alasanPerubahan: input.alasanPerubahan.trim(),
      diubahOlehId: aktor.id,
      diubahOlehNama: aktor.namaLengkap,
      diubahPada: sekarang,
    };

    const hasil = await this.clinicalRepo.perbaruiVersiInstruksiDiet(
      instruksiLama.id,
      instruksiBaru,
      riwayatPerubahan,
    );

    if (!hasil.berhasil || !hasil.instruksi) {
      throw new AppError({ kode: KODE_GALAT.KONFLIK_BISNIS, statusHttp: 409, pesanPengguna: "Versi instruksi telah berubah. Muat ulang sebelum menyimpan revisi." });
    }

    await this.deps.padaPerubahanDiet?.(instruksiLama.pasienId);

    await this.deps.catatAuditAkses({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "PEMBARUAN_VERSI_INSTRUKSI_DIET",
      sumberDaya: "instruksi_diet",
      idSumberDaya: hasil.instruksi.id,
      keputusan: "DIIZINKAN",
      alasan: `Pembaruan instruksi diet ke Versi ${versiBaru}: ${input.alasanPerubahan}`,
      correlationId,
      metadata: {
        nomorInstruksi: hasil.instruksi.nomorInstruksi,
        versiBaru,
        alasanPerubahan: input.alasanPerubahan,
      },
    });

    // Peringatan otomatis keselamatan: perubahan diet memicu pemeriksaan pesanan terdampak (AB-010)
    await this.deps.kirimNotifikasiPengguna({
      id: `notif-diet-rev-${randomUUID()}`,
      penerimaId: aktor.id,
      judul: "Revisi Instruksi Diet Aktif (AB-010)",
      pesan: `Instruksi diet ${hasil.instruksi.nomorInstruksi} telah diperbarui ke Versi ${versiBaru}. Unit terkait akan meninjau pesanan terdampak.`,
      kategori: "keselamatan",
      prioritas: "tinggi",
      dibuatPada: sekarang,
    });

    return hasil.instruksi;
  }

  /**
   * Menerbitkan pengajuan rawat inap oleh Dokter DPJP (BRD Bab IV.4.3).
   */
  public async buatPengajuanRawatInap(
    input: InputPengajuanRawatInap,
    aktor: ProfilSesiPengguna,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<EntitasPengajuanRawatInap> {
    this.validasiIzinAksesDokter(aktor, "Membuat Pengajuan Rawat Inap Pasien");

    if (idempotencyKey) {
      const rekaman = await this.clinicalRepo.ambilRekamanIdempotensi(
        idempotencyKey,
      );
      if (rekaman) {
        return JSON.parse(rekaman.tubuhRespons) as EntitasPengajuanRawatInap;
      }
    }

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(input.pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data pasien tidak ditemukan.",
      });
    }

    const kunjungan = await this.patientRepo.cariKunjunganBerdasarkanId(
      input.kunjunganId,
    );
    if (!kunjungan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data kunjungan tidak ditemukan.",
      });
    }

    // Periksa apakah pasien sudah memiliki pengajuan rawat inap yang menunggu penempatan
    const pengajuanAktif =
      await this.clinicalRepo.ambilPengajuanRawatInapAktif(pasien.id);
    if (pengajuanAktif) {
      throw new AppError({
        kode: KODE_GALAT.KONFLIK_BISNIS,
        statusHttp: 409,
        pesanPengguna: `Pasien ${pasien.nomorRekamMedis} sudah memiliki pengajuan rawat inap aktif (${pengajuanAktif.nomorPengajuan}) yang sedang menunggu penempatan bangsal oleh Petugas Rawat Inap.`,
      });
    }

    const sekarang = new Date().toISOString();
    const nomorPengajuan =
      await this.clinicalRepo.hitungNomorPengajuanRawatInapBerikutnya();
    const pengajuanId = `ri-${randomUUID()}`;

    const pengajuan: EntitasPengajuanRawatInap = {
      id: pengajuanId,
      nomorPengajuan,
      pasienId: pasien.id,
      kunjunganId: kunjungan.id,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      dokterPengajuId: aktor.id,
      dokterPengajuNama: aktor.namaLengkap,
      diagnosisUtama: input.diagnosisUtama.trim(),
      alasanRawatInap: input.alasanRawatInap.trim(),
      prioritasRawatInap: input.prioritasRawatInap,
      rekomendasiBangsal: input.rekomendasiBangsal.trim(),
      kebutuhanKhusus: input.kebutuhanKhusus?.trim() ?? null,
      instruksiDietId: input.instruksiDietId ?? null,
      statusPengajuan: "menunggu_penempatan",
      diajukanPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const hasilSimpan =
      await this.clinicalRepo.simpanPengajuanRawatInap(pengajuan);

    if (idempotencyKey) {
      await this.clinicalRepo.simpanRekamanIdempotensi({
        id: `idemp-${randomUUID()}`,
        kunci: idempotencyKey,
        aktorId: aktor.id,
        metodeHttp: "POST",
        jalurPermintaan: "/v1/clinical-nutrition/admission-requests",
        kodeStatusRespons: 201,
        tubuhRespons: JSON.stringify(hasilSimpan),
        waktuDibuat: sekarang,
      });
    }

    await this.deps.catatAuditAkses({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "BUAT_PENGAJUAN_RAWAT_INAP",
      sumberDaya: "pengajuan_rawat_inap",
      idSumberDaya: hasilSimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Pengajuan rawat inap ${hasilSimpan.nomorPengajuan} diterbitkan ke ${hasilSimpan.rekomendasiBangsal} (Prioritas ${hasilSimpan.prioritasRawatInap})`,
      correlationId,
      metadata: {
        nomorPengajuan: hasilSimpan.nomorPengajuan,
        rekomendasiBangsal: hasilSimpan.rekomendasiBangsal,
        prioritas: hasilSimpan.prioritasRawatInap,
      },
    });

    await this.deps.kirimNotifikasiPengguna({
      id: `notif-ri-${randomUUID()}`,
      penerimaId: aktor.id,
      judul: "Pengajuan Rawat Inap Diterbitkan",
      pesan: `Pengajuan ${hasilSimpan.nomorPengajuan} untuk pasien ${pasien.namaLengkap} telah diteruskan ke Petugas Rawat Inap (Rekomendasi: ${hasilSimpan.rekomendasiBangsal}).`,
      kategori: "operasional",
      prioritas: "normal",
      dibuatPada: sekarang,
    });

    return hasilSimpan;
  }

  /**
   * Mengambil daftar pengajuan rawat inap berpaginasi.
   */
  public async ambilDaftarPengajuanRawatInap(
    param: ParameterDaftarPengajuanRawatInap,
    aktor: ProfilSesiPengguna,
  ): Promise<{ items: EntitasPengajuanRawatInap[]; totalItem: number }> {
    this.validasiIzinAksesDokter(aktor, "Melihat Daftar Pengajuan Rawat Inap");
    return this.clinicalRepo.ambilDaftarPengajuanRawatInap(param);
  }

  /**
   * Menyelesaikan kunjungan pemeriksaan rawat jalan.
   */
  public async selesaikanKunjunganPemeriksaan(
    kunjunganId: string,
    aktor: ProfilSesiPengguna,
    correlationId?: string,
  ): Promise<{ kunjunganId: string; statusKunjungan: string }> {
    this.validasiIzinAksesDokter(
      aktor,
      "Menyelesaikan Kunjungan Pemeriksaan Pasien",
    );

    const kunjungan = await this.patientRepo.cariKunjunganBerdasarkanId(
      kunjunganId,
    );
    if (!kunjungan) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data kunjungan pemeriksaan tidak ditemukan.",
      });
    }

    await this.deps.catatAuditAkses({
      aktorId: aktor.id,
      peranAktor: aktor.peran,
      tindakan: "SELESAIKAN_KUNJUNGAN_PEMERIKSAAN",
      sumberDaya: "kunjungan",
      idSumberDaya: kunjungan.id,
      keputusan: "DIIZINKAN",
      alasan: `Kunjungan ${kunjungan.nomorKunjungan} dinyatakan selesai pemeriksaan oleh Dokter DPJP`,
      correlationId,
    });

    return {
      kunjunganId: kunjungan.id,
      statusKunjungan: "selesai_pemeriksaan",
    };
  }

  /**
   * Memvalidasi kewenangan peran Dokter (AB-032).
   * Menolak Administrator dan peran non-medis dengan HTTP 403 Forbidden.
   */
  private validasiIzinAksesDokter(
    aktor: ProfilSesiPengguna,
    konteksTindakan: string,
  ): void {
    if (aktor.peran !== "dokter") {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna: `Anda tidak memiliki kewenangan medis untuk ${konteksTindakan}. Sesuai regulasi keselamatan rekam medis (AB-032), modul klinis Dokter hanya dapat diakses oleh peran Dokter.`,
        pesanInternal: `Akses ditolak untuk peran ${aktor.peran} (${aktor.id}) pada operasi klinis '${konteksTindakan}'.`,
      });
    }

    if (!aktor.daftarIzin.includes("dokter:pemeriksaan:baca")) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akun Anda tidak memiliki izin dasar dokter:pemeriksaan:baca.",
      });
    }
  }

  // =========================================================================
  // DOMAIN ASUHAN KEPERAWATAN & FOOD SAFETY VERIFICATION (TAHAP 5 — PERAWAT)
  // =========================================================================

  /**
   * Memvalidasi kewenangan peran Perawat (AB-032).
   * Menolak peran non-Perawat (Administrator, Petugas Pendaftaran, dll.) dengan HTTP 403 Forbidden.
   */
  public validasiIzinAksesPerawat(
    aktor: ProfilSesiPengguna,
    konteksTindakan: string,
  ): void {
    if (aktor.peran !== "perawat") {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna: `Anda tidak memiliki kewenangan keperawatan untuk ${konteksTindakan}. Sesuai regulasi rekam medis (AB-032), modul asuhan keperawatan dan verifikasi makanan hanya dapat diakses oleh peran Perawat.`,
        pesanInternal: `Akses ditolak untuk peran ${aktor.peran} (${aktor.id}) pada operasi keperawatan '${konteksTindakan}'.`,
      });
    }

    if (
      !aktor.daftarIzin.includes("perawat:asupan:catat") &&
      !aktor.daftarIzin.includes("perawat:keamanan_makanan:verifikasi")
    ) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akun Anda tidak memiliki izin perawat:asupan:catat atau perawat:keamanan_makanan:verifikasi.",
      });
    }
  }

  /**
   * Memvalidasi isolasi wilayah bangsal binaan perawat (AB-032).
   * Mencegah perawat mengakses atau memverifikasi pasien di luar bangsal penugasannya.
   */
  public validasiIsolasiBangsal(
    aktor: ProfilSesiPengguna,
    bangsalIdTarget: string,
  ): void {
    if (
      aktor.daftarBangsalId &&
      aktor.daftarBangsalId.length > 0 &&
      !aktor.daftarBangsalId.includes(bangsalIdTarget)
    ) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna: `Akses ditolak (AB-032): Anda ditugaskan di bangsal [${aktor.daftarBangsalId.join(", ")}], tidak memiliki wewenang untuk mengakses bangsal [${bangsalIdTarget}].`,
        pesanInternal: `Cross-ward isolation violation: actor wards=${aktor.daftarBangsalId.join(",")}, target ward=${bangsalIdTarget}`,
      });
    }
  }

  /**
   * Mengambil daftar pasien aktif di bangsal penugasan perawat (Tahap 5 — Perawat, AB-032).
   */
  public async ambilDaftarPasienBangsalPerawat(param: {
    aktor: ProfilSesiPengguna;
    bangsalId?: string;
    correlationId?: string;
  }): Promise<ItemPasienBangsalPerawatDto[]> {
    this.validasiIzinAksesPerawat(
      param.aktor,
      "Melihat Pasien Bangsal Rawat Inap",
    );

    const bangsalTarget =
      param.bangsalId ?? param.aktor.daftarBangsalId?.[0];
    if (!bangsalTarget) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 400,
        pesanPengguna:
          "Bangsal target tidak ditentukan dan akun perawat tidak memiliki bangsal penugasan.",
      });
    }

    this.validasiIsolasiBangsal(param.aktor, bangsalTarget);

    if (!this.inpatientRepo) {
      return [];
    }

    const [daftarBangsal, daftarKamar, daftarTempatTidur, daftarEpisode] =
      await Promise.all([
        this.inpatientRepo.ambilSemuaBangsal(),
        this.inpatientRepo.ambilSemuaKamar(bangsalTarget),
        this.inpatientRepo.ambilSemuaTempatTidur(bangsalTarget),
        this.inpatientRepo.ambilSemuaEpisode({
          status: "aktif",
          bangsalId: bangsalTarget,
        }),
      ]);

    const bangsal = daftarBangsal.find((b) => b.id === bangsalTarget);
    const namaBangsal = bangsal?.namaBangsal ?? bangsalTarget;

    const petaKamar = new Map<string, string>();
    for (const kmr of daftarKamar) {
      petaKamar.set(kmr.id, kmr.nomorKamar);
    }

    const petaTempatTidur = new Map<
      string,
      { nomor: string; kamarId: string }
    >();
    for (const tt of daftarTempatTidur) {
      petaTempatTidur.set(tt.id, {
        nomor: tt.nomorTempatTidur,
        kamarId: tt.kamarId,
      });
    }

    const hasil: ItemPasienBangsalPerawatDto[] = [];

    for (const ep of daftarEpisode) {
      const pasien = await this.patientRepo.cariPasienBerdasarkanId(
        ep.pasienId,
      );
      if (!pasien) continue;

      const ttInfo = petaTempatTidur.get(ep.tempatTidurId);
      const nomorTempatTidur = ttInfo?.nomor ?? ep.tempatTidurId;
      const nomorKamar =
        (ttInfo ? petaKamar.get(ttInfo.kamarId) : null) ?? "-";

      const [
        instruksiDiet,
        daftarAlergi,
        skriningTerakhir,
        verifikasiTerakhir,
      ] = await Promise.all([
        this.clinicalRepo.ambilInstruksiDietAktif(ep.pasienId),
        this.clinicalRepo.ambilDaftarAlergiPasien(ep.pasienId, true),
        this.clinicalRepo.ambilSkriningGiziTerakhir(ep.id),
        this.clinicalRepo.ambilVerifikasiKeamananTerakhir(ep.id),
      ]);

      const tglLahir = new Date(pasien.tanggalLahir);
      const sekarang = new Date();
      let usia = sekarang.getFullYear() - tglLahir.getFullYear();
      const selisihBulan = sekarang.getMonth() - tglLahir.getMonth();
      if (
        selisihBulan < 0 ||
        (selisihBulan === 0 && sekarang.getDate() < tglLahir.getDate())
      ) {
        usia--;
      }

      hasil.push({
        episodeId: ep.id,
        nomorEpisode: ep.nomorEpisode,
        pasienId: pasien.id,
        nomorRekamMedis: pasien.nomorRekamMedis,
        namaPasien: pasien.namaLengkap,
        tanggalLahir: pasien.tanggalLahir,
        usiaTahun: Math.max(0, usia),
        jenisKelamin: pasien.jenisKelamin,
        bangsalId: ep.bangsalId,
        namaBangsal,
        nomorKamar,
        nomorTempatTidur,
        dokterDpjpNama: ep.dokterDpjpNama,
        diagnosisUtama: ep.diagnosisUtama,
        waktuMasuk: ep.waktuMasuk,
        instruksiDietId: instruksiDiet?.id ?? null,
        jenisDiet: instruksiDiet?.jenisDiet ?? "Belum ada instruksi sah",
        bentukMakanan: instruksiDiet?.bentukMakanan ?? "Belum ditetapkan",
        statusPuasaNpo: instruksiDiet?.statusPuasaNpo ?? false,
        alasanPuasa: instruksiDiet?.alasanPuasa ?? null,
        daftarAlergenAktif: daftarAlergi.map((a) => a.namaAlergen),
        statusVerifikasiKeamanan: !instruksiDiet || instruksiDiet.statusPuasaNpo || instruksiDiet.rutePemberian !== "oral"
          ? "ditahan_safety_hold"
          : verifikasiTerakhir?.instruksiDietId === instruksiDiet.id
            ? verifikasiTerakhir.keputusan
            : "belum_diverifikasi",
        terakhirDiverifikasiPada: verifikasiTerakhir?.diverifikasiPada ?? null,
        statusSkriningGizi: skriningTerakhir
          ? "sudah_diskrining"
          : "belum_diskrining",
        skorMstTerakhir: skriningTerakhir ? skriningTerakhir.totalSkor : null,
        kategoriRisikoGizi: skriningTerakhir
          ? skriningTerakhir.kategoriRisiko
          : null,
        perluPenilaianLanjut: skriningTerakhir
          ? skriningTerakhir.perluPenilaianLanjut
          : false,
      });
    }

    return hasil;
  }

  /**
   * Melakukan verifikasi keamanan makanan oleh perawat sebelum disajikan ke pasien.
   * Mengimplementasikan verifikasi dua pengenal (AB-020, fail-closed jika DOB mismatch 422),
   * pencegahan tersedak disfagia, kesadaran, dan penegakan NPO (AB-003, AB-008).
   */
  public async verifikasiKeamananMakanan(param: {
    aktor: ProfilSesiPengguna;
    input: InputVerifikasiKeamananMakanan;
    correlationId?: string;
  }): Promise<ItemVerifikasiKeamananMakananDto> {
    this.validasiIzinAksesPerawat(
      param.aktor,
      "Verifikasi Keamanan Makanan Pasien",
    );

    if (!this.inpatientRepo) {
      throw new AppError({
        kode: KODE_GALAT.GANGGUAN_INTERNAL,
        statusHttp: 500,
        pesanPengguna: "Repositori rawat inap belum terkonfigurasi.",
      });
    }

    const episode = await this.inpatientRepo.ambilEpisodeBerdasarkanId(
      param.input.episodeId,
    );
    if (!episode) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Episode rawat inap ${param.input.episodeId} tidak ditemukan.`,
      });
    }

    this.validasiIsolasiBangsal(param.aktor, episode.bangsalId);

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(
      episode.pasienId,
    );
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data rekam medis pasien tidak ditemukan.",
      });
    }

    // Two-Identifier Verification (AB-020): Verifikasi Tanggal Lahir (Fail-Closed 422)
    if (param.input.konfirmasiTanggalLahir !== pasien.tanggalLahir) {
      throw new AppError({
        kode: KODE_GALAT.VALIDASI_GAGAL,
        statusHttp: 422,
        pesanPengguna: `Verifikasi dua pengenal gagal (AB-020): Tanggal lahir yang dikonfirmasi (${param.input.konfirmasiTanggalLahir}) tidak cocok dengan rekam medis pasien (${pasien.tanggalLahir}). Makanan tidak boleh disajikan kepada pasien demi keselamatan!`,
        pesanInternal: `DOB mismatch: input=${param.input.konfirmasiTanggalLahir}, patient=${pasien.tanggalLahir}`,
      });
    }

    const tempatTidur = await this.inpatientRepo.ambilTempatTidurBerdasarkanId(
      episode.tempatTidurId,
    );
    const nomorTempatTidur =
      tempatTidur?.nomorTempatTidur ?? episode.tempatTidurId;
    const instruksiDiet = await this.clinicalRepo.ambilInstruksiDietAktif(
      pasien.id,
    );

    const nomorVerifikasi =
      await this.clinicalRepo.hitungNomorVerifikasiKeamananBerikutnya();
    const sekarang = new Date().toISOString();

    const entitas: EntitasVerifikasiKeamananMakanan = {
      id: `vkm-${randomUUID()}`,
      nomorVerifikasi,
      episodeId: episode.id,
      pasienId: pasien.id,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      bangsalId: episode.bangsalId,
      tempatTidurId: episode.tempatTidurId,
      nomorTempatTidur,
      instruksiDietId: instruksiDiet?.id ?? null,
      perawatId: param.aktor.id,
      perawatNama: param.aktor.namaLengkap,
      konfirmasiTanggalLahir: param.input.konfirmasiTanggalLahir,
      apakahIdentitasSesuai: param.input.apakahIdentitasSesuai,
      apakahDietSesuai: param.input.apakahDietSesuai,
      apakahAlergiTerkonfirmasi: param.input.apakahAlergiTerkonfirmasi,
      kemampuanMenelan: param.input.kemampuanMenelan as KemampuanMenelan,
      statusKesadaran: param.input.statusKesadaran as StatusKesadaran,
      statusPuasaNpo: param.input.statusPuasaNpo as StatusPuasaNpo,
      keputusan: param.input.keputusan as KeputusanKeamananMakanan,
      alasanPenahanan: param.input.alasanPenahanan ?? null,
      tindakanEskalasi: param.input.tindakanEskalasi ?? null,
      diverifikasiPada: sekarang,
      dibuatPada: sekarang,
    };

    const tersimpan =
      await this.clinicalRepo.simpanVerifikasiKeamananMakanan(entitas);

    // Jika ditahan (safety hold), kirim notifikasi prioritas tinggi/kritis ke dokter DPJP (AB-008, AB-020)
    if (param.input.keputusan === "ditahan_safety_hold") {
      await this.deps.kirimNotifikasiPengguna({
        id: `notif-hold-${randomUUID()}`,
        penerimaId: episode.dokterDpjpId,
        judul: `🚨 PENAHANAN KESELAMATAN MAKANAN: ${pasien.namaLengkap} (${pasien.nomorRekamMedis})`,
        pesan: `Pemberian makanan ditahan oleh Perawat ${param.aktor.namaLengkap} di ${episode.bangsalId} Bed ${nomorTempatTidur}. Alasan: ${param.input.alasanPenahanan ?? "Penahanan keselamatan klinis"}.`,
        kategori: "keselamatan",
        prioritas: "kritis",
        tautanAksi: `/perawat`,
        dibuatPada: sekarang,
      });
    }

    await this.deps.catatAuditAkses({
      aktorId: param.aktor.id,
      peranAktor: param.aktor.peran,
      tindakan: "VERIFIKASI_KEAMANAN_MAKANAN_PERAWAT",
      sumberDaya: "verifikasi_keamanan_makanan",
      idSumberDaya: tersimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Perawat ${param.aktor.namaLengkap} menyelesaikan verifikasi keamanan makanan: ${param.input.keputusan} untuk pasien ${pasien.nomorRekamMedis}`,
      correlationId: param.correlationId,
      metadata: {
        nomorVerifikasi: tersimpan.nomorVerifikasi,
        keputusan: tersimpan.keputusan,
        alasanPenahanan: tersimpan.alasanPenahanan,
      },
    });

    return {
      id: tersimpan.id,
      nomorVerifikasi: tersimpan.nomorVerifikasi,
      episodeId: tersimpan.episodeId,
      pasienId: tersimpan.pasienId,
      nomorRekamMedis: tersimpan.nomorRekamMedis,
      namaPasien: tersimpan.namaPasien,
      bangsalId: tersimpan.bangsalId,
      nomorTempatTidur: tersimpan.nomorTempatTidur,
      instruksiDietId: tersimpan.instruksiDietId,
      perawatId: tersimpan.perawatId,
      perawatNama: tersimpan.perawatNama,
      konfirmasiTanggalLahir: tersimpan.konfirmasiTanggalLahir,
      apakahIdentitasSesuai: tersimpan.apakahIdentitasSesuai,
      apakahDietSesuai: tersimpan.apakahDietSesuai,
      apakahAlergiTerkonfirmasi: tersimpan.apakahAlergiTerkonfirmasi,
      kemampuanMenelan: tersimpan.kemampuanMenelan,
      statusKesadaran: tersimpan.statusKesadaran,
      statusPuasaNpo: tersimpan.statusPuasaNpo,
      keputusan: tersimpan.keputusan,
      alasanPenahanan: tersimpan.alasanPenahanan,
      tindakanEskalasi: tersimpan.tindakanEskalasi,
      diverifikasiPada: tersimpan.diverifikasiPada,
    };
  }

  /**
   * Merekam skrining gizi awal menggunakan Malnutrition Screening Tool (MST) (BRD Bab V.5.2).
   * Menghitung skor total 0-5. Jika skor >= 2, otomatis menandai perlunya rujukan ke Ahli Gizi.
   */
  public async rekamSkriningGizi(param: {
    aktor: ProfilSesiPengguna;
    input: InputSkriningGizi;
    correlationId?: string;
  }): Promise<ItemSkriningGiziDto> {
    this.validasiIzinAksesPerawat(
      param.aktor,
      "Perekaman Skrining Gizi Pasien (MST)",
    );

    if (!this.inpatientRepo) {
      throw new AppError({
        kode: KODE_GALAT.GANGGUAN_INTERNAL,
        statusHttp: 500,
        pesanPengguna: "Repositori rawat inap belum terkonfigurasi.",
      });
    }

    const episode = await this.inpatientRepo.ambilEpisodeBerdasarkanId(
      param.input.episodeId,
    );
    if (!episode) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Episode rawat inap ${param.input.episodeId} tidak ditemukan.`,
      });
    }

    this.validasiIsolasiBangsal(param.aktor, episode.bangsalId);

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(
      episode.pasienId,
    );
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data rekam medis pasien tidak ditemukan.",
      });
    }

    // Hitung Skor MST
    let skorPenurunanBb = 0;
    switch (param.input.penurunanBeratBadan) {
      case "1_sampai_5_kg":
        skorPenurunanBb = 1;
        break;
      case "ragu_pakaian_longgar":
      case "6_sampai_10_kg":
        skorPenurunanBb = 2;
        break;
      case "11_sampai_15_kg":
        skorPenurunanBb = 3;
        break;
      case "lebih_15_kg":
        skorPenurunanBb = 4;
        break;
      case "tidak_ada":
      default:
        skorPenurunanBb = 0;
        break;
    }

    const skorAsupanMakan = param.input.asupanMakanBerkurang ? 1 : 0;
    const totalSkor = skorPenurunanBb + skorAsupanMakan;

    let kategoriRisiko: KategoriRisikoGizi = "risiko_rendah";
    let perluPenilaianLanjut = false;

    if (totalSkor >= 2) {
      kategoriRisiko = "risiko_tinggi";
      perluPenilaianLanjut = true;
    }

    const nomorSkrining =
      await this.clinicalRepo.hitungNomorSkriningBerikutnya();
    const sekarang = new Date().toISOString();

    const entitas: EntitasSkriningGizi = {
      id: `mst-${randomUUID()}`,
      nomorSkrining,
      episodeId: episode.id,
      pasienId: pasien.id,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      bangsalId: episode.bangsalId,
      perawatId: param.aktor.id,
      perawatNama: param.aktor.namaLengkap,
      metodeSkrining: "mst",
      penurunanBeratBadan:
        param.input.penurunanBeratBadan as KategoriPenurunanBb,
      skorPenurunanBb,
      asupanMakanBerkurang: param.input.asupanMakanBerkurang,
      skorAsupanMakan,
      totalSkor,
      kategoriRisiko,
      perluPenilaianLanjut,
      catatanSkrining: param.input.catatanSkrining ?? null,
      diskriningPada: sekarang,
      dibuatPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const tersimpan = await this.clinicalRepo.simpanSkriningGizi(entitas);

    // Jika berisiko tinggi (skor >= 2), kirim notifikasi rujukan asuhan gizi ke dokter DPJP
    if (perluPenilaianLanjut) {
      await this.deps.kirimNotifikasiPengguna({
        id: `notif-mst-${randomUUID()}`,
        penerimaId: episode.dokterDpjpId,
        judul: `📋 RUJUKAN GIZI (MST >= 2): ${pasien.namaLengkap} (${pasien.nomorRekamMedis})`,
        pesan: `Pasien di bangsal ${episode.bangsalId} diskrining berisiko malnutrisi (Skor MST: ${totalSkor}). Diperlukan asuhan gizi terstandar (ADIME).`,
        kategori: "pekerjaan",
        prioritas: "tinggi",
        tautanAksi: `/perawat`,
        dibuatPada: sekarang,
      });
    }

    await this.deps.catatAuditAkses({
      aktorId: param.aktor.id,
      peranAktor: param.aktor.peran,
      tindakan: "REKAM_SKRINING_GIZI_MST",
      sumberDaya: "skrining_gizi",
      idSumberDaya: tersimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Perawat ${param.aktor.namaLengkap} mencatat skrining gizi MST (skor ${totalSkor}, ${kategoriRisiko}) untuk pasien ${pasien.nomorRekamMedis}`,
      correlationId: param.correlationId,
      metadata: {
        nomorSkrining: tersimpan.nomorSkrining,
        totalSkor,
        kategoriRisiko,
        perluPenilaianLanjut,
      },
    });

    return {
      id: tersimpan.id,
      nomorSkrining: tersimpan.nomorSkrining,
      episodeId: tersimpan.episodeId,
      pasienId: tersimpan.pasienId,
      nomorRekamMedis: tersimpan.nomorRekamMedis,
      namaPasien: tersimpan.namaPasien,
      bangsalId: tersimpan.bangsalId,
      perawatId: tersimpan.perawatId,
      perawatNama: tersimpan.perawatNama,
      metodeSkrining: tersimpan.metodeSkrining,
      penurunanBeratBadan: tersimpan.penurunanBeratBadan,
      skorPenurunanBb: tersimpan.skorPenurunanBb,
      asupanMakanBerkurang: tersimpan.asupanMakanBerkurang,
      skorAsupanMakan: tersimpan.skorAsupanMakan,
      totalSkor: tersimpan.totalSkor,
      kategoriRisiko: tersimpan.kategoriRisiko,
      perluPenilaianLanjut: tersimpan.perluPenilaianLanjut,
      catatanSkrining: tersimpan.catatanSkrining,
      diskriningPada: tersimpan.diskriningPada,
    };
  }

  /**
   * Mencatat observasi asupan makanan harian pasien menggunakan skala Comstock visual (BRD Bab X.10.1, 10.2).
   * Menerapkan prinsip keselamatan: "belum dicatat tidak sama dengan konsumsi nol".
   * Menghasilkan peringatan asupan rendah jika konsumsi <= 25%.
   */
  public async catatObservasiAsupan(param: {
    aktor: ProfilSesiPengguna;
    input: InputObservasiAsupan;
    correlationId?: string;
  }): Promise<ItemObservasiAsupanDto> {
    this.validasiIzinAksesPerawat(
      param.aktor,
      "Pencatatan Observasi Asupan Pasien (Comstock)",
    );

    if (!this.inpatientRepo) {
      throw new AppError({
        kode: KODE_GALAT.GANGGUAN_INTERNAL,
        statusHttp: 500,
        pesanPengguna: "Repositori rawat inap belum terkonfigurasi.",
      });
    }

    const episode = await this.inpatientRepo.ambilEpisodeBerdasarkanId(
      param.input.episodeId,
    );
    if (!episode) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Episode rawat inap ${param.input.episodeId} tidak ditemukan.`,
      });
    }

    this.validasiIsolasiBangsal(param.aktor, episode.bangsalId);

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(
      episode.pasienId,
    );
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: "Data rekam medis pasien tidak ditemukan.",
      });
    }

    const tempatTidur = await this.inpatientRepo.ambilTempatTidurBerdasarkanId(
      episode.tempatTidurId,
    );
    const nomorTempatTidur =
      tempatTidur?.nomorTempatTidur ?? episode.tempatTidurId;

    await this.deps.sebelumObservasi?.(param.input);

    let persentaseKonsumsi = 0;
    switch (param.input.skalaComstock) {
      case "skala_100":
        persentaseKonsumsi = 100;
        break;
      case "skala_75":
        persentaseKonsumsi = 75;
        break;
      case "skala_50":
        persentaseKonsumsi = 50;
        break;
      case "skala_25":
        persentaseKonsumsi = 25;
        break;
      case "skala_0":
      case "belum_diobservasi":
      default:
        persentaseKonsumsi = 0;
        break;
    }

    // Peringatan asupan rendah: konsumsi <= 25% dan bukan puasa medis terjadwal
    const peringatanAsupanRendah =
      (param.input.skalaComstock === "skala_0" ||
        param.input.skalaComstock === "skala_25") &&
      param.input.kondisiPemberian !== "puasa_medis";

    const sekarang = new Date().toISOString();

    const entitas: EntitasObservasiAsupanKeperawatan = {
      id: `obs-${randomUUID()}`,
      episodeId: episode.id,
      pasienId: pasien.id,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      bangsalId: episode.bangsalId,
      tempatTidurId: episode.tempatTidurId,
      perawatId: param.aktor.id,
      perawatNama: param.aktor.namaLengkap,
      tanggalMakan: param.input.tanggalMakan,
      jadwalMakan: param.input.jadwalMakan as JadwalMakan,
      skalaComstock: param.input.skalaComstock as SkalaComstock,
      persentaseKonsumsi,
      kondisiPemberian:
        param.input.kondisiPemberian as KondisiPemberianMakanan,
      alasanTidakHabis: param.input.alasanTidakHabis ?? null,
      catatanObservasi: param.input.catatanObservasi ?? null,
      peringatanAsupanRendah,
      diobservasiPada: sekarang,
      dibuatPada: sekarang,
    };

    const tersimpan = await this.clinicalRepo.simpanObservasiAsupan(entitas);

    // Jika asupan rendah, kirim notifikasi peringatan ke DPJP
    if (peringatanAsupanRendah) {
      await this.deps.kirimNotifikasiPengguna({
        id: `notif-asupan-${randomUUID()}`,
        penerimaId: episode.dokterDpjpId,
        judul: `⚠️ ASUPAN RENDAH (<=25%): ${pasien.namaLengkap} (${pasien.nomorRekamMedis})`,
        pesan: `Asupan jadwal ${param.input.jadwalMakan} pada ${param.input.tanggalMakan} hanya ${persentaseKonsumsi}%. Alasan: ${param.input.alasanTidakHabis ?? "Nafsu makan menurun"}.`,
        kategori: "keselamatan",
        prioritas: "tinggi",
        tautanAksi: `/perawat`,
        dibuatPada: sekarang,
      });
    }

    await this.deps.catatAuditAkses({
      aktorId: param.aktor.id,
      peranAktor: param.aktor.peran,
      tindakan: "CATAT_OBSERVASI_ASUPAN_COMSTOCK",
      sumberDaya: "observasi_asupan_keperawatan",
      idSumberDaya: tersimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Perawat ${param.aktor.namaLengkap} mencatat observasi asupan (${param.input.skalaComstock}, ${persentaseKonsumsi}%) untuk pasien ${pasien.nomorRekamMedis}`,
      correlationId: param.correlationId,
      metadata: {
        jadwalMakan: param.input.jadwalMakan,
        skalaComstock: param.input.skalaComstock,
        persentaseKonsumsi,
        peringatanAsupanRendah,
      },
    });

    return {
      id: tersimpan.id,
      episodeId: tersimpan.episodeId,
      pasienId: tersimpan.pasienId,
      nomorRekamMedis: tersimpan.nomorRekamMedis,
      namaPasien: tersimpan.namaPasien,
      bangsalId: tersimpan.bangsalId,
      nomorTempatTidur,
      perawatId: tersimpan.perawatId,
      perawatNama: tersimpan.perawatNama,
      tanggalMakan: tersimpan.tanggalMakan,
      jadwalMakan: tersimpan.jadwalMakan,
      skalaComstock: tersimpan.skalaComstock,
      persentaseKonsumsi: tersimpan.persentaseKonsumsi,
      kondisiPemberian: tersimpan.kondisiPemberian,
      alasanTidakHabis: tersimpan.alasanTidakHabis,
      catatanObservasi: tersimpan.catatanObservasi,
      peringatanAsupanRendah: tersimpan.peringatanAsupanRendah,
      diobservasiPada: tersimpan.diobservasiPada,
    };
  }

  /**
   * Mengambil riwayat observasi asupan makanan pasien.
   */
  public async ambilRiwayatKeperawatan(aktor: ProfilSesiPengguna, jenis: "skrining" | "keamanan", episodeId?: string) {
    this.validasiIzinAksesPerawat(aktor, "Membaca riwayat keperawatan");
    const items = jenis === "skrining"
      ? await this.clinicalRepo.ambilDaftarSkriningGizi({ episodeId })
      : await this.clinicalRepo.ambilDaftarVerifikasiKeamananMakanan({ episodeId });
    return items.filter((item) => aktor.daftarBangsalId.includes(item.bangsalId));
  }

  public async ambilRiwayatObservasiAsupan(param: {
    aktor: ProfilSesiPengguna;
    pasienId?: string;
    episodeId?: string;
    bangsalId?: string;
    correlationId?: string;
  }): Promise<ItemObservasiAsupanDto[]> {
    this.validasiIzinAksesPerawat(
      param.aktor,
      "Melihat Riwayat Observasi Asupan Pasien",
    );

    if (param.bangsalId) {
      this.validasiIsolasiBangsal(param.aktor, param.bangsalId);
    }

    const daftar = await this.clinicalRepo.ambilDaftarObservasiAsupan({
      episodeId: param.episodeId,
      bangsalId: param.bangsalId,
    });

    const tersaring = daftar.filter((d) => param.aktor.daftarBangsalId.includes(d.bangsalId) && (!param.pasienId || d.pasienId === param.pasienId));

    const petaTempatTidur = new Map<string, string>();
    if (this.inpatientRepo) {
      const daftarTt = await this.inpatientRepo.ambilSemuaTempatTidur();
      for (const tt of daftarTt) {
        petaTempatTidur.set(tt.id, tt.nomorTempatTidur);
      }
    }

    return tersaring.map((d) => ({
      id: d.id,
      episodeId: d.episodeId,
      pasienId: d.pasienId,
      nomorRekamMedis: d.nomorRekamMedis,
      namaPasien: d.namaPasien,
      bangsalId: d.bangsalId,
      nomorTempatTidur:
        petaTempatTidur.get(d.tempatTidurId) ?? d.tempatTidurId,
      perawatId: d.perawatId,
      perawatNama: d.perawatNama,
      tanggalMakan: d.tanggalMakan,
      jadwalMakan: d.jadwalMakan,
      skalaComstock: d.skalaComstock,
      persentaseKonsumsi: d.persentaseKonsumsi,
      kondisiPemberian: d.kondisiPemberian,
      alasanTidakHabis: d.alasanTidakHabis,
      catatanObservasi: d.catatanObservasi,
      peringatanAsupanRendah: d.peringatanAsupanRendah,
      diobservasiPada: d.diobservasiPada,
    }));
  }

  // ==============================================================================
  // TAHAP 6: AHLI GIZI / DIETISIEN (ASUHAN GIZI ADIME & PERENCANAAN MENU)
  // ==============================================================================

  /**
   * Memvalidasi bahwa aktor memiliki hak akses peran Ahli Gizi / Dietisien klinis (AB-032).
   */
  public validasiIzinAksesDietisien(
    aktor: ProfilSesiPengguna,
    operasi: string,
  ): void {
    if (
      aktor.peran !== "ahli_gizi" &&
      !aktor.daftarIzin.includes("ahli_gizi:penilaian:kelola") &&
      !aktor.daftarIzin.includes("ahli_gizi:menu_individual:sahkan")
    ) {
      throw new AppError({
        kode: KODE_GALAT.AKSES_DITOLAK,
        statusHttp: 403,
        pesanPengguna:
          "Akses ditolak: Operasi asuhan gizi dan perencanaan menu individual hanya diizinkan untuk Ahli Gizi / Dietisien klinis.",
        pesanInternal: `Akses ditolak untuk peran ${aktor.peran} (${aktor.id}) pada operasi '${operasi}'.`,
      });
    }
  }

  /**
   * Mengambil daftar pasien rawat inap untuk konsultasi dan asuhan gizi dietisien (Tahap 6).
   * Memadukan status skrining risiko MST, instruksi diet dokter, riwayat alergi,
   * dan observasi asupan terakhir perawat.
   */
  public async ambilDaftarPasienDietisien(param: {
    aktor: ProfilSesiPengguna;
    bangsalId?: string;
    risikoGizi?: string;
    statusAsuhan?: string;
    correlationId?: string;
  }): Promise<ItemPasienDietisienDto[]> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Melihat Daftar Pasien Asuhan Gizi Dietisien",
    );

    if (!this.inpatientRepo) {
      return [];
    }

    const daftarEpisode = await this.inpatientRepo.ambilSemuaEpisode({
      status: "aktif",
    });
    const daftarTempatTidur = await this.inpatientRepo.ambilSemuaTempatTidur();
    const daftarKamar = await this.inpatientRepo.ambilSemuaKamar();
    const daftarBangsal = await this.inpatientRepo.ambilSemuaBangsal();

    const petaTt = new Map<string, { nomor: string; kamarId: string; bangsalId: string }>();
    for (const tt of daftarTempatTidur) {
      petaTt.set(tt.id, {
        nomor: tt.nomorTempatTidur,
        kamarId: tt.kamarId,
        bangsalId: tt.bangsalId,
      });
    }

    const petaKamar = new Map<string, string>();
    for (const k of daftarKamar) {
      petaKamar.set(k.id, k.nomorKamar);
    }

    const petaBangsal = new Map<string, string>();
    for (const b of daftarBangsal) {
      petaBangsal.set(b.id, b.namaBangsal);
    }

    const hasil: ItemPasienDietisienDto[] = [];

    for (const ep of daftarEpisode) {
      if (param.bangsalId && ep.bangsalId !== param.bangsalId) {
        continue;
      }

      const infoTt = ep.tempatTidurId ? petaTt.get(ep.tempatTidurId) : undefined;
      const namaBangsal = ep.bangsalId
        ? petaBangsal.get(ep.bangsalId) ?? ep.bangsalId
        : "Rawat Inap";
      const nomorKamar = infoTt ? petaKamar.get(infoTt.kamarId) ?? "-" : "-";
      const nomorTt = infoTt ? infoTt.nomor : "-";

      const pasien = await this.patientRepo.cariPasienBerdasarkanId(ep.pasienId);
      const tanggalLahir = pasien ? pasien.tanggalLahir : "1980-01-01";
      const jenisKelamin: "L" | "P" =
        pasien?.jenisKelamin === "perempuan" ? "P" : "L";

      const daftarAlergi = await this.clinicalRepo.ambilDaftarAlergiPasien(ep.pasienId);
      const alergiNama = daftarAlergi.map((a) => a.namaAlergen);

      const instruksiAktif = await this.clinicalRepo.ambilInstruksiDietAktif(ep.pasienId);
      const skriningTerakhir = await this.clinicalRepo.ambilSkriningGiziTerakhir(ep.id);
      const asuhanTerakhir = await this.clinicalRepo.ambilAsuhanGiziTerakhirBerdasarkanEpisode(ep.id);
      const daftarObservasi = await this.clinicalRepo.ambilDaftarObservasiAsupan({ episodeId: ep.id });
      const observasiTerakhir = daftarObservasi.length > 0 ? daftarObservasi[0] : null;

      const daftarMenuDisahkan = await this.clinicalRepo.ambilDaftarRencanaMenuIndividual({
        episodeId: ep.id,
        statusPengesahan: "disahkan",
      });

      const statusSkrining = skriningTerakhir
        ? skriningTerakhir.kategoriRisiko
        : "belum_skrining";
      const skorMst = skriningTerakhir ? skriningTerakhir.totalSkor : null;
      const perluPenilaianLanjut = skriningTerakhir
        ? skriningTerakhir.perluPenilaianLanjut
        : false;

      const statusAsuhan = asuhanTerakhir
        ? asuhanTerakhir.statusAsuhan
        : "belum_ada";

      if (param.risikoGizi && statusSkrining !== param.risikoGizi) {
        continue;
      }
      if (param.statusAsuhan && statusAsuhan !== param.statusAsuhan) {
        continue;
      }

      const nomorRekamMedis = pasien ? pasien.nomorRekamMedis : "RM-0000";
      const namaPasien = pasien ? pasien.namaLengkap : "Pasien Rawat Inap";

      hasil.push({
        episodeId: ep.id,
        pasienId: ep.pasienId,
        nomorRekamMedis,
        namaPasien,
        tanggalLahir,
        jenisKelamin,
        bangsalId: ep.bangsalId ?? "",
        namaBangsal,
        nomorKamar,
        nomorTempatTidur: nomorTt,
        diagnosisUtama: ep.diagnosisUtama,
        daftarAlergi: alergiNama,
        instruksiDietAktif: instruksiAktif ? instruksiAktif.jenisDiet : null,
        instruksiDietAktifId: instruksiAktif?.id ?? null,
        teksturMakanan: instruksiAktif ? instruksiAktif.bentukMakanan : null,
        statusSkrining,
        skorMst,
        perluPenilaianLanjut,
        statusAsuhanGizi: statusAsuhan,
        observasiAsupanTerakhir: observasiTerakhir
          ? observasiTerakhir.persentaseKonsumsi
          : null,
        peringatanAsupanRendah: observasiTerakhir
          ? observasiTerakhir.peringatanAsupanRendah
          : false,
        jumlahRencanaMenuDisahkan: daftarMenuDisahkan.length,
      });
    }

    return hasil;
  }

  /**
   * Merekam asuhan gizi terstandar ADIME dan target nutrisi pasien oleh Ahli Gizi (Tahap 6).
   * Menerapkan verifikasi dua pengenal pasien (AB-020).
   */
  public async rekamAsuhanGiziAdime(param: {
    aktor: ProfilSesiPengguna;
    input: unknown;
    correlationId?: string;
  }): Promise<ItemAsuhanGiziAdimeDto> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Merekam Asuhan Gizi Terstandar ADIME (AB-027)",
    );

    const valid = validasiInputAsuhanGizi(param.input);

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(valid.pasienId);
    if (!pasien) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Data pasien ${valid.pasienId} tidak ditemukan.`,
        pesanInternal: `Pasien ID ${valid.pasienId} tidak ada di database.`,
      });
    }

    // AB-020: Verifikasi dua pengenal pasien (Nama & Tanggal Lahir) fail-closed
    if (pasien.tanggalLahir !== valid.konfirmasiTanggalLahir) {
      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna:
          "Verifikasi keselamatan gagal: Konfirmasi tanggal lahir tidak cocok dengan data rekam medis pasien (AB-020).",
        pesanInternal: `DOB mismatch untuk pasien ${pasien.nomorRekamMedis}: input '${valid.konfirmasiTanggalLahir}' vs DB '${pasien.tanggalLahir}'.`,
      });
    }

    let bangsalId = "";
    if (this.inpatientRepo) {
      const episode = await this.inpatientRepo.ambilEpisodeBerdasarkanId(valid.episodeId);
      if (episode && episode.bangsalId) {
        bangsalId = episode.bangsalId;
      }
    }

    // Kalkulasi IMT otomatis jika BB dan TB tersedia
    let imt: number | null = null;
    let klasifikasiImt: string | null = null;
    if (valid.antropometriBbKg && valid.antropometriTbCm && valid.antropometriTbCm > 0) {
      const tbMeter = valid.antropometriTbCm / 100;
      imt = Number((valid.antropometriBbKg / (tbMeter * tbMeter)).toFixed(2));
      if (imt < 18.5) {
        klasifikasiImt = "Underweight (Kurus)";
      } else if (imt <= 22.9) {
        klasifikasiImt = "Normal";
      } else if (imt <= 24.9) {
        klasifikasiImt = "Overweight (Kelebihan)";
      } else {
        klasifikasiImt = "Obesitas";
      }
    }

    const nomorAsuhan = await this.clinicalRepo.hitungNomorAsuhanGiziBerikutnya();
    const sekarang = new Date().toISOString();

    const entitas: EntitasAsuhanGiziAdime = {
      id: `asuhan-${randomUUID()}`,
      nomorAsuhan,
      episodeId: valid.episodeId,
      pasienId: valid.pasienId,
      nomorRekamMedis: pasien.nomorRekamMedis,
      namaPasien: pasien.namaLengkap,
      bangsalId,
      skriningId: valid.skriningId ?? null,
      ahliGiziId: param.aktor.id,
      ahliGiziNama: param.aktor.namaLengkap,
      antropometriBbKg: valid.antropometriBbKg ?? null,
      antropometriTbCm: valid.antropometriTbCm ?? null,
      antropometriImt: imt,
      klasifikasiImt,
      biokimia: valid.biokimia ?? null,
      klinisFisik: valid.klinisFisik ?? null,
      riwayatDiet: valid.riwayatDiet ?? null,
      diagnosisGiziPes: valid.diagnosisGiziPes,
      targetEnergiKkal: valid.targetEnergiKkal,
      targetProteinGram: valid.targetProteinGram,
      targetLemakGram: valid.targetLemakGram,
      targetKarbohidratGram: valid.targetKarbohidratGram,
      targetCairanMl: valid.targetCairanMl ?? null,
      targetSeratGram: valid.targetSeratGram ?? null,
      targetNatriumMg: valid.targetNatriumMg ?? null,
      tujuanIntervensi: valid.tujuanIntervensi,
      rencanaIntervensi: valid.rencanaIntervensi,
      rencanaMonitoringEvaluasi: valid.rencanaMonitoringEvaluasi,
      tanggalEvaluasiUlang: valid.tanggalEvaluasiUlang,
      statusAsuhan: "aktif",
      waktuBerlaku: sekarang,
      versi: 1,
      dibuatPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const tersimpan = await this.clinicalRepo.simpanAsuhanGizi(entitas);

    await this.deps.catatAuditAkses({
      aktorId: param.aktor.id,
      peranAktor: param.aktor.peran,
      tindakan: "REKAM_ASUHAN_GIZI_ADIME",
      sumberDaya: "asuhan_gizi_adime",
      idSumberDaya: tersimpan.id,
      keputusan: "DIIZINKAN",
      alasan: `Asuhan gizi ${nomorAsuhan} berhasil disahkan oleh ${param.aktor.namaLengkap}.`,
      correlationId: param.correlationId,
      metadata: {
        episodeId: tersimpan.episodeId,
        pasienId: tersimpan.pasienId,
        targetEnergiKkal: tersimpan.targetEnergiKkal,
      },
    });

    return {
      id: tersimpan.id,
      nomorAsuhan: tersimpan.nomorAsuhan,
      episodeId: tersimpan.episodeId,
      pasienId: tersimpan.pasienId,
      nomorRekamMedis: tersimpan.nomorRekamMedis,
      namaPasien: tersimpan.namaPasien,
      bangsalId: tersimpan.bangsalId,
      skriningId: tersimpan.skriningId,
      ahliGiziId: tersimpan.ahliGiziId,
      ahliGiziNama: tersimpan.ahliGiziNama,
      antropometriBbKg: tersimpan.antropometriBbKg,
      antropometriTbCm: tersimpan.antropometriTbCm,
      antropometriImt: tersimpan.antropometriImt,
      klasifikasiImt: tersimpan.klasifikasiImt,
      biokimia: tersimpan.biokimia,
      klinisFisik: tersimpan.klinisFisik,
      riwayatDiet: tersimpan.riwayatDiet,
      diagnosisGiziPes: tersimpan.diagnosisGiziPes,
      targetEnergiKkal: tersimpan.targetEnergiKkal,
      targetProteinGram: tersimpan.targetProteinGram,
      targetLemakGram: tersimpan.targetLemakGram,
      targetKarbohidratGram: tersimpan.targetKarbohidratGram,
      targetCairanMl: tersimpan.targetCairanMl,
      targetSeratGram: tersimpan.targetSeratGram,
      targetNatriumMg: tersimpan.targetNatriumMg,
      tujuanIntervensi: tersimpan.tujuanIntervensi,
      rencanaIntervensi: tersimpan.rencanaIntervensi,
      rencanaMonitoringEvaluasi: tersimpan.rencanaMonitoringEvaluasi,
      tanggalEvaluasiUlang: tersimpan.tanggalEvaluasiUlang,
      statusAsuhan: tersimpan.statusAsuhan,
      waktuBerlaku: tersimpan.waktuBerlaku,
      versi: tersimpan.versi,
      dibuatPada: tersimpan.dibuatPada,
    };
  }

  /**
   * Mengambil riwayat asuhan gizi ADIME pasien.
   */
  public async ambilRiwayatAsuhanGizi(param: {
    aktor: ProfilSesiPengguna;
    episodeId?: string;
    pasienId?: string;
    correlationId?: string;
  }): Promise<ItemAsuhanGiziAdimeDto[]> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Melihat Riwayat Asuhan Gizi ADIME",
    );

    const daftar = await this.clinicalRepo.ambilDaftarAsuhanGizi({
      episodeId: param.episodeId,
      pasienId: param.pasienId,
    });

    return daftar.filter((d) => param.aktor.daftarBangsalId.includes(d.bangsalId)).map((d) => ({
      id: d.id,
      nomorAsuhan: d.nomorAsuhan,
      episodeId: d.episodeId,
      pasienId: d.pasienId,
      nomorRekamMedis: d.nomorRekamMedis,
      namaPasien: d.namaPasien,
      bangsalId: d.bangsalId,
      skriningId: d.skriningId,
      ahliGiziId: d.ahliGiziId,
      ahliGiziNama: d.ahliGiziNama,
      antropometriBbKg: d.antropometriBbKg,
      antropometriTbCm: d.antropometriTbCm,
      antropometriImt: d.antropometriImt,
      klasifikasiImt: d.klasifikasiImt,
      biokimia: d.biokimia,
      klinisFisik: d.klinisFisik,
      riwayatDiet: d.riwayatDiet,
      diagnosisGiziPes: d.diagnosisGiziPes,
      targetEnergiKkal: d.targetEnergiKkal,
      targetProteinGram: d.targetProteinGram,
      targetLemakGram: d.targetLemakGram,
      targetKarbohidratGram: d.targetKarbohidratGram,
      targetCairanMl: d.targetCairanMl,
      targetSeratGram: d.targetSeratGram,
      targetNatriumMg: d.targetNatriumMg,
      tujuanIntervensi: d.tujuanIntervensi,
      rencanaIntervensi: d.rencanaIntervensi,
      rencanaMonitoringEvaluasi: d.rencanaMonitoringEvaluasi,
      tanggalEvaluasiUlang: d.tanggalEvaluasiUlang,
      statusAsuhan: d.statusAsuhan,
      waktuBerlaku: d.waktuBerlaku,
      versi: d.versi,
      dibuatPada: d.dibuatPada,
    }));
  }

  /**
   * Mengambil katalog menu dan resep standar rumah sakit (Tahap 6 & acuan gudang/dapur).
   */
  public async ambilKatalogMenuResep(param: {
    aktor: ProfilSesiPengguna;
    kategoriMakanan?: string;
    bentukMakanan?: string;
    correlationId?: string;
  }): Promise<ItemKatalogMenuResepDto[]> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Melihat Master Katalog Menu & Resep Standar",
    );

    const daftar = await this.clinicalRepo.ambilKatalogMenuResep({
      kategoriMakanan: param.kategoriMakanan,
      bentukMakanan: param.bentukMakanan,
      aktifHanya: true,
    });

    return daftar.map((m) => ({
      id: m.id,
      kodeMenu: m.kodeMenu,
      namaMenu: m.namaMenu,
      kategoriMakanan: m.kategoriMakanan,
      bentukMakanan: m.bentukMakanan,
      jenisDietTerkait: m.jenisDietTerkait,
      energiKkal: m.energiKkal,
      proteinGram: m.proteinGram,
      lemakGram: m.lemakGram,
      karbohidratGram: m.karbohidratGram,
      komposisiBahan: m.komposisiBahan,
      alergen: m.alergen,
      aktif: m.aktif,
    }));
  }

  /**
   * Membuat rencana menu individual per pasien (Tahap 6).
   * Menerapkan validasi alergi (AB-007) dan kesesuaian bentuk makanan / instruksi diet dokter.
   */
  public async buatRencanaMenuIndividual(param: {
    aktor: ProfilSesiPengguna;
    input: unknown;
    correlationId?: string;
  }): Promise<ItemRencanaMenuIndividualDto> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Menyusun Rencana Menu Individual Pasien (AB-011)",
    );

    const valid = validasiInputRencanaMenuIndividual(param.input);

    const episode = await this.inpatientRepo?.ambilEpisodeBerdasarkanId(valid.episodeId);
    const asuhan = await this.clinicalRepo.ambilAsuhanGiziBerdasarkanId(valid.asuhanGiziId);
    if (!episode || episode.pasienId !== valid.pasienId || episode.statusPerawatan !== "aktif" || !asuhan || asuhan.episodeId !== episode.id || asuhan.pasienId !== valid.pasienId) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Pasien, episode aktif, dan asuhan gizi harus saling sesuai." });
    this.validasiIsolasiBangsal(param.aktor, episode.bangsalId);
    const menu = await this.clinicalRepo.ambilMenuResepBerdasarkanId(valid.menuId);
    if (!menu) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Menu dengan ID ${valid.menuId} tidak ditemukan di katalog resep.`,
        pesanInternal: `Menu ID ${valid.menuId} tidak ditemukan.`,
      });
    }

    const pasien = await this.patientRepo.cariPasienBerdasarkanId(valid.pasienId);
    const namaPasien = pasien ? pasien.namaLengkap : "Pasien Rawat Inap";
    const nomorRekamMedis = pasien ? pasien.nomorRekamMedis : "RM-0000";

    const instruksiDiet = await this.clinicalRepo.ambilInstruksiDietBerdasarkanId(
      valid.instruksiDietId,
    );

    // AB-007: Validasi alergen terhadap riwayat alergi pasien
    const daftarAlergi = await this.clinicalRepo.ambilDaftarAlergiPasien(valid.pasienId);
    const daftarAlergenPasien = daftarAlergi.map((a) => a.namaAlergen.toLowerCase());

    const alergenTabrakan: string[] = [];
    for (const alg of menu.alergen) {
      const algLower = alg.toLowerCase();
      if (
        daftarAlergenPasien.some(
          (ap) => ap.includes(algLower) || algLower.includes(ap),
        )
      ) {
        alergenTabrakan.push(alg);
      }
    }

    let statusKesesuaian: EntitasRencanaMenuIndividual["statusKesesuaian"] = "sesuai";
    let alasanTidakSesuai: string | null = null;

    if (alergenTabrakan.length > 0) {
      statusKesesuaian = "tidak_sesuai_alergi";
      alasanTidakSesuai = `Menu mengandung alergen pasien: ${alergenTabrakan.join(", ")} (AB-007).`;
    } else if (
      instruksiDiet &&
      menu.bentukMakanan !== instruksiDiet.bentukMakanan
    ) {
      statusKesesuaian = "tidak_sesuai_tekstur";
      alasanTidakSesuai = `Bentuk makanan menu (${menu.bentukMakanan}) berbeda dengan instruksi dokter (${instruksiDiet.bentukMakanan}).`;
    }

    const porsi = valid.porsi ?? 1.0;
    const energiKkal = Math.round(menu.energiKkal * porsi);
    const proteinGram = Number((menu.proteinGram * porsi).toFixed(1));
    const lemakGram = Number((menu.lemakGram * porsi).toFixed(1));
    const karbohidratGram = Number((menu.karbohidratGram * porsi).toFixed(1));

    const sekarang = new Date().toISOString();

    const entitas: EntitasRencanaMenuIndividual = {
      id: `rmi-${randomUUID()}`,
      episodeId: valid.episodeId,
      pasienId: valid.pasienId,
      nomorRekamMedis,
      namaPasien,
      asuhanGiziId: valid.asuhanGiziId,
      instruksiDietId: valid.instruksiDietId,
      tanggalPelayanan: valid.tanggalPelayanan,
      jadwalMakan: valid.jadwalMakan,
      menuId: menu.id,
      namaMenu: menu.namaMenu,
      bentukMakanan: menu.bentukMakanan,
      porsi,
      energiKkal,
      proteinGram,
      lemakGram,
      karbohidratGram,
      statusKesesuaian,
      alasanTidakSesuai,
      statusPengesahan: "draf",
      disahkanOleh: null,
      disahkanPada: null,
      catatanKhusus: valid.catatanKhusus ?? null,
      versi: 1,
      dibuatPada: sekarang,
      diperbaruiPada: sekarang,
    };

    const tersimpan = await this.clinicalRepo.simpanRencanaMenuIndividual(entitas);

    return {
      id: tersimpan.id,
      episodeId: tersimpan.episodeId,
      pasienId: tersimpan.pasienId,
      nomorRekamMedis: tersimpan.nomorRekamMedis,
      namaPasien: tersimpan.namaPasien,
      asuhanGiziId: tersimpan.asuhanGiziId,
      instruksiDietId: tersimpan.instruksiDietId,
      tanggalPelayanan: tersimpan.tanggalPelayanan,
      jadwalMakan: tersimpan.jadwalMakan,
      menuId: tersimpan.menuId,
      namaMenu: tersimpan.namaMenu,
      bentukMakanan: tersimpan.bentukMakanan,
      porsi: tersimpan.porsi,
      energiKkal: tersimpan.energiKkal,
      proteinGram: tersimpan.proteinGram,
      lemakGram: tersimpan.lemakGram,
      karbohidratGram: tersimpan.karbohidratGram,
      statusKesesuaian: tersimpan.statusKesesuaian,
      alasanTidakSesuai: tersimpan.alasanTidakSesuai,
      statusPengesahan: tersimpan.statusPengesahan,
      disahkanOleh: tersimpan.disahkanOleh,
      disahkanPada: tersimpan.disahkanPada,
      catatanKhusus: tersimpan.catatanKhusus,
      versi: tersimpan.versi,
      dibuatPada: tersimpan.dibuatPada,
    };
  }

  /**
   * Mengesahkan rencana menu individual oleh Ahli Gizi (Tahap 6).
   * Menerapkan fail-closed jika terdapat ketidaksesuaian alergi (AB-007).
   */
  public async sahkanRencanaMenuIndividual(param: {
    aktor: ProfilSesiPengguna;
    rencanaId: string;
    correlationId?: string;
  }): Promise<ItemRencanaMenuIndividualDto> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Mengesahkan Rencana Menu Individual Pasien (AB-011)",
    );

    const rmi = await this.clinicalRepo.ambilRencanaMenuIndividualBerdasarkanId(
      param.rencanaId,
    );
    if (!rmi) {
      throw new AppError({
        kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
        statusHttp: 404,
        pesanPengguna: `Rencana menu individual ${param.rencanaId} tidak ditemukan.`,
        pesanInternal: `Rencana menu ID ${param.rencanaId} tidak ada di database.`,
      });
    }

    // Fail-closed jika alergen pasien terlanggar
    if (rmi.statusKesesuaian === "tidak_sesuai_alergi") {
      throw new AppError({
        kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
        statusHttp: 422,
        pesanPengguna:
          "Penahanan keselamatan aktif: Rencana menu ini mengandung bahan alergen pasien dan tidak boleh disahkan! (AB-007)",
        pesanInternal: `Pengesahan ditolak karena alergen: ${String(rmi.alasanTidakSesuai)}`,
      });
    }

    await this.deps.periksaMenu?.(rmi);

    const sekarang = new Date().toISOString();
    const terbaharui = await this.clinicalRepo.perbaruiStatusPengesahanMenu(
      param.rencanaId,
      "disahkan",
      param.aktor.id,
      sekarang,
    );

    await this.deps.padaMenuDisahkan?.(terbaharui, param.aktor);

    await this.deps.catatAuditAkses({
      aktorId: param.aktor.id,
      peranAktor: param.aktor.peran,
      tindakan: "SAHKAN_RENCANA_MENU_INDIVIDUAL",
      sumberDaya: "rencana_menu_individual",
      idSumberDaya: terbaharui.id,
      keputusan: "DIIZINKAN",
      alasan: `Rencana menu ${terbaharui.namaMenu} untuk pasien ${terbaharui.namaPasien} disahkan oleh ${param.aktor.namaLengkap}.`,
      correlationId: param.correlationId,
      metadata: {
        episodeId: terbaharui.episodeId,
        tanggalPelayanan: terbaharui.tanggalPelayanan,
        jadwalMakan: terbaharui.jadwalMakan,
      },
    });

    return {
      id: terbaharui.id,
      episodeId: terbaharui.episodeId,
      pasienId: terbaharui.pasienId,
      nomorRekamMedis: terbaharui.nomorRekamMedis,
      namaPasien: terbaharui.namaPasien,
      asuhanGiziId: terbaharui.asuhanGiziId,
      instruksiDietId: terbaharui.instruksiDietId,
      tanggalPelayanan: terbaharui.tanggalPelayanan,
      jadwalMakan: terbaharui.jadwalMakan,
      menuId: terbaharui.menuId,
      namaMenu: terbaharui.namaMenu,
      bentukMakanan: terbaharui.bentukMakanan,
      porsi: terbaharui.porsi,
      energiKkal: terbaharui.energiKkal,
      proteinGram: terbaharui.proteinGram,
      lemakGram: terbaharui.lemakGram,
      karbohidratGram: terbaharui.karbohidratGram,
      statusKesesuaian: terbaharui.statusKesesuaian,
      alasanTidakSesuai: terbaharui.alasanTidakSesuai,
      statusPengesahan: terbaharui.statusPengesahan,
      disahkanOleh: terbaharui.disahkanOleh,
      disahkanPada: terbaharui.disahkanPada,
      catatanKhusus: terbaharui.catatanKhusus,
      versi: terbaharui.versi,
      dibuatPada: terbaharui.dibuatPada,
    };
  }

  /**
   * Mengambil daftar rencana menu individual pasien.
   */
  public async ambilDaftarRencanaMenuIndividual(param: {
    aktor: ProfilSesiPengguna;
    episodeId?: string;
    pasienId?: string;
    tanggalPelayanan?: string;
    correlationId?: string;
  }): Promise<ItemRencanaMenuIndividualDto[]> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Melihat Daftar Rencana Menu Individual",
    );

    const daftar = await this.clinicalRepo.ambilDaftarRencanaMenuIndividual({
      episodeId: param.episodeId,
      pasienId: param.pasienId,
      tanggalPelayanan: param.tanggalPelayanan,
    });

    const tersaring = [];
    for (const item of daftar) {
      const episode = await this.inpatientRepo?.ambilEpisodeBerdasarkanId(item.episodeId);
      if (episode && param.aktor.daftarBangsalId.includes(episode.bangsalId)) tersaring.push(item);
    }
    return tersaring.map((d) => ({
      id: d.id,
      episodeId: d.episodeId,
      pasienId: d.pasienId,
      nomorRekamMedis: d.nomorRekamMedis,
      namaPasien: d.namaPasien,
      asuhanGiziId: d.asuhanGiziId,
      instruksiDietId: d.instruksiDietId,
      tanggalPelayanan: d.tanggalPelayanan,
      jadwalMakan: d.jadwalMakan,
      menuId: d.menuId,
      namaMenu: d.namaMenu,
      bentukMakanan: d.bentukMakanan,
      porsi: d.porsi,
      energiKkal: d.energiKkal,
      proteinGram: d.proteinGram,
      lemakGram: d.lemakGram,
      karbohidratGram: d.karbohidratGram,
      statusKesesuaian: d.statusKesesuaian,
      alasanTidakSesuai: d.alasanTidakSesuai,
      statusPengesahan: d.statusPengesahan,
      disahkanOleh: d.disahkanOleh,
      disahkanPada: d.disahkanPada,
      catatanKhusus: d.catatanKhusus,
      versi: d.versi,
      dibuatPada: d.dibuatPada,
    }));
  }

  /**
   * Merekam monitoring dan evaluasi asuhan gizi berkala (AB-026, AB-028).
   */
  public async rekamEvaluasiAsuhanGizi(param: {
    aktor: ProfilSesiPengguna;
    input: unknown;
    correlationId?: string;
  }): Promise<ItemEvaluasiAsuhanGiziDto> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Merekam Evaluasi Asuhan Gizi Berkala (AB-026)",
    );

    const valid = validasiInputEvaluasiAsuhanGizi(param.input);

    const episode = await this.inpatientRepo?.ambilEpisodeBerdasarkanId(valid.episodeId);
    const asuhan = await this.clinicalRepo.ambilAsuhanGiziBerdasarkanId(valid.asuhanGiziId);
    if (!episode || episode.pasienId !== valid.pasienId || !asuhan || asuhan.episodeId !== episode.id || asuhan.pasienId !== valid.pasienId) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Evaluasi harus mengacu pada pasien, episode, dan asuhan gizi yang sama." });
    this.validasiIsolasiBangsal(param.aktor, episode.bangsalId);
    const entitas: EntitasEvaluasiAsuhanGizi = {
      id: `eval-${randomUUID()}`,
      asuhanGiziId: valid.asuhanGiziId,
      episodeId: valid.episodeId,
      pasienId: valid.pasienId,
      ahliGiziId: param.aktor.id,
      ahliGiziNama: param.aktor.namaLengkap,
      tanggalEvaluasi: valid.tanggalEvaluasi,
      evaluasiAntropometri: valid.evaluasiAntropometri ?? null,
      evaluasiBiokimia: valid.evaluasiBiokimia ?? null,
      evaluasiAsupan: valid.evaluasiAsupan,
      persentasePemenuhanAsupan: valid.persentasePemenuhanAsupan ?? null,
      hambatanAsupan: valid.hambatanAsupan ?? null,
      keputusanTindakLanjut: valid.keputusanTindakLanjut,
      rekomendasiKeDokter: valid.rekomendasiKeDokter ?? null,
      dibuatPada: new Date().toISOString(),
    };

    const tersimpan = await this.clinicalRepo.simpanEvaluasiAsuhanGizi(entitas);

    // Jika ada rekomendasi modifikasi ke dokter atau rujukan DPJP
    if (valid.keputusanTindakLanjut === "rujuk_dpjp" || valid.rekomendasiKeDokter) {
      const instruksiAktif = await this.clinicalRepo.ambilInstruksiDietAktif(valid.pasienId);
      if (instruksiAktif) {
        await this.deps.kirimNotifikasiPengguna({
          id: `notif-gizi-${randomUUID()}`,
          penerimaId: instruksiAktif.dokterPengesahId,
          judul: "Rekomendasi Modifikasi Terapi Gizi dari Dietisien",
          pesan: `Dietisien ${param.aktor.namaLengkap} menyampaikan evaluasi gizi untuk pasien ${instruksiAktif.namaPasien}: ${valid.rekomendasiKeDokter ?? "Perlu tinjauan terapi gizi ulang."}`,
          kategori: "pekerjaan",
          prioritas: "tinggi",
          tautanAksi: "/dokter",
          dibuatPada: new Date().toISOString(),
        });
      }
    }

    return {
      id: tersimpan.id,
      asuhanGiziId: tersimpan.asuhanGiziId,
      episodeId: tersimpan.episodeId,
      pasienId: tersimpan.pasienId,
      ahliGiziId: tersimpan.ahliGiziId,
      ahliGiziNama: tersimpan.ahliGiziNama,
      tanggalEvaluasi: tersimpan.tanggalEvaluasi,
      evaluasiAntropometri: tersimpan.evaluasiAntropometri,
      evaluasiBiokimia: tersimpan.evaluasiBiokimia,
      evaluasiAsupan: tersimpan.evaluasiAsupan,
      persentasePemenuhanAsupan: tersimpan.persentasePemenuhanAsupan,
      hambatanAsupan: tersimpan.hambatanAsupan,
      keputusanTindakLanjut: tersimpan.keputusanTindakLanjut,
      rekomendasiKeDokter: tersimpan.rekomendasiKeDokter,
      dibuatPada: tersimpan.dibuatPada,
    };
  }

  /**
   * Mengambil riwayat evaluasi asuhan gizi.
   */
  public async ambilRiwayatEvaluasiAsuhanGizi(param: {
    aktor: ProfilSesiPengguna;
    asuhanGiziId?: string;
    episodeId?: string;
    correlationId?: string;
  }): Promise<ItemEvaluasiAsuhanGiziDto[]> {
    this.validasiIzinAksesDietisien(
      param.aktor,
      "Melihat Riwayat Evaluasi Asuhan Gizi",
    );

    const daftar = await this.clinicalRepo.ambilDaftarEvaluasiAsuhanGizi({
      asuhanGiziId: param.asuhanGiziId,
      episodeId: param.episodeId,
    });

    const tersaring = [];
    for (const item of daftar) {
      const episode = await this.inpatientRepo?.ambilEpisodeBerdasarkanId(item.episodeId);
      if (episode && param.aktor.daftarBangsalId.includes(episode.bangsalId)) tersaring.push(item);
    }
    return tersaring.map((d) => ({
      id: d.id,
      asuhanGiziId: d.asuhanGiziId,
      episodeId: d.episodeId,
      pasienId: d.pasienId,
      ahliGiziId: d.ahliGiziId,
      ahliGiziNama: d.ahliGiziNama,
      tanggalEvaluasi: d.tanggalEvaluasi,
      evaluasiAntropometri: d.evaluasiAntropometri,
      evaluasiBiokimia: d.evaluasiBiokimia,
      evaluasiAsupan: d.evaluasiAsupan,
      persentasePemenuhanAsupan: d.persentasePemenuhanAsupan,
      hambatanAsupan: d.hambatanAsupan,
      keputusanTindakLanjut: d.keputusanTindakLanjut,
      rekomendasiKeDokter: d.rekomendasiKeDokter,
      dibuatPada: d.dibuatPada,
    }));
  }
}
