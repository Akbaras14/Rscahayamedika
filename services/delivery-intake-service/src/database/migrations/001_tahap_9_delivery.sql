-- =============================================================================
-- Migrasi Skema Basis Data Delivery Intake Service (Tahap 9: Petugas Distribusi)
-- File: services/delivery-intake-service/src/database/migrations/001_tahap_9_delivery.sql
-- Sesuai BRD Bab IX & Aturan Bisnis AB-020, AB-021, AB-022, AB-023, AB-030, AB-032
-- =============================================================================

CREATE TABLE IF NOT EXISTS troli_distribusi_bangsal (
  id VARCHAR(64) PRIMARY KEY,
  nomor_troli VARCHAR(32) NOT NULL UNIQUE,
  bangsal_id VARCHAR(64) NOT NULL,
  nama_bangsal VARCHAR(128) NOT NULL,
  sesi_makan ENUM('pagi', 'siang', 'malam', 'snack_pagi', 'snack_sore') NOT NULL,
  tanggal_distribusi DATE NOT NULL,
  petugas_distribusi_id VARCHAR(64) NOT NULL,
  petugas_distribusi_nama VARCHAR(128) NOT NULL,
  status ENUM('persiapan', 'dalam_perjalanan', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'persiapan',
  total_porsi INT NOT NULL DEFAULT 0,
  total_terserah INT NOT NULL DEFAULT 0,
  total_ditahan INT NOT NULL DEFAULT 0,
  waktu_berangkat DATETIME NULL,
  waktu_kembali DATETIME NULL,
  catatan TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_troli_bangsal_tanggal (bangsal_id, tanggal_distribusi),
  INDEX idx_troli_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_porsi_distribusi (
  id VARCHAR(64) PRIMARY KEY,
  troli_id VARCHAR(64) NULL,
  nomor_troli VARCHAR(32) NULL,
  label_porsi_id VARCHAR(64) NOT NULL UNIQUE,
  nomor_label VARCHAR(64) NOT NULL,
  nomor_pesanan VARCHAR(64) NOT NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nama_pasien VARCHAR(128) NOT NULL,
  nomor_rm VARCHAR(32) NOT NULL,
  tanggal_lahir_pasien DATE NOT NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  nama_bangsal VARCHAR(128) NOT NULL,
  kamar_bed VARCHAR(64) NOT NULL,
  sesi_makan ENUM('pagi', 'siang', 'malam', 'snack_pagi', 'snack_sore') NOT NULL,
  nama_menu VARCHAR(255) NOT NULL,
  jenis_diet_label VARCHAR(128) NOT NULL,
  diet_terkini_pasien VARCHAR(128) NOT NULL,
  status_kesesuaian_diet ENUM('sesuai', 'berubah_perlu_tahan') NOT NULL DEFAULT 'sesuai',
  status_serah ENUM('menunggu_pengiriman', 'dalam_troli', 'berhasil_diserahkan', 'ditahan_klinis', 'gagal_diserahkan', 'dibatalkan') NOT NULL DEFAULT 'menunggu_pengiriman',
  waktu_serah DATETIME NULL,
  nama_penerima VARCHAR(128) NULL,
  hubungan_penerima ENUM('pasien_sendiri', 'keluarga_pasien', 'perawat_penanggung_jawab') NULL,
  alasan_gagal_atau_tahan TEXT NULL,
  dua_identitas_terverifikasi BOOLEAN NOT NULL DEFAULT FALSE,
  petugas_distribusi_nama VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_item_porsi_troli (troli_id),
  INDEX idx_item_porsi_pasien (pasien_id),
  INDEX idx_item_porsi_bangsal_status (bangsal_id, status_serah),
  INDEX idx_item_porsi_rm (nomor_rm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verifikasi_dua_identitas_serah (
  id VARCHAR(64) PRIMARY KEY,
  item_porsi_distribusi_id VARCHAR(64) NOT NULL,
  nama_pasien_diinput VARCHAR(128) NOT NULL,
  tanggal_lahir_diinput DATE NOT NULL,
  nomor_rm_diinput VARCHAR(32) NOT NULL,
  metode_verifikasi ENUM('gelang_pasien', 'tanya_pasien_keluarga', 'rekam_medis_bedside') NOT NULL,
  status_cocok BOOLEAN NOT NULL,
  verifikator_id VARCHAR(64) NOT NULL,
  verifikator_nama VARCHAR(128) NOT NULL,
  catatan_verifikasi TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_verif_porsi (item_porsi_distribusi_id),
  INDEX idx_verif_petugas (verifikator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riwayat_penyerahan_makanan (
  id VARCHAR(64) PRIMARY KEY,
  item_porsi_distribusi_id VARCHAR(64) NOT NULL,
  troli_id VARCHAR(64) NULL,
  status_sebelumnya VARCHAR(64) NOT NULL,
  status_sesudahnya VARCHAR(64) NOT NULL,
  nama_penerima VARCHAR(128) NOT NULL,
  hubungan_penerima VARCHAR(64) NOT NULL,
  petugas_id VARCHAR(64) NOT NULL,
  petugas_nama VARCHAR(128) NOT NULL,
  waktu_transisi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  keterangan TEXT NOT NULL,
  INDEX idx_riwayat_porsi (item_porsi_distribusi_id),
  INDEX idx_riwayat_waktu (waktu_transisi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS laporan_insiden_distribusi (
  id VARCHAR(64) PRIMARY KEY,
  nomor_insiden VARCHAR(64) NOT NULL UNIQUE,
  troli_id VARCHAR(64) NULL,
  porsi_distribusi_id VARCHAR(64) NULL,
  bangsal_id VARCHAR(64) NOT NULL,
  nama_bangsal VARCHAR(128) NOT NULL,
  jenis_insiden ENUM('makanan_tumpah_rusak', 'diet_tidak_sesuai', 'pasien_puasa_npo', 'pasien_pindah_kamar', 'pasien_menolak', 'keterlambatan_ekstrem', 'lainnya') NOT NULL,
  deskripsi_insiden TEXT NOT NULL,
  tindakan_koreksi TEXT NOT NULL,
  dilaporkan_oleh_id VARCHAR(64) NOT NULL,
  dilaporkan_oleh_nama VARCHAR(128) NOT NULL,
  waktu_kejadian DATETIME NOT NULL,
  status_penyelesaian ENUM('terbuka', 'ditindaklanjuti', 'selesai') NOT NULL DEFAULT 'terbuka',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_insiden_bangsal (bangsal_id),
  INDEX idx_insiden_jenis (jenis_insiden),
  INDEX idx_insiden_status (status_penyelesaian)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

