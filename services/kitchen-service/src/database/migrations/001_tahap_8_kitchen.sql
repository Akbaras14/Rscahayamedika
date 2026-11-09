-- Migrasi Tahap 8: Peran Petugas Dapur (Kitchen Staff)
-- Mengikuti BRD Bab VIII (Produksi dan Pengendalian Makanan),
-- Aturan Bisnis AB-005, AB-010, AB-012, AB-013, AB-014, AB-018, AB-019.

-- Tabel 1: Rencana Produksi Reguler H-1
CREATE TABLE IF NOT EXISTS rencana_produksi_h1 (
  id VARCHAR(64) PRIMARY KEY,
  nomor_rencana VARCHAR(64) NOT NULL UNIQUE,
  tanggal_pelayanan DATE NOT NULL,
  sesi_makan VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  total_estimasi_porsi INT NOT NULL DEFAULT 0,
  catatan TEXT NULL,
  penanggung_jawab_id VARCHAR(64) NOT NULL,
  penanggung_jawab_nama VARCHAR(128) NOT NULL,
  waktu_dibuat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  waktu_disetujui TIMESTAMP NULL,
  versi INT NOT NULL DEFAULT 1,
  INDEX idx_rencana_tgl_sesi (tanggal_pelayanan, sesi_makan),
  INDEX idx_rencana_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 2: Batch Memasak Produksi Dapur
CREATE TABLE IF NOT EXISTS batch_produksi_dapur (
  id VARCHAR(64) PRIMARY KEY,
  nomor_batch VARCHAR(64) NOT NULL UNIQUE,
  rencana_produksi_id VARCHAR(64) NOT NULL,
  resep_id VARCHAR(64) NOT NULL,
  nama_masakan VARCHAR(128) NOT NULL,
  sesi_makan VARCHAR(32) NOT NULL,
  jumlah_porsi_target INT NOT NULL,
  jumlah_porsi_realisasi INT NOT NULL DEFAULT 0,
  suhu_masak_ccp_celsius DECIMAL(5,2) NULL,
  waktu_mulai_masak TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  waktu_selesai_masak TIMESTAMP NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'persiapan',
  catatan_koki TEXT NULL,
  chef_penanggung_jawab VARCHAR(128) NOT NULL,
  waktu_dibuat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  versi INT NOT NULL DEFAULT 1,
  INDEX idx_batch_rencana (rencana_produksi_id),
  INDEX idx_batch_status (status),
  INDEX idx_batch_sesi (sesi_makan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 3: Ketertelusuran Penggunaan Lot Bahan Gudang dalam Batch Masak (AB-018)
CREATE TABLE IF NOT EXISTS penggunaan_lot_bahan_batch (
  id VARCHAR(64) PRIMARY KEY,
  batch_produksi_id VARCHAR(64) NOT NULL,
  bahan_id VARCHAR(64) NOT NULL,
  nama_bahan VARCHAR(128) NOT NULL,
  nomor_lot VARCHAR(64) NOT NULL,
  jumlah_digunakan DECIMAL(10,2) NOT NULL,
  satuan VARCHAR(32) NOT NULL,
  waktu_pencatatan TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lot_batch (batch_produksi_id),
  INDEX idx_lot_nomor (nomor_lot),
  INDEX idx_lot_bahan (bahan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 4: Pemeriksaan Mutu Akhir & Uji Organoleptik/Suhu Sebelum Distribusi (AB-019, AB-022)
CREATE TABLE IF NOT EXISTS pemeriksaan_mutu_produksi (
  id VARCHAR(64) PRIMARY KEY,
  batch_produksi_id VARCHAR(64) NOT NULL,
  suhu_saji_celsius DECIMAL(5,2) NOT NULL,
  uji_tekstur VARCHAR(32) NOT NULL,
  uji_aroma VARCHAR(32) NOT NULL,
  uji_rasa VARCHAR(32) NOT NULL,
  uji_tampilan_visual VARCHAR(32) NOT NULL,
  status_mutu VARCHAR(32) NOT NULL,
  catatan_pemeriksaan TEXT NOT NULL,
  pemeriksa_id VARCHAR(64) NOT NULL,
  pemeriksa_nama VARCHAR(128) NOT NULL,
  waktu_pemeriksaan TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qc_batch (batch_produksi_id),
  INDEX idx_qc_status (status_mutu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 5: Label Porsi Makanan Pasien & Penahanan Pesanan Terdampak Perubahan Klinis (BRD 8.5, AB-010, AB-013)
CREATE TABLE IF NOT EXISTS label_porsi_makanan (
  id VARCHAR(64) PRIMARY KEY,
  nomor_label VARCHAR(64) NOT NULL UNIQUE,
  nomor_pesanan VARCHAR(64) NOT NULL,
  batch_produksi_id VARCHAR(64) NULL,
  nomor_batch VARCHAR(64) NULL,
  pasien_id VARCHAR(64) NOT NULL,
  nama_pasien VARCHAR(128) NOT NULL,
  nomor_rm VARCHAR(32) NOT NULL,
  bangsal_kamar_bed VARCHAR(128) NOT NULL,
  tanggal_pelayanan DATE NOT NULL,
  sesi_makan VARCHAR(32) NOT NULL,
  nama_menu VARCHAR(128) NOT NULL,
  bentuk_makanan VARCHAR(64) NOT NULL,
  jenis_diet VARCHAR(128) NOT NULL,
  informasi_alergen TEXT NOT NULL,
  suhu_kemasan_celsius DECIMAL(5,2) NULL,
  status_porsi VARCHAR(32) NOT NULL DEFAULT 'terencana',
  alasan_penahanan TEXT NULL,
  waktu_cetak_label TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  petugas_label_nama VARCHAR(128) NOT NULL,
  versi INT NOT NULL DEFAULT 1,
  INDEX idx_label_pasien (pasien_id),
  INDEX idx_label_pesanan (nomor_pesanan),
  INDEX idx_label_status (status_porsi),
  INDEX idx_label_batch (batch_produksi_id),
  INDEX idx_label_tgl_sesi (tanggal_pelayanan, sesi_makan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

