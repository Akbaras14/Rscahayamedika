# Serah terima aplikasi lokal

## Runtime

UI/API berada pada 127.0.0.1:3100, dengan gateway dalam proses yang sama. MySQL khusus komputer pengembangan berada pada 127.0.0.1:3310. Kredensial dan datadir lokal diabaikan Git. Tidak ada konfigurasi deployment atau ketergantungan cloud untuk menjalankan aplikasi.

## Pemetaan BRD

| Bagian BRD | Implementasi |
|---|---|
| III, AB-032 | Peran/izin, sesi HttpOnly, navigasi per peran, pemeriksaan server |
| IV, AB-001-004 | Pendaftaran, verifikasi, dokter, pengajuan, episode dan penempatan |
| V, AB-005-011 | Instruksi berversi, NPO, alergi, keamanan perawat, skrining, ADIME, resep dan menu |
| VI, AB-012-014 | Rencana H-1/mendadak, kalkulasi resep/porsi dan permintaan bahan |
| VII, AB-015-018 | Katalog, lot, mutu, FEFO, alokasi/pengeluaran, opname dan pembuangan |
| VIII, AB-019 | Batch, penggunaan lot, QC, kemasan dan penelusuran lot ke porsi |
| IX, AB-020-022 | Distribusi, troli, identitas, diet/episode terkini dan penahanan |
| X, AB-023-025 | Konsumsi terpisah dari penyerahan, observasi, laporan empat tahap |
| XI, AB-026-028 | Evaluasi ahli gizi, rekomendasi dokter dan tindak lanjut |
| XII, AB-029-031 | Insiden, tindakan koreksi, revisi diet, perpindahan dan pemulangan |
| XIII-XVI, AB-034-035 | Status, riwayat, audit, daftar kerja, penyaringan dan cetak |
| XVIII, AB-033 | Formulir sementara dan rekonsiliasi gangguan |

Aturan sistem tidak menggantikan penilaian tenaga berwenang. BRD versi 4.0 telah disetujui rumah sakit sesuai konfirmasi pemilik proyek. Data sintetis awal tetap dibedakan dari data pelayanan; master operasional dikelola oleh peran yang berwenang.

## Konsistensi

- Gudang memakai transaksi MySQL dan penguncian untuk perubahan stok.
- Admisi, perpindahan dan pemulangan memakai transaksi. Indeks unik mencegah dua penempatan aktif pada satu tempat tidur dan dua episode aktif pasien yang sama.
- Rawat inap membaca pengajuan dokter dari sumber skema klinis yang sama.
- Menu sah menghasilkan label pesanan individual; pemrosesan ulang menu yang sama tidak membuat label ganda.
- Distribusi memeriksa instruksi, alergi, episode aktif, lokasi dan QC sebelum penyerahan.
- Laporan konsumsi memakai nilai gizi snapshot porsi pada rencana individual.
- Kegagalan MySQL menjadi galat layanan; gudang tidak beralih ke data sementara di memori.
- Migrasi dan seed mempertahankan rekaman operasional yang sudah ada. Buat cadangan MySQL sebelum mengganti komputer atau memindahkan datadir.

## Ketika aplikasi tidak tersedia

1. Catat waktu gangguan dan laporkan kepada kepala instalasi.
2. Gunakan formulir sementara yang disahkan rumah sakit dengan nomor unik.
3. Verifikasi identitas, alergi, instruksi terbaru dan status perawatan dari sumber yang dapat dipertanggungjawabkan.
4. Catat pesanan, bahan, produksi, penyerahan dan konsumsi beserta pelaksana dan waktunya.
5. Setelah pulih, cocokkan formulir dengan aplikasi; periksa duplikasi dan selisih sebelum memasukkan data.
6. Kepala instalasi mengisi rekonsiliasi gangguan, menyelesaikan selisih dan mengesahkan hasilnya.

## Lingkup bukti pemeriksaan

Sebanyak 92 tes otomatis lulus, mencakup modul peran, aturan keselamatan dan alur lintas unit dari pesanan awal sampai konsumsi. Alur lengkap juga dijalankan pada MySQL lokal, termasuk perubahan NPO setelah produksi. Simulasi 500 pesanan memeriksa kalkulasi bahan; hasil tersebut bukan uji beban 500 pengguna bersamaan. Persetujuan BRD telah dikonfirmasi pemilik proyek.
