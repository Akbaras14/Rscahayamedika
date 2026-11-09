"use client";

/**
 * @fileoverview Ruang kerja operasional Peran Petugas Pendaftaran (`PendaftaranWorkspace`).
 * Mengimplementasikan alur BRD Versi 4.0 Bab IV.4.1 & Bab XVII:
 * 1. Pencarian pasien berdasarkan Nomor RM, NIK, Nama Lengkap, atau Tanggal Lahir.
 * 2. Pemeriksaan kemungkinan data pasien ganda (`AB-001`) sebelum registrasi.
 * 3. Pendaftaran pasien baru dengan verifikasi sedikitnya dua pengenal (`AB-020`).
 * 4. Koreksi terbatas identitas pasien berversi (`versi`) yang menyimpan riwayat sebelum/sesudah (`AB-030`).
 * 5. Pembuatan kunjungan pemeriksaan dan pemasukan pasien ke antrean dokter (`BRD Bab IV.4.1`).
 * 6. Pembatalan kunjungan administratif dengan alasan wajib & dialog konfirmasi merah (`UI_UX.md` Bagian 8).
 *
 * Referensi desain terkurasi (UI_UX.md Bagian 1 & 2):
 * - MediCal Smart Healthcare Dashboard (https://www.behance.net/gallery/243702383/MediCal-Smart-Healthcare-Dashboard)
 * - Hospital Management Dashboard by Pixelean (https://dribbble.com/shots/26917973-Hospital-Management-Dashboard)
 * Elemen yang diadaptasi: hierarki tabel pasien dua pengenal, pemisahan jelas antara pencarian/registrasi
 * dan antrean kunjungan dokter. Pola yang tidak ditiru: kartu finansial dan dekorasi 3D.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { SemanticIcon } from "@/components/atoms/semantic-icon";
import { StatusBadge } from "@/components/atoms/status-badge";
import { FormFieldMolecule } from "@/components/molecules/form-field";
import {
  ErrorState,
  LoadingState,
  MinimalToastBanner,
  PermissionDeniedState,
  SafetyHoldBanner,
} from "@/components/molecules/state-feedback";
import { ConfirmDialog } from "@/components/organisms/confirm-dialog";
import {
  DataTableFoundation,
  type DefinisiKolomTabel,
} from "@/components/organisms/data-table-foundation";
import { AppShellTemplate } from "@/components/templates/app-shell-template";
import { Button } from "@/components/ui/button";
import { useSesiAdmin } from "@/features/admin/hooks/use-sesi-admin";
import type {
  ItemNavigasiPeran,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";
import type {
  DaftarKunjunganRespons,
  DaftarPasienRespons,
  EntitasPasien,
  EntitasRiwayatKoreksiPasien,
  GolonganDarahPasien,
  HasilCekDuplikasiPasienDto,
  ItemAntreanKunjunganDto,
  JenisKelaminPasien,
  MetodeVerifikasiDuaPengenal,
  PrioritasAntreanKunjungan,
  StatusKunjunganPasien,
  StatusVerifikasiIdentitas,
} from "../../../../services/patient-service/src/model/patient.model.ts";

const DAFTAR_METODE_VERIFIKASI: ReadonlyArray<{
  nilai: MetodeVerifikasiDuaPengenal;
  label: string;
}> = [
  {
    nilai: "nomor_rekam_medis_dan_tanggal_lahir",
    label: "Nomor Rekam Medis + Tanggal Lahir (Wajib 2 Pengenal)",
  },
  {
    nilai: "nama_lengkap_dan_tanggal_lahir",
    label: "Nama Lengkap + Tanggal Lahir (Wajib 2 Pengenal)",
  },
  {
    nilai: "nik_dan_tanggal_lahir",
    label: "NIK 16 Digit + Tanggal Lahir (Wajib 2 Pengenal)",
  },
  {
    nilai: "nomor_rekam_medis_dan_nik",
    label: "Nomor Rekam Medis + NIK 16 Digit (Wajib 2 Pengenal)",
  },
];

const KELAS_INPUT_TEKS =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function PendaftaranWorkspace() {
  const {
    profil,
    navigasi,
    sedangMemuatSesi,
    notifikasiItems,
    jumlahBelumDibaca,
    sedangMemuatNotifikasi,
    segarkanNotifikasi,
    tandaiSatuNotifikasiDibaca,
    tandaiSemuaNotifikasiDibaca,
    keluarSesi,
  } = useSesiAdmin();

  // State daftar pasien
  const [daftarPasien, setDaftarPasien] = useState<EntitasPasien[]>([]);
  const [totalPasien, setTotalPasien] = useState(0);
  const [halamanPasien, setHalamanPasien] = useState(1);
  const [kataKunciPasien, setKataKunciPasien] = useState("");
  const [filterStatusVerifikasi, setFilterStatusVerifikasi] = useState<
    StatusVerifikasiIdentitas | "SEMUA"
  >("SEMUA");
  const [sedangMemuatPasien, setSedangMemuatPasien] = useState(false);

  // State daftar kunjungan & antrean dokter
  const [daftarKunjungan, setDaftarKunjungan] = useState<
    ItemAntreanKunjunganDto[]
  >([]);
  const [totalKunjungan, setTotalKunjungan] = useState(0);
  const [halamanKunjungan, setHalamanKunjungan] = useState(1);
  const [kataKunciKunjungan, setKataKunciKunjungan] = useState("");
  const [filterStatusKunjungan, setFilterStatusKunjungan] = useState<
    StatusKunjunganPasien | "SEMUA"
  >("SEMUA");
  const [ringkasanAntrean, setRingkasanAntrean] = useState({
    menungguPemeriksaan: 0,
    mendesakMenunggu: 0,
    sedangDiperiksa: 0,
    dibatalkanHariIni: 0,
  });
  const [sedangMemuatKunjungan, setSedangMemuatKunjungan] = useState(false);

  // Umpan balik & banner keselamatan
  const [galatMemuat, setGalatMemuat] = useState<{
    pesan: string;
    kodeLaporan?: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    jenis: "berhasil" | "kesalahan";
    pesan: string;
  } | null>(null);
  const [peringatanKeselamatan, setPeringatanKeselamatan] = useState<
    string | null
  >(null);
  const [menuTerkunci, setMenuTerkunci] = useState<ItemNavigasiPeran | null>(
    null,
  );

  // State form registrasi pasien baru
  const [nikBaru, setNikBaru] = useState("");
  const [tanpaNikBaru, setTanpaNikBaru] = useState(false);
  const [alasanTanpaNikBaru, setAlasanTanpaNikBaru] = useState("");
  const [namaPasienBaru, setNamaPasienBaru] = useState("");
  const [tglLahirBaru, setTglLahirBaru] = useState("");
  const [jenisKelaminBaru, setJenisKelaminBaru] =
    useState<JenisKelaminPasien>("laki_laki");
  const [golDarahBaru, setGolDarahBaru] =
    useState<GolonganDarahPasien>("belum_diketahui");
  const [alamatBaru, setAlamatBaru] = useState("");
  const [teleponDaruratBaru, setTeleponDaruratBaru] = useState("");
  const [namaKontakBaru, setNamaKontakBaru] = useState("");
  const [hubunganKontakBaru, setHubunganKontakBaru] = useState("Pasangan");
  const [metodeVerifikasiBaru, setMetodeVerifikasiBaru] =
    useState<MetodeVerifikasiDuaPengenal>("nik_dan_tanggal_lahir");
  const [catatanAdminBaru, setCatatanAdminBaru] = useState("");
  const [hasilCekDuplikat, setHasilCekDuplikat] =
    useState<HasilCekDuplikasiPasienDto | null>(null);
  const [konfirmasiBukanDuplikat, setKonfirmasiBukanDuplikat] = useState(false);
  const [alasanKonfirmasiDuplikat, setAlasanKonfirmasiDuplikat] = useState("");
  const [sedangCekDuplikat, setSedangCekDuplikat] = useState(false);
  const [sedangSimpanPasienBaru, setSedangSimpanPasienBaru] = useState(false);

  // State panel pasien terpilih (untuk buat kunjungan atau koreksi identitas)
  const [pasienTerpilih, setPasienTerpilih] = useState<EntitasPasien | null>(
    null,
  );
  const [modePanelPasien, setModePanelPasien] = useState<
    "kunjungan" | "koreksi"
  >("kunjungan");
  const [riwayatKoreksiPasien, setRiwayatKoreksiPasien] = useState<
    EntitasRiwayatKoreksiPasien[]
  >([]);

  // State form buat kunjungan pemeriksaan
  const [unitTujuan, setUnitTujuan] = useState("Poliklinik Penyakit Dalam");
  const [dokterTujuanId, setDokterTujuanId] = useState("");
  const [dokterTujuanNama, setDokterTujuanNama] = useState("");
  const [keluhanAdministratif, setKeluhanAdministratif] = useState("");
  const [prioritasAntrean, setPrioritasAntrean] =
    useState<PrioritasAntreanKunjungan>("reguler");
  const [metodeVerifikasiKunjungan, setMetodeVerifikasiKunjungan] =
    useState<MetodeVerifikasiDuaPengenal>(
      "nomor_rekam_medis_dan_tanggal_lahir",
    );
  const [verifikasiTanggalLahirInput, setVerifikasiTanggalLahirInput] =
    useState("");
  const [sedangSimpanKunjungan, setSedangSimpanKunjungan] = useState(false);

  // State form koreksi identitas pasien (`AB-030`)
  const [koreksiNik, setKoreksiNik] = useState("");
  const [koreksiAlasanTanpaNik, setKoreksiAlasanTanpaNik] = useState("");
  const [koreksiNama, setKoreksiNama] = useState("");
  const [koreksiTglLahir, setKoreksiTglLahir] = useState("");
  const [koreksiJenisKelamin, setKoreksiJenisKelamin] =
    useState<JenisKelaminPasien>("laki_laki");
  const [koreksiGolDarah, setKoreksiGolDarah] =
    useState<GolonganDarahPasien>("belum_diketahui");
  const [koreksiAlamat, setKoreksiAlamat] = useState("");
  const [koreksiTelepon, setKoreksiTelepon] = useState("");
  const [koreksiNamaKontak, setKoreksiNamaKontak] = useState("");
  const [koreksiHubunganKontak, setKoreksiHubunganKontak] = useState("");
  const [koreksiStatusVerifikasi, setKoreksiStatusVerifikasi] =
    useState<StatusVerifikasiIdentitas>("terverifikasi_dua_pengenal");
  const [koreksiCatatanAdmin, setKoreksiCatatanAdmin] = useState("");
  const [koreksiMetodeVerifikasi, setKoreksiMetodeVerifikasi] =
    useState<MetodeVerifikasiDuaPengenal>(
      "nomor_rekam_medis_dan_tanggal_lahir",
    );
  const [koreksiAlasan, setKoreksiAlasan] = useState("");
  const [sedangSimpanKoreksi, setSedangSimpanKoreksi] = useState(false);

  // State dialog pembatalan kunjungan (merah destruktif)
  const [kunjunganAkanDibatalkan, setKunjunganAkanDibatalkan] =
    useState<ItemAntreanKunjunganDto | null>(null);
  const [alasanBatalKunjungan, setAlasanBatalKunjungan] = useState(
    "Pasien meminta penjadwalan ulang sebelum pemeriksaan dokter dimulai",
  );
  const [sedangMemprosesBatal, setSedangMemprosesBatal] = useState(false);

  const ukuranHalaman = 6;
  const punyaIzinBaca =
    profil?.daftarIzin.includes("pendaftaran:pasien:baca") ?? false;
  const punyaIzinBuat =
    profil?.daftarIzin.includes("pendaftaran:pasien:buat") ?? false;
  const punyaIzinKoreksi =
    profil?.daftarIzin.includes("pendaftaran:pasien:koreksi") ?? false;

  async function muatDataLoket(
    hlmPasien = halamanPasien,
    cariPasien = kataKunciPasien,
    statusVerif = filterStatusVerifikasi,
    hlmKunjungan = halamanKunjungan,
    cariKunjungan = kataKunciKunjungan,
    statusKnj = filterStatusKunjungan,
  ): Promise<void> {
    setSedangMemuatPasien(true);
    setSedangMemuatKunjungan(true);
    setGalatMemuat(null);
    try {
      const qsPasien = new URLSearchParams({
        halaman: String(hlmPasien),
        ukuranHalaman: String(ukuranHalaman),
      });
      if (cariPasien.trim()) {
        qsPasien.set("kataKunci", cariPasien.trim());
      }
      if (statusVerif !== "SEMUA") {
        qsPasien.set("statusVerifikasi", statusVerif);
      }

      const qsKunjungan = new URLSearchParams({
        halaman: String(hlmKunjungan),
        ukuranHalaman: String(ukuranHalaman),
      });
      if (cariKunjungan.trim()) {
        qsKunjungan.set("kataKunci", cariKunjungan.trim());
      }
      if (statusKnj !== "SEMUA") {
        qsKunjungan.set("statusKunjungan", statusKnj);
      }

      const [resPasien, resKunjungan] = await Promise.all([
        fetch(`/api/v1/patients?${qsPasien.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/v1/patients/visits?${qsKunjungan.toString()}`, {
          cache: "no-store",
        }),
      ]);

      const jsonPasien =
        (await resPasien.json()) as ResponsApi<DaftarPasienRespons>;
      const jsonKunjungan =
        (await resKunjungan.json()) as ResponsApi<DaftarKunjunganRespons>;

      if (!jsonPasien.sukses) {
        setGalatMemuat({
          pesan: jsonPasien.galat.pesan,
          kodeLaporan: jsonPasien.galat.kodeLaporan,
        });
        return;
      }

      setDaftarPasien(jsonPasien.data.items);
      setTotalPasien(jsonPasien.data.totalItem);

      if (jsonKunjungan.sukses) {
        setDaftarKunjungan(jsonKunjungan.data.items);
        setTotalKunjungan(jsonKunjungan.data.totalItem);
        setRingkasanAntrean(jsonKunjungan.data.ringkasanAntrean);
      }
    } catch {
      setGalatMemuat({
        pesan: "Koneksi terputus. Periksa jaringan dan coba kembali.",
      });
    } finally {
      setSedangMemuatPasien(false);
      setSedangMemuatKunjungan(false);
    }
  }

  useEffect(() => {
    if (!profil || !punyaIzinBaca) {
      return;
    }
    let aktif = true;
    async function muatOtomatis() {
      const qsPasien = new URLSearchParams({
        halaman: String(halamanPasien),
        ukuranHalaman: String(ukuranHalaman),
      });
      if (kataKunciPasien.trim()) {
        qsPasien.set("kataKunci", kataKunciPasien.trim());
      }
      if (filterStatusVerifikasi !== "SEMUA") {
        qsPasien.set("statusVerifikasi", filterStatusVerifikasi);
      }

      const qsKunjungan = new URLSearchParams({
        halaman: String(halamanKunjungan),
        ukuranHalaman: String(ukuranHalaman),
      });
      if (kataKunciKunjungan.trim()) {
        qsKunjungan.set("kataKunci", kataKunciKunjungan.trim());
      }
      if (filterStatusKunjungan !== "SEMUA") {
        qsKunjungan.set("statusKunjungan", filterStatusKunjungan);
      }

      try {
        const [resPasien, resKunjungan] = await Promise.all([
          fetch(`/api/v1/patients?${qsPasien.toString()}`, {
            cache: "no-store",
          }),
          fetch(`/api/v1/patients/visits?${qsKunjungan.toString()}`, {
            cache: "no-store",
          }),
        ]);
        if (!aktif) {
          return;
        }
        const jsonPasien =
          (await resPasien.json()) as ResponsApi<DaftarPasienRespons>;
        const jsonKunjungan =
          (await resKunjungan.json()) as ResponsApi<DaftarKunjunganRespons>;

        if (jsonPasien.sukses && aktif) {
          setDaftarPasien(jsonPasien.data.items);
          setTotalPasien(jsonPasien.data.totalItem);
          setGalatMemuat(null);
        } else if (!jsonPasien.sukses && aktif) {
          setGalatMemuat({
            pesan: jsonPasien.galat.pesan,
            kodeLaporan: jsonPasien.galat.kodeLaporan,
          });
        }

        if (jsonKunjungan.sukses && aktif) {
          setDaftarKunjungan(jsonKunjungan.data.items);
          setTotalKunjungan(jsonKunjungan.data.totalItem);
          setRingkasanAntrean(jsonKunjungan.data.ringkasanAntrean);
        }
      } catch {
        if (aktif) {
          setGalatMemuat({
            pesan: "Koneksi terputus. Periksa jaringan dan coba kembali.",
          });
        }
      }
    }
    void muatOtomatis();
    return () => {
      aktif = false;
    };
  }, [
    profil,
    punyaIzinBaca,
    halamanPasien,
    kataKunciPasien,
    filterStatusVerifikasi,
    halamanKunjungan,
    kataKunciKunjungan,
    filterStatusKunjungan,
  ]);

  async function pilihPasienUntukTindakan(
    pasien: EntitasPasien,
    mode: "kunjungan" | "koreksi",
  ): Promise<void> {
    setPasienTerpilih(pasien);
    setModePanelPasien(mode);
    setPeringatanKeselamatan(null);
    setVerifikasiTanggalLahirInput("");
    setKeluhanAdministratif("");
    setKoreksiNik(pasien.nomorIdentitasNasional ?? "");
    setKoreksiAlasanTanpaNik(pasien.alasanTanpaNik ?? "");
    setKoreksiNama(pasien.namaLengkap);
    setKoreksiTglLahir(pasien.tanggalLahir);
    setKoreksiJenisKelamin(pasien.jenisKelamin);
    setKoreksiGolDarah(pasien.golonganDarah);
    setKoreksiAlamat(pasien.alamatDomisili);
    setKoreksiTelepon(pasien.teleponKontakDarurat);
    setKoreksiNamaKontak(pasien.namaKontakDarurat);
    setKoreksiHubunganKontak(pasien.hubunganKontakDarurat);
    setKoreksiStatusVerifikasi(pasien.statusVerifikasiIdentitas);
    setKoreksiCatatanAdmin(pasien.catatanAdministratif ?? "");
    setKoreksiAlasan("");

    try {
      const res = await fetch(`/api/v1/patients/${pasien.id}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ResponsApi<{
        pasien: EntitasPasien;
        riwayatKoreksi: EntitasRiwayatKoreksiPasien[];
      }>;
      if (json.sukses) {
        setPasienTerpilih(json.data.pasien);
        setRiwayatKoreksiPasien(json.data.riwayatKoreksi);
      }
    } catch {
      // Gunakan data baris jika detail tambahan gagal dimuat
    }
  }

  async function tanganiCekDuplikasi(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    setToast(null);
    if (namaPasienBaru.trim().length < 3 || !tglLahirBaru) {
      setToast({
        jenis: "kesalahan",
        pesan:
          "Isi Nama Lengkap (minimal 3 karakter) dan Tanggal Lahir terlebih dahulu untuk memeriksa kemungkinan duplikasi (AB-001).",
      });
      return;
    }

    setSedangCekDuplikat(true);
    try {
      const res = await fetch("/api/v1/patients/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomorIdentitasNasional:
            !tanpaNikBaru && nikBaru.trim() ? nikBaru.trim() : undefined,
          namaLengkap: namaPasienBaru.trim(),
          tanggalLahir: tglLahirBaru.trim(),
        }),
      });
      const json =
        (await res.json()) as ResponsApi<HasilCekDuplikasiPasienDto>;
      if (!json.sukses) {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        return;
      }
      setHasilCekDuplikat(json.data);
      if (!json.data.adaKonflikPasti && !json.data.adaPotensiDuplikat) {
        setToast({
          jenis: "berhasil",
          pesan:
            "Pemeriksaan duplikasi selesai: tidak ditemukan pasien ganda dengan identitas tersebut.",
        });
      }
    } finally {
      setSedangCekDuplikat(false);
    }
  }

  async function tanganiSimpanPasienBaru(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setToast(null);
    setPeringatanKeselamatan(null);
    setSedangSimpanPasienBaru(true);

    try {
      const res = await fetch("/api/v1/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `reg-pasien-${namaPasienBaru.trim().toLowerCase().replace(/\s+/g, "-")}-${tglLahirBaru}-${Date.now()}`,
        },
        body: JSON.stringify({
          nomorIdentitasNasional: tanpaNikBaru ? null : nikBaru.trim() || null,
          alasanTanpaNik: tanpaNikBaru ? alasanTanpaNikBaru.trim() : null,
          namaLengkap: namaPasienBaru.trim(),
          tanggalLahir: tglLahirBaru.trim(),
          jenisKelamin: jenisKelaminBaru,
          golonganDarah: golDarahBaru,
          alamatDomisili: alamatBaru.trim(),
          teleponKontakDarurat: teleponDaruratBaru.trim(),
          namaKontakDarurat: namaKontakBaru.trim(),
          hubunganKontakDarurat: hubunganKontakBaru.trim(),
          pengenalDiverifikasi: metodeVerifikasiBaru,
          catatanAdministratif: catatanAdminBaru.trim() || null,
          konfirmasiBukanDuplikat,
          alasanKonfirmasiDuplikat: konfirmasiBukanDuplikat
            ? alasanKonfirmasiDuplikat.trim()
            : undefined,
        }),
      });

      const json = (await res.json()) as ResponsApi<EntitasPasien>;
      if (!json.sukses) {
        const detail = json.galat.rincianValidasi
          ?.map((r) => `${r.field}: ${r.pesan}`)
          .join(" | ");
        setToast({
          jenis: "kesalahan",
          pesan: detail ? `${json.galat.pesan} (${detail})` : json.galat.pesan,
        });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Pasien ${json.data.namaLengkap} berhasil didaftarkan dengan Nomor RM ${json.data.nomorRekamMedis}.`,
      });
      setNikBaru("");
      setAlasanTanpaNikBaru("");
      setNamaPasienBaru("");
      setAlamatBaru("");
      setTeleponDaruratBaru("");
      setNamaKontakBaru("");
      setCatatanAdminBaru("");
      setHasilCekDuplikat(null);
      setKonfirmasiBukanDuplikat(false);
      setAlasanKonfirmasiDuplikat("");
      await muatDataLoket();
      await pilihPasienUntukTindakan(json.data, "kunjungan");
    } finally {
      setSedangSimpanPasienBaru(false);
    }
  }

  async function tanganiBuatKunjungan(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!pasienTerpilih) {
      return;
    }
    setToast(null);
    setPeringatanKeselamatan(null);
    setSedangSimpanKunjungan(true);

    if (!dokterTujuanId.trim() || !dokterTujuanNama.trim()) {
      setToast({ jenis: "kesalahan", pesan: "Pilih atau isi ID dan nama dokter tujuan yang valid." });
      setSedangSimpanKunjungan(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/patients/${pasienTerpilih.id}/visits`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": `visit-${pasienTerpilih.id}-${Date.now()}`,
          },
          body: JSON.stringify({
            unitTujuan: unitTujuan.trim(),
            dokterTujuanId: dokterTujuanId.trim(),
            dokterTujuanNama: dokterTujuanNama.trim(),
            keluhanAdministratif: keluhanAdministratif.trim(),
            prioritasAntrean,
            pengenalDiverifikasi: metodeVerifikasiKunjungan,
            verifikasiTanggalLahir: verifikasiTanggalLahirInput.trim(),
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<{
        kunjungan: ItemAntreanKunjunganDto;
      }>;
      if (!json.sukses) {
        if (json.galat.kode === "ERR_PENAHANAN_KESELAMATAN") {
          setPeringatanKeselamatan(json.galat.pesan);
        }
        const detail = json.galat.rincianValidasi
          ?.map((r) => `${r.field}: ${r.pesan}`)
          .join(" | ");
        setToast({
          jenis: "kesalahan",
          pesan: detail ? `${json.galat.pesan} (${detail})` : json.galat.pesan,
        });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Kunjungan pemeriksaan ${json.data.kunjungan.nomorKunjungan} berhasil dibuat. Nomor Antrean Dokter: ${json.data.kunjungan.kodeAntrean}.`,
      });
      setKeluhanAdministratif("");
      setVerifikasiTanggalLahirInput("");
      await muatDataLoket();
      await segarkanNotifikasi();
    } finally {
      setSedangSimpanKunjungan(false);
    }
  }

  async function tanganiSimpanKoreksiIdentitas(
    e: React.FormEvent,
  ): Promise<void> {
    e.preventDefault();
    if (!pasienTerpilih) {
      return;
    }
    setToast(null);
    setSedangSimpanKoreksi(true);

    try {
      const res = await fetch(
        `/api/v1/patients/${pasienTerpilih.id}/identity`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nomorIdentitasNasional: koreksiNik.trim() || null,
            alasanTanpaNik: koreksiNik.trim()
              ? null
              : koreksiAlasanTanpaNik.trim() || null,
            namaLengkap: koreksiNama.trim(),
            tanggalLahir: koreksiTglLahir.trim(),
            jenisKelamin: koreksiJenisKelamin,
            golonganDarah: koreksiGolDarah,
            alamatDomisili: koreksiAlamat.trim(),
            teleponKontakDarurat: koreksiTelepon.trim(),
            namaKontakDarurat: koreksiNamaKontak.trim(),
            hubunganKontakDarurat: koreksiHubunganKontak.trim(),
            statusVerifikasiIdentitas: koreksiStatusVerifikasi,
            catatanAdministratif: koreksiCatatanAdmin.trim() || null,
            pengenalDiverifikasi: koreksiMetodeVerifikasi,
            versi: pasienTerpilih.versi,
            alasanKoreksi: koreksiAlasan.trim(),
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<{
        pasien: EntitasPasien;
        riwayat: EntitasRiwayatKoreksiPasien;
      }>;
      if (!json.sukses) {
        const detail = json.galat.rincianValidasi
          ?.map((r) => `${r.field}: ${r.pesan}`)
          .join(" | ");
        setToast({
          jenis: "kesalahan",
          pesan: detail ? `${json.galat.pesan} (${detail})` : json.galat.pesan,
        });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Identitas pasien ${json.data.pasien.nomorRekamMedis} berhasil dikoreksi ke versi v${json.data.pasien.versi} dan dicatat dalam riwayat audit (AB-030).`,
      });
      await muatDataLoket();
      await pilihPasienUntukTindakan(json.data.pasien, "koreksi");
    } finally {
      setSedangSimpanKoreksi(false);
    }
  }

  async function eksekusiBatalkanKunjungan(): Promise<void> {
    if (!kunjunganAkanDibatalkan) {
      return;
    }
    setSedangMemprosesBatal(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/v1/patients/visits/${kunjunganAkanDibatalkan.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versi: kunjunganAkanDibatalkan.versi,
            alasanPembatalan: alasanBatalKunjungan.trim(),
          }),
        },
      );
      const json = (await res.json()) as ResponsApi<ItemAntreanKunjunganDto>;
      if (!json.sukses) {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        return;
      }
      setToast({
        jenis: "berhasil",
        pesan: `Kunjungan ${json.data.nomorKunjungan} (${json.data.kodeAntrean}) telah dibatalkan dan dicatat dalam riwayat.`,
      });
      setKunjunganAkanDibatalkan(null);
      await muatDataLoket();
    } finally {
      setSedangMemprosesBatal(false);
    }
  }

  const kolomPasien: readonly DefinisiKolomTabel<EntitasPasien>[] = [
    {
      id: "identitasUtama",
      header: "Dua Pengenal Pasien (AB-001 & AB-020)",
      renderSel: (item) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-900 border border-blue-200">
              {item.nomorRekamMedis}
            </span>
            <span className="font-semibold text-foreground">
              {item.namaLengkap}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Tgl Lahir:{" "}
            <strong className="text-foreground">{item.tanggalLahir}</strong> •{" "}
            {item.jenisKelamin === "laki_laki" ? "Laki-laki" : "Perempuan"} •
            Gol. Darah: {item.golonganDarah}
          </p>
        </div>
      ),
    },
    {
      id: "nikDanVerifikasi",
      header: "NIK & Status Verifikasi",
      renderSel: (item) => (
        <div className="space-y-1">
          <p className="font-mono text-xs text-foreground">
            {item.nomorIdentitasNasional ?? "Belum Ada NIK"}
          </p>
          <StatusBadge
            varian={
              item.statusVerifikasiIdentitas === "terverifikasi_dua_pengenal"
                ? "sesuai"
                : "menunggu"
            }
            label={
              item.statusVerifikasiIdentitas === "terverifikasi_dua_pengenal"
                ? "Terverifikasi 2 Pengenal"
                : "Perlu Verifikasi Ulang"
            }
          />
        </div>
      ),
    },
    {
      id: "kontakDarurat",
      header: "Kontak Darurat / Wali",
      renderSel: (item) => (
        <div className="text-xs">
          <p className="font-medium text-foreground">
            {item.namaKontakDarurat} ({item.hubunganKontakDarurat})
          </p>
          <p className="text-[11px] text-muted-foreground">
            {item.teleponKontakDarurat}
          </p>
        </div>
      ),
    },
    {
      id: "versi",
      header: "Versi",
      renderSel: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          v{item.versi}
        </span>
      ),
    },
    {
      id: "tindakan",
      header: "Tindakan Pendaftaran",
      renderSel: (item) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {punyaIzinBuat ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void pilihPasienUntukTindakan(item, "kunjungan")}
              className="min-h-8 px-2.5 text-xs bg-blue-700 text-white hover:bg-blue-800"
            >
              <SemanticIcon nama="Plus" className="mr-1 size-3.5" />
              Buat Kunjungan
            </Button>
          ) : null}
          {punyaIzinKoreksi ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void pilihPasienUntukTindakan(item, "koreksi")}
              className="min-h-8 px-2.5 text-xs"
            >
              <SemanticIcon nama="Pencil" className="mr-1 size-3.5" />
              Koreksi & Riwayat
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const kolomKunjungan: readonly DefinisiKolomTabel<ItemAntreanKunjunganDto>[] =
    [
      {
        id: "kodeAntrean",
        header: "Nomor Antrean & Kunjungan",
        renderSel: (item) => (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                {item.kodeAntrean}
              </span>
              <StatusBadge
                varian={
                  item.prioritasAntrean === "mendesak" ? "menunggu" : "netral"
                }
                label={
                  item.prioritasAntrean === "mendesak" ? "Mendesak" : "Reguler"
                }
              />
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {item.nomorKunjungan} • {item.tanggalKunjungan}
            </p>
          </div>
        ),
      },
      {
        id: "pasien",
        header: "Dua Pengenal Pasien (AB-020)",
        renderSel: (item) => (
          <div>
            <p className="font-semibold text-foreground">
              {item.pasien.namaLengkap}
            </p>
            <p className="text-[11px] text-muted-foreground">
              No. RM:{" "}
              <strong className="font-mono text-foreground">
                {item.pasien.nomorRekamMedis}
              </strong>{" "}
              • Tgl Lahir:{" "}
              <strong className="text-foreground">
                {item.pasien.tanggalLahir}
              </strong>
            </p>
          </div>
        ),
      },
      {
        id: "tujuan",
        header: "Unit & Dokter Pemeriksa",
        renderSel: (item) => (
          <div className="text-xs">
            <p className="font-medium text-foreground">{item.unitTujuan}</p>
            <p className="text-[11px] text-muted-foreground">
              {item.dokterTujuanNama}
            </p>
            <p className="mt-0.5 text-[11px] italic text-slate-600">
              Keluhan: {item.keluhanAdministratif}
            </p>
          </div>
        ),
      },
      {
        id: "statusKunjungan",
        header: "Status Antrean",
        renderSel: (item) => (
          <div className="space-y-1">
            <StatusBadge
              varian={
                item.statusKunjungan === "menunggu_pemeriksaan"
                  ? "menunggu"
                  : item.statusKunjungan === "dibatalkan"
                    ? "ditahan"
                    : "sesuai"
              }
              label={
                item.statusKunjungan === "menunggu_pemeriksaan"
                  ? "Menunggu Pemeriksaan Dokter"
                  : item.statusKunjungan === "sedang_diperiksa"
                    ? "Sedang Diperiksa"
                    : item.statusKunjungan === "selesai_pemeriksaan"
                      ? "Selesai Pemeriksaan"
                      : item.statusKunjungan === "diajukan_rawat_inap"
                        ? "Diajukan Rawat Inap"
                        : "Dibatalkan"
              }
            />
            {item.alasanPembatalan ? (
              <p className="text-[11px] text-red-800">
                Alasan batal: {item.alasanPembatalan}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "aksi",
        header: "Tindakan",
        renderSel: (item) =>
          item.statusKunjungan === "menunggu_pemeriksaan" && punyaIzinKoreksi ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setKunjunganAkanDibatalkan(item)}
              className="min-h-8 px-2.5 text-xs bg-red-700 text-white hover:bg-red-800"
            >
              <SemanticIcon nama="Ban" className="mr-1 size-3.5" />
              Batalkan Kunjungan
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Terkunci ({item.statusKunjungan})
            </span>
          ),
      },
    ];

  return (
    <AppShellTemplate
      judulHalaman="Pendaftaran Pasien, Verifikasi Identitas & Antrean Dokter"
      subjudulHalaman="Registrasi pasien, pencegahan duplikasi (AB-001), verifikasi dua pengenal (AB-020), koreksi identitas teraudit (AB-030), dan antrean kunjungan pemeriksaan."
      profil={profil}
      navigasi={navigasi}
      notifikasiItems={notifikasiItems}
      jumlahBelumDibaca={jumlahBelumDibaca}
      sedangMemuatNotifikasi={sedangMemuatNotifikasi}
      onTandaiSatuNotifikasiDibaca={tandaiSatuNotifikasiDibaca}
      onTandaiSemuaNotifikasiDibaca={tandaiSemuaNotifikasiDibaca}
      onPilihMenuTerkunci={(item) => setMenuTerkunci(item)}
      onKeluarSesi={() => void keluarSesi()}
    >
      {toast ? (
        <MinimalToastBanner
          jenis={toast.jenis}
          pesan={toast.pesan}
          onTutup={() => setToast(null)}
        />
      ) : null}

      {peringatanKeselamatan ? (
        <SafetyHoldBanner
          judul="Penahanan Keselamatan Verifikasi Identitas Pasien (AB-020)"
          alasanPenahanan={peringatanKeselamatan}
          tindakLanjutWajib="Cocokkan kembali sedikitnya dua pengenal pasien (Nomor Rekam Medis/NIK dan Tanggal Lahir) dari dokumen resmi pasien sebelum membuat kunjungan pemeriksaan."
        />
      ) : null}

      {sedangMemuatSesi ? (
        <LoadingState
          judul="Memverifikasi sesi dan izin Petugas Pendaftaran..."
          deskripsi="Memeriksa hak akses pendaftaran:pasien:baca pada sesi aktif."
        />
      ) : !profil ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <PermissionDeniedState pesan="Sesi Anda berakhir atau Anda belum masuk. Silakan masuk sebagai Petugas Pendaftaran (petugas.pendaftaran) melalui halaman login." />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <SemanticIcon nama="ArrowLeft" className="size-4" />
            Kembali ke Halaman Masuk
          </Link>
        </div>
      ) : !punyaIzinBaca ? (
        <PermissionDeniedState pesan="Anda tidak memiliki izin (pendaftaran:pasien:baca) untuk membuka ruang kerja Petugas Pendaftaran. Sesuai AB-032, Administrator teknis maupun peran tanpa hak akses pendaftaran diblokir dari halaman ini." />
      ) : (
        <div className="space-y-6">
          {/* Bar Ringkasan Tugas Operasional Loket Pendaftaran */}
          <section
            aria-label="Ringkasan operasional loket pendaftaran"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <div className="rounded-lg border border-border bg-card p-3.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Pasien Terdaftar
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {totalPasien}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Identitas unik (AB-001)
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Menunggu Pemeriksaan Dokter
              </p>
              <p className="mt-1 text-xl font-bold text-blue-800">
                {ringkasanAntrean.menungguPemeriksaan}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Antrean aktif hari ini
              </p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-3.5">
              <p className="text-[11px] font-medium text-amber-900">
                Antrean Prioritas Mendesak
              </p>
              <p className="mt-1 text-xl font-bold text-amber-900">
                {ringkasanAntrean.mendesakMenunggu}
              </p>
              <p className="text-[11px] text-amber-800">
                Didahulukan pada antrean poli
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Kunjungan Dibatalkan
              </p>
              <p className="mt-1 text-xl font-bold text-slate-700">
                {ringkasanAntrean.dibatalkanHariIni}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tercatat beserta alasan (AB-030)
              </p>
            </div>
          </section>

          {galatMemuat ? (
            <ErrorState
              pesanAman={galatMemuat.pesan}
              kodeLaporan={galatMemuat.kodeLaporan}
              onCobaLagi={() => void muatDataLoket()}
            />
          ) : null}

          {/* Seksi 1: Pencarian Pasien Lama & Pendaftaran Pasien Baru */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <DataTableFoundation<EntitasPasien>
                judulTabel="1. Pencarian & Verifikasi Pasien Terdaftar"
                deskripsiTabel="Cari pasien lama sebelum membuat identitas baru untuk mencegah duplikasi (AB-001)."
                kolom={kolomPasien}
                data={daftarPasien}
                ambilKunciBaris={(item) => item.id}
                sedangMemuat={sedangMemuatPasien}
                kataKunciCari={kataKunciPasien}
                onUbahKataKunciCari={(nilai) => {
                  setKataKunciPasien(nilai);
                  setHalamanPasien(1);
                }}
                placeholderCari="Cari Nomor RM, NIK, Nama Lengkap, atau Tanggal Lahir (YYYY-MM-DD)..."
                slotFilterTambahan={
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="filter-verifikasi-identitas"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Status Verifikasi:
                    </label>
                    <select
                      id="filter-verifikasi-identitas"
                      value={filterStatusVerifikasi}
                      onChange={(e) => {
                        setFilterStatusVerifikasi(
                          e.target.value as StatusVerifikasiIdentitas | "SEMUA",
                        );
                        setHalamanPasien(1);
                      }}
                      className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                    >
                      <option value="SEMUA">Semua Status</option>
                      <option value="terverifikasi_dua_pengenal">
                        Terverifikasi 2 Pengenal
                      </option>
                      <option value="perlu_verifikasi_ulang">
                        Perlu Verifikasi Ulang
                      </option>
                    </select>
                  </div>
                }
                halamanSaatIni={halamanPasien}
                totalHalaman={Math.max(1, Math.ceil(totalPasien / ukuranHalaman))}
                totalData={totalPasien}
                onUbahHalaman={(hlm) => setHalamanPasien(hlm)}
                judulKosong="Pasien belum ditemukan"
                deskripsiKosong="Tidak ada pasien yang cocok dengan kata kunci pencarian. Anda dapat mendaftarkan identitas pasien baru pada formulir di samping."
              />
            </div>

            {/* Formulir Pendaftaran Pasien Baru */}
            <section
              aria-labelledby="judul-registrasi-pasien"
              className="lg:col-span-5 rounded-lg border border-border bg-card p-5 space-y-4"
            >
              <div className="border-b border-border pb-3">
                <h2
                  id="judul-registrasi-pasien"
                  className="text-sm font-bold text-foreground"
                >
                  2. Registrasi Identitas Pasien Baru (AB-001 & AB-020)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Nomor Rekam Medis (RM-2026-XXXX) diterbitkan otomatis dan unik. Gunakan data uji sintetis.
                </p>
              </div>

              <form onSubmit={tanganiSimpanPasienBaru} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={tanpaNikBaru}
                      onChange={(e) => setTanpaNikBaru(e.target.checked)}
                    />
                    Pasien darurat/belum memiliki NIK saat pendaftaran
                  </label>
                </div>

                {!tanpaNikBaru ? (
                  <FormFieldMolecule
                    id="pasien-nik-baru"
                    label="Nomor Identitas Nasional / NIK (16 Digit)"
                    wajib
                    bantuan="Wajib unik 16 digit angka (AB-001)."
                  >
                    <input
                      id="pasien-nik-baru"
                      type="text"
                      value={nikBaru}
                      onChange={(e) => setNikBaru(e.target.value)}
                      placeholder="Contoh: 9900010588060009 (Sintetis)"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                ) : (
                  <FormFieldMolecule
                    id="pasien-alasan-tanpa-nik"
                    label="Alasan Administratif Tanpa NIK"
                    wajib
                    bantuan="Status pasien akan ditandai 'Perlu Verifikasi Ulang' hingga NIK dilengkapi."
                  >
                    <input
                      id="pasien-alasan-tanpa-nik"
                      type="text"
                      value={alasanTanpaNikBaru}
                      onChange={(e) => setAlasanTanpaNikBaru(e.target.value)}
                      placeholder="Contoh: Pasien darurat belum membawa KTP fisik"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormFieldMolecule
                    id="pasien-nama-baru"
                    label="Nama Lengkap Pasien"
                    wajib
                  >
                    <input
                      id="pasien-nama-baru"
                      type="text"
                      value={namaPasienBaru}
                      onChange={(e) => setNamaPasienBaru(e.target.value)}
                      placeholder="Nama Lengkap (Data Uji Sintetis)"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                  <FormFieldMolecule
                    id="pasien-tgl-lahir-baru"
                    label="Tanggal Lahir (YYYY-MM-DD)"
                    wajib
                  >
                    <input
                      id="pasien-tgl-lahir-baru"
                      type="text"
                      value={tglLahirBaru}
                      onChange={(e) => setTglLahirBaru(e.target.value)}
                      placeholder="1988-06-15"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-xs text-muted-foreground">
                    Periksa potensi data ganda sebelum menyimpan:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sedangCekDuplikat}
                    onClick={(e) => void tanganiCekDuplikasi(e)}
                    className="min-h-8 text-xs"
                  >
                    <SemanticIcon nama="Search" className="mr-1.5 size-3.5" />
                    {sedangCekDuplikat
                      ? "Memeriksa..."
                      : "Cek Kemungkinan Duplikat"}
                  </Button>
                </div>

                {hasilCekDuplikat &&
                (hasilCekDuplikat.adaKonflikPasti ||
                  hasilCekDuplikat.adaPotensiDuplikat) ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 text-xs text-amber-950">
                    <p className="font-semibold">
                      Peringatan Deteksi Duplikasi Identitas (AB-001):
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      {hasilCekDuplikat.alasanDeteksi.map((alasan) => (
                        <li key={alasan}>{alasan}</li>
                      ))}
                    </ul>
                    {!hasilCekDuplikat.adaKonflikPasti &&
                    hasilCekDuplikat.adaPotensiDuplikat ? (
                      <div className="pt-2 space-y-2 border-t border-amber-200">
                        <label className="flex items-center gap-2 font-medium">
                          <input
                            type="checkbox"
                            checked={konfirmasiBukanDuplikat}
                            onChange={(e) =>
                              setKonfirmasiBukanDuplikat(e.target.checked)
                            }
                          />
                          Saya telah memverifikasi 2 pengenal bahwa ini pasien berbeda
                        </label>
                        {konfirmasiBukanDuplikat ? (
                          <FormFieldMolecule
                            id="alasan-konfirmasi-duplikat"
                            label="Alasan Konfirmasi Bukan Pasien Duplikat"
                            wajib
                          >
                            <input
                              id="alasan-konfirmasi-duplikat"
                              type="text"
                              value={alasanKonfirmasiDuplikat}
                              onChange={(e) =>
                                setAlasanKonfirmasiDuplikat(e.target.value)
                              }
                              placeholder="Contoh: NIK, alamat domisili, dan nama orang tua berbeda"
                              className={KELAS_INPUT_TEKS}
                            />
                          </FormFieldMolecule>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="pasien-jk-baru"
                      className="block text-xs font-semibold text-foreground"
                    >
                      Jenis Kelamin
                    </label>
                    <select
                      id="pasien-jk-baru"
                      value={jenisKelaminBaru}
                      onChange={(e) =>
                        setJenisKelaminBaru(
                          e.target.value as JenisKelaminPasien,
                        )
                      }
                      className={KELAS_INPUT_TEKS}
                    >
                      <option value="laki_laki">Laki-laki</option>
                      <option value="perempuan">Perempuan</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="pasien-goldar-baru"
                      className="block text-xs font-semibold text-foreground"
                    >
                      Golongan Darah
                    </label>
                    <select
                      id="pasien-goldar-baru"
                      value={golDarahBaru}
                      onChange={(e) =>
                        setGolDarahBaru(e.target.value as GolonganDarahPasien)
                      }
                      className={KELAS_INPUT_TEKS}
                    >
                      <option value="belum_diketahui">Belum Diketahui</option>
                      <option value="O">O</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                    </select>
                  </div>
                </div>

                <FormFieldMolecule
                  id="pasien-alamat-baru"
                  label="Alamat Domisili"
                  wajib
                >
                  <input
                    id="pasien-alamat-baru"
                    type="text"
                    value={alamatBaru}
                    onChange={(e) => setAlamatBaru(e.target.value)}
                    placeholder="Alamat lengkap pasien"
                    className={KELAS_INPUT_TEKS}
                  />
                </FormFieldMolecule>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormFieldMolecule
                    id="pasien-nama-kontak-baru"
                    label="Nama Kontak Darurat"
                    wajib
                  >
                    <input
                      id="pasien-nama-kontak-baru"
                      type="text"
                      value={namaKontakBaru}
                      onChange={(e) => setNamaKontakBaru(e.target.value)}
                      placeholder="Nama Wali"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                  <FormFieldMolecule
                    id="pasien-hub-kontak-baru"
                    label="Hubungan"
                    wajib
                  >
                    <input
                      id="pasien-hub-kontak-baru"
                      type="text"
                      value={hubunganKontakBaru}
                      onChange={(e) => setHubunganKontakBaru(e.target.value)}
                      placeholder="Suami/Istri/Anak"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                  <FormFieldMolecule
                    id="pasien-telp-baru"
                    label="No. Telepon Darurat"
                    wajib
                  >
                    <input
                      id="pasien-telp-baru"
                      type="text"
                      value={teleponDaruratBaru}
                      onChange={(e) => setTeleponDaruratBaru(e.target.value)}
                      placeholder="081100001234"
                      className={KELAS_INPUT_TEKS}
                    />
                  </FormFieldMolecule>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="pasien-metode-verif-baru"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Metode Verifikasi Dua Pengenal (AB-020)
                  </label>
                  <select
                    id="pasien-metode-verif-baru"
                    value={metodeVerifikasiBaru}
                    onChange={(e) =>
                      setMetodeVerifikasiBaru(
                        e.target.value as MetodeVerifikasiDuaPengenal,
                      )
                    }
                    className={KELAS_INPUT_TEKS}
                  >
                    {DAFTAR_METODE_VERIFIKASI.map((m) => (
                      <option key={m.nilai} value={m.nilai}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <FormFieldMolecule
                  id="pasien-catatan-baru"
                  label="Catatan Administratif Pendaftaran (Opsional)"
                >
                  <input
                    id="pasien-catatan-baru"
                    type="text"
                    value={catatanAdminBaru}
                    onChange={(e) => setCatatanAdminBaru(e.target.value)}
                    placeholder="Catatan administratif loket pendaftaran..."
                    className={KELAS_INPUT_TEKS}
                  />
                </FormFieldMolecule>

                <Button
                  type="submit"
                  disabled={sedangSimpanPasienBaru || !punyaIzinBuat}
                  className="w-full min-h-9 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <SemanticIcon nama="Plus" className="mr-1.5 size-4" />
                  {sedangSimpanPasienBaru
                    ? "Menyimpan Identitas Pasien..."
                    : "Daftarkan Pasien Baru"}
                </Button>
              </form>
            </section>
          </div>

          {/* Seksi 2: Panel Kontekstual Pasien Terpilih (Buat Kunjungan atau Koreksi Identitas Teraudit) */}
          {pasienTerpilih ? (
            <section
              aria-label="Panel tindakan pasien terpilih"
              className="rounded-lg border-2 border-blue-700/30 bg-card p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      {pasienTerpilih.nomorRekamMedis}
                    </span>
                    <h3 className="text-sm font-bold text-foreground">
                      {pasienTerpilih.namaLengkap}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      (Tgl Lahir:{" "}
                      <strong>{pasienTerpilih.tanggalLahir}</strong> • Versi v
                      {pasienTerpilih.versi})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    NIK: {pasienTerpilih.nomorIdentitasNasional ?? "Belum tercatat"} • Wali:{" "}
                    {pasienTerpilih.namaKontakDarurat} ({pasienTerpilih.teleponKontakDarurat})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={
                      modePanelPasien === "kunjungan" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setModePanelPasien("kunjungan")}
                    className="min-h-8 text-xs"
                  >
                    Buat Kunjungan & Antrean Dokter
                  </Button>
                  <Button
                    type="button"
                    variant={
                      modePanelPasien === "koreksi" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setModePanelPasien("koreksi")}
                    className="min-h-8 text-xs"
                  >
                    Koreksi Identitas & Riwayat (AB-030)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPasienTerpilih(null)}
                    className="min-h-8 text-xs"
                  >
                    <SemanticIcon nama="X" className="mr-1 size-3.5" />
                    Tutup Panel
                  </Button>
                </div>
              </div>

              {modePanelPasien === "kunjungan" ? (
                <form
                  onSubmit={tanganiBuatKunjungan}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                      A. Verifikasi Dua Pengenal Pasien Wajib (AB-020)
                    </h4>
                    <div className="space-y-1">
                      <label
                        htmlFor="kunjungan-metode-verif"
                        className="block text-xs font-semibold text-foreground"
                      >
                        Kombinasi Pengenal yang Diverifikasi Petugas
                      </label>
                      <select
                        id="kunjungan-metode-verif"
                        value={metodeVerifikasiKunjungan}
                        onChange={(e) =>
                          setMetodeVerifikasiKunjungan(
                            e.target.value as MetodeVerifikasiDuaPengenal,
                          )
                        }
                        className={KELAS_INPUT_TEKS}
                      >
                        {DAFTAR_METODE_VERIFIKASI.map((m) => (
                          <option key={m.nilai} value={m.nilai}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <FormFieldMolecule
                      id="kunjungan-verifikasi-tgl-lahir"
                      label="Ketik Ulang Tanggal Lahir Pasien (YYYY-MM-DD) untuk Verifikasi Silang"
                      wajib
                      bantuan={`Wajib cocok dengan tanggal lahir pada rekam medis (${pasienTerpilih.tanggalLahir}) sesuai AB-020.`}
                    >
                      <input
                        id="kunjungan-verifikasi-tgl-lahir"
                        type="text"
                        value={verifikasiTanggalLahirInput}
                        onChange={(e) =>
                          setVerifikasiTanggalLahirInput(e.target.value)
                        }
                        placeholder={pasienTerpilih.tanggalLahir}
                        className={KELAS_INPUT_TEKS}
                      />
                    </FormFieldMolecule>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                      B. Rincian Kunjungan & Antrean Pemeriksaan Dokter
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormFieldMolecule
                        id="kunjungan-unit-tujuan"
                        label="Poliklinik / Unit Pemeriksaan"
                        wajib
                      >
                        <input
                          id="kunjungan-unit-tujuan"
                          type="text"
                          value={unitTujuan}
                          onChange={(e) => setUnitTujuan(e.target.value)}
                          placeholder="Poliklinik Penyakit Dalam"
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                      <FormFieldMolecule id="kunjungan-dokter-id" label="ID Dokter Tujuan" wajib>
                        <input id="kunjungan-dokter-id" value={dokterTujuanId} onChange={(e) => setDokterTujuanId(e.target.value)} className={KELAS_INPUT_TEKS} required />
                      </FormFieldMolecule>
                      <FormFieldMolecule id="kunjungan-dokter-nama" label="Nama Dokter Tujuan" wajib>
                        <input id="kunjungan-dokter-nama" value={dokterTujuanNama} onChange={(e) => setDokterTujuanNama(e.target.value)} className={KELAS_INPUT_TEKS} required />
                      </FormFieldMolecule>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="kunjungan-prioritas"
                        className="block text-xs font-semibold text-foreground"
                      >
                        Prioritas Antrean Pemeriksaan
                      </label>
                      <select
                        id="kunjungan-prioritas"
                        value={prioritasAntrean}
                        onChange={(e) =>
                          setPrioritasAntrean(
                            e.target.value as PrioritasAntreanKunjungan,
                          )
                        }
                        className={KELAS_INPUT_TEKS}
                      >
                        <option value="reguler">Reguler</option>
                        <option value="mendesak">
                          Mendesak (Prioritas Pemeriksaan Segera)
                        </option>
                      </select>
                    </div>

                    <FormFieldMolecule
                      id="kunjungan-keluhan-admin"
                      label="Keluhan Utama / Tujuan Kunjungan Saat Registrasi"
                      wajib
                    >
                      <input
                        id="kunjungan-keluhan-admin"
                        type="text"
                        value={keluhanAdministratif}
                        onChange={(e) =>
                          setKeluhanAdministratif(e.target.value)
                        }
                        placeholder="Contoh: Rujukan evaluasi asupan makan dan penurunan berat badan (Sintetis)"
                        className={KELAS_INPUT_TEKS}
                      />
                    </FormFieldMolecule>

                    <Button
                      type="submit"
                      disabled={sedangSimpanKunjungan || !punyaIzinBuat}
                      className="w-full min-h-9 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      <SemanticIcon
                        nama="ShieldCheck"
                        className="mr-1.5 size-4"
                      />
                      {sedangSimpanKunjungan
                        ? "Memverifikasi & Membuat Antrean..."
                        : "Verifikasi 2 Pengenal & Masukkan ke Antrean Dokter"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <form
                    onSubmit={tanganiSimpanKoreksiIdentitas}
                    className="lg:col-span-7 space-y-3"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Formulir Koreksi Terbatas Identitas Pasien (Versi Saat Ini: v
                      {pasienTerpilih.versi})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Nomor Rekam Medis (
                      <strong>{pasienTerpilih.nomorRekamMedis}</strong>) bersifat tetap (AB-001). Setiap perubahan menyimpan snapshot sebelum & sesudah beserta alasan (AB-030).
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormFieldMolecule
                        id="koreksi-nik"
                        label="NIK (16 Digit)"
                      >
                        <input
                          id="koreksi-nik"
                          type="text"
                          value={koreksiNik}
                          onChange={(e) => setKoreksiNik(e.target.value)}
                          placeholder="Kosongkan hanya jika belum ada NIK"
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                      <FormFieldMolecule
                        id="koreksi-nama"
                        label="Nama Lengkap Pasien"
                        wajib
                      >
                        <input
                          id="koreksi-nama"
                          type="text"
                          value={koreksiNama}
                          onChange={(e) => setKoreksiNama(e.target.value)}
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                    </div>

                    {!koreksiNik.trim() ? (
                      <FormFieldMolecule
                        id="koreksi-alasan-tanpa-nik"
                        label="Alasan Tanpa NIK"
                        wajib
                      >
                        <input
                          id="koreksi-alasan-tanpa-nik"
                          type="text"
                          value={koreksiAlasanTanpaNik}
                          onChange={(e) =>
                            setKoreksiAlasanTanpaNik(e.target.value)
                          }
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormFieldMolecule
                        id="koreksi-tgl-lahir"
                        label="Tanggal Lahir"
                        wajib
                      >
                        <input
                          id="koreksi-tgl-lahir"
                          type="text"
                          value={koreksiTglLahir}
                          onChange={(e) => setKoreksiTglLahir(e.target.value)}
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                      <div className="space-y-1">
                        <label
                          htmlFor="koreksi-status-verif"
                          className="block text-xs font-semibold text-foreground"
                        >
                          Status Verifikasi
                        </label>
                        <select
                          id="koreksi-status-verif"
                          value={koreksiStatusVerifikasi}
                          onChange={(e) =>
                            setKoreksiStatusVerifikasi(
                              e.target.value as StatusVerifikasiIdentitas,
                            )
                          }
                          className={KELAS_INPUT_TEKS}
                        >
                          <option value="terverifikasi_dua_pengenal">
                            Terverifikasi 2 Pengenal
                          </option>
                          <option value="perlu_verifikasi_ulang">
                            Perlu Verifikasi Ulang
                          </option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="koreksi-metode-verif"
                          className="block text-xs font-semibold text-foreground"
                        >
                          Pengenal Diverifikasi
                        </label>
                        <select
                          id="koreksi-metode-verif"
                          value={koreksiMetodeVerifikasi}
                          onChange={(e) =>
                            setKoreksiMetodeVerifikasi(
                              e.target.value as MetodeVerifikasiDuaPengenal,
                            )
                          }
                          className={KELAS_INPUT_TEKS}
                        >
                          {DAFTAR_METODE_VERIFIKASI.map((m) => (
                            <option key={m.nilai} value={m.nilai}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <FormFieldMolecule
                      id="koreksi-alamat"
                      label="Alamat Domisili"
                      wajib
                    >
                      <input
                        id="koreksi-alamat"
                        type="text"
                        value={koreksiAlamat}
                        onChange={(e) => setKoreksiAlamat(e.target.value)}
                        className={KELAS_INPUT_TEKS}
                      />
                    </FormFieldMolecule>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormFieldMolecule
                        id="koreksi-nama-kontak"
                        label="Nama Kontak Darurat"
                        wajib
                      >
                        <input
                          id="koreksi-nama-kontak"
                          type="text"
                          value={koreksiNamaKontak}
                          onChange={(e) => setKoreksiNamaKontak(e.target.value)}
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                      <FormFieldMolecule
                        id="koreksi-hub-kontak"
                        label="Hubungan"
                        wajib
                      >
                        <input
                          id="koreksi-hub-kontak"
                          type="text"
                          value={koreksiHubunganKontak}
                          onChange={(e) =>
                            setKoreksiHubunganKontak(e.target.value)
                          }
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                      <FormFieldMolecule
                        id="koreksi-telp"
                        label="Telepon Darurat"
                        wajib
                      >
                        <input
                          id="koreksi-telp"
                          type="text"
                          value={koreksiTelepon}
                          onChange={(e) => setKoreksiTelepon(e.target.value)}
                          className={KELAS_INPUT_TEKS}
                        />
                      </FormFieldMolecule>
                    </div>

                    <FormFieldMolecule
                      id="koreksi-alasan-wajib"
                      label="Alasan Koreksi Identitas (Wajib Audit AB-030)"
                      wajib
                    >
                      <input
                        id="koreksi-alasan-wajib"
                        type="text"
                        value={koreksiAlasan}
                        onChange={(e) => setKoreksiAlasan(e.target.value)}
                        placeholder="Contoh: Koreksi ejaan nama sesuai KTP fisik yang baru diserahkan keluarga"
                        className={KELAS_INPUT_TEKS}
                      />
                    </FormFieldMolecule>

                    <Button
                      type="submit"
                      disabled={sedangSimpanKoreksi || !punyaIzinKoreksi}
                      className="min-h-9 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      <SemanticIcon nama="Save" className="mr-1.5 size-4" />
                      {sedangSimpanKoreksi
                        ? "Menyimpan Koreksi..."
                        : "Simpan Koreksi Identitas Teraudit"}
                    </Button>
                  </form>

                  <div className="lg:col-span-5 space-y-3 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Riwayat Koreksi Identitas (AB-030 & AB-034)
                    </h4>
                    {riwayatKoreksiPasien.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border bg-slate-50 p-3 text-xs text-muted-foreground">
                        Belum ada riwayat koreksi identitas untuk pasien ini.
                      </p>
                    ) : (
                      <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {riwayatKoreksiPasien.map((r) => (
                          <li
                            key={r.id}
                            className="rounded-md border border-border bg-slate-50 p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-blue-900">
                                v{r.versiSebelum} → v{r.versiSesudah}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(r.dikoreksiPada).toLocaleString(
                                  "id-ID",
                                )}
                              </span>
                            </div>
                            <p className="font-medium text-foreground">
                              Alasan: {r.alasanKoreksi}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Oleh: {r.dikoreksiOlehNama} • Pengenal:{" "}
                              {r.pengenalDiverifikasi}
                            </p>
                            <p className="text-[11px] text-slate-700">
                              Sebelum: {r.snapshotSebelum.namaLengkap} (NIK:{" "}
                              {r.snapshotSebelum.nomorIdentitasNasional ?? "-"})
                              <br />
                              Sesudah: {r.snapshotSesudah.namaLengkap} (NIK:{" "}
                              {r.snapshotSesudah.nomorIdentitasNasional ?? "-"})
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {/* Seksi 3: Daftar Antrean Kunjungan Pemeriksaan Dokter */}
          <DataTableFoundation<ItemAntreanKunjunganDto>
            judulTabel="3. Antrean Kunjungan Pemeriksaan Dokter (BRD Bab IV.4.1)"
            deskripsiTabel="Menampilkan pasien yang telah diverifikasi dua pengenal dan masuk ke antrean pemeriksaan dokter."
            kolom={kolomKunjungan}
            data={daftarKunjungan}
            ambilKunciBaris={(item) => item.id}
            sedangMemuat={sedangMemuatKunjungan}
            kataKunciCari={kataKunciKunjungan}
            onUbahKataKunciCari={(nilai) => {
              setKataKunciKunjungan(nilai);
              setHalamanKunjungan(1);
            }}
            placeholderCari="Cari Kode Antrean, Nomor Kunjungan, Nomor RM, atau Nama Pasien..."
            slotFilterTambahan={
              <div className="flex flex-wrap items-center gap-2">
                <FormFieldMolecule
                  id="alasan-batal-kunjungan-inline"
                  label="Alasan Pembatalan Default:"
                  className="sm:flex-row sm:items-center sm:gap-2"
                >
                  <input
                    id="alasan-batal-kunjungan-inline"
                    type="text"
                    value={alasanBatalKunjungan}
                    onChange={(e) => setAlasanBatalKunjungan(e.target.value)}
                    placeholder="Alasan pembatalan kunjungan..."
                    className="h-8 w-56 rounded-md border border-input bg-white px-2 text-xs"
                  />
                </FormFieldMolecule>
                <label
                  htmlFor="filter-status-kunjungan"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Status Kunjungan:
                </label>
                <select
                  id="filter-status-kunjungan"
                  value={filterStatusKunjungan}
                  onChange={(e) => {
                    setFilterStatusKunjungan(
                      e.target.value as StatusKunjunganPasien | "SEMUA",
                    );
                    setHalamanKunjungan(1);
                  }}
                  className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="menunggu_pemeriksaan">
                    Menunggu Pemeriksaan Dokter
                  </option>
                  <option value="sedang_diperiksa">Sedang Diperiksa</option>
                  <option value="selesai_pemeriksaan">
                    Selesai Pemeriksaan
                  </option>
                  <option value="diajukan_rawat_inap">
                    Diajukan Rawat Inap
                  </option>
                  <option value="dibatalkan">Dibatalkan</option>
                </select>
              </div>
            }
            halamanSaatIni={halamanKunjungan}
            totalHalaman={Math.max(
              1,
              Math.ceil(totalKunjungan / ukuranHalaman),
            )}
            totalData={totalKunjungan}
            onUbahHalaman={(hlm) => setHalamanKunjungan(hlm)}
            judulKosong="Belum ada antrean kunjungan"
            deskripsiKosong="Pilih pasien dari tabel di atas lalu klik 'Buat Kunjungan' untuk memasukkan pasien ke antrean pemeriksaan dokter."
          />
        </div>
      )}

      {/* Dialog Konfirmasi Destruktif: Batalkan Kunjungan Pemeriksaan */}
      <ConfirmDialog
        terbuka={Boolean(kunjunganAkanDibatalkan)}
        onPerubahanTerbuka={(terbuka) => {
          if (!terbuka) {
            setKunjunganAkanDibatalkan(null);
          }
        }}
        judul={
          kunjunganAkanDibatalkan
            ? `Batalkan kunjungan ${kunjunganAkanDibatalkan.kodeAntrean} (${kunjunganAkanDibatalkan.pasien.namaLengkap})?`
            : "Batalkan kunjungan pemeriksaan?"
        }
        deskripsiDampak={`Kunjungan masih berstatus menunggu pemeriksaan dokter. Pembatalan akan mengeluarkan pasien dari antrean aktif dengan alasan tercatat: "${alasanBatalKunjungan}".`}
        labelKonfirmasi="Batalkan Kunjungan"
        labelBatal="Kembali"
        varianTindakan="destruktif"
        sedangMemproses={sedangMemprosesBatal}
        onKonfirmasi={() => void eksekusiBatalkanKunjungan()}
      />

      {/* Dialog Informasi Pembatasan Kewenangan Lintas Peran (AB-032) */}
      <ConfirmDialog
        terbuka={Boolean(menuTerkunci)}
        onPerubahanTerbuka={(terbuka) => {
          if (!terbuka) {
            setMenuTerkunci(null);
          }
        }}
        judul={
          menuTerkunci
            ? `Pembatasan Akses Peran: ${menuTerkunci.label}`
            : "Pembatasan Akses Peran"
        }
        deskripsiDampak={
          menuTerkunci
            ? `Sesuai BRD Bab III & AB-032, modul "${menuTerkunci.label}" hanya dapat diakses oleh petugas dengan peran dan izin kewenangan terkait.`
            : ""
        }
        labelKonfirmasi="Mengerti"
        labelBatal="Tutup"
        varianTindakan="primer"
        onKonfirmasi={() => setMenuTerkunci(null)}
      />
    </AppShellTemplate>
  );
}
