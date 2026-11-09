-- ============================================================================
-- MIGRASI 002: TAHAP 1 ADMINISTRATOR (RIWAYAT VERSI KONFIGURASI & INDEKS AUDIT)
-- Layanan pemilik: identity-service
-- Mesin: InnoDB, Karakter: utf8mb4_0900_ai_ci
-- Aturan Bisnis: AB-030 (Koreksi mempertahankan riwayat), AB-032, AB-034
-- ============================================================================

CREATE TABLE IF NOT EXISTS riwayat_konfigurasi_operasional (
  id VARCHAR(64) NOT NULL,
  kunci_konfigurasi VARCHAR(96) NOT NULL,
  nilai_sebelum VARCHAR(512) NOT NULL,
  nilai_sesudah VARCHAR(512) NOT NULL,
  versi_sebelum INT NOT NULL,
  versi_sesudah INT NOT NULL,
  alasan_perubahan VARCHAR(500) NOT NULL,
  diubah_oleh VARCHAR(64) NOT NULL,
  diubah_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  correlation_id VARCHAR(96) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_riwayat_konfig_kunci_waktu (kunci_konfigurasi, diubah_pada),
  CONSTRAINT fk_riwayat_konfig_kunci FOREIGN KEY (kunci_konfigurasi) REFERENCES konfigurasi_operasional (kunci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

