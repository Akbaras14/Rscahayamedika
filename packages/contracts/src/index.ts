/**
 * @fileoverview Kontrak izin peran, navigasi fondasi, dan batas kepemilikan data antar-microservice.
 * Acuan: BRD Versi 4.0 Bab III & XVII (AB-032, AB-034, AB-035), TECHSTACK.md Bagian 2 & 9, IMPLEMENTATION_RULES.md Tahap 0.
 */

import type {
  ItemNavigasiPeran,
  IzinSistem,
  PeranPengguna,
} from "../../shared-types/src/index.ts";

/**
 * Definisi metadata peran resmi sesuai BRD Bab III.
 * Catatan keselamatan (AGENTS.md Bagian 4 & 10):
 * Administrator hanya memiliki izin teknis/konfigurasi/audit akses dan TIDAK memiliki izin klinis.
 */
export interface DefinisiPeranMaster {
  kode: PeranPengguna;
  nama: string;
  deskripsiTanggungJawab: string;
  tahapImplementasi: number;
  izinDefault: readonly IzinSistem[];
  wajibBatasBangsal: boolean;
}

export const MATRIKS_PERAN_MASTER: Record<PeranPengguna, DefinisiPeranMaster> = {
  administrator: {
    kode: "administrator",
    nama: "Administrator",
    deskripsiTanggungJawab:
      "Pengguna, hak akses, pengaturan operasional, dan audit teknis tanpa akses keputusan klinis.",
    tahapImplementasi: 1,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "admin:pengguna:baca",
      "admin:pengguna:ubah",
      "admin:konfigurasi:baca",
      "admin:konfigurasi:ubah",
      "admin:audit:baca",
    ],
    wajibBatasBangsal: false,
  },
  petugas_pendaftaran: {
    kode: "petugas_pendaftaran",
    nama: "Petugas Pendaftaran",
    deskripsiTanggungJawab:
      "Registrasi, verifikasi identitas pasien, kunjungan pemeriksaan, dan antrean dokter.",
    tahapImplementasi: 2,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "pendaftaran:pasien:baca",
      "pendaftaran:pasien:buat",
      "pendaftaran:pasien:koreksi",
    ],
    wajibBatasBangsal: false,
  },
  dokter: {
    kode: "dokter",
    nama: "Dokter",
    deskripsiTanggungJawab:
      "Pemeriksaan awal, pengajuan rawat inap, instruksi diet awal sah, dan keputusan klinis.",
    tahapImplementasi: 3,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "dokter:pemeriksaan:baca",
      "dokter:instruksi_diet:sahkan",
    ],
    wajibBatasBangsal: true,
  },
  petugas_rawat_inap: {
    kode: "petugas_rawat_inap",
    nama: "Petugas Rawat Inap",
    deskripsiTanggungJawab:
      "Penerimaan pengajuan, penempatan bangsal/kamar/tempat tidur, perpindahan, dan pemulangan administratif.",
    tahapImplementasi: 4,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "rawat_inap:penempatan:baca",
      "rawat_inap:penempatan:kelola",
    ],
    wajibBatasBangsal: true,
  },
  perawat: {
    kode: "perawat",
    nama: "Perawat",
    deskripsiTanggungJawab:
      "Verifikasi keamanan makanan, skrining risiko gangguan gizi, pengamatan bangsal, dan pencatatan konsumsi.",
    tahapImplementasi: 5,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "perawat:keamanan_makanan:verifikasi",
      "perawat:skrining_gizi:kelola",
      "perawat:asupan:catat",
    ],
    wajibBatasBangsal: true,
  },
  ahli_gizi: {
    kode: "ahli_gizi",
    nama: "Ahli Gizi",
    deskripsiTanggungJawab:
      "Penilaian kondisi gizi, target kebutuhan, rencana menu individual, intervensi, dan evaluasi.",
    tahapImplementasi: 6,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "ahli_gizi:penilaian:kelola",
      "ahli_gizi:menu_individual:sahkan",
    ],
    wajibBatasBangsal: true,
  },
  petugas_gudang: {
    kode: "petugas_gudang",
    nama: "Petugas Gudang",
    deskripsiTanggungJawab:
      "Penerimaan, penyimpanan, pemeriksaan mutu, alokasi, pengeluaran, pengembalian, dan stok opname bahan.",
    tahapImplementasi: 7,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "gudang:persediaan:kelola",
      "gudang:penerimaan:catat",
      "gudang:pengeluaran:proses",
      "gudang:opname:catat",
    ],
    wajibBatasBangsal: false,
  },
  petugas_dapur: {
    kode: "petugas_dapur",
    nama: "Petugas Dapur",
    deskripsiTanggungJawab:
      "Perencanaan produksi H-1, persiapan, pengolahan, pemeriksaan mutu akhir, pengepakan, dan pelabelan.",
    tahapImplementasi: 8,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "dapur:produksi:kelola",
      "dapur:rencana:kelola",
      "dapur:produksi:catat",
      "dapur:mutu:periksa",
      "dapur:label:cetak",
    ],
    wajibBatasBangsal: false,
  },
  petugas_distribusi: {
    kode: "petugas_distribusi",
    nama: "Petugas Distribusi",
    deskripsiTanggungJawab:
      "Pengiriman per bangsal, verifikasi dua identitas pasien, pemeriksaan diet terbaru, dan penyerahan makanan.",
    tahapImplementasi: 9,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "distribusi:troli:kelola",
      "distribusi:penyerahan:verifikasi",
      "distribusi:insiden:catat",
    ],
    wajibBatasBangsal: true,
  },
  kepala_instalasi_gizi: {
    kode: "kepala_instalasi_gizi",
    nama: "Kepala Instalasi Gizi",
    deskripsiTanggungJawab:
      "Pengawasan proses lintas unit, mutu pelayanan, persediaan, penanganan insiden, dan laporan.",
    tahapImplementasi: 10,
    izinDefault: [
      "sistem:kesehatan:baca",
      "notifikasi:pribadi:baca",
      "notifikasi:pribadi:ubah",
      "kepala_instalasi:pengawasan:baca",
      "kepala_instalasi:insiden:kelola",
      "kepala_instalasi:mutu:evaluasi",
      "kepala_instalasi:audit:rekonsiliasi",
    ],
    wajibBatasBangsal: false,
  },
};

