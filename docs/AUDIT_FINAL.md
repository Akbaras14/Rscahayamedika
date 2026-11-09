# Audit final aplikasi lokal

Tanggal: 9 November 2026. Acuan: [BRD versi 4.0](../agent/brd.md), yang telah disetujui rumah sakit berdasarkan konfirmasi pemilik proyek.

## Kesimpulan

**Saat audit dimulai, proyek belum final secara teknis.** Ditemukan celah autentikasi, kemungkinan data sementara ketika database gagal, aturan keselamatan yang dapat dilewati, penyerahan ganda, dan alur tindakan koreksi yang belum lengkap. Temuan tersebut telah diperbaiki serta diuji ulang.

**Hasil setelah perbaikan: versi final untuk penggunaan lokal dalam lingkup pemeriksaan di bawah.** UI/API memakai hasil `npm run build` melalui `npm start` pada loopback 127.0.0.1:3100. Data operasional memakai database MySQL/MariaDB yang tersedia di port 3307. Tidak ada penyiapan hosting. Persetujuan BRD tidak diubah oleh audit ini.

## Temuan terverifikasi dan penyelesaian

| Prioritas | Temuan awal dan dampak | Perbaikan dan bukti |
|---|---|---|
| Kritis | Kata sandi tetap dapat melewati hash akun sintetis yang sudah diganti. | Login selalu memverifikasi hash tersimpan. Tes membuktikan kata sandi lama ditolak dan kata sandi baru diterima. |
| Tinggi | Gateway dapat beralih ke data memori saat database gagal pada mode pengembangan. Perubahan bisa tampak berhasil lalu hilang. | Hapus fallback. Gangguan database menghasilkan kegagalan layanan, dan inisialisasi dapat dicoba kembali. Tes regresi mencakup kedua keadaan. |
| Tinggi | Mutasi dapur/distribusi terdiri atas beberapa penulisan tanpa transaksi dan serialisasi lintas instance. | Transaksi SQL dan kunci per domain; antrean untuk repository pengujian. Rollback diuji pada MariaDB. Dua instance layanan hanya menghasilkan satu penyerahan dan satu riwayat. |
| Tinggi | QC dapat lolos sebelum memasak, realisasi melebihi target, lot berulang, serta suhu kemasan diisi angka contoh. | Validasi tahap memasak, suhu, realisasi dan lot. Suhu yang tidak diukur disimpan kosong. Batch lolos QC tidak dapat ditimpa pengukuran memasaknya. |
| Tinggi | Porsi batal masih dapat diserahkan; porsi siap dapat dipindahkan ke batch lain. | Batasi status serah dan batch; pengulangan pengemasan tetap idempoten. Tes regresi mencakup pembatalan dan perubahan batch. |
| Tinggi | Instruksi diet di luar masa berlaku dan batch berulang dapat menambah produksi yang tidak sah. | Periksa awal/akhir masa berlaku dan akumulasi target batch pada resep, tanggal serta sesi yang sama. Tes menolak diet mendatang/kedaluwarsa dan produksi berlebih. |
| Tinggi | Insiden dapat ditutup ketika tindakan koreksi belum selesai; belum ada UI verifikasi bukti. | API dan dialog kepala instalasi memverifikasi bukti, pencatat serta waktu penyelesaian. Penutupan wajib menunggu semua tindakan selesai efektif. Tes hak akses, bukti, status akhir dan pemeriksaan browser lulus. |
| Sedang | Permintaan lintas origin terlalu terbuka dan log galat dapat memuat pesan teknis/SQL. | Batasi origin lokal/sama; tolak mutasi origin asing. Log memakai jenis galat dan korelasi, tanpa pesan SQL mentah. Tes origin lulus. |
| Sedang | Pemuatan 500 episode menjalankan terlalu banyak kueri bersamaan hingga antrean koneksi penuh; laporan beberapa role gagal. | Batasi konkurensi pemuatan episode. Tes 500 episode dan pemeriksaan ulang seluruh role tidak menghasilkan galat API. |
| Sedang | Tabel perawat, ahli gizi dan katalog gudang memakai paginasi semu; semua baris dirender sekaligus. | Tampilkan 10 baris per halaman, aktifkan tombol halaman dan reset pencarian/filter. Uji browser memeriksa perpindahan halaman dan hasil kosong. |
| Sedang | Tanggal penerimaan, menu, kebutuhan bahan dan kedaluwarsa memakai nilai contoh tetap. | Tanggal penerimaan/menu diisi saat formulir dibuka; kebutuhan dan kedaluwarsa diisi pengguna. Uji browser memeriksa nilai dan tanggal yang dikirim ke API. |
| Sedang | Enam perintah server domain menjalankan repository memori dan berisiko dipakai untuk operasional. | Hapus entrypoint/perintah tersebut. Runtime lokal terintegrasi tetap memakai SQL; repository memori hanya untuk factory/pengujian. |
| Sedang | Pohon dependensi mengandung kerentanan dari CLI yang tidak dipakai dan minimatch. | Hapus shadcn CLI, CSS khusus yang tidak dipakai, serta paket ikon tidak terpakai. Perbarui resolusi minimatch. Hasil `npm audit`: 0 kerentanan. |
| Rendah | Dialog penyelesaian insiden tidak mengurung fokus keyboard; tombol kartu terpotong pada ponsel. | Gunakan Radix Dialog yang sudah terpasang, label terkait, pengembalian fokus, Escape dan pembungkusan tombol. Pemeriksaan keyboard dan ponsel lulus. |

