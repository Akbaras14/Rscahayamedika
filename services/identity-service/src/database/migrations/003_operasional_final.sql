-- Memperbarui pemberitahuan teknis lama tanpa mengubah status baca atau data pelayanan.
UPDATE notifikasi_pengguna SET judul = 'Akses administrator tersedia', ringkasan = 'Kelola pengguna, penugasan bangsal, konfigurasi operasional, dan jejak audit sesuai kewenangan administrator.', tautan_tujuan = '/administrator' WHERE id = 'notif-fondasi-001';
UPDATE notifikasi_pengguna SET judul = 'Seluruh modul peran tersedia', ringkasan = 'Sepuluh modul operasional tersedia sesuai izin dan penugasan masing-masing pengguna.', tautan_tujuan = '/portal' WHERE id = 'notif-fondasi-002';
UPDATE notifikasi_pengguna SET ringkasan = 'Akses pelayanan Anda dibatasi pada BANGSAL-ANGGREK sesuai penugasan.', tautan_tujuan = '/perawat' WHERE id = 'notif-fondasi-003';