/**
 * Katalog navigasi adaptif berdasarkan izin.
 * Sesuai UI_UX.md Bagian 6: Sidebar hanya menampilkan modul yang boleh diakses oleh peran aktif.
 */
export const KATALOG_NAVIGASI_SISTEM: readonly ItemNavigasiPeran[] = [
  {
    id: "modul-admin-pengguna",
    label: "Manajemen Pengguna & Akses",
    href: "/administrator",
    ikon: "Users",
    izinWajib: "admin:pengguna:baca",
    statusTahap: "aktif_tahap_1",
    tahapTarget: 1,
  },
  {
    id: "modul-admin-audit",
    label: "Jejak Audit & Konfigurasi",
    href: "/administrator/audit",
    ikon: "History",
    izinWajib: "admin:audit:baca",
    statusTahap: "aktif_tahap_1",
    tahapTarget: 1,
  },
  {
    id: "modul-pendaftaran",
    label: "Pendaftaran & Kunjungan",
    href: "/pendaftaran",
    ikon: "Users",
    izinWajib: "pendaftaran:pasien:baca",
    statusTahap: "aktif_tahap_2",
    tahapTarget: 2,
  },
  {
    id: "modul-dokter",
    label: "Pemeriksaan & Instruksi Diet",
    href: "/dokter",
    ikon: "ShieldCheck",
    izinWajib: "dokter:pemeriksaan:baca",
    statusTahap: "aktif_tahap_3",
    tahapTarget: 3,
  },
  {
    id: "modul-rawat-inap",
    label: "Penempatan Rawat Inap",
    href: "/rawat-inap",
    ikon: "Users",
    izinWajib: "rawat_inap:penempatan:kelola",
    statusTahap: "aktif_tahap_4",
    tahapTarget: 4,
  },
  {
    id: "modul-perawat",
    label: "Verifikasi & Skrining Bangsal",
    href: "/perawat",
    ikon: "ShieldCheck",
    izinWajib: "perawat:keamanan_makanan:verifikasi",
    statusTahap: "aktif_tahap_5",
    tahapTarget: 5,
  },
  {
    id: "modul-ahli-gizi",
    label: "Penilaian & Menu Individual",
    href: "/ahli-gizi",
    ikon: "CalendarDays",
    izinWajib: "ahli_gizi:penilaian:kelola",
    statusTahap: "aktif_tahap_6",
    tahapTarget: 6,
  },
  {
    id: "modul-gudang",
    label: "Persediaan & Mutu Bahan",
    href: "/gudang",
    ikon: "Package",
    izinWajib: "gudang:persediaan:kelola",
    statusTahap: "aktif_tahap_7",
    tahapTarget: 7,
  },
  {
    id: "modul-dapur",
    label: "Perencanaan H-1 & Produksi",
    href: "/dapur",
    ikon: "CalendarDays",
    izinWajib: "dapur:produksi:kelola",
    statusTahap: "aktif_tahap_8",
    tahapTarget: 8,
  },
  {
    id: "modul-distribusi",
    label: "Distribusi & Verifikasi Serah",
    href: "/distribusi",
    ikon: "Truck",
    izinWajib: "distribusi:penyerahan:verifikasi",
    statusTahap: "aktif_tahap_9",
    tahapTarget: 9,
  },
  {
    id: "modul-kepala-instalasi",
    label: "Pengawasan & Insiden Gizi",
    href: "/kepala-instalasi",
    ikon: "TriangleAlert",
    izinWajib: "kepala_instalasi:pengawasan:baca",
    statusTahap: "aktif_tahap_10",
    tahapTarget: 10,
  },
] as const;

