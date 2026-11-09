-- ==============================================================================
-- Migrasi 002: Skema Layanan Asuhan Keperawatan Bangsal (Tahap 5)
-- Database: manajemen_gizi_pasien_clinical
-- Menegakkan:
-- - Pemeriksaan Keamanan Makanan oleh Perawat (BRD Bab V.5.1, AB-003, AB-007, AB-008, AB-020)
-- - Skrining Risiko Gangguan Gizi (MST) & Rujukan ke Ahli Gizi (BRD Bab V.5.2)
-- - Observasi Klinis & Kontrak Asupan Makanan Skala Comstock (BRD Bab X.10.1, 10.2)
-- Catatan: Forward-only migration.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS skrining_gizi (
  id VARCHAR(64) NOT NULL,
  nomor_skrining VARCHAR(32) NOT NULL,
  episode_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  perawat_id VARCHAR(64) NOT NULL,
  perawat_nama VARCHAR(160) NOT NULL,
  metode_skrining VARCHAR(30) NOT NULL DEFAULT 'mst',
  penurunan_berat_badan VARCHAR(50) NOT NULL,
  skor_penurunan_bb INT NOT NULL,
  asupan_makan_berkurang BOOLEAN NOT NULL DEFAULT 0,
  skor_asupan_makan INT NOT NULL,
  total_skor INT NOT NULL,
  kategori_risiko VARCHAR(30) NOT NULL,
  perlu_penilaian_lanjut BOOLEAN NOT NULL DEFAULT 0,
  catatan_skrining TEXT NULL,
  diskrining_pada DATETIME(3) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_skrining_nomor (nomor_skrining),
  INDEX idx_skrining_episode (episode_id),
  INDEX idx_skrining_pasien (pasien_id),
  INDEX idx_skrining_bangsal (bangsal_id),
  INDEX idx_skrining_perawat (perawat_id),
  INDEX idx_skrining_risiko (kategori_risiko)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verifikasi_keamanan_makanan (
  id VARCHAR(64) NOT NULL,
  nomor_verifikasi VARCHAR(32) NOT NULL,
  episode_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  tempat_tidur_id VARCHAR(64) NOT NULL,
  nomor_tempat_tidur VARCHAR(64) NOT NULL,
  instruksi_diet_id VARCHAR(64) NULL,
  perawat_id VARCHAR(64) NOT NULL,
  perawat_nama VARCHAR(160) NOT NULL,
  konfirmasi_tanggal_lahir DATE NOT NULL,
  apakah_identitas_sesuai BOOLEAN NOT NULL DEFAULT 1,
  apakah_diet_sesuai BOOLEAN NOT NULL DEFAULT 1,
  apakah_alergi_terkonfirmasi BOOLEAN NOT NULL DEFAULT 1,
  kemampuan_menelan VARCHAR(50) NOT NULL,
  status_kesadaran VARCHAR(50) NOT NULL,
  status_puasa_npo VARCHAR(50) NOT NULL,
  keputusan VARCHAR(30) NOT NULL,
  alasan_penahanan TEXT NULL,
  tindakan_eskalasi TEXT NULL,
  diverifikasi_pada DATETIME(3) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_verifikasi_nomor (nomor_verifikasi),
  INDEX idx_vkm_episode (episode_id),
  INDEX idx_vkm_pasien (pasien_id),
  INDEX idx_vkm_bangsal (bangsal_id),
  INDEX idx_vkm_keputusan (keputusan),
  INDEX idx_vkm_perawat (perawat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS observasi_asupan_keperawatan (
  id VARCHAR(64) NOT NULL,
  episode_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  tempat_tidur_id VARCHAR(64) NOT NULL,
  perawat_id VARCHAR(64) NOT NULL,
  perawat_nama VARCHAR(160) NOT NULL,
  tanggal_makan DATE NOT NULL,
  jadwal_makan VARCHAR(30) NOT NULL,
  skala_comstock VARCHAR(30) NOT NULL,
  persentase_konsumsi INT NOT NULL DEFAULT 0,
  kondisi_pemberian VARCHAR(50) NOT NULL,
  alasan_tidak_habis VARCHAR(100) NULL,
  catatan_observasi TEXT NULL,
  peringatan_asupan_rendah BOOLEAN NOT NULL DEFAULT 0,
  diobservasi_pada DATETIME(3) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_oak_episode (episode_id),
  INDEX idx_oak_pasien (pasien_id),
  INDEX idx_oak_bangsal (bangsal_id),
  INDEX idx_oak_tanggal (tanggal_makan),
  INDEX idx_oak_jadwal (jadwal_makan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

