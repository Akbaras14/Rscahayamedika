-- ==============================================================================
-- Migrasi 001: Skema Layanan Nutrisi Klinis & Dokter DPJP (Tahap 3)
-- Database: manajemen_gizi_pasien_clinical
-- Menegakkan:
-- - Pemeriksaan awal dokter & diagnosis klinis (BRD Bab IV.4.2)
-- - Pencatatan alergi & intoleransi bahan makanan (AB-007)
-- - Penetapan instruksi diet awal sah berstempel waktu & berversi (AB-003, AB-004, AB-005)
-- - Larangan makan/minum melalui mulut / NPO (AB-008)
-- - Riwayat koreksi versi instruksi diet (AB-010, AB-030)
-- - Pengajuan rawat inap dokter ke bangsal perawatan (BRD Bab IV.4.3)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS skema_migrasi_clinical (
  nama_berkas VARCHAR(255) NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  dijalankan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (nama_berkas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pemeriksaan_klinis (
  id VARCHAR(64) NOT NULL,
  kunjungan_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  tanggal_lahir_pasien DATE NOT NULL,
  dokter_id VARCHAR(64) NOT NULL,
  dokter_nama VARCHAR(160) NOT NULL,
  unit_pelayanan VARCHAR(100) NOT NULL,
  bangsal_id VARCHAR(64) NULL,
  keluhan_utama TEXT NOT NULL,
  riwayat_penyakit_sekarang TEXT NULL,
  tekanan_darah_sistol INT NULL,
  tekanan_darah_diastol INT NULL,
  denyut_nadi INT NULL,
  frekuensi_nafas INT NULL,
  suhu_tubuh DECIMAL(4, 1) NULL,
  berat_badan_kg DECIMAL(5, 2) NULL,
  tinggi_badan_cm DECIMAL(5, 2) NULL,
  diagnosis_klinis_primer VARCHAR(255) NOT NULL,
  diagnosis_klinis_sekunder TEXT NULL,
  catatan_klinis_relevan_gizi TEXT NULL,
  tindak_lanjut VARCHAR(50) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_pemeriksaan_kunjungan (kunjungan_id),
  INDEX idx_pemeriksaan_pasien (pasien_id),
  INDEX idx_pemeriksaan_rekam_medis (nomor_rekam_medis),
  INDEX idx_pemeriksaan_dokter (dokter_id),
  INDEX idx_pemeriksaan_dibuat (dibuat_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alergi_pasien (
  id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  pemeriksaan_id VARCHAR(64) NULL,
  kategori_alergen VARCHAR(50) NOT NULL,
  nama_alergen VARCHAR(100) NOT NULL,
  tingkat_keparahan VARCHAR(30) NOT NULL,
  reaksi_alergi VARCHAR(255) NULL,
  status_aktif TINYINT(1) NOT NULL DEFAULT 1,
  dicatat_oleh_id VARCHAR(64) NOT NULL,
  dicatat_oleh_nama VARCHAR(160) NOT NULL,
  dicatat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_alergi_pasien (pasien_id),
  INDEX idx_alergi_kategori (kategori_alergen),
  INDEX idx_alergi_status (status_aktif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instruksi_diet (
  id VARCHAR(64) NOT NULL,
  nomor_instruksi VARCHAR(32) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  kunjungan_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  dokter_pengesah_id VARCHAR(64) NOT NULL,
  dokter_pengesah_nama VARCHAR(160) NOT NULL,
  bangsal_id VARCHAR(64) NULL,
  jenis_diet VARCHAR(100) NOT NULL,
  nama_diet_kustom VARCHAR(150) NULL,
  bentuk_makanan VARCHAR(50) NOT NULL,
  rute_pemberian VARCHAR(50) NOT NULL,
  status_puasa_npo TINYINT(1) NOT NULL DEFAULT 0,
  alasan_puasa VARCHAR(255) NULL,
  target_energi_kkal INT NULL,
  target_protein_gram DECIMAL(5, 1) NULL,
  pembatasan_cairan_ml INT NULL,
  pembatasan_natrium_mg INT NULL,
  instruksi_khusus TEXT NULL,
  status_instruksi VARCHAR(30) NOT NULL,
  versi INT NOT NULL DEFAULT 1,
  berlaku_sejak DATETIME(3) NOT NULL,
  berlaku_hingga DATETIME(3) NULL,
  disahkan_pada DATETIME(3) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_instruksi_nomor (nomor_instruksi),
  INDEX idx_instruksi_pasien (pasien_id),
  INDEX idx_instruksi_kunjungan (kunjungan_id),
  INDEX idx_instruksi_rekam_medis (nomor_rekam_medis),
  INDEX idx_instruksi_status (status_instruksi),
  INDEX idx_instruksi_bangsal (bangsal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riwayat_versi_instruksi_diet (
  id VARCHAR(64) NOT NULL,
  instruksi_diet_id VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  versi INT NOT NULL,
  snapshot_data TEXT NOT NULL,
  alasan_perubahan TEXT NOT NULL,
  diubah_oleh_id VARCHAR(64) NOT NULL,
  diubah_oleh_nama VARCHAR(160) NOT NULL,
  diubah_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_riwayat_diet_id (instruksi_diet_id),
  INDEX idx_riwayat_pasien_id (pasien_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pengajuan_rawat_inap (
  id VARCHAR(64) NOT NULL,
  nomor_pengajuan VARCHAR(32) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  kunjungan_id VARCHAR(64) NOT NULL,
  nomor_rekam_medis VARCHAR(32) NOT NULL,
  nama_pasien VARCHAR(160) NOT NULL,
  dokter_pengaju_id VARCHAR(64) NOT NULL,
  dokter_pengaju_nama VARCHAR(160) NOT NULL,
  diagnosis_utama VARCHAR(255) NOT NULL,
  alasan_rawat_inap TEXT NOT NULL,
  prioritas_rawat_inap VARCHAR(30) NOT NULL,
  rekomendasi_bangsal VARCHAR(64) NOT NULL,
  kebutuhan_khusus VARCHAR(255) NULL,
  instruksi_diet_id VARCHAR(64) NULL,
  status_pengajuan VARCHAR(30) NOT NULL DEFAULT 'menunggu_penempatan',
  diajukan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pengajuan_nomor (nomor_pengajuan),
  INDEX idx_pengajuan_pasien (pasien_id),
  INDEX idx_pengajuan_kunjungan (kunjungan_id),
  INDEX idx_pengajuan_status (status_pengajuan),
  INDEX idx_pengajuan_bangsal (rekomendasi_bangsal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kunci_idempotensi_clinical (
  id VARCHAR(64) NOT NULL,
  kunci VARCHAR(128) NOT NULL,
  aktor_id VARCHAR(64) NOT NULL,
  metode_http VARCHAR(16) NOT NULL,
  jalur_permintaan VARCHAR(255) NOT NULL,
  kode_status_respons INT NOT NULL,
  tubuh_respons LONGTEXT NOT NULL,
  waktu_dibuat DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kunci_idempotensi_clinical (kunci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox_peristiwa_clinical (
  id VARCHAR(64) NOT NULL,
  tipe_peristiwa VARCHAR(100) NOT NULL,
  id_agregat VARCHAR(64) NOT NULL,
  muatan LONGTEXT NOT NULL,
  status_publikasi VARCHAR(20) NOT NULL DEFAULT 'TERTUNDA',
  waktu_dibuat DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_outbox_clinical_status (status_publikasi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