/**
 * Menyaring daftar navigasi hanya untuk modul yang diizinkan bagi pengguna aktif.
 *
 * @param daftarIzin - Daftar izin milik pengguna yang sedang terautentikasi.
 * @returns Daftar item navigasi yang berhak dilihat oleh pengguna tersebut.
 */
export function saringNavigasiBerdasarkanIzin(
  daftarIzin: readonly IzinSistem[],
): ItemNavigasiPeran[] {
  const himpunanIzin = new Set<IzinSistem>(daftarIzin);
  return KATALOG_NAVIGASI_SISTEM.filter((item) =>
    himpunanIzin.has(item.izinWajib),
  );
}

export function ambilRuteUtamaPeran(peran: PeranPengguna): string {
  return KATALOG_NAVIGASI_SISTEM.find((item) => item.tahapTarget === MATRIKS_PERAN_MASTER[peran].tahapImplementasi)?.href ?? "/portal";
}

/**
 * Kontrak batas kepemilikan data antar-microservice sesuai TECHSTACK.md Bagian 2.
 * Setiap layanan hanya boleh menulis ke skema/tabel miliknya sendiri.
 */
export interface KontrakKepemilikanLayanan {
  namaLayanan: string;
  skemaDatabase: string;
  tabelDimiliki: readonly string[];
  tanggungJawabUtama: string;
  tahapAktifMulai: number;
}

