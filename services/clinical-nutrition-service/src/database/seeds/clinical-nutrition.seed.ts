/**
 * @fileoverview Data sintetis awal untuk `clinical-nutrition-service` (Tahap 3 — Dokter).
 * Digunakan untuk pengujian native, integrasi gateway, dan verifikasi alur klinis tanpa data riil pasien.
 */

import type {
  EntitasAlergiPasien,
  EntitasInstruksiDiet,
  EntitasPemeriksaanKlinis,
  EntitasPengajuanRawatInap,
  EntitasRiwayatVersiInstruksiDiet,
} from "../../model/clinical-nutrition.model.ts";

const WAKTU_TETAP_SEED = "2026-11-08T08:30:00.000Z";

export const SEED_ALERGI_SINTETIS: readonly EntitasAlergiPasien[] = [
  {
    id: "alg-sintetis-001",
    pasienId: "psn-sintetis-001",
    pemeriksaanId: "pmx-sintetis-001",
    kategoriAlergen: "makanan",
    namaAlergen: "Udang & Seafood",
    tingkatKeparahan: "sedang",
    reaksiAlergi: "Urtikaria dan gatal pada kulit setelah konsumsi udang.",
    statusAktif: true,
    dicatatOlehId: "usr-sintetis-dokter-melati",
    dicatatOlehNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    dicatatPada: WAKTU_TETAP_SEED,
  },
  {
    id: "alg-sintetis-002",
    pasienId: "psn-sintetis-002",
    pemeriksaanId: null,
    kategoriAlergen: "obat",
    namaAlergen: "Penisilin / Amoksisilin",
    tingkatKeparahan: "berat_anafilaksis",
    reaksiAlergi: "Edema laring dan ruam luas (Riwayat Syok Anafilaksis).",
    statusAktif: true,
    dicatatOlehId: "usr-sintetis-dokter-melati",
    dicatatOlehNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    dicatatPada: WAKTU_TETAP_SEED,
  },
];

export const SEED_PEMERIKSAAN_SINTETIS: readonly EntitasPemeriksaanKlinis[] = [
  {
    id: "pmx-sintetis-001",
    kunjunganId: "knj-sintetis-001",
    pasienId: "psn-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    namaPasien: "Siti Rahmawati (Sintetis)",
    tanggalLahirPasien: "1985-04-12",
    dokterId: "usr-sintetis-dokter-melati",
    dokterNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    unitPelayanan: "Poliklinik Penyakit Dalam",
    bangsalId: "BANGSAL-MELATI",
    keluhanUtama: "Badan lemas terasa berat sejak 3 hari, nafsu makan menurun drastis.",
    riwayatPenyakitSekarang:
      "Pasien memiliki riwayat Diabetes Melitus Tipe 2 selama 4 tahun, gula darah sewaktu tidak terkontrol.",
    tandaVital: {
      tekananDarahSistol: 130,
      tekananDarahDiastol: 85,
      denyutNadi: 82,
      frekuensiNafas: 20,
      suhuTubuh: 36.8,
      beratBadanKg: 58.5,
      tinggiBadanCm: 156.0,
    },
    diagnosisKlinisPrimer: "Diabetes Melitus Tipe 2 dengan Dehidrasi Ringan",
    diagnosisKlinisSekunder: "Gastritis Akut",
    catatanKlinisRelevanGizi:
      "Perlu diet DM terkontrol 1700 kkal bentuk lunak. Hindari karbohidrat sederhana dan periksa toleransi lambung.",
    tindakLanjut: "anjuran_rawat_inap",
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
];

export const SEED_INSTRUKSI_DIET_SINTETIS: readonly EntitasInstruksiDiet[] = [
  {
    id: "diet-sintetis-001",
    nomorInstruksi: "DIET-20261108-0001",
    pasienId: "psn-sintetis-001",
    kunjunganId: "knj-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    namaPasien: "Siti Rahmawati (Sintetis)",
    dokterPengesahId: "usr-sintetis-dokter-melati",
    dokterPengesahNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    bangsalId: "BANGSAL-MELATI",
    jenisDiet: "diabetes_melitus",
    namaDietKustom: null,
    bentukMakanan: "lunak",
    rutePemberian: "oral",
    statusPuasaNpo: false,
    alasanPuasa: null,
    targetEnergiKkal: 1700,
    targetProteinGram: 60.0,
    pembatasanCairanMl: 2000,
    pembatasanNatriumMg: 2000,
    instruksiKhusus: "Bagi dalam 3 porsi utama dan 2 selingan. Bebas gula murni. Alergi udang aktif.",
    statusInstruksi: "aktif",
    versi: 1,
    berlakuSejak: WAKTU_TETAP_SEED,
    berlakuHingga: null,
    disahkanPada: WAKTU_TETAP_SEED,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
];

export const SEED_RIWAYAT_VERSI_DIET_SINTETIS: readonly EntitasRiwayatVersiInstruksiDiet[] = [
  {
    id: "rv-diet-sintetis-001",
    instruksiDietId: "diet-sintetis-001",
    pasienId: "psn-sintetis-001",
    versi: 1,
    snapshotData: { ...SEED_INSTRUKSI_DIET_SINTETIS[0] },
    alasanPerubahan: "Penetapan instruksi diet awal sah oleh DPJP Poliklinik Penyakit Dalam (AB-003, AB-009).",
    diubahOlehId: "usr-sintetis-dokter-melati",
    diubahOlehNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    diubahPada: WAKTU_TETAP_SEED,
  },
];

export const SEED_PENGAJUAN_RAWAT_INAP_SINTETIS: readonly EntitasPengajuanRawatInap[] = [
  {
    id: "ri-sintetis-001",
    nomorPengajuan: "RI-20261108-0001",
    pasienId: "psn-sintetis-001",
    kunjunganId: "knj-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    namaPasien: "Siti Rahmawati (Sintetis)",
    dokterPengajuId: "usr-sintetis-dokter-melati",
    dokterPengajuNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    diagnosisUtama: "Diabetes Melitus Tipe 2 dengan Dehidrasi Ringan",
    alasanRawatInap:
      "Perlu regulasi insulin intravena dan pemantauan asupan nutrisi intensif di bangsal perawatan.",
    prioritasRawatInap: "mendesak",
    rekomendasiBangsal: "BANGSAL-MELATI",
    kebutuhanKhusus: "Infus RL 20 tpm, Diet DM 1700 kkal Lunak",
    instruksiDietId: "diet-sintetis-001",
    statusPengajuan: "menunggu_penempatan",
    diajukanPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "ri-sintetis-002",
    nomorPengajuan: "RI-20261108-0002",
    pasienId: "psn-sintetis-003",
    kunjunganId: "knj-sintetis-003",
    nomorRekamMedis: "RM-2026-0003",
    namaPasien: "Dimas Pratama (Data Uji Sintetis)",
    dokterPengajuId: "usr-sintetis-dokter-melati",
    dokterPengajuNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    diagnosisUtama: "Observasi Febris H-4 dengan Dehidrasi Sedang",
    alasanRawatInap:
      "Perlu rehidrasi intravena dan observasi berkala di bangsal perawatan.",
    prioritasRawatInap: "rutin",
    rekomendasiBangsal: "BANGSAL-MELATI",
    kebutuhanKhusus: "Infus RL, Diet Lunak",
    instruksiDietId: null,
    statusPengajuan: "menunggu_penempatan",
    diajukanPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
];

