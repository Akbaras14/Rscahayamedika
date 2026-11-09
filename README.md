# HPNMS - Manajemen Asupan Gizi Pasien Rumah Sakit

Aplikasi lokal berdasarkan [BRD versi 4.0](agent/brd.md), dengan ruang kerja untuk 10 peran. UI dan API berjalan dalam satu proses Next.js; data tersimpan di tujuh skema database MySQL/MariaDB.

## Menjalankan di komputer ini

Kebutuhan: Node.js 22+ dan layanan database MySQL/MariaDB lokal. Pemeriksaan koneksi tidak membatasi nomor versi server.

Konfigurasi komputer ini tersimpan di .env, menggunakan layanan database yang sudah tersedia pada 127.0.0.1:3307. Kata sandi akun aplikasi ada pada **HPNMS_SEED_PASSWORD**. Berkas .env dan data .local diabaikan Git.

Pastikan layanan database port 3307 aktif, lalu jalankan:

    npm run db:check
    npm run db:migrate
    npm run dev

Buka **http://127.0.0.1:3100**. Server hanya mendengarkan alamat loopback komputer lokal.

Untuk menjalankan hasil build secara lokal:

    npm run build
    npm start

## Menyiapkan di komputer lain

1. Jalankan npm install.
2. Salin .env.example menjadi .env.
3. Isi koneksi database lokal, rahasia sesi acak minimal 32 karakter, dan HPNMS_SEED_PASSWORD unik untuk membuat akun serta data sintetis awal.
4. Akun database perlu hak membuat dan memigrasikan tujuh skema yang tercantum di .env.
5. Jalankan npm run db:check, npm run db:migrate, lalu npm run dev.

Database port 3307 dikelola melalui layanan database yang sudah terpasang di komputer. Perintah local:database hanya opsional untuk instance MySQL terpisah dengan datadir yang sudah diinisialisasi; konfigurasi tersebut tidak dipakai pada komputer ini.

## Akun dan ruang kerja

Semua akun awal memakai kata sandi lokal dari HPNMS_SEED_PASSWORD. Kolom login tidak diisi otomatis.

| Peran | Nama pengguna | Ruang kerja |
|---|---|---|
| Administrator | admin.fondasi | Pengguna, penugasan, konfigurasi, audit teknis |
| Pendaftaran | petugas.pendaftaran | Identitas, duplikasi, kunjungan, antrean |
| Dokter | dokter.melati | Pemeriksaan, diet sah, revisi, pengajuan rawat inap |
| Rawat inap | petugas.rawatinap | Penerimaan, tempat tidur, perpindahan, pemulangan |
| Perawat | perawat.anggrek / perawat.melati | Keamanan, skrining, pesanan awal, konsumsi |
| Ahli gizi | dietisien.klinis | ADIME, target, resep, menu individual, evaluasi |
| Gudang | petugas.gudang | Master bahan, penerimaan, mutu, alokasi, pengeluaran, opname |
| Dapur | petugas.dapur | Rencana H-1/mendadak, kebutuhan bahan, batch, QC, label, penelusuran lot |
| Distribusi | petugas.distribusi | Troli, dua identitas, diet terkini, penyerahan, insiden |
| Kepala instalasi | kepala.gizi | Insiden, tindakan, mutu, rekonsiliasi gangguan |

Login langsung membuka ruang kerja peran. Administrator tidak memperoleh kewenangan tindakan klinis. Penugasan bangsal dikelola melalui akun administrator.

## URL operasional

| Peran | URL |
|---|---|
| Administrator | `/administrator` |
| Konfigurasi dan audit | `/administrator/audit` |
| Pendaftaran | `/pendaftaran` |
| Dokter | `/dokter` |
| Rawat inap | `/rawat-inap` |
| Perawat | `/perawat` |
| Ahli gizi | `/ahli-gizi` |
| Gudang | `/gudang` |
| Dapur | `/dapur` |
| Distribusi | `/distribusi` |
| Kepala instalasi gizi | `/kepala-instalasi` |

Dashboard tersedia di `/portal`. Rute pengembangan lama telah dihapus; migrasi database memperbarui tautan notifikasi tersimpan ke URL operasional.

## Alur operasional

1. Daftarkan pasien dan buat kunjungan; dokter menyimpan pemeriksaan serta instruksi diet.
2. Proses pengajuan dan penempatan rawat inap. Perawat memverifikasi keamanan dan melakukan skrining.
3. Pesanan diet awal yang sesuai dapat diproses sebelum ADIME lengkap. Ahli gizi menyusun target dan mengesahkan menu individual.
4. Dapur membuat dan mengesahkan rencana, lalu mengajukan bahan dari perhitungan resep. Gudang mengalokasikan dan mengeluarkan lot. Pembuatan rencana tidak mengurangi stok.
5. Dapur memilih resep dan seluruh lot yang dikeluarkan, mencatat produksi, suhu, pemeriksaan akhir, serta kemasan.
6. Distribusi memverifikasi dua identitas dan diet terkini sebelum penyerahan. Perawat kemudian mencatat konsumsi.
7. Panel **Perbandingan empat tahap pemenuhan gizi** membandingkan target, rencana, sajian dan konsumsi. Data belum tercatat dibedakan dari konsumsi nol.
8. Insiden diteruskan ke kepala instalasi untuk investigasi dan tindak lanjut. Tombol **Cetak** mencetak laporan halaman aktif.

Seluruh data awal sintetis. Master resep contoh perlu ditinjau; bahan baru dimulai dengan stok nol. Pengembalian bahan dicatat melalui penerimaan lot kembali dengan asal dan alasan pada catatan pemeriksaan, kemudian diperiksa kelayakannya.

## Pemeriksaan

    npm test
    npm run typecheck
    npm run lint
    npm run build

Pemetaan implementasi dan prosedur gangguan ada di [dokumen lokal](docs/LOCAL_HANDOVER.md).

BRD versi 4.0 telah disetujui rumah sakit sesuai konfirmasi pemilik proyek. Aplikasi final dijalankan secara lokal, dengan kewenangan setiap peran mengikuti BRD dan prosedur rumah sakit.
