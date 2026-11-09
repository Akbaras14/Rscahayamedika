-- ==============================================================================
-- Migrasi 003: Skema Layanan Asuhan Gizi & Rencana Menu Individual (Tahap 6: Ahli Gizi / Dietisien)
-- Database: manajemen_gizi_pasien_clinical
-- Menegakkan:
-- - Penilaian Kondisi Gizi & Target Nutrisi Individual (BRD Bab V.5.3, AB-009, AB-027)
-- - Pemeriksaan Kesesuaian Diet Berdasarkan Kondisi Medis & Alergi (BRD Bab V.5.4, AB-007, AB-010)
-- - Perencanaan Menu Individual & Katalog Menu/Resep Standar (BRD Bab V.5.5, AB-011, AB-014)
-- - Evaluasi & Intervensi Asuhan Gizi Berkala (BRD Bab V.5.6, Bab XI, AB-026, AB-028)
-- Catatan: Forward-only migration.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS asuhan_gizi_adime (
  id VARCHAR(64) NOT NULL,
  nomor_asuhan VARCHAR(32) NOT NULL,
  episode_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  skrining_id VARCHAR(64) NULL,
  ahli_gizi_id VARCHAR(64) NOT NULL,
  ahli_gizi_nama VARCHAR(160) NOT NULL,
  antropometri_bb_kg DECIMAL(5,2) NULL,
  antropometri_tb_cm DECIMAL(5,2) NULL,
  antropometri_imt DECIMAL(4,2) NULL,
  klasifikasi_imt VARCHAR(40) NULL,
  biokimia TEXT NULL,
  klinis_fisik TEXT NULL,
  riwayat_diet TEXT NULL,
  diagnosis_gizi_pes TEXT NOT NULL,
  target_energi_kkal INT NOT NULL,
  target_protein_gram DECIMAL(5,2) NOT NULL,
  target_lemak_gram DECIMAL(5,2) NOT NULL,
  target_karbohidrat_gram DECIMAL(5,2) NOT NULL,
  target_cairan_ml INT NULL,
  target_serat_gram DECIMAL(5,2) NULL,
  target_natrium_mg INT NULL,
  tujuan_intervensi TEXT NOT NULL,
  rencana_intervensi TEXT NOT NULL,
  rencana_monitoring_evaluasi TEXT NOT NULL,
  tanggal_evaluasi_ulang DATE NOT NULL,
  status_asuhan VARCHAR(30) NOT NULL DEFAULT 'aktif',
  waktu_berlaku DATETIME(3) NOT NULL,
  versi INT NOT NULL DEFAULT 1,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_asuhan_nomor (nomor_asuhan),
  INDEX idx_asuhan_episode (episode_id),
  INDEX idx_asuhan_pasien (pasien_id),
  INDEX idx_asuhan_bangsal (bangsal_id),
  INDEX idx_asuhan_ahli_gizi (ahli_gizi_id),
  INDEX idx_asuhan_status (status_asuhan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS katalog_menu_resep (
  id VARCHAR(64) NOT NULL,
  kode_menu VARCHAR(32) NOT NULL,
  nama_menu VARCHAR(160) NOT NULL,
  kategori_makanan VARCHAR(40) NOT NULL,
  bentuk_makanan VARCHAR(30) NOT NULL,
  jenis_diet_terkait VARCHAR(64) NOT NULL,
  energi_kkal INT NOT NULL,
  protein_gram DECIMAL(5,2) NOT NULL,
  lemak_gram DECIMAL(5,2) NOT NULL,
  karbohidrat_gram DECIMAL(5,2) NOT NULL,
  komposisi_bahan JSON NOT NULL,
  alergen JSON NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT 1,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_katalog_kode (kode_menu),
  INDEX idx_katalog_kategori (kategori_makanan),
  INDEX idx_katalog_bentuk (bentuk_makanan),
  INDEX idx_katalog_diet (jenis_diet_terkait)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rencana_menu_individual (
  id VARCHAR(64) NOT NULL,
  episode_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  asuhan_gizi_id VARCHAR(64) NOT NULL,
  instruksi_diet_id VARCHAR(64) NOT NULL,
  tanggal_pelayanan DATE NOT NULL,
  jadwal_makan VARCHAR(30) NOT NULL,
  menu_id VARCHAR(64) NOT NULL,
  nama_menu VARCHAR(160) NOT NULL,
  bentuk_makanan VARCHAR(30) NOT NULL,
  porsi DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  energi_kkal INT NOT NULL,
  protein_gram DECIMAL(5,2) NOT NULL,
  lemak_gram DECIMAL(5,2) NOT NULL,
  karbohidrat_gram DECIMAL(5,2) NOT NULL,
  status_kesesuaian VARCHAR(30) NOT NULL DEFAULT 'sesuai',
  alasan_tidak_sesuai TEXT NULL,
  status_pengesahan VARCHAR(30) NOT NULL DEFAULT 'draf',
  disahkan_oleh VARCHAR(64) NULL,
  disahkan_pada DATETIME(3) NULL,
  catatan_khusus TEXT NULL,
  versi INT NOT NULL DEFAULT 1,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_rmi_episode (episode_id),
  INDEX idx_rmi_pasien (pasien_id),
  INDEX idx_rmi_tanggal (tanggal_pelayanan),
  INDEX idx_rmi_jadwal (jadwal_makan),
  INDEX idx_rmi_status (status_pengesahan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evaluasi_asuhan_gizi (
  id VARCHAR(64) NOT NULL,
  asuhan_gizi_id VARCHAR(64) NOT NULL,
  episode_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  ahli_gizi_id VARCHAR(64) NOT NULL,
  ahli_gizi_nama VARCHAR(160) NOT NULL,
  tanggal_evaluasi DATE NOT NULL,
  evaluasi_antropometri TEXT NULL,
  evaluasi_biokimia TEXT NULL,
  evaluasi_asupan TEXT NOT NULL,
  persentase_pemenuhan_asupan DECIMAL(5,2) NULL,
  hambatan_asupan TEXT NULL,
  keputusan_tindak_lanjut VARCHAR(40) NOT NULL,
  rekomendasi_ke_dokter TEXT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_eag_asuhan (asuhan_gizi_id),
  INDEX idx_eag_episode (episode_id),
  INDEX idx_eag_pasien (pasien_id),
  INDEX idx_eag_tanggal (tanggal_evaluasi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

