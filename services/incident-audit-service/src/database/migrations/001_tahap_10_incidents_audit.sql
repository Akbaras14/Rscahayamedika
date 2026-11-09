-- =============================================================================
-- MIGRASI 001 — TAHAP 10: LAYANAN PENGAWASAN MUTU & AUDIT INSIDEN GIZI
-- Domain: incident-audit-service (Kepala Instalasi Gizi)
-- Standar: Forward-only DDL, InnoDB, utf8mb4_0900_ai_ci, Tanpa Penghapusan Destruktif
-- Aturan Bisnis: AB-028, AB-029, AB-030, AB-032, AB-033, BRD Bab X, XI, XVI
-- =============================================================================

CREATE TABLE IF NOT EXISTS `laporan_insiden_keselamatan_gizi` (
  `id` VARCHAR(64) NOT NULL,
  `nomor_insiden` VARCHAR(64) NOT NULL,
  `unit_pelapor` VARCHAR(32) NOT NULL,
  `tanggal_kejadian` DATETIME NOT NULL,
  `jenis_insiden` VARCHAR(128) NOT NULL,
  `derajat_keparahan` ENUM('rendah', 'sedang', 'tinggi', 'kritis') NOT NULL,
  `deskripsi_kejadian` TEXT NOT NULL,
  `tindakan_awal_segera` TEXT NOT NULL,
  `pasien_terdampak_nama` VARCHAR(128) NULL,
  `nomor_rm_pasien` VARCHAR(64) NULL,
  `nama_bangsal` VARCHAR(128) NULL,
  `status_insiden` ENUM('dilaporkan', 'dalam_investigasi', 'tindakan_koreksi', 'terverifikasi', 'selesai_ditutup') NOT NULL DEFAULT 'dilaporkan',
  `pelapor_id` VARCHAR(64) NOT NULL,
  `pelapor_nama` VARCHAR(128) NOT NULL,
  `penanggung_jawab_id` VARCHAR(64) NULL,
  `penanggung_jawab_nama` VARCHAR(128) NULL,
  `waktu_penutupan` DATETIME NULL,
  `catatan_penutupan` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_nomor_insiden` (`nomor_insiden`),
  KEY `idx_insiden_status` (`status_insiden`),
  KEY `idx_insiden_derajat` (`derajat_keparahan`),
  KEY `idx_insiden_tanggal` (`tanggal_kejadian`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `investigasi_insiden_gizi` (
  `id` VARCHAR(64) NOT NULL,
  `insiden_id` VARCHAR(64) NOT NULL,
  `nomor_insiden` VARCHAR(64) NOT NULL,
  `investigator_id` VARCHAR(64) NOT NULL,
  `investigator_nama` VARCHAR(128) NOT NULL,
  `tanggal_investigasi` DATETIME NOT NULL,
  `akar_masalah_rca` TEXT NOT NULL,
  `faktor_kontributor` TEXT NOT NULL,
  `rekomendasi_sistemik` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_investigasi_insiden` (`insiden_id`),
  KEY `idx_investigasi_insiden` (`insiden_id`),
  CONSTRAINT `fk_investigasi_insiden` FOREIGN KEY (`insiden_id`) REFERENCES `laporan_insiden_keselamatan_gizi` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tindakan_perbaikan_insiden` (
  `id` VARCHAR(64) NOT NULL,
  `insiden_id` VARCHAR(64) NOT NULL,
  `nomor_insiden` VARCHAR(64) NOT NULL,
  `deskripsi_tindakan` TEXT NOT NULL,
  `penanggung_jawab_id` VARCHAR(64) NOT NULL,
  `penanggung_jawab_nama` VARCHAR(128) NOT NULL,
  `target_tanggal_selesai` DATE NOT NULL,
  `tanggal_realisasi` DATE NULL,
  `status_tindakan` ENUM('direncanakan', 'sedang_berjalan', 'selesai_efektif') NOT NULL DEFAULT 'direncanakan',
  `bukti_penyelesaian` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tindakan_insiden` (`insiden_id`),
  CONSTRAINT `fk_tindakan_insiden` FOREIGN KEY (`insiden_id`) REFERENCES `laporan_insiden_keselamatan_gizi` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `evaluasi_mutu_dan_sisa_makanan` (
  `id` VARCHAR(64) NOT NULL,
  `tanggal_evaluasi` DATE NOT NULL,
  `bangsal_id` VARCHAR(64) NOT NULL,
  `nama_bangsal` VARCHAR(128) NOT NULL,
  `total_porsi_disajikan` INT NOT NULL DEFAULT 0,
  `rata_rata_sisa_makanan_persen` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `kepatuhan_ccp_suhu_persen` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `kepatuhan_dua_identitas_persen` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `kategori_mutu` ENUM('sangat_baik', 'standar', 'perlu_perbaikan') NOT NULL DEFAULT 'standar',
  `catatan_evaluasi` TEXT NOT NULL,
  `evaluator_id` VARCHAR(64) NOT NULL,
  `evaluator_nama` VARCHAR(128) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_evaluasi_tanggal` (`tanggal_evaluasi`),
  KEY `idx_evaluasi_bangsal` (`bangsal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `rekonsiliasi_downtime_pelayanan` (
  `id` VARCHAR(64) NOT NULL,
  `nomor_rekonsiliasi` VARCHAR(64) NOT NULL,
  `tanggal_insiden_downtime` DATE NOT NULL,
  `durasi_downtime_menit` INT NOT NULL DEFAULT 0,
  `unit_terdampak` VARCHAR(128) NOT NULL,
  `jumlah_formulir_kertas` INT NOT NULL DEFAULT 0,
  `duplikasi_terdeteksi` INT NOT NULL DEFAULT 0,
  `selisih_pesanan_selesai` BOOLEAN NOT NULL DEFAULT TRUE,
  `status_rekonsiliasi` ENUM('menunggu_pengesahan', 'disahkan', 'ditolak') NOT NULL DEFAULT 'menunggu_pengesahan',
  `disahkan_oleh_id` VARCHAR(64) NULL,
  `disahkan_oleh_nama` VARCHAR(128) NULL,
  `waktu_pengesahan` DATETIME NULL,
  `catatan_rekonsiliasi` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_nomor_rekonsiliasi` (`nomor_rekonsiliasi`),
  KEY `idx_rekonsiliasi_status` (`status_rekonsiliasi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
