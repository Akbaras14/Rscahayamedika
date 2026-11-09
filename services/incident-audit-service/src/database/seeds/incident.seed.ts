/**
 * @fileoverview Data seed sintetis untuk `incident-audit-service` (Tahap 10).
 */

import type {
  EvaluasiMutuGiziEntitas,
  InvestigasiInsidenEntitas,
  LaporanInsidenKeselamatanEntitas,
  RekonsiliasiDowntimeEntitas,
  TindakanPerbaikanEntitas,
} from "../../model/incident.model.ts";

export const SEED_LAPORAN_INSIDEN: LaporanInsidenKeselamatanEntitas[] = [
  {
    id: "ins-001",
    nomorInsiden: "INC-202611-001",
    unitPelapor: "distribusi",
    tanggalKejadian: "2026-11-08T09:15:00.000Z",
    jenisInsiden: "Ketidakcocokan Diet Pasien (NPO Post-Op)",
    derajatKeparahan: "tinggi",
    deskripsiKejadian:
      "Makanan diet lunak hampir diserahkan kepada pasien yang status medisnya berubah menjadi NPO (puasa) untuk operasi mendadak. Dicegah oleh verifikasi rekam medis bedside AB-021.",
    tindakanAwalSegera:
      "Porsi makanan langsung ditahan klinis (AB-022) dan dikembalikan ke instalasi gizi.",
    pasienTerdampakNama: "Siti Rahmawati",
    nomorRmPasien: "RM-2026-0002",
    namaBangsal: "Bangsal Melati",
    statusInsiden: "tindakan_koreksi",
    pelaporId: "usr-sintetis-distribusi",
    pelaporNama: "Dedi Setiawan, A.Md.Gz",
    penanggungJawabId: "usr-sintetis-dietisien",
    penanggungJawabNama: "Dewi Lestari, S.Tr.Gz",
    waktuPenutupan: null,
    catatanPenutupan: null,
    createdAt: "2026-11-08T09:20:00.000Z",
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    id: "ins-002",
    nomorInsiden: "INC-202611-002",
    unitPelapor: "dapur",
    tanggalKejadian: "2026-11-08T07:45:00.000Z",
    jenisInsiden: "Suhu Inti Memasak Di Bawah Batas CCP (< 75 C)",
    derajatKeparahan: "sedang",
    deskripsiKejadian:
      "Pengukuran suhu batch semur ayam pada tahap pematangan pertama tercatat 71.5 C (kurang dari batas aman kritis 75 C, AB-019).",
    tindakanAwalSegera:
      "Batch ditahan tidak boleh diporsikan; proses pemasakan dilanjutkan selama 15 menit hingga suhu inti mencapai 82.0 C dan lolos verifikasi ulang.",
    pasienTerdampakNama: null,
    nomorRmPasien: null,
    namaBangsal: "Dapur Pengolahan",
    statusInsiden: "selesai_ditutup",
    pelaporId: "usr-sintetis-dapur",
    pelaporNama: "Bambang Supriyanto",
    penanggungJawabId: "usr-sintetis-dapur",
    penanggungJawabNama: "Bambang Supriyanto",
    waktuPenutupan: "2026-11-08T08:30:00.000Z",
    catatanPenutupan:
      "Batch telah dimasak ulang hingga suhu 82 C, uji organoleptik lolos, dan kalibrasi termometer sensor CCP telah diverifikasi akurat.",
    createdAt: "2026-11-08T07:50:00.000Z",
    updatedAt: "2026-11-08T08:30:00.000Z",
  },
  {
    id: "ins-003",
    nomorInsiden: "INC-202611-003",
    unitPelapor: "perawat",
    tanggalKejadian: "2026-11-08T12:30:00.000Z",
    jenisInsiden: "Keterlambatan Distribusi Makan Siang Bangsal Rawat Inap",
    derajatKeparahan: "rendah",
    deskripsiKejadian:
      "Troli pengantaran bangsal Mawar terlambat 25 menit akibat lift servis rumah sakit mengalami perbaikan darurat.",
    tindakanAwalSegera:
      "Petugas distribusi menggunakan rute koridor cadangan gedung barat dan mengukur suhu saji ulang sebelum penyerahan.",
    pasienTerdampakNama: null,
    nomorRmPasien: null,
    namaBangsal: "Bangsal Mawar",
    statusInsiden: "dalam_investigasi",
    pelaporId: "usr-sintetis-perawat",
    pelaporNama: "Ns. Ratna Sari, S.Kep",
    penanggungJawabId: "usr-sintetis-distribusi",
    penanggungJawabNama: "Dedi Setiawan, A.Md.Gz",
    waktuPenutupan: null,
    catatanPenutupan: null,
    createdAt: "2026-11-08T12:40:00.000Z",
    updatedAt: "2026-11-08T12:40:00.000Z",
  },
];

