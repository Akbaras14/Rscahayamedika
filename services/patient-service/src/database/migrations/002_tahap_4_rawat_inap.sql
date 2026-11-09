-- ============================================================================
-- MIGRASI 002: TAHAP 4 — PERAN PETUGAS RAWAT INAP (PATIENT SERVICE)
-- Layanan Pemilik: patient-service
-- Skema: manajemen_gizi_pasien_patient
-- Acuan: BRD Versi 4.0 Bab IV.4.3 & IV.4.5, Bab XVIII (AB-002, AB-020, AB-030, AB-031, AB-032, AB-034)
-- Catatan: Forward-only migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bangsal (
  id VARCHAR(64) NOT NULL,
  kode_bangsal VARCHAR(32) NOT NULL,
  nama_bangsal VARCHAR(96) NOT NULL,
  kelas_pelayanan ENUM('kelas_1', 'kelas_2', 'kelas_3', 'vip', 'vvip', 'icu') NOT NULL,
  kapasitas_tempat_tidur INT UNSIGNED NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bangsal_kode (kode_bangsal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kamar (
  id VARCHAR(64) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  nomor_kamar VARCHAR(32) NOT NULL,
  nama_kamar VARCHAR(96) NOT NULL,
  kapasitas_tempat_tidur INT UNSIGNED NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_kamar_bangsal (bangsal_id),
  CONSTRAINT fk_kamar_bangsal FOREIGN KEY (bangsal_id) REFERENCES bangsal (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tempat_tidur (
  id VARCHAR(64) NOT NULL,
  kamar_id VARCHAR(64) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  nomor_tempat_tidur VARCHAR(32) NOT NULL,
  status_tempat_tidur ENUM('tersedia', 'terisi', 'pemeliharaan') NOT NULL DEFAULT 'tersedia',
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kamar_bed (kamar_id, nomor_tempat_tidur),
  KEY idx_bed_bangsal_status (bangsal_id, status_tempat_tidur),
  CONSTRAINT fk_bed_kamar FOREIGN KEY (kamar_id) REFERENCES kamar (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bed_bangsal FOREIGN KEY (bangsal_id) REFERENCES bangsal (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS episode_rawat_inap (
  id VARCHAR(64) NOT NULL,
  nomor_episode VARCHAR(40) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  kunjungan_id VARCHAR(64) NOT NULL,
  pengajuan_id VARCHAR(64) NOT NULL,
  dokter_dpjp_id VARCHAR(64) NOT NULL,
  dokter_dpjp_nama VARCHAR(160) NOT NULL,
  diagnosis_utama VARCHAR(255) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  kamar_id VARCHAR(64) NOT NULL,
  tempat_tidur_id VARCHAR(64) NOT NULL,
  waktu_masuk DATETIME(3) NOT NULL,
  waktu_keluar DATETIME(3) NULL,
  status_perawatan ENUM('aktif', 'selesai', 'dirujuk', 'meninggal') NOT NULL DEFAULT 'aktif',
  alasan_pemulangan ENUM('sembuh', 'rujuk_rs_lain', 'pulang_paksa', 'meninggal') NULL,
  catatan_pemulangan VARCHAR(255) NULL,
  dipulangkan_oleh_id VARCHAR(64) NULL,
  dipulangkan_oleh_nama VARCHAR(120) NULL,
  versi INT UNSIGNED NOT NULL DEFAULT 1,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_episode_nomor (nomor_episode),
  KEY idx_episode_pasien (pasien_id, status_perawatan),
  KEY idx_episode_bangsal (bangsal_id, status_perawatan),
  CONSTRAINT fk_episode_pasien FOREIGN KEY (pasien_id) REFERENCES pasien (id) ON DELETE RESTRICT,
  CONSTRAINT fk_episode_kunjungan FOREIGN KEY (kunjungan_id) REFERENCES kunjungan (id) ON DELETE RESTRICT,
  CONSTRAINT fk_episode_bed FOREIGN KEY (tempat_tidur_id) REFERENCES tempat_tidur (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS penempatan_tempat_tidur (
  id VARCHAR(64) NOT NULL,
  episode_rawat_inap_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  tempat_tidur_id VARCHAR(64) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  kamar_id VARCHAR(64) NOT NULL,
  waktu_masuk DATETIME(3) NOT NULL,
  waktu_keluar DATETIME(3) NULL,
  status_penempatan ENUM('aktif', 'selesai') NOT NULL DEFAULT 'aktif',
  dicatat_oleh_id VARCHAR(64) NOT NULL,
  dicatat_oleh_nama VARCHAR(120) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_penempatan_episode (episode_rawat_inap_id, status_penempatan),
  KEY idx_penempatan_bed (tempat_tidur_id, status_penempatan),
  CONSTRAINT fk_penempatan_episode FOREIGN KEY (episode_rawat_inap_id) REFERENCES episode_rawat_inap (id) ON DELETE RESTRICT,
  CONSTRAINT fk_penempatan_bed FOREIGN KEY (tempat_tidur_id) REFERENCES tempat_tidur (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riwayat_perpindahan_tempat_tidur (
  id VARCHAR(64) NOT NULL,
  episode_rawat_inap_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  bangsal_asal_id VARCHAR(64) NOT NULL,
  kamar_asal_id VARCHAR(64) NOT NULL,
  tempat_tidur_asal_id VARCHAR(64) NOT NULL,
  bangsal_tujuan_id VARCHAR(64) NOT NULL,
  kamar_tujuan_id VARCHAR(64) NOT NULL,
  tempat_tidur_tujuan_id VARCHAR(64) NOT NULL,
  alasan_pemindahan VARCHAR(255) NOT NULL,
  dipindahkan_oleh_id VARCHAR(64) NOT NULL,
  dipindahkan_oleh_nama VARCHAR(120) NOT NULL,
  waktu_pemindahan DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_riwayat_pindah_episode (episode_rawat_inap_id, waktu_pemindahan),
  CONSTRAINT fk_pindah_episode FOREIGN KEY (episode_rawat_inap_id) REFERENCES episode_rawat_inap (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
