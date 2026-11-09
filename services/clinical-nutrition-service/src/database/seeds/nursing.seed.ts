/**
 * @fileoverview Data benih (seed) sintetis untuk domain Asuhan Keperawatan (Tahap 5 — Perawat).
 * Acuan: BRD Versi 4.0 Bab V.5.1, V.5.2, Bab X.10.1–10.2. Tanpa data pasien riil.
 */

import type {
  EntitasObservasiAsupanKeperawatan,
  EntitasSkriningGizi,
  EntitasVerifikasiKeamananMakanan,
} from "../../model/nursing.model.ts";

const WAKTU_TETAP_SEED = "2026-11-08T08:30:00.000Z";

export const SEED_SKRINING_GIZI_SINTETIS: readonly EntitasSkriningGizi[] = [
  {
    id: "mst-sintetis-001",
    nomorSkrining: "MST-20261108-0001",
    episodeId: "ep-sintetis-002",
    pasienId: "psn-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    namaPasien: "Budi Santoso (Data Uji Sintetis)",
    bangsalId: "BANGSAL-ANGGREK",
    perawatId: "usr-sintetis-perawat-anggrek",
    perawatNama: "Perawat Bangsal Anggrek (Sintetis)",
    metodeSkrining: "mst",
    penurunanBeratBadan: "1_sampai_5_kg",
    skorPenurunanBb: 1,
    asupanMakanBerkurang: true,
    skorAsupanMakan: 1,
    totalSkor: 2,
    kategoriRisiko: "risiko_tinggi",
    perluPenilaianLanjut: true,
    catatanSkrining: "Pasien mengeluh nafsu makan menurun 1 minggu terakhir karena mual.",
    diskriningPada: WAKTU_TETAP_SEED,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
];

export const SEED_VERIFIKASI_KEAMANAN_SINTETIS: readonly EntitasVerifikasiKeamananMakanan[] = [
  {
    id: "vkm-sintetis-001",
    nomorVerifikasi: "VKM-20261108-0001",
    episodeId: "ep-sintetis-002",
    pasienId: "psn-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    namaPasien: "Budi Santoso (Data Uji Sintetis)",
    bangsalId: "BANGSAL-ANGGREK",
    tempatTidurId: "bed-anggrek-201-2",
    nomorTempatTidur: "Bed 201-B",
    instruksiDietId: "diet-sintetis-001",
    perawatId: "usr-sintetis-perawat-anggrek",
    perawatNama: "Perawat Bangsal Anggrek (Sintetis)",
    konfirmasiTanggalLahir: "1980-04-12",
    apakahIdentitasSesuai: true,
    apakahDietSesuai: true,
    apakahAlergiTerkonfirmasi: true,
    kemampuanMenelan: "normal",
    statusKesadaran: "kompos_mentis",
    statusPuasaNpo: "tidak_puasa",
    keputusan: "aman_lolos",
    alasanPenahanan: null,
    tindakanEskalasi: null,
    diverifikasiPada: WAKTU_TETAP_SEED,
    dibuatPada: WAKTU_TETAP_SEED,
  },
];

export const SEED_OBSERVASI_ASUPAN_SINTETIS: readonly EntitasObservasiAsupanKeperawatan[] = [
  {
    id: "obs-sintetis-001",
    episodeId: "ep-sintetis-002",
    pasienId: "psn-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    namaPasien: "Budi Santoso (Data Uji Sintetis)",
    bangsalId: "BANGSAL-ANGGREK",
    tempatTidurId: "bed-anggrek-201-2",
    perawatId: "usr-sintetis-perawat-anggrek",
    perawatNama: "Perawat Bangsal Anggrek (Sintetis)",
    tanggalMakan: "2026-11-08",
    jadwalMakan: "pagi",
    skalaComstock: "skala_75",
    persentaseKonsumsi: 75,
    kondisiPemberian: "dikonsumsi_sebagian",
    alasanTidakHabis: "kenyang",
    catatanObservasi: "Pasien menghabiskan 3/4 porsi bubur dan lauk lunak.",
    peringatanAsupanRendah: false,
    diobservasiPada: WAKTU_TETAP_SEED,
    dibuatPada: WAKTU_TETAP_SEED,
  },
];