export const SEED_INVESTIGASI_INSIDEN: InvestigasiInsidenEntitas[] = [
  {
    id: "inv-001",
    insidenId: "ins-001",
    nomorInsiden: "INC-202611-001",
    investigatorId: "usr-sintetis-kepala-instalasi",
    investigatorNama: "Dr. dr. Nurul Hidayati, Sp.GK",
    tanggalInvestigasi: "2026-11-08T09:45:00.000Z",
    akarMasalahRca:
      "Instruksi NPO DPJP bedah diinput 15 menit sebelum waktu makan tanpa memicu notifikasi peringatan suara otomatis ke unit distribusi.",
    faktorKontributor:
      "Perubahan jadwal operasi darurat yang dimajukan 2 jam lebih awal.",
    rekomendasiSistemik:
      "Integrasi flag otomatis NPO langsung mengunci status porsi di dasbor troli dan memicu peringatan merah permanen.",
    createdAt: "2026-11-08T09:50:00.000Z",
  },
  {
    id: "inv-002",
    insidenId: "ins-002",
    nomorInsiden: "INC-202611-002",
    investigatorId: "usr-sintetis-kepala-instalasi",
    investigatorNama: "Dr. dr. Nurul Hidayati, Sp.GK",
    tanggalInvestigasi: "2026-11-08T08:10:00.000Z",
    akarMasalahRca:
      "Volume bahan dalam kuali melebihi batas standar kapasitas batch (overfilling), menyebabkan distribusi panas tidak merata.",
    faktorKontributor:
      "Kombinasi 2 sesi masak menjadi 1 batch karena mengejar tenggat waktu makan siang.",
    rekomendasiSistemik:
      "Dilarang menggabungkan batch melebihi kapasitas standar kuali (maksimal 60 porsi per kuali).",
    createdAt: "2026-11-08T08:15:00.000Z",
  },
];

export const SEED_TINDAKAN_PERBAIKAN: TindakanPerbaikanEntitas[] = [
  {
    id: "act-001",
    insidenId: "ins-001",
    nomorInsiden: "INC-202611-001",
    deskripsiTindakan:
      "Penguatan briefing SOP verifikasi diet terkini (AB-021) pada seluruh tim runner bangsal setiap sebelum troli berangkat.",
    penanggungJawabId: "usr-sintetis-distribusi",
    penanggungJawabNama: "Dedi Setiawan, A.Md.Gz",
    targetTanggalSelesai: "2026-11-09",
    tanggalRealisasi: null,
    statusTindakan: "sedang_berjalan",
    buktiPenyelesaian: null,
    createdAt: "2026-11-08T10:00:00.000Z",
  },
  {
    id: "act-002",
    insidenId: "ins-002",
    nomorInsiden: "INC-202611-002",
    deskripsiTindakan:
      "Kalibrasi sensor suhu digital termokopel dan pembatasan maksimal porsi per kuali menjadi 50 porsi.",
    penanggungJawabId: "usr-sintetis-dapur",
    penanggungJawabNama: "Bambang Supriyanto",
    targetTanggalSelesai: "2026-11-08",
    tanggalRealisasi: "2026-11-08",
    statusTindakan: "selesai_efektif",
    buktiPenyelesaian:
      "Log kalibrasi suhu tanggal 08-11-2026 terverifikasi akurat margin 0.2 C.",
    createdAt: "2026-11-08T08:20:00.000Z",
  },
];

export const SEED_EVALUASI_MUTU: EvaluasiMutuGiziEntitas[] = [
  {
    id: "ev-001",
    tanggalEvaluasi: "2026-11-08",
    bangsalId: "bng-001",
    namaBangsal: "Bangsal Melati",
    totalPorsiDisajikan: 48,
    rataRataSisaMakananPersen: 14.2,
    kepatuhanCcpSuhuPersen: 97.5,
    kepatuhanDuaIdentitasPersen: 100.0,
    kategoriMutu: "sangat_baik",
    catatanEvaluasi:
      "Tingkat sisa makanan (plate waste) di bawah batas toleransi 20% SPM Kemenkes. Kepatuhan identifikasi 2 pengenal pasien 100%.",
    evaluatorId: "usr-sintetis-kepala-instalasi",
    evaluatorNama: "Dr. dr. Nurul Hidayati, Sp.GK",
    createdAt: "2026-11-08T13:00:00.000Z",
  },
  {
    id: "ev-002",
    tanggalEvaluasi: "2026-11-08",
    bangsalId: "bng-002",
    namaBangsal: "Bangsal Mawar",
    totalPorsiDisajikan: 52,
    rataRataSisaMakananPersen: 22.8,
    kepatuhanCcpSuhuPersen: 95.0,
    kepatuhanDuaIdentitasPersen: 98.1,
    kategoriMutu: "perlu_perbaikan",
    catatanEvaluasi:
      "Sisa makanan bangsal melebihi target SPM (22.8% > 20%). Penyebab utama mual dan nafsu makan menurun pada pasien onkologi/kemoterapi. Diperlukan konsul modifikasi tekstur dietisien.",
    evaluatorId: "usr-sintetis-kepala-instalasi",
    evaluatorNama: "Dr. dr. Nurul Hidayati, Sp.GK",
    createdAt: "2026-11-08T13:10:00.000Z",
  },
];

export const SEED_REKONSILIASI_DOWNTIME: RekonsiliasiDowntimeEntitas[] = [
  {
    id: "rec-001",
    nomorRekonsiliasi: "REC-202611-001",
    tanggalInsidenDowntime: "2026-11-07",
    durasiDowntimeMenit: 45,
    unitTerdampak: "Dapur & Distribusi (Jaringan Switch Gedung Gizi)",
    jumlahFormulirKertas: 24,
    duplikasiTerdeteksi: 0,
    selisihPesananSelesai: true,
    statusRekonsiliasi: "disahkan",
    disahkanOlehId: "usr-sintetis-kepala-instalasi",
    disahkanOlehNama: "Dr. dr. Nurul Hidayati, Sp.GK",
    waktuPengesahan: "2026-11-07T16:30:00.000Z",
    catatanRekonsiliasi:
      "Seluruh 24 pesanan formulir kertas darurat berhasil dientri ke sistem pasca-downtime tanpa ada duplikasi pesanan (AB-033). Rekonsiliasi sah.",
    createdAt: "2026-11-07T16:00:00.000Z",
  },
];