export const BATAS_KEPEMILIKAN_LAYANAN: readonly KontrakKepemilikanLayanan[] = [
  {
    namaLayanan: "identity-service",
    skemaDatabase: "manajemen_gizi_pasien_identity",
    tabelDimiliki: [
      "peran",
      "izin",
      "peran_izin",
      "pengguna",
      "pengguna_penugasan_bangsal",
      "sesi_pengguna",
      "notifikasi_pengguna",
      "konfigurasi_operasional",
      "riwayat_konfigurasi_operasional",
      "catatan_audit_akses",
      "kunci_idempotensi",
      "outbox_peristiwa",
    ],
    tanggungJawabUtama:
      "Identitas pengguna, sesi HttpOnly, peran, izin, penugasan bangsal, notifikasi per pengguna, konfigurasi dasar, dan audit akses.",
    tahapAktifMulai: 0,
  },
  {
    namaLayanan: "patient-service",
    skemaDatabase: "manajemen_gizi_pasien_patient",
    tabelDimiliki: [
      "pasien",
      "riwayat_koreksi_identitas_pasien",
      "kunjungan",
      "episode_rawat_inap",
      "penempatan_tempat_tidur",
      "kunci_idempotensi_pasien",
      "outbox_peristiwa_pasien",
    ],
    tanggungJawabUtama: "Identitas pasien, kunjungan, rawat inap, dan lokasi perawatan.",
    tahapAktifMulai: 2,
  },
  {
    namaLayanan: "clinical-nutrition-service",
    skemaDatabase: "manajemen_gizi_pasien_clinical",
    tabelDimiliki: [
      "instruksi_diet",
      "alergi_pasien",
      "skrining_gizi",
      "penilaian_gizi",
      "target_nutrisi",
      "intervensi_gizi",
    ],
    tanggungJawabUtama:
      "Instruksi diet sah berversi, alergi, kondisi medis relevan, skrining, penilaian, dan intervensi gizi.",
    tahapAktifMulai: 3,
  },
  {
    namaLayanan: "meal-planning-service",
    skemaDatabase: "manajemen_gizi_pasien_meal_planning",
    tabelDimiliki: ["resep", "menu", "rencana_menu_individual", "pesanan_makanan"],
    tanggungJawabUtama:
      "Resep, menu, pemesanan makanan, dan validasi kesesuaian menu terhadap instruksi diet versi aktif.",
    tahapAktifMulai: 6,
  },
  {
    namaLayanan: "inventory-service",
    skemaDatabase: "manajemen_gizi_pasien_inventory",
    tabelDimiliki: [
      "bahan_makanan",
      "kelompok_stok_bahan",
      "alokasi_stok",
      "riwayat_pergerakan_stok",
    ],
    tanggungJawabUtama:
      "Penerimaan, lot/kelompok stok, pemeriksaan mutu, alokasi, pengeluaran, pengembalian, dan stok opname.",
    tahapAktifMulai: 7,
  },
  {
    namaLayanan: "kitchen-service",
    skemaDatabase: "manajemen_gizi_pasien_kitchen",
    tabelDimiliki: ["rencana_produksi_h1", "kelompok_produksi", "pemeriksaan_akhir_produksi"],
    tanggungJawabUtama:
      "Perencanaan H-1, kapasitas dapur, perhitungan kebutuhan bahan, produksi, dan pemeriksaan mutu akhir.",
    tahapAktifMulai: 8,
  },
  {
    namaLayanan: "delivery-intake-service",
    skemaDatabase: "manajemen_gizi_pasien_delivery",
    tabelDimiliki: ["distribusi_makanan", "verifikasi_penyerahan", "catatan_konsumsi"],
    tanggungJawabUtama:
      "Distribusi per bangsal, verifikasi dua identitas pasien & diet terkini, serta pencatatan konsumsi aktual.",
    tahapAktifMulai: 9,
  },
  {
    namaLayanan: "incident-audit-service",
    skemaDatabase: "manajemen_gizi_pasien_incident",
    tabelDimiliki: ["insiden_pelayanan", "tindak_lanjut_insiden", "rekonsiliasi_gangguan"],
    tanggungJawabUtama:
      "Insiden pelayanan gizi, tindak lanjut lintas unit, dan rekonsiliasi prosedur downtime.",
    tahapAktifMulai: 10,
  },
] as const;