## Cakupan BRD dan role

Pemetaan seluruh kelompok aturan AB-001 sampai AB-035 tersedia pada [serah terima lokal](LOCAL_HANDOVER.md). Audit meninjau jalur yang berisiko pada identitas, kewenangan, instruksi klinis, keamanan makanan, stok, produksi, penyerahan, konsumsi, insiden, audit dan gangguan layanan. Audit bukan pembacaan manual setiap baris kode.

| Role | URL utama | Pemeriksaan browser |
|---|---|---|
| Administrator | `/administrator` | Login, pengalihan sesuai role, pemuatan desktop/ponsel |
| Petugas pendaftaran | `/pendaftaran` | Sama |
| Dokter | `/dokter` | Sama |
| Petugas rawat inap | `/rawat-inap` | Sama |
| Perawat | `/perawat` | Sama, ditambah paginasi |
| Ahli gizi | `/ahli-gizi` | Sama, ditambah paginasi |
| Petugas gudang | `/gudang` | Sama, ditambah paginasi dan tanggal formulir |
| Petugas dapur | `/dapur` | Login, pengalihan sesuai role, pemuatan desktop/ponsel |
| Petugas distribusi | `/distribusi` | Sama |
| Kepala instalasi gizi | `/kepala-instalasi` | Sama, ditambah verifikasi tindakan dan penutupan insiden |

Halaman pengembangan `tahap-*` sudah tidak menjadi halaman aplikasi. URL utama menggunakan role. Akun sintetis tetap diberi penanda sebagai data contoh; penanda ini tidak dihapus karena diperlukan agar tidak disalahartikan sebagai data pelayanan.

## Bukti pemeriksaan

- `npm test`: **103 tes lulus**, 0 gagal; mencakup 11 suite dan tes regresi tambahan. Tes awal membuktikan bug sebelum perbaikan.
- `npm run lint` dan `npm run build`: berhasil.
- `npm audit`: **0 kerentanan** pada pohon dependensi yang terpasang saat audit.
- MariaDB port 3307: alur instruksi/pesanan awal, permintaan serta pengeluaran bahan, batch, CCP, QC, kemasan, verifikasi dua identitas, penyerahan, observasi konsumsi, penahanan NPO dan penyelesaian insiden berhasil.
- Rollback dapur/distribusi serta konflik penyerahan dari dua instance layanan diperiksa langsung pada SQL.
- Dataset terpisah berisi **500 pasien/pesanan**: kalkulasi menghasilkan 50 kg beras dalam **1.426 ms**, tanpa mengubah stok fisik. Angka ini satu pengukuran lokal, bukan jaminan latensi.
- Sepuluh role diperiksa pada desktop 1440×1000 dan ponsel 390×844: tidak ada galat JavaScript/API atau overflow dokumen. Panel rincian ikut dibuka pada pemeriksaan ponsel. Tabel lebar tetap dapat digulir di dalam panel.
- Dialog tindakan koreksi diperiksa sampai penutupan tersimpan di database: bukti wajib, tombol penutupan terkunci sebelum verifikasi, fokus keyboard, Escape dan pengembalian fokus.
- Sebelas akun aktif pada database proyek mempunyai hash yang sesuai konfigurasi seed lokal. Tidak ada penggantian kata sandi selama audit.

Pemeriksaan mutasi menggunakan tujuh skema audit tersendiri dengan awalan `hpnms_audit_20261109_`, terpisah dari skema operasional. Kredensial, log teknis dan tangkapan layar berada di `.local` yang diabaikan Git. Kredensial tidak dicantumkan pada laporan atau `.env.example`. Setelah pemeriksaan, tujuh skema audit beserta hak akses sementaranya dihapus. Server aplikasi dihentikan; database port 3307 yang sudah aktif tetap tersedia, dan koneksi skema proyek diperiksa kembali.

## Menjalankan versi final

Ikuti [README](../README.md). Gunakan database port 3307 dan satu proses `npm start` setelah build. `npm run dev` adalah mode penyuntingan dengan Fast Refresh sehingga perubahan berkas dapat memuat ulang browser. Migrasi/seed menjaga data yang sudah ada; tetap simpan cadangan sebelum pemindahan komputer atau database.

## Batas kesimpulan

Tidak dilakukan uji 500 pengguna serentak, observasi pelayanan nyata, uji pemadaman listrik, audit seluruh jaringan komputer rumah sakit, atau penilaian klinis oleh tenaga kesehatan. Pemeriksaan teknis ini tidak menyatakan bahwa kegiatan tersebut sudah dilakukan. Penerapan pada pelayanan mengikuti SOP dan kewenangan rumah sakit; BRD tetap berstatus disetujui.
