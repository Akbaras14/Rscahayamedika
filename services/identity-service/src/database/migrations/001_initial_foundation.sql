-- ============================================================================
-- MIGRASI 001: FONDASI IDENTITAS, PERAN, SESI, NOTIFIKASI, AUDIT, & OUTBOX
-- Layanan pemilik: identity-service
-- Mesin: InnoDB, Karakter: utf8mb4_0900_ai_ci
-- Aturan: Forward-only; DILARANG DROP/TRUNCATE tanpa persetujuan eksplisit.
-- ============================================================================

CREATE TABLE IF NOT EXISTS migrasi_skema (
  versi VARCHAR(64) NOT NULL,
  nama_berkas VARCHAR(255) NOT NULL,
  diterapkan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (versi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS peran (
  kode VARCHAR(64) NOT NULL,
  nama VARCHAR(128) NOT NULL,
  deskripsi_tanggung_jawab VARCHAR(512) NOT NULL,
  tahap_implementasi INT NOT NULL,
  wajib_batas_bangsal TINYINT(1) NOT NULL DEFAULT 0,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS izin (
  kode VARCHAR(96) NOT NULL,
  deskripsi VARCHAR(255) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS peran_izin (
  peran_kode VARCHAR(64) NOT NULL,
  izin_kode VARCHAR(96) NOT NULL,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (peran_kode, izin_kode),
  CONSTRAINT fk_peran_izin_peran FOREIGN KEY (peran_kode) REFERENCES peran (kode),
  CONSTRAINT fk_peran_izin_izin FOREIGN KEY (izin_kode) REFERENCES izin (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pengguna (
  id VARCHAR(64) NOT NULL,
  nama_pengguna VARCHAR(64) NOT NULL,
  nama_lengkap VARCHAR(160) NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  password_salt VARCHAR(128) NOT NULL,
  peran_kode VARCHAR(64) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  versi INT NOT NULL DEFAULT 1,
  dibuat_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_pengguna_nama_pengguna (nama_pengguna),
  KEY idx_pengguna_peran_aktif (peran_kode, aktif),
  CONSTRAINT fk_pengguna_peran FOREIGN KEY (peran_kode) REFERENCES peran (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pengguna_penugasan_bangsal (
  pengguna_id VARCHAR(64) NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  ditugaskan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (pengguna_id, bangsal_id),
  KEY idx_penugasan_bangsal_aktif (bangsal_id, aktif),
  CONSTRAINT fk_penugasan_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sesi_pengguna (
  id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  pengguna_id VARCHAR(64) NOT NULL,
  alamat_ip VARCHAR(64) NOT NULL,
  info_perangkat VARCHAR(255) NOT NULL,
  waktu_dibuat DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  waktu_kedaluwarsa DATETIME(3) NOT NULL,
  dicabut_pada DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesi_token_hash (token_hash),
  KEY idx_sesi_pengguna_aktif (pengguna_id, waktu_kedaluwarsa),
  CONSTRAINT fk_sesi_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifikasi_pengguna (
  id VARCHAR(64) NOT NULL,
  peristiwa_id VARCHAR(64) NOT NULL,
  penerima_id VARCHAR(64) NOT NULL,
  judul VARCHAR(200) NOT NULL,
  ringkasan VARCHAR(500) NOT NULL,
  kategori ENUM('keselamatan', 'pekerjaan', 'operasional', 'informasi') NOT NULL,
  prioritas ENUM('kritis', 'tinggi', 'normal', 'rendah') NOT NULL,
  status_baca ENUM('belum_dibaca', 'sudah_dibaca') NOT NULL DEFAULT 'belum_dibaca',
  tautan_tujuan VARCHAR(255) NOT NULL,
  waktu_dibuat DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  waktu_dibaca DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifikasi_peristiwa_penerima (peristiwa_id, penerima_id),
  KEY idx_notifikasi_penerima_status_waktu (penerima_id, status_baca, waktu_dibuat),
  CONSTRAINT fk_notifikasi_penerima FOREIGN KEY (penerima_id) REFERENCES pengguna (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS konfigurasi_operasional (
  kunci VARCHAR(96) NOT NULL,
  nilai VARCHAR(512) NOT NULL,
  deskripsi VARCHAR(512) NOT NULL,
  versi INT NOT NULL DEFAULT 1,
  diperbarui_oleh VARCHAR(64) NOT NULL,
  diperbarui_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kunci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS catatan_audit_akses (
  id VARCHAR(64) NOT NULL,
  waktu_kejadian DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  aktor_pengguna_id VARCHAR(64) NULL,
  aktor_peran VARCHAR(64) NOT NULL,
  tindakan VARCHAR(128) NOT NULL,
  objek_tipe VARCHAR(96) NOT NULL,
  objek_id VARCHAR(128) NOT NULL,
  status_hasil ENUM('berhasil', 'ditolak', 'gagal') NOT NULL,
  alasan VARCHAR(500) NOT NULL,
  correlation_id VARCHAR(96) NOT NULL,
  metadata_tersanitasi JSON NOT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_waktu_aktor (waktu_kejadian, aktor_pengguna_id),
  KEY idx_audit_correlation (correlation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS kunci_idempotensi (
  kunci VARCHAR(128) NOT NULL,
  pengguna_id VARCHAR(64) NOT NULL,
  rute VARCHAR(160) NOT NULL,
  fingerprint_payload VARCHAR(128) NOT NULL,
  status_http INT NOT NULL,
  respons_json JSON NOT NULL,
  waktu_dibuat DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  waktu_kedaluwarsa DATETIME(3) NOT NULL,
  PRIMARY KEY (kunci, pengguna_id, rute),
  KEY idx_idempotensi_kedaluwarsa (waktu_kedaluwarsa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS outbox_peristiwa (
  event_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  aggregate_id VARCHAR(128) NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  correlation_id VARCHAR(96) NOT NULL,
  payload JSON NOT NULL,
  status_kirim ENUM('menunggu', 'terkirim', 'gagal') NOT NULL DEFAULT 'menunggu',
  jumlah_percobaan INT NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id),
  KEY idx_outbox_status_waktu (status_kirim, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

