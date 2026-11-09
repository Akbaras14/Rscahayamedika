-- =============================================================================
-- Migrasi SQL Tahap 7 — Peran Petugas Gudang (Manajemen Inventaris, Stok Mutu, FIFO/FEFO)
-- Berkas: 001_tahap_7_inventory.sql
-- Acuan: BRD Bab VII, Bab XVII (AB-014, AB-015, AB-016, AB-017, AB-018)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `katalog_bahan_baku` (
  `id` VARCHAR(64) NOT NULL,
  `kode_bahan` VARCHAR(32) NOT NULL,
  `nama_bahan` VARCHAR(128) NOT NULL,
  `kategori` VARCHAR(32) NOT NULL,
  `satuan` VARCHAR(16) NOT NULL,
  `suhu_penyimpanan` VARCHAR(32) NOT NULL,
  `stok_minimum` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `stok_fisik` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `stok_layak` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `stok_dialokasikan` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `stok_ditahan` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `daftar_alergen_json` JSON NOT NULL,
  `kalori_per_100g` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `protein_per_100g` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `lemak_per_100g` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `karbohidrat_per_100g` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `versi` INT NOT NULL DEFAULT 1,
  `dibuat_pada` DATETIME(3) NOT NULL,
  `diperbarui_pada` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_katalog_bahan_kode` (`kode_bahan`),
  INDEX `idx_katalog_bahan_kategori` (`kategori`),
  INDEX `idx_katalog_bahan_suhu` (`suhu_penyimpanan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `penerimaan_lot_bahan` (
  `id` VARCHAR(64) NOT NULL,
  `nomor_lot` VARCHAR(64) NOT NULL,
  `bahan_id` VARCHAR(64) NOT NULL,
  `nama_pemasok` VARCHAR(128) NOT NULL,
  `jumlah_masuk` DECIMAL(12, 2) NOT NULL,
  `sisa_stok_lot` DECIMAL(12, 2) NOT NULL,
  `satuan` VARCHAR(16) NOT NULL,
  `tanggal_penerimaan` DATE NOT NULL,
  `tanggal_kedaluwarsa` DATE NOT NULL,
  `status_mutu` VARCHAR(32) NOT NULL,
  `catatan_pemeriksaan` TEXT NOT NULL,
  `suhu_tercatat_celsius` DECIMAL(5, 2) NULL,
  `petugas_penerima_id` VARCHAR(64) NOT NULL,
  `petugas_penerima_nama` VARCHAR(128) NOT NULL,
  `status_lot` VARCHAR(32) NOT NULL DEFAULT 'aktif',
  `dibuat_pada` DATETIME(3) NOT NULL,
  `diperbarui_pada` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_penerimaan_lot_nomor` (`nomor_lot`),
  INDEX `idx_penerimaan_lot_bahan` (`bahan_id`),
  INDEX `idx_penerimaan_lot_ed` (`tanggal_kedaluwarsa`),
  INDEX `idx_penerimaan_lot_status` (`status_lot`, `status_mutu`),
  CONSTRAINT `fk_lot_katalog_bahan` FOREIGN KEY (`bahan_id`) REFERENCES `katalog_bahan_baku` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kartu_stok_mutasi` (
  `id` VARCHAR(64) NOT NULL,
  `bahan_id` VARCHAR(64) NOT NULL,
  `nomor_lot` VARCHAR(64) NULL,
  `jenis_mutasi` VARCHAR(32) NOT NULL,
  `referensi_dokumen` VARCHAR(64) NOT NULL,
  `jumlah_masuk` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `jumlah_keluar` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `saldo_akhir` DECIMAL(12, 2) NOT NULL,
  `keterangan` VARCHAR(255) NOT NULL,
  `petugas_nama` VARCHAR(128) NOT NULL,
  `waktu_pencatatan` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_kartu_stok_bahan` (`bahan_id`),
  INDEX `idx_kartu_stok_lot` (`nomor_lot`),
  INDEX `idx_kartu_stok_waktu` (`waktu_pencatatan`),
  CONSTRAINT `fk_mutasi_katalog_bahan` FOREIGN KEY (`bahan_id`) REFERENCES `katalog_bahan_baku` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permintaan_bahan_dapur` (
  `id` VARCHAR(64) NOT NULL,
  `nomor_permintaan` VARCHAR(64) NOT NULL,
  `tanggal_kebutuhan` DATE NOT NULL,
  `unit_peminta` VARCHAR(64) NOT NULL,
  `keterangan` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `alasan_penolakan` TEXT NULL,
  `rincian_item_json` JSON NOT NULL,
  `catatan_selisih` TEXT NULL,
  `waktu_permintaan` DATETIME(3) NOT NULL,
  `waktu_alokasi` DATETIME(3) NULL,
  `waktu_pengeluaran` DATETIME(3) NULL,
  `petugas_gudang_id` VARCHAR(64) NULL,
  `petugas_gudang_nama` VARCHAR(128) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permintaan_bahan_nomor` (`nomor_permintaan`),
  INDEX `idx_permintaan_bahan_status` (`status`),
  INDEX `idx_permintaan_bahan_tgl` (`tanggal_kebutuhan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `penyesuaian_stok_opname` (
  `id` VARCHAR(64) NOT NULL,
  `bahan_id` VARCHAR(64) NOT NULL,
  `stok_sistem_sebelum` DECIMAL(12, 2) NOT NULL,
  `stok_fisik_aktual` DECIMAL(12, 2) NOT NULL,
  `selisih` DECIMAL(12, 2) NOT NULL,
  `alasan_wajib` TEXT NOT NULL,
  `petugas_id` VARCHAR(64) NOT NULL,
  `petugas_nama` VARCHAR(128) NOT NULL,
  `waktu_pencatatan` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_opname_bahan` (`bahan_id`),
  INDEX `idx_opname_waktu` (`waktu_pencatatan`),
  CONSTRAINT `fk_opname_katalog_bahan` FOREIGN KEY (`bahan_id`) REFERENCES `katalog_bahan_baku` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

