-- ============================================================================
-- MIGRASI 001: TAHAP 2 — PERAN PETUGAS PENDAFTARAN (PATIENT SERVICE)
-- Layanan Pemilik: patient-service
-- Skema: manajemen_gizi_pasien_patient
-- Acuan: BRD Versi 4.0 Bab IV.4.1 & Bab XVII (AB-001, AB-020, AB-030, AB-032, AB-034)
-- Catatan: Forward-only migration, tanpa DROP/TRUNCATE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS skema_migrasi_patient (
  versi VARCHAR(64) NOT NULL,
  deskripsi VARCHAR(255) NOT NULL,
  diterapkan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (versi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pasien (
  id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nomor_identitas_nasional VARCHAR(32) NULL,
  alasan_tanpa_nik VARCHAR(255) NULL,
  nama_lengkap VARCHAR(160) NOT NULL,
  tanggal_lahir DATE NOT NULL,
  jenis_kelamin ENUM('laki_laki', 'perempuan') NOT NULL,
  golongan_darah ENUM('A', 'B', 'AB', 'O', 'belum_diketahui') NOT NULL DEFAULT 'belum_diketahui',
  alamat_domisili VARCHAR(255) NOT NULL,
  telepon_kontak_darurat VARCHAR(32) NOT NULL,
  nama_kontak_darurat VARCHAR(160) NOT NULL,
  hubungan_kontak_darurat VARCHAR(64) NOT NULL,
  status_verifikasi_identitas ENUM('terverifikasi_dua_pengenal', 'perlu_verifikasi_ulang') NOT NULL DEFAULT 'terverifikasi_dua_pengenal',
  catatan_administratif VARCHAR(255) NULL,
  versi INT UNSIGNED NOT NULL DEFAULT 1,
  didaftarkan_oleh VARCHAR(64) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pasien_nomor_rekam_medis (nomor_rekam_medis),
  UNIQUE KEY uq_pasien_nik (nomor_identitas_nasional),
  KEY idx_pasien_nama_tgl_lahir (nama_lengkap, tanggal_lahir),
  KEY idx_pasien_tgl_lahir (tanggal_lahir)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riwayat_koreksi_identitas_pasien (
  id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  versi_sebelum INT UNSIGNED NOT NULL,
  versi_sesudah INT UNSIGNED NOT NULL,
  snapshot_sebelum_json JSON NOT NULL,
  snapshot_sesudah_json JSON NOT NULL,
  alasan_koreksi VARCHAR(255) NOT NULL,
  pengenal_diverifikasi VARCHAR(128) NOT NULL,
  dikoreksi_oleh_id VARCHAR(64) NOT NULL,
  dikoreksi_oleh_nama VARCHAR(120) NOT NULL,
  dikoreksi_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_koreksi_pasien_waktu (pasien_id, dikoreksi_pada),
  CONSTRAINT fk_koreksi_pasien FOREIGN KEY (pasien_id) REFERENCES pasien (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kunjungan (
  id VARCHAR(64) NOT NULL,
  nomor_kunjungan VARCHAR(40) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  tanggal_kunjungan DATE NOT NULL,
  nomor_antrean_harian INT UNSIGNED NOT NULL,
  kode_antrean VARCHAR(24) NOT NULL,
  unit_tujuan VARCHAR(96) NOT NULL,
  dokter_tujuan_id VARCHAR(64) NOT NULL,
  dokter_tujuan_nama VARCHAR(160) NOT NULL,
  keluhan_administratif VARCHAR(255) NOT NULL,
  prioritas_antrean ENUM('reguler', 'mendesak') NOT NULL DEFAULT 'reguler',
  status_kunjungan ENUM(
    'menunggu_pemeriksaan',
    'sedang_diperiksa',
    'selesai_pemeriksaan',
    'diajukan_rawat_inap',
    'dibatalkan'
  ) NOT NULL DEFAULT 'menunggu_pemeriksaan',
  pengenal_diverifikasi VARCHAR(128) NOT NULL,
  alasan_pembatalan VARCHAR(255) NULL,
  dibatalkan_oleh_id VARCHAR(64) NULL,
  dibatalkan_pada DATETIME(3) NULL,
  versi INT UNSIGNED NOT NULL DEFAULT 1,
  didaftarkan_oleh_id VARCHAR(64) NOT NULL,
  didaftarkan_oleh_nama VARCHAR(120) NOT NULL,
  waktu_masuk_antrean DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kunjungan_nomor (nomor_kunjungan),
  UNIQUE KEY uq_kunjungan_antrean_harian (tanggal_kunjungan, unit_tujuan, nomor_antrean_harian),
  KEY idx_kunjungan_pasien_status (pasien_id, status_kunjungan),
  KEY idx_kunjungan_antrean_dokter (tanggal_kunjungan, status_kunjungan, prioritas_antrean, nomor_antrean_harian),
  CONSTRAINT fk_kunjungan_pasien FOREIGN KEY (pasien_id) REFERENCES pasien (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kunci_idempotensi_pasien (
  kunci_idempotensi VARCHAR(128) NOT NULL,
  pengguna_id VARCHAR(64) NOT NULL,
  rute VARCHAR(160) NOT NULL,
  hash_payload CHAR(64) NOT NULL,
  status_http SMALLINT UNSIGNED NOT NULL,
  respons_json JSON NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  kedaluwarsa_pada DATETIME(3) NOT NULL,
  PRIMARY KEY (kunci_idempotensi, pengguna_id, rute),
  KEY idx_idempotensi_pasien_kedaluwarsa (kedaluwarsa_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox_peristiwa_pasien (
  event_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(96) NOT NULL,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  aggregate_id VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  status_pengiriman ENUM('menunggu', 'terkirim', 'gagal') NOT NULL DEFAULT 'menunggu',
  jumlah_percobaan INT UNSIGNED NOT NULL DEFAULT 0,
  terjadi_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  dikirim_pada DATETIME(3) NULL,
  PRIMARY KEY (event_id),
  KEY idx_outbox_pasien_status (status_pengiriman, terjadi_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

