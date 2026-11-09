"use client";

/**
 * @fileoverview Ruang kerja operasional Peran Dokter Penanggung Jawab Pelayanan / DPJP (`DokterWorkspace`).
 * Mengimplementasikan alur BRD Versi 4.0 Bab IV.4.2 s.d. IV.4.4 & Bab XVII:
 * 1. Inspeksi antrean pasien dokter poliklinik/bangsal penugasan (`AB-032`).
 * 2. Pemeriksaan klinis & tanda vital dengan verifikasi sedikitnya dua pengenal (`AB-020`, `AB-006`).
 * 3. Pencatatan alergi makanan dan obat dengan deteksi tanda bahaya anafilaksis (`AB-007`).
 * 4. Penetapan & pengesahan instruksi diet awal sah (`AB-003`, `AB-004`, `AB-005`, `AB-008`, `AB-009`) dengan validasi NPO/puasa dan nomor unik.
 * 5. Koreksi/revisi instruksi diet berversi (`versi`) dengan kontrol konkurensi optimistik (`AB-004`, `AB-010`, `AB-030`).
 * 6. Pengajuan rawat inap (`pengajuan_rawat_inap`) berstatus `menunggu_penempatan` untuk diserahkan ke Petugas Rawat Inap rawat inap.
 *
 * Referensi desain (UI_UX.md):
 * - Kepadatan informasi klinis bersih, tenang, kontras tinggi, bebas animasi berlebih.
 * - Banner keselamatan dua pengenal dan penugasan bangsal DPJP (`BANGSAL-MELATI`).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Clock,
  FileCheck2,
  FilePlus,
  HeartPulse,
  History,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";
import { StatusBadge } from "@/components/atoms/status-badge";
import { FormFieldMolecule } from "@/components/molecules/form-field";
import {
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
  BentukMakananKlinis,
  DaftarAntreanDokterRespons,
  DetailKlinisPasienRespons,
  EntitasAlergiPasien,
  EntitasInstruksiDiet,
  EntitasPemeriksaanKlinis,
  EntitasPengajuanRawatInap,
  ItemAntreanDokterDto,
  JenisDietKlinis,
  KategoriAlergen,
  PrioritasRawatInap,
  RutePemberianNutrisi,
  TindakLanjutPemeriksaan,
  TingkatKeparahanAlergi,
} from "../../../../services/clinical-nutrition-service/src/model/clinical-nutrition.model.ts";

const DAFTAR_JENIS_DIET: ReadonlyArray<{
  nilai: JenisDietKlinis;
  label: string;
}> = [
  { nilai: "makanan_biasa", label: "Makanan Biasa (Umum)" },
  { nilai: "makanan_lunak", label: "Makanan Lunak (Mudah Dikunyah)" },
  { nilai: "rendah_garam", label: "Diet Rendah Garam (RG I / II / III)" },
  { nilai: "diabetes_melitus", label: "Diet Diabetes Melitus (Kalori Terkontrol)" },
  { nilai: "lambung", label: "Diet Lambung (Gastritis / Tukak Peptik)" },
  { nilai: "jantung", label: "Diet Jantung (Dislipidemia & Sirkulasi)" },
  { nilai: "rendah_lemak", label: "Diet Rendah Lemak & Kolesterol" },
  { nilai: "ginjal_rendah_protein", label: "Diet Ginjal Rendah Protein (PGK)" },
  { nilai: "tktp", label: "Diet Tinggi Kalori Tinggi Protein (TKTP)" },
  { nilai: "hati", label: "Diet Gangguan Fungsi Hati" },
  { nilai: "khusus_kombinasi", label: "Diet Khusus / Komposisi Kombinasi DPJP" },
];

const DAFTAR_BENTUK_MAKANAN: ReadonlyArray<{
  nilai: BentukMakananKlinis;
  label: string;
}> = [
  { nilai: "biasa", label: "Biasa (Nasi / Lauk Normal)" },
  { nilai: "lunak", label: "Lunak (Bubur Kasar / Nasi Tim / Lauk Lunak)" },
  { nilai: "saring", label: "Saring (Bubur Halus / Blenderized)" },
  { nilai: "cair", label: "Cair (Formula Enteral / Kaldu Jernih)" },
];

const DAFTAR_RUTE_PEMBERIAN: ReadonlyArray<{
  nilai: RutePemberianNutrisi;
  label: string;
}> = [
  { nilai: "oral", label: "Oral (Melalui Mulut)" },
  { nilai: "enteral_ngt", label: "Enteral via Selang NGT / OGT" },
  { nilai: "parenteral_tpn", label: "Parenteral (Intravena Infus Nutrisi / TPN)" },
];

const DAFTAR_KATEGORI_ALERGEN: ReadonlyArray<{
  nilai: KategoriAlergen;
  label: string;
}> = [
  { nilai: "makanan", label: "Alergi Makanan (Bahan Pangan/Nutrisi)" },
  { nilai: "obat", label: "Alergi Obat / Farmakoterapi" },
  { nilai: "lingkungan", label: "Alergi Lingkungan / Kontak" },
  { nilai: "lainnya", label: "Lainnya / Intoleransi Khusus" },
];

const DAFTAR_TINGKAT_KEPARAHAN: ReadonlyArray<{
  nilai: TingkatKeparahanAlergi;
  label: string;
}> = [
  { nilai: "ringan", label: "Ringan (Pruritus / Eritema Lokal)" },
  { nilai: "sedang", label: "Sedang (Urtikaria Luas / Mual Muntah)" },
  { nilai: "berat_anafilaksis", label: "Berat / Anafilaksis (Risiko Fatal / Sumbatan Jalan Napas)" },
];

const DAFTAR_TINDAK_LANJUT: ReadonlyArray<{
  nilai: TindakLanjutPemeriksaan;
  label: string;
}> = [
  { nilai: "anjuran_rawat_inap", label: "Anjuran Rawat Inap (Hospitalisasi)" },
  { nilai: "selesai_rawat_jalan", label: "Pemeriksaan Selesai (Pulang)" },
  { nilai: "rujuk_eksternal", label: "Rujuk ke Fasilitas Kesehatan Lain" },
];

const KELAS_INPUT =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

type TabDokter =
  | "antrean"
  | "pemeriksaan"
  | "alergi"
  | "diet_awal"
  | "koreksi_diet"
  | "rawat_inap";

export function DokterWorkspace() {
  const {
    profil,
    navigasi,
    sedangMemuatSesi,
    notifikasiItems,
    jumlahBelumDibaca,
    sedangMemuatNotifikasi,
    tandaiSatuNotifikasiDibaca,
    tandaiSemuaNotifikasiDibaca,
    keluarSesi,
  } = useSesiAdmin();

  // State antrean pasien
  const [tabAktif, setTabAktif] = useState<TabDokter>("antrean");
  const [daftarAntrean, setDaftarAntrean] = useState<ItemAntreanDokterDto[]>([]);
  const [ringkasan, setRingkasan] = useState({
    menungguPemeriksaan: 0,
    sedangDiperiksa: 0,
    selesaiPemeriksaan: 0,
    diajukanRawatInap: 0,
  });
  const [sedangMemuatAntrean, setSedangMemuatAntrean] = useState(false);
  const [antreanTerpilih, setAntreanTerpilih] =
    useState<ItemAntreanDokterDto | null>(null);

  // Detail klinis pasien terpilih
  const [detailKlinis, setDetailKlinis] =
    useState<DetailKlinisPasienRespons | null>(null);

  // Form Pemeriksaan Klinis (AB-020, AB-006)
  const [verifikasiTanggalLahir, setVerifikasiTanggalLahir] = useState("");
  const [keluhanUtama, setKeluhanUtama] = useState("");
  const [riwayatPenyakit, setRiwayatPenyakit] = useState("");
  const [tekananDarahSistol, setTekananDarahSistol] = useState<number | "">("");
  const [tekananDarahDiastol, setTekananDarahDiastol] = useState<number | "">("");
  const [denyutNadi, setDenyutNadi] = useState<number | "">("");
  const [frekuensiNafas, setFrekuensiNafas] = useState<number | "">("");
  const [suhuTubuh, setSuhuTubuh] = useState<number | "">("");
  const [beratBadanKg, setBeratBadanKg] = useState<number | "">("");
  const [tinggiBadanCm, setTinggiBadanCm] = useState<number | "">("");
  const [diagnosisPrimer, setDiagnosisPrimer] = useState("");
  const [diagnosisSekunder, setDiagnosisSekunder] = useState("");
  const [catatanGizi, setCatatanGizi] = useState("");
  const [tindakLanjut, setTindakLanjut] =
    useState<TindakLanjutPemeriksaan>("anjuran_rawat_inap");
  const [sedangSimpanPemeriksaan, setSedangSimpanPemeriksaan] = useState(false);

  // Form Alergi Pasien (AB-007)
  const [kategoriAlergen, setKategoriAlergen] =
    useState<KategoriAlergen>("makanan");
  const [namaAlergen, setNamaAlergen] = useState("");
  const [tingkatKeparahan, setTingkatKeparahan] =
    useState<TingkatKeparahanAlergi>("sedang");
  const [reaksiAlergi, setReaksiAlergi] = useState("");
  const [sedangSimpanAlergi, setSedangSimpanAlergi] = useState(false);

  // Form Instruksi Diet Awal (AB-003, AB-005, AB-008, AB-009)
  const [jenisDiet, setJenisDiet] = useState<JenisDietKlinis | "">("");
  const [namaDietKustom, setNamaDietKustom] = useState("");
  const [bentukMakanan, setBentukMakanan] = useState<BentukMakananKlinis | "">("");
  const [rutePemberian, setRutePemberian] =
    useState<RutePemberianNutrisi | "">("");
  const [statusPuasaNpo, setStatusPuasaNpo] = useState<boolean | null>(null);
  const [alasanPuasa, setAlasanPuasa] = useState("");
  const [targetEnergiKkal, setTargetEnergiKkal] = useState<number | "">("");
  const [targetProteinGram, setTargetProteinGram] = useState<number | "">("");
  const [pembatasanCairanMl, setPembatasanCairanMl] = useState<number | "">("");
  const [pembatasanNatriumMg, setPembatasanNatriumMg] = useState<number | "">("");
  const [instruksiKhusus, setInstruksiKhusus] = useState("");
  const [sedangSimpanDiet, setSedangSimpanDiet] = useState(false);

  // Form Koreksi/Revisi Diet Berversi (AB-004, AB-010, AB-030)
  const [koreksiAlasanPerubahan, setKoreksiAlasanPerubahan] = useState("");
  const [koreksiJenisDiet, setKoreksiJenisDiet] =
    useState<JenisDietKlinis>("makanan_biasa");
  const [koreksiBentukMakanan, setKoreksiBentukMakanan] =
    useState<BentukMakananKlinis>("lunak");
  const [koreksiRutePemberian, setKoreksiRutePemberian] =
    useState<RutePemberianNutrisi>("oral");
  const [koreksiStatusPuasa, setKoreksiStatusPuasa] = useState(false);
  const [koreksiAlasanPuasa, setKoreksiAlasanPuasa] = useState("");
  const [koreksiEnergiKkal, setKoreksiEnergiKkal] = useState<number | "">(1900);
  const [koreksiProteinGram, setKoreksiProteinGram] = useState<number | "">(65);
  const [koreksiCairanMl, setKoreksiCairanMl] = useState<number | "">("");
  const [koreksiNatriumMg, setKoreksiNatriumMg] = useState<number | "">("");
  const [koreksiInstruksiKhusus, setKoreksiInstruksiKhusus] = useState("");
  const [sedangSimpanKoreksiDiet, setSedangSimpanKoreksiDiet] = useState(false);

  // Form Pengajuan Rawat Inap (BRD Bab IV.4.3)
  const [riDiagnosisUtama, setRiDiagnosisUtama] = useState("");
  const [riAlasan, setRiAlasan] = useState("");
  const [riPrioritas, setRiPrioritas] =
    useState<PrioritasRawatInap>("mendesak");
  const [riBangsal, setRiBangsal] = useState("BANGSAL-MELATI");
  const [riKebutuhanKhusus, setRiKebutuhanKhusus] = useState("");
  const [sedangSimpanPengajuanRi, setSedangSimpanPengajuanRi] = useState(false);

  // Umpan balik & notifikasi
  const [toast, setToast] = useState<{
    jenis: "berhasil" | "kesalahan";
    pesan: string;
  } | null>(null);
  const [peringatanKeselamatan, setPeringatanKeselamatan] =
    useState<string | null>(null);
  const [menuTerkunci, setMenuTerkunci] = useState<ItemNavigasiPeran | null>(
    null,
  );
  const [dialogKonfirmasiTerbuka, setDialogKonfirmasiTerbuka] = useState(false);
  const [konfirmasiDietData, setKonfirmasiDietData] = useState<{
    judul: string;
    deskripsi: string;
    eksekusi: () => Promise<void>;
  } | null>(null);

  const [kataKunciCari, setKataKunciCari] = useState("");
  const [halamanSaatIni, setHalamanSaatIni] = useState(1);

  // Muat data antrean dokter
  async function muatAntrean(): Promise<void> {
    setSedangMemuatAntrean(true);
    try {
      const res = await fetch("/api/v1/clinical-nutrition/queue", {
        cache: "no-store",
      });
      const json = (await res.json()) as ResponsApi<DaftarAntreanDokterRespons>;
      if (json.sukses) {
        setDaftarAntrean(json.data.items);
        setRingkasan(json.data.ringkasan);

        if (json.data.items.length > 0) {
          if (!antreanTerpilih) {
            pilihPasien(json.data.items[0]);
          } else {
            const masihAda = json.data.items.find(
              (a) => a.kunjunganId === antreanTerpilih.kunjunganId,
            );
            if (masihAda) {
              setAntreanTerpilih(masihAda);
            }
          }
        }
      } else {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
      }
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal memuat antrean kunjungan dokter dari gateway.",
      });
    } finally {
      setSedangMemuatAntrean(false);
    }
  }

  // Muat detail lengkap klinis pasien saat pasien dipilih
  async function muatDetailKlinis(kunjunganId: string): Promise<void> {
    setDetailKlinis(null);
    try {
      const res = await fetch(
        `/api/v1/clinical-nutrition/visits/${kunjunganId}/clinical-detail`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as ResponsApi<DetailKlinisPasienRespons>;
      if (!json.sukses) throw new Error(json.galat.pesan);
      if (json.sukses) {
        setDetailKlinis(json.data);

        if (json.data.pemeriksaanTerbaru) {
          const p = json.data.pemeriksaanTerbaru;
          setKeluhanUtama(p.keluhanUtama);
          setRiwayatPenyakit(p.riwayatPenyakitSekarang ?? "");
          setTekananDarahSistol(p.tandaVital.tekananDarahSistol ?? "");
          setTekananDarahDiastol(p.tandaVital.tekananDarahDiastol ?? "");
          setDenyutNadi(p.tandaVital.denyutNadi ?? "");
          setFrekuensiNafas(p.tandaVital.frekuensiNafas ?? "");
          setSuhuTubuh(p.tandaVital.suhuTubuh ?? "");
          setBeratBadanKg(p.tandaVital.beratBadanKg ?? "");
          setTinggiBadanCm(p.tandaVital.tinggiBadanCm ?? "");
          setDiagnosisPrimer(p.diagnosisKlinisPrimer);
          setDiagnosisSekunder(p.diagnosisKlinisSekunder ?? "");
          setCatatanGizi(p.catatanKlinisRelevanGizi ?? "");
          setTindakLanjut(p.tindakLanjut as TindakLanjutPemeriksaan);
        } else {
          setKeluhanUtama("");
          setRiwayatPenyakit("");
          setTekananDarahSistol("");
          setTekananDarahDiastol("");
          setDenyutNadi("");
          setFrekuensiNafas("");
          setSuhuTubuh("");
          setBeratBadanKg("");
          setTinggiBadanCm("");
          setDiagnosisPrimer("");
          setDiagnosisSekunder("");
          setCatatanGizi("");
          setTindakLanjut("anjuran_rawat_inap");
        }

        if (json.data.pemeriksaanTerbaru?.diagnosisKlinisPrimer) {
          setRiDiagnosisUtama(json.data.pemeriksaanTerbaru.diagnosisKlinisPrimer);
        }

        if (json.data.instruksiDietAktif) {
          const d = json.data.instruksiDietAktif;
          setKoreksiJenisDiet(d.jenisDiet);
          setKoreksiBentukMakanan(d.bentukMakanan);
          setKoreksiRutePemberian(d.rutePemberian);
          setKoreksiStatusPuasa(d.statusPuasaNpo);
          setKoreksiAlasanPuasa(d.alasanPuasa ?? "");
          setKoreksiEnergiKkal(d.targetEnergiKkal ?? "");
          setKoreksiProteinGram(d.targetProteinGram ?? "");
          setKoreksiCairanMl(d.pembatasanCairanMl ?? "");
          setKoreksiNatriumMg(d.pembatasanNatriumMg ?? "");
          setKoreksiInstruksiKhusus(d.instruksiKhusus ?? "");
        }
      }
    } catch {
      setPeringatanKeselamatan("Detail klinis belum berhasil dimuat. Pilih ulang pasien atau segarkan data.");
    }
  }

  function pilihPasien(item: ItemAntreanDokterDto) {
    setAntreanTerpilih(item);
    setVerifikasiTanggalLahir("");
    setPeringatanKeselamatan(null);
    muatDetailKlinis(item.kunjunganId);
  }

  useEffect(() => {
    if (profil && profil.peran === "dokter") {
      const timer = setTimeout(() => {
        void muatAntrean();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  // Aksi: Simpan Pemeriksaan Klinis (AB-020, AB-006)
  async function tanganiSimpanPemeriksaan(e: React.FormEvent) {
    e.preventDefault();
    if (!antreanTerpilih || !detailKlinis) return;

    if (!verifikasiTanggalLahir.trim()) {
      setPeringatanKeselamatan(
        "Penahanan Keselamatan (AB-020): Verifikasi dua pengenal wajib dilakukan. Masukkan tanggal lahir pasien yang dikonfirmasi langsung sebelum menyimpan pemeriksaan medis.",
      );
      return;
    }

    setSedangSimpanPemeriksaan(true);
    setPeringatanKeselamatan(null);
    try {
      const res = await fetch("/api/v1/clinical-nutrition/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kunjunganId: antreanTerpilih.kunjunganId,
          pasienId: antreanTerpilih.pasienId,
          verifikasiTanggalLahir: verifikasiTanggalLahir.trim(),
          keluhanUtama: keluhanUtama.trim(),
          riwayatPenyakitSekarang: riwayatPenyakit.trim() || undefined,
          tekananDarahSistol:
            tekananDarahSistol !== "" ? Number(tekananDarahSistol) : undefined,
          tekananDarahDiastol:
            tekananDarahDiastol !== "" ? Number(tekananDarahDiastol) : undefined,
          denyutNadi: denyutNadi !== "" ? Number(denyutNadi) : undefined,
          frekuensiNafas:
            frekuensiNafas !== "" ? Number(frekuensiNafas) : undefined,
          suhuTubuh: suhuTubuh !== "" ? Number(suhuTubuh) : undefined,
          beratBadanKg: beratBadanKg !== "" ? Number(beratBadanKg) : undefined,
          tinggiBadanCm:
            tinggiBadanCm !== "" ? Number(tinggiBadanCm) : undefined,
          diagnosisKlinisPrimer: diagnosisPrimer.trim(),
          diagnosisKlinisSekunder: diagnosisSekunder.trim() || undefined,
          catatanKlinisRelevanGizi: catatanGizi.trim() || undefined,
          tindakLanjut,
        }),
      });

      const json = (await res.json()) as ResponsApi<EntitasPemeriksaanKlinis>;
      if (!json.sukses) {
        if (json.galat.kode === "ERR_PENAHANAN_KESELAMATAN") {
          setPeringatanKeselamatan(json.galat.pesan);
        } else {
          setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        }
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Hasil pemeriksaan klinis untuk ${antreanTerpilih.namaLengkap} berhasil diverifikasi 2 pengenal & disimpan.`,
      });
      await muatAntrean();
      await muatDetailKlinis(antreanTerpilih.kunjunganId);
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal menyimpan pemeriksaan klinis.",
      });
    } finally {
      setSedangSimpanPemeriksaan(false);
    }
  }

  // Aksi: Catat Alergi Pasien (AB-007)
  async function tanganiSimpanAlergi(e: React.FormEvent) {
    e.preventDefault();
    if (!antreanTerpilih || !detailKlinis) return;

    if (!namaAlergen.trim() || !reaksiAlergi.trim()) {
      setToast({
        jenis: "kesalahan",
        pesan: "Nama alergen dan deskripsi reaksi klinis wajib diisi.",
      });
      return;
    }

    setSedangSimpanAlergi(true);
    try {
      const res = await fetch(
        `/api/v1/clinical-nutrition/patients/${antreanTerpilih.pasienId}/allergies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pemeriksaanId: detailKlinis?.pemeriksaanTerbaru?.id,
            kategoriAlergen,
            namaAlergen: namaAlergen.trim(),
            tingkatKeparahan,
            reaksiAlergi: reaksiAlergi.trim(),
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<EntitasAlergiPasien>;
      if (!json.sukses) {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Alergi '${json.data.namaAlergen}' (${json.data.tingkatKeparahan}) berhasil dicatat di rekam medis keselamatan pasien.`,
      });
      setNamaAlergen("");
      setReaksiAlergi("");
      await muatDetailKlinis(antreanTerpilih.kunjunganId);
    } catch {
      setToast({ jenis: "kesalahan", pesan: "Gagal mencatat alergi pasien." });
    } finally {
      setSedangSimpanAlergi(false);
    }
  }

  // Aksi: Sahkan Instruksi Diet Awal (AB-003, AB-005, AB-008, AB-009)
  async function eksekusiPengesahanDietAwal() {
    if (!antreanTerpilih || !detailKlinis) return;

    setSedangSimpanDiet(true);
    try {
      const idempotencyKey = `idem-diet-${antreanTerpilih.kunjunganId}-${Date.now()}`;
      const res = await fetch("/api/v1/clinical-nutrition/diet-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          kunjunganId: antreanTerpilih.kunjunganId,
          pasienId: antreanTerpilih.pasienId,
          jenisDiet,
          namaDietKustom: namaDietKustom.trim() || undefined,
          bentukMakanan,
          rutePemberian,
          statusPuasaNpo,
          alasanPuasa: statusPuasaNpo ? alasanPuasa.trim() : undefined,
          targetEnergiKkal:
            targetEnergiKkal !== "" ? Number(targetEnergiKkal) : undefined,
          targetProteinGram:
            targetProteinGram !== "" ? Number(targetProteinGram) : undefined,
          pembatasanCairanMl:
            pembatasanCairanMl !== "" ? Number(pembatasanCairanMl) : undefined,
          pembatasanNatriumMg:
            pembatasanNatriumMg !== ""
              ? Number(pembatasanNatriumMg)
              : undefined,
          instruksiKhusus: instruksiKhusus.trim() || undefined,
        }),
      });

      const json = (await res.json()) as ResponsApi<EntitasInstruksiDiet>;
      if (!json.sukses) {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Instruksi diet sah ${json.data.nomorInstruksi} (Versi ${json.data.versi}) berhasil diterbitkan oleh DPJP.`,
      });
      await muatDetailKlinis(antreanTerpilih.kunjunganId);
      setTabAktif("koreksi_diet");
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal mengesahkan instruksi diet awal.",
      });
    } finally {
      setSedangSimpanDiet(false);
      setDialogKonfirmasiTerbuka(false);
    }
  }

  function tanganiKonfirmasiDietAwal(e: React.FormEvent) {
    e.preventDefault();
    if (!antreanTerpilih || !detailKlinis) return;
    if (!jenisDiet || !bentukMakanan || !rutePemberian || statusPuasaNpo === null) {
      setToast({ jenis: "kesalahan", pesan: "Tentukan jenis diet, bentuk makanan, rute, dan status puasa berdasarkan penilaian DPJP." });
      return;
    }

    if (statusPuasaNpo && !alasanPuasa.trim()) {
      setToast({
        jenis: "kesalahan",
        pesan:
          "Aturan Keselamatan (AB-008): Alasan puasa (NPO) wajib dicantumkan jika status puasa diaktifkan.",
      });
      return;
    }

    setKonfirmasiDietData({
      judul: "Sahkan Instruksi Diet Awal (DPJP Sah)?",
      deskripsi: `Anda akan mengesahkan resep diet klinis ${jenisDiet.toUpperCase()} (${bentukMakanan}, via ${rutePemberian}) untuk pasien ${antreanTerpilih.namaLengkap}. Instruksi ini akan menjadi acuan resmi unit gizi dan perawat.`,
      eksekusi: eksekusiPengesahanDietAwal,
    });
    setDialogKonfirmasiTerbuka(true);
  }

  // Aksi: Simpan Revisi Diet Berversi (AB-004, AB-010, AB-030)
  async function tanganiSimpanKoreksiDiet(e: React.FormEvent) {
    e.preventDefault();
    if (!antreanTerpilih || !detailKlinis?.instruksiDietAktif) return;

    if (!koreksiAlasanPerubahan.trim()) {
      setToast({
        jenis: "kesalahan",
        pesan:
          "Aturan Keselamatan (AB-004, AB-010): Alasan perubahan diet wajib diisi untuk menjaga jejak audit klinis.",
      });
      return;
    }

    if (koreksiStatusPuasa && !koreksiAlasanPuasa.trim()) {
      setToast({
        jenis: "kesalahan",
        pesan:
          "Aturan Keselamatan (AB-008): Alasan puasa wajib dicantumkan jika status puasa diaktifkan.",
      });
      return;
    }

    setSedangSimpanKoreksiDiet(true);
    try {
      const instruksiId = detailKlinis.instruksiDietAktif.id;
      const res = await fetch(
        `/api/v1/clinical-nutrition/diet-orders/${instruksiId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versiSebelum: detailKlinis.instruksiDietAktif.versi,
            alasanPerubahan: koreksiAlasanPerubahan.trim(),
            jenisDiet: koreksiJenisDiet,
            bentukMakanan: koreksiBentukMakanan,
            rutePemberian: koreksiRutePemberian,
            statusPuasaNpo: koreksiStatusPuasa,
            alasanPuasa: koreksiStatusPuasa
              ? koreksiAlasanPuasa.trim()
              : undefined,
            targetEnergiKkal:
              koreksiEnergiKkal !== "" ? Number(koreksiEnergiKkal) : undefined,
            targetProteinGram:
              koreksiProteinGram !== ""
                ? Number(koreksiProteinGram)
                : undefined,
            pembatasanCairanMl:
              koreksiCairanMl !== "" ? Number(koreksiCairanMl) : undefined,
            pembatasanNatriumMg:
              koreksiNatriumMg !== "" ? Number(koreksiNatriumMg) : undefined,
            instruksiKhusus: koreksiInstruksiKhusus.trim() || undefined,
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<EntitasInstruksiDiet>;
      if (!json.sukses) {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Instruksi diet ${json.data.nomorInstruksi} berhasil diperbarui ke Versi ${json.data.versi} dengan jejak audit lengkap (AB-030).`,
      });
      setKoreksiAlasanPerubahan("");
      await muatDetailKlinis(antreanTerpilih.kunjunganId);
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal memperbarui versi instruksi diet.",
      });
    } finally {
      setSedangSimpanKoreksiDiet(false);
    }
  }

  // Aksi: Terbitkan Pengajuan Rawat Inap (BRD Bab IV.4.3)
  async function tanganiSimpanPengajuanRi(e: React.FormEvent) {
    e.preventDefault();
    if (!antreanTerpilih || !detailKlinis) return;

    if (!riDiagnosisUtama.trim() || !riAlasan.trim()) {
      setToast({
        jenis: "kesalahan",
        pesan: "Diagnosis utama dan alasan rawat inap wajib diisi.",
      });
      return;
    }

    setSedangSimpanPengajuanRi(true);
    try {
      const res = await fetch("/api/v1/clinical-nutrition/admission-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kunjunganId: antreanTerpilih.kunjunganId,
          pasienId: antreanTerpilih.pasienId,
          diagnosisUtama: riDiagnosisUtama.trim(),
          alasanRawatInap: riAlasan.trim(),
          prioritasRawatInap: riPrioritas,
          rekomendasiBangsal: riBangsal,
          kebutuhanKhusus: riKebutuhanKhusus.trim() || undefined,
        }),
      });

      const json = (await res.json()) as ResponsApi<EntitasPengajuanRawatInap>;
      if (!json.sukses) {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        return;
      }

      setToast({
        jenis: "berhasil",
        pesan: `Pengajuan rawat inap ${json.data.nomorPengajuan} berhasil diterbitkan (Status: ${json.data.statusPengajuan}). Diserahkan ke Petugas Rawat Inap untuk penempatan tempat tidur.`,
      });
      await muatAntrean();
      await muatDetailKlinis(antreanTerpilih.kunjunganId);
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal menerbitkan pengajuan rawat inap.",
      });
    } finally {
      setSedangSimpanPengajuanRi(false);
    }
  }

  if (sedangMemuatSesi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <LoadingState
          judul="Memuat Ruang Kerja Dokter..."
          deskripsi="Menyiapkan data antrean pasien klinis, rekam alergi, dan otorisasi DPJP..."
        />
      </div>
    );
  }

  if (!profil || profil.peran !== "dokter") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-border shadow-sm space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Hanya untuk Dokter Penanggung Jawab Pelayanan (DPJP)."
            detailKonteks="Sesuai Aturan Keselamatan AB-003 & AB-032, penetapan instruksi diet klinis dan rekam pemeriksaan medis memerlukan otorisasi DPJP. Administrator dan peran non-medis dilarang mengakses modul ini."
          />
          <div className="pt-2">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full h-9 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors"
            >
              Kembali ke Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ukuranHalaman = 10;

  const bangsalPenugasan =
    profil.daftarBangsalId.length > 0
      ? profil.daftarBangsalId[0]
      : "BANGSAL-MELATI";

  // Definisi kolom tabel antrean dokter
  const kolomAntrean: readonly DefinisiKolomTabel<ItemAntreanDokterDto>[] = [
    {
      id: "nomorAntreanHarian",
      header: "No.",
      lebarKelas: "w-[60px]",
      renderSel: (item: ItemAntreanDokterDto) => (
        <span className="font-bold text-slate-900">
          #{item.nomorAntreanHarian}
        </span>
      ),
    },
    {
      id: "kodeAntrean",
      header: "Kode Antrean",
      lebarKelas: "w-[130px]",
      renderSel: (item: ItemAntreanDokterDto) => (
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {item.kodeAntrean}
        </span>
      ),
    },
    {
      id: "nomorRekamMedis",
      header: "No. RM",
      lebarKelas: "w-[120px]",
      renderSel: (item: ItemAntreanDokterDto) => (
        <span className="font-mono font-semibold text-slate-800">
          {item.nomorRekamMedis}
        </span>
      ),
    },
    {
      id: "namaLengkap",
      header: "Identitas Pasien (2 Pengenal)",
      renderSel: (item: ItemAntreanDokterDto) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            {item.namaLengkap}
            <ShieldCheck className="size-3.5 text-emerald-600 inline" />
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>Tgl Lahir: {item.tanggalLahir}</span>
            <span>•</span>
            <span className="capitalize">{item.jenisKelamin}</span>
          </div>
        </div>
      ),
    },
    {
      id: "prioritasAntrean",
      header: "Prioritas",
      lebarKelas: "w-[110px]",
      renderSel: (item: ItemAntreanDokterDto) => (
        <StatusBadge
          varian={item.prioritasAntrean === "mendesak" ? "ditahan" : "netral"}
          label={item.prioritasAntrean.toUpperCase()}
        />
      ),
    },
    {
      id: "statusKunjungan",
      header: "Status Klinis",
      lebarKelas: "w-[160px]",
      renderSel: (item: ItemAntreanDokterDto) => (
        <StatusBadge
          varian={
            item.statusKunjungan === "diajukan_rawat_inap"
              ? "sesuai"
              : item.statusKunjungan === "selesai_pemeriksaan"
                ? "sesuai"
                : item.statusKunjungan === "sedang_diperiksa"
                  ? "menunggu"
                  : "netral"
          }
          label={item.statusKunjungan.replace(/_/g, " ").toUpperCase()}
        />
      ),
    },
    {
      id: "kunjunganId",
      header: "Aksi Klinis",
      lebarKelas: "w-[140px]",
      renderSel: (item: ItemAntreanDokterDto) => {
        const terpilih = antreanTerpilih?.kunjunganId === item.kunjunganId;
        return (
          <Button
            size="sm"
            variant={terpilih ? "default" : "outline"}
            className="h-7 text-xs font-semibold gap-1.5"
            onClick={() => {
              pilihPasien(item);
              setTabAktif("pemeriksaan");
            }}
          >
            <Stethoscope className="size-3.5" />
            {terpilih ? "Sedang Aktif" : "Periksa Pasien"}
          </Button>
        );
      },
    },
  ];

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Ruang Kerja Dokter Penanggung Jawab Pelayanan"
      subjudulHalaman={`DPJP ${profil.namaLengkap} • Penugasan Wilayah Klinis ${bangsalPenugasan} • Sesuai BRD Bab IV.4.2 s.d. IV.4.4`}
      profil={profil}
      navigasi={navigasi}
      notifikasiItems={notifikasiItems}
      jumlahBelumDibaca={jumlahBelumDibaca}
      sedangMemuatNotifikasi={sedangMemuatNotifikasi}
      onTandaiSatuNotifikasiDibaca={tandaiSatuNotifikasiDibaca}
      onTandaiSemuaNotifikasiDibaca={tandaiSemuaNotifikasiDibaca}
      onKeluarSesi={keluarSesi}
      onPilihMenuTerkunci={(item: ItemNavigasiPeran) => setMenuTerkunci(item)}
    >
      <div className="space-y-6 pb-12">
        {/* Banner Penugasan Bangsal & Keselamatan DPJP (AB-032 & AB-020) */}
        <section
          aria-label="Informasi Wilayah Penugasan Dokter"
          className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-xs"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Stethoscope className="size-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-blue-950">
                    Otoritas Medis DPJP: {profil.namaLengkap}
                  </h1>
                  <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                    Wilayah: {bangsalPenugasan}
                  </span>
                </div>
                <p className="text-xs text-blue-900/80">
                  Wajib melakukan verifikasi sedikitnya dua pengenal (Nomor RM + Tanggal Lahir) sebelum pemeriksaan medis dan peresepan diet (AB-020).
                  Hanya DPJP yang berwenang menetapkan dan merevisi instruksi diet klinis (AB-003, AB-004).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={muatAntrean}
                disabled={sedangMemuatAntrean}
                className="h-8 text-xs font-semibold gap-1.5 bg-white hover:bg-slate-50 border-blue-200"
              >
                <RefreshCw
                  className={`size-3.5 ${sedangMemuatAntrean ? "animate-spin" : ""}`}
                />
                Segarkan Antrean
              </Button>
            </div>
          </div>
        </section>

        {/* Notifikasi Toast */}
        {toast && (
          <MinimalToastBanner
            pesan={toast.pesan}
            jenis={toast.jenis}
            onTutup={() => setToast(null)}
          />
        )}

        {/* Peringatan Penahanan Keselamatan Pasien (AB-020) */}
        {peringatanKeselamatan && (
          <SafetyHoldBanner
            judul="Penahanan Keselamatan Pasien (AB-020): Verifikasi Dua Pengenal Gagal"
            alasanPenahanan={peringatanKeselamatan}
            tindakLanjutWajib="Pastikan data tanggal lahir dicocokkan langsung dari gelang identitas fisik pasien atau dokumen resmi sebelum melanjutkan."
          />
        )}

        {/* Kartu Ringkasan Antrean Klinis */}
        <section
          aria-label="Statistik Antrean Poliklinik"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>Menunggu Pemeriksaan</span>
              <Clock className="size-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {ringkasan.menungguPemeriksaan}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pasien terdaftar di loket
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>Sedang Diperiksa</span>
              <Activity className="size-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700 mt-2">
              {ringkasan.sedangDiperiksa}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Di ruang periksa DPJP
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>Selesai Pemeriksaan</span>
              <CheckCircle2 className="size-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-2">
              {ringkasan.selesaiPemeriksaan}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Diet sah / rawat jalan
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span>Diajukan Rawat Inap</span>
              <BedDouble className="size-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700 mt-2">
              {ringkasan.diajukanRawatInap}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Menunggu penempatan rawat inap
            </p>
          </div>
        </section>

        {/* Panel Pasien Aktif */}
        {antreanTerpilih && (
          <section
            aria-label="Panel Pasien Aktif"
            className="rounded-xl border border-slate-300 bg-white p-4 shadow-xs space-y-3"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center shrink-0">
                  {antreanTerpilih.namaLengkap.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">
                      {antreanTerpilih.namaLengkap}
                    </h2>
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {antreanTerpilih.nomorRekamMedis}
                    </span>
                    <StatusBadge
                      varian={
                        antreanTerpilih.prioritasAntrean === "mendesak"
                          ? "ditahan"
                          : "netral"
                      }
                      label={antreanTerpilih.prioritasAntrean.toUpperCase()}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>
                      Tanggal Lahir:{" "}
                      <strong className="text-slate-800">
                        {antreanTerpilih.tanggalLahir}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Keluhan Loket:{" "}
                      <em>{antreanTerpilih.keluhanAdministratif}</em>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Alergi & Diet Terkini Pasien */}
              <div className="flex flex-wrap items-center gap-2">
                {detailKlinis?.alergiAktif && detailKlinis.alergiAktif.length > 0 ? (
                  <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 flex items-center gap-1.5">
                    <AlertOctagon className="size-3.5 text-rose-600" />
                    {detailKlinis.alergiAktif.length} Alergi Aktif
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    Tidak Ada Alergi
                  </span>
                )}

                {detailKlinis?.instruksiDietAktif ? (
                  <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 flex items-center gap-1.5">
                    <UtensilsCrossed className="size-3.5 text-blue-600" />
                    Diet: {detailKlinis.instruksiDietAktif.jenisDiet.toUpperCase()} (v{detailKlinis.instruksiDietAktif.versi})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    Belum Ada Diet Sah
                  </span>
                )}
              </div>
            </div>

            {/* Navigasi Tab Klinis Dokter */}
            <div className="flex flex-wrap gap-1 border-b border-border pt-1">
              <button
                type="button"
                onClick={() => setTabAktif("antrean")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  tabAktif === "antrean"
                    ? "bg-slate-100 text-slate-900 border-b-2 border-blue-700"
                    : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Clock className="size-3.5" />
                Daftar Antrean ({daftarAntrean.length})
              </button>

              <button
                type="button"
                onClick={() => setTabAktif("pemeriksaan")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  tabAktif === "pemeriksaan"
                    ? "bg-slate-100 text-slate-900 border-b-2 border-blue-700"
                    : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Stethoscope className="size-3.5" />
                Pemeriksaan & Tanda Vital (AB-020)
              </button>

              <button
                type="button"
                onClick={() => setTabAktif("alergi")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  tabAktif === "alergi"
                    ? "bg-slate-100 text-slate-900 border-b-2 border-blue-700"
                    : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <AlertOctagon className="size-3.5" />
                Rekam Alergi ({detailKlinis?.alergiAktif.length ?? 0})
              </button>

              <button
                type="button"
                onClick={() => setTabAktif("diet_awal")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  tabAktif === "diet_awal"
                    ? "bg-slate-100 text-slate-900 border-b-2 border-blue-700"
                    : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <UtensilsCrossed className="size-3.5" />
                Instruksi Diet Awal Sah (AB-003)
              </button>

              <button
                type="button"
                onClick={() => setTabAktif("koreksi_diet")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  tabAktif === "koreksi_diet"
                    ? "bg-slate-100 text-slate-900 border-b-2 border-blue-700"
                    : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <History className="size-3.5" />
                Revisi Diet Berversi (AB-004, AB-030)
              </button>

              <button
                type="button"
                onClick={() => setTabAktif("rawat_inap")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  tabAktif === "rawat_inap"
                    ? "bg-slate-100 text-slate-900 border-b-2 border-blue-700"
                    : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <BedDouble className="size-3.5" />
                Pengajuan Rawat Inap
              </button>
            </div>
          </section>
        )}

        {/* KONTEN TAB 1: Antrean Pasien Dokter */}
        {tabAktif === "antrean" && (
          <section
            aria-labelledby="judul-antrean-dokter"
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2
                  id="judul-antrean-dokter"
                  className="text-sm font-bold text-slate-900 flex items-center gap-2"
                >
                  <Clock className="size-4 text-blue-700" />
                  Antrean Kunjungan Pasien • Poliklinik Penyakit Dalam ({bangsalPenugasan})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Daftar pasien yang telah melalui registrasi loket dan menunggu pemeriksaan medis DPJP.
                </p>
              </div>
            </div>

            <DataTableFoundation
              judulTabel="Antrean Kunjungan Pasien • Poliklinik Penyakit Dalam"
              deskripsiTabel="Daftar pasien yang telah melalui registrasi loket dan menunggu pemeriksaan medis DPJP."
              kolom={kolomAntrean}
              data={daftarAntrean}
              ambilKunciBaris={(item: ItemAntreanDokterDto) => item.kunjunganId}
              kataKunciCari={kataKunciCari}
              onUbahKataKunciCari={(k) => {
                setKataKunciCari(k);
                setHalamanSaatIni(1);
              }}
              placeholderCari="Cari nama pasien atau No. RM..."
              sedangMemuat={sedangMemuatAntrean}
              halamanSaatIni={halamanSaatIni}
              totalHalaman={Math.max(1, Math.ceil(daftarAntrean.length / ukuranHalaman))}
              totalData={daftarAntrean.length}
              onUbahHalaman={(hlm) => setHalamanSaatIni(hlm)}
              judulKosong="Tidak ada pasien dalam antrean poliklinik saat ini."
              deskripsiKosong="Pasien yang telah didaftarkan di loket pendaftaran akan otomatis muncul pada daftar antrean ini."
            />
          </section>
        )}

        {/* KONTEN TAB 2: Pemeriksaan Klinis & Tanda Vital (AB-020, AB-006) */}
        {tabAktif === "pemeriksaan" && antreanTerpilih && (
          <section
            aria-labelledby="judul-pemeriksaan"
            className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="judul-pemeriksaan"
                  className="text-sm font-bold text-slate-900 flex items-center gap-2"
                >
                  <Stethoscope className="size-4 text-blue-700" />
                  Pemeriksaan Klinis & Tanda Vital Pasien (AB-006)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Catat keluhan utama, tanda vital, diagnosis primer/sekunder, dan rekomendasi tindak lanjut medis.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                Kunjungan: {antreanTerpilih.nomorKunjungan}
              </span>
            </div>

            <form onSubmit={tanganiSimpanPemeriksaan} className="space-y-5">
              {/* Box Verifikasi Dua Pengenal (AB-020) */}
              <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <ShieldCheck className="size-4 text-emerald-700" />
                  Verifikasi Dua Pengenal Pasien Wajib (AB-020)
                </div>
                <p className="text-[11px] text-emerald-950">
                  Untuk mencegah kesalahan identitas pasien, DPJP wajib mencocokkan tanggal lahir pasien yang ditanyakan langsung atau tertera pada gelang pasien dengan data sistem.
                </p>
                <div className="max-w-xs">
                  <FormFieldMolecule
                    id="verifikasi-tanggal-lahir-input"
                    label="Konfirmasi Tanggal Lahir Pasien (YYYY-MM-DD)"
                    wajib
                    bantuan="Ketik tanggal lahir pasien untuk validasi keselamatan (Contoh: 1980-04-12)"
                  >
                    <input
                      id="verifikasi-tanggal-lahir-input"
                      type="date"
                      required
                      value={verifikasiTanggalLahir}
                      onChange={(e) => setVerifikasiTanggalLahir(e.target.value)}
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>
                </div>
              </div>

              {/* Tanda-Tanda Vital */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HeartPulse className="size-3.5 text-rose-600" />
                  Tanda-Tanda Vital (Vital Signs)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <FormFieldMolecule id="tekanan-sistol-input" label="Sistol (mmHg)">
                    <input
                      id="tekanan-sistol-input"
                      type="number"
                      placeholder="120"
                      value={tekananDarahSistol}
                      onChange={(e) =>
                        setTekananDarahSistol(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="tekanan-diastol-input" label="Diastol (mmHg)">
                    <input
                      id="tekanan-diastol-input"
                      type="number"
                      placeholder="80"
                      value={tekananDarahDiastol}
                      onChange={(e) =>
                        setTekananDarahDiastol(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="denyut-nadi-input" label="Nadi (x/mnt)">
                    <input
                      id="denyut-nadi-input"
                      type="number"
                      placeholder="80"
                      value={denyutNadi}
                      onChange={(e) =>
                        setDenyutNadi(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="frekuensi-nafas-input" label="Nafas (x/mnt)">
                    <input
                      id="frekuensi-nafas-input"
                      type="number"
                      placeholder="18"
                      value={frekuensiNafas}
                      onChange={(e) =>
                        setFrekuensiNafas(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="suhu-tubuh-input" label="Suhu (°C)">
                    <input
                      id="suhu-tubuh-input"
                      type="number"
                      step="0.1"
                      placeholder="36.5"
                      value={suhuTubuh}
                      onChange={(e) =>
                        setSuhuTubuh(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="berat-badan-input" label="Berat (kg)">
                    <input
                      id="berat-badan-input"
                      type="number"
                      step="0.1"
                      placeholder="60.0"
                      value={beratBadanKg}
                      onChange={(e) =>
                        setBeratBadanKg(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>
                </div>
              </div>

              {/* Keluhan & Riwayat Penyakit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormFieldMolecule id="keluhan-utama-input" label="Keluhan Utama Pasien" wajib>
                  <textarea
                    id="keluhan-utama-input"
                    required
                    rows={2}
                    value={keluhanUtama}
                    onChange={(e) => setKeluhanUtama(e.target.value)}
                    placeholder="Keluhan yang dirasakan pasien saat tiba di poliklinik..."
                    className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule id="riwayat-penyakit-input" label="Riwayat Penyakit Sekarang & Komorbid">
                  <textarea
                    id="riwayat-penyakit-input"
                    rows={2}
                    value={riwayatPenyakit}
                    onChange={(e) => setRiwayatPenyakit(e.target.value)}
                    placeholder="Riwayat penyakit kronis, diabetes, hipertensi, atau gangguan saluran cerna..."
                    className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </FormFieldMolecule>
              </div>

              {/* Diagnosis Klinis & Catatan Gizi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <FormFieldMolecule id="diagnosis-primer-input" label="Diagnosis Klinis Primer (Utama)" wajib>
                    <input
                      id="diagnosis-primer-input"
                      type="text"
                      required
                      value={diagnosisPrimer}
                      onChange={(e) => setDiagnosisPrimer(e.target.value)}
                      placeholder="Contoh: Diabetes Melitus Tipe 2 Tidak Terkontrol"
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="diagnosis-sekunder-input" label="Diagnosis Klinis Sekunder / Tambahan">
                    <input
                      id="diagnosis-sekunder-input"
                      type="text"
                      value={diagnosisSekunder}
                      onChange={(e) => setDiagnosisSekunder(e.target.value)}
                      placeholder="Contoh: Gastritis Akut / Hipertensi Grade 1"
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>
                </div>

                <div className="space-y-3">
                  <FormFieldMolecule id="catatan-gizi-input" label="Catatan Klinis Terkait Terapi Gizi">
                    <textarea
                      id="catatan-gizi-input"
                      rows={2}
                      value={catatanGizi}
                      onChange={(e) => setCatatanGizi(e.target.value)}
                      placeholder="Petunjuk khusus untuk Ahli Gizi: pembatasan natrium, hindari makanan bergas..."
                      className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="tindak-lanjut-select" label="Rencana Tindak Lanjut Medis" wajib>
                    <select
                      id="tindak-lanjut-select"
                      value={tindakLanjut}
                      onChange={(e) =>
                        setTindakLanjut(e.target.value as TindakLanjutPemeriksaan)
                      }
                      className={KELAS_INPUT}
                    >
                      {DAFTAR_TINDAK_LANJUT.map((t) => (
                        <option key={t.nilai} value={t.nilai}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </FormFieldMolecule>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={sedangSimpanPemeriksaan}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold h-9 px-4 gap-1.5"
                >
                  <FileCheck2 className="size-4" />
                  {sedangSimpanPemeriksaan
                    ? "Menyimpan Pemeriksaan..."
                    : "Simpan & Sahkan Pemeriksaan (AB-020)"}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* KONTEN TAB 3: Rekam Alergi Pasien (AB-007) */}
        {tabAktif === "alergi" && antreanTerpilih && (
          <section
            aria-labelledby="judul-alergi"
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2
                    id="judul-alergi"
                    className="text-sm font-bold text-slate-900 flex items-center gap-2"
                  >
                    <AlertOctagon className="size-4 text-rose-600" />
                    Pencatatan Alergi Makanan & Obat Pasien (AB-007)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Seluruh alergi makanan aktif akan secara otomatis memblokir menu berbahan alergen terkait pada tahap pemesanan gizi.
                  </p>
                </div>
              </div>

              {/* Daftar Alergi Aktif Saat Ini */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800">
                  Daftar Alergen Aktif Terdaftar:
                </h3>
                {detailKlinis?.alergiAktif && detailKlinis.alergiAktif.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {detailKlinis.alergiAktif.map((alg) => (
                      <div
                        key={alg.id}
                        className={`rounded-lg border p-3 space-y-1.5 ${
                          alg.tingkatKeparahan === "berat_anafilaksis"
                            ? "border-rose-300 bg-rose-50/80 text-rose-950"
                            : "border-amber-300 bg-amber-50/70 text-amber-950"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">
                            {alg.namaAlergen}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider bg-white/80 border border-current">
                            {alg.kategoriAlergen}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {alg.reaksiAlergi}
                        </p>
                        <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-semibold capitalize">
                            Keparahan: {alg.tingkatKeparahan.replace(/_/g, " ")}
                          </span>
                          <span>Oleh: {alg.dicatatOlehNama}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-slate-50 p-3 rounded border border-border">
                    Belum ada rekaman alergi aktif untuk pasien ini. Tambahkan alergen bila ditemukan riwayat alergi.
                  </p>
                )}
              </div>

              {/* Form Tambah Alergi */}
              <form
                onSubmit={tanganiSimpanAlergi}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FilePlus className="size-3.5 text-blue-700" />
                  Tambah Alergen Baru Pasien
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormFieldMolecule id="kategori-alergen-select" label="Kategori Alergen" wajib>
                    <select
                      id="kategori-alergen-select"
                      value={kategoriAlergen}
                      onChange={(e) =>
                        setKategoriAlergen(e.target.value as KategoriAlergen)
                      }
                      className={KELAS_INPUT}
                    >
                      {DAFTAR_KATEGORI_ALERGEN.map((k) => (
                        <option key={k.nilai} value={k.nilai}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </FormFieldMolecule>

                  <FormFieldMolecule id="nama-alergen-input" label="Nama Alergen Spesifik" wajib>
                    <input
                      id="nama-alergen-input"
                      type="text"
                      required
                      placeholder="Contoh: Kacang Kedelai / Udang / Penisilin"
                      value={namaAlergen}
                      onChange={(e) => setNamaAlergen(e.target.value)}
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="tingkat-keparahan-select" label="Tingkat Keparahan Klinis" wajib>
                    <select
                      id="tingkat-keparahan-select"
                      value={tingkatKeparahan}
                      onChange={(e) =>
                        setTingkatKeparahan(
                          e.target.value as TingkatKeparahanAlergi,
                        )
                      }
                      className={KELAS_INPUT}
                    >
                      {DAFTAR_TINGKAT_KEPARAHAN.map((k) => (
                        <option key={k.nilai} value={k.nilai}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </FormFieldMolecule>
                </div>

                <FormFieldMolecule id="reaksi-alergi-input" label="Reaksi Klinis yang Muncul (Manifestasi Alergi)" wajib>
                  <input
                    id="reaksi-alergi-input"
                    type="text"
                    required
                    placeholder="Contoh: Ruam kemerahan, bengkak bibir, mual muntah, atau sesak napas..."
                    value={reaksiAlergi}
                    onChange={(e) => setReaksiAlergi(e.target.value)}
                    className={KELAS_INPUT}
                  />
                </FormFieldMolecule>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={sedangSimpanAlergi}
                    className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold h-8 px-3 gap-1.5"
                  >
                    <AlertOctagon className="size-3.5" />
                    {sedangSimpanAlergi ? "Menyimpan Alergi..." : "Catat Alergi Pasien (AB-007)"}
                  </Button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* KONTEN TAB 4: Instruksi Diet Awal Sah (AB-003, AB-005, AB-008, AB-009) */}
        {tabAktif === "diet_awal" && antreanTerpilih && (
          <section
            aria-labelledby="judul-diet-awal"
            className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="judul-diet-awal"
                  className="text-sm font-bold text-slate-900 flex items-center gap-2"
                >
                  <UtensilsCrossed className="size-4 text-blue-700" />
                  Penetapan & Otorisasi Instruksi Diet Awal Sah (AB-003)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Hanya Dokter DPJP yang berwenang menetapkan jenis diet, bentuk makanan, dan rute pemberian awal pasien.
                </p>
              </div>

              {detailKlinis?.instruksiDietAktif && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300">
                  Sudah Ada Diet Aktif: {detailKlinis.instruksiDietAktif.nomorInstruksi}
                </span>
              )}
            </div>

            {detailKlinis?.instruksiDietAktif ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-blue-950">
                      Pasien Sudah Memiliki Instruksi Diet Sah Terdaftar
                    </h3>
                    <p className="text-xs text-blue-900/80">
                      Nomor: <strong>{detailKlinis.instruksiDietAktif.nomorInstruksi}</strong> (Versi {detailKlinis.instruksiDietAktif.versi}) • Jenis: {detailKlinis.instruksiDietAktif.jenisDiet.toUpperCase()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setTabAktif("koreksi_diet")}
                    className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold gap-1.5"
                  >
                    <History className="size-3.5" />
                    Buka Menu Revisi Versi Diet
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={tanganiKonfirmasiDietAwal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormFieldMolecule id="jenis-diet-select" label="Jenis Diet Klinis Utama" wajib>
                    <select
                      id="jenis-diet-select"
                      value={jenisDiet}
                      onChange={(e) =>
                        setJenisDiet(e.target.value as JenisDietKlinis | "")
                      }
                      className={KELAS_INPUT}
                      required
                    >
                      <option value="" disabled>Pilih diet yang disahkan DPJP</option>
                      {DAFTAR_JENIS_DIET.map((j) => (
                        <option key={j.nilai} value={j.nilai}>
                          {j.label}
                        </option>
                      ))}
                    </select>
                  </FormFieldMolecule>

                  <FormFieldMolecule id="bentuk-makanan-select" label="Bentuk Makanan (Konsistensi)" wajib>
                    <select
                      id="bentuk-makanan-select"
                      value={bentukMakanan}
                      onChange={(e) =>
                        setBentukMakanan(e.target.value as BentukMakananKlinis | "")
                      }
                      className={KELAS_INPUT}
                      required
                    >
                      <option value="" disabled>Pilih bentuk makanan</option>
                      {DAFTAR_BENTUK_MAKANAN.map((b) => (
                        <option key={b.nilai} value={b.nilai}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </FormFieldMolecule>

                  <FormFieldMolecule id="rute-pemberian-select" label="Rute Pemberian Nutrisi" wajib>
                    <select
                      id="rute-pemberian-select"
                      value={rutePemberian}
                      onChange={(e) =>
                        setRutePemberian(e.target.value as RutePemberianNutrisi | "")
                      }
                      className={KELAS_INPUT}
                      required
                    >
                      <option value="" disabled>Pilih rute pemberian</option>
                      {DAFTAR_RUTE_PEMBERIAN.map((r) => (
                        <option key={r.nilai} value={r.nilai}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </FormFieldMolecule>
                </div>

                {jenisDiet === "khusus_kombinasi" && (
                  <FormFieldMolecule id="nama-diet-kustom-input" label="Nama Diet Khusus / Kustom" wajib>
                    <input
                      id="nama-diet-kustom-input"
                      type="text"
                      required
                      placeholder="Contoh: Diet Rendah Purin Kombinasi Rendah Garam II"
                      value={namaDietKustom}
                      onChange={(e) => setNamaDietKustom(e.target.value)}
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>
                )}

                {/* Kontrol Puasa / NPO (AB-008) */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-amber-950">Status puasa / NPO (AB-008) *</legend>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-2"><input type="radio" name="status-puasa" checked={statusPuasaNpo === false} onChange={() => setStatusPuasaNpo(false)} required />Tidak puasa</label>
                      <label className="flex items-center gap-2"><input type="radio" name="status-puasa" checked={statusPuasaNpo === true} onChange={() => setStatusPuasaNpo(true)} required />Pasien dipuasakan (NPO)</label>
                    </div>
                  </fieldset>

                  {statusPuasaNpo && (
                    <FormFieldMolecule
                      id="alasan-puasa-input"
                      label="Alasan Medis Puasa (Wajib diisi sesuai AB-008)"
                      wajib
                    >
                      <input
                        id="alasan-puasa-input"
                        type="text"
                        required
                        placeholder="Contoh: Puasa pre-operatif jam 24:00 / Evaluasi perdarahan saluran cerna..."
                        value={alasanPuasa}
                        onChange={(e) => setAlasanPuasa(e.target.value)}
                        className={KELAS_INPUT}
                      />
                    </FormFieldMolecule>
                  )}
                </div>

                {/* Target Nutrisi & Pembatasan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <FormFieldMolecule id="target-energi-input" label="Target Energi (kkal)">
                    <input
                      id="target-energi-input"
                      type="number"
                      value={targetEnergiKkal}
                      onChange={(e) =>
                        setTargetEnergiKkal(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="target-protein-input" label="Target Protein (gram)">
                    <input
                      id="target-protein-input"
                      type="number"
                      value={targetProteinGram}
                      onChange={(e) =>
                        setTargetProteinGram(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="batasan-cairan-input" label="Batasan Cairan (ml/24j)">
                    <input
                      id="batasan-cairan-input"
                      type="number"
                      placeholder="2000"
                      value={pembatasanCairanMl}
                      onChange={(e) =>
                        setPembatasanCairanMl(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule id="batasan-natrium-input" label="Batasan Natrium (mg/24j)">
                    <input
                      id="batasan-natrium-input"
                      type="number"
                      placeholder="1500"
                      value={pembatasanNatriumMg}
                      onChange={(e) =>
                        setPembatasanNatriumMg(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>
                </div>

                <FormFieldMolecule id="instruksi-khusus-input" label="Instruksi Klinis Khusus untuk Ahli Gizi / Dapur">
                  <textarea
                    id="instruksi-khusus-input"
                    rows={2}
                    value={instruksiKhusus}
                    onChange={(e) => setInstruksiKhusus(e.target.value)}
                    placeholder="Bagi porsi kecil sering (6x makan), hindari makanan bersantan kental dan pedas..."
                    className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </FormFieldMolecule>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    type="submit"
                    disabled={sedangSimpanDiet}
                    className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold h-9 px-4 gap-1.5"
                  >
                    <CheckCircle2 className="size-4" />
                    {sedangSimpanDiet
                      ? "Mengesahkan..."
                      : "Sahkan Instruksi Diet Awal (DPJP Sah)"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* KONTEN TAB 5: Revisi Diet Berversi (AB-004, AB-010, AB-030) */}
        {tabAktif === "koreksi_diet" && antreanTerpilih && (
          <section
            aria-labelledby="judul-revisi-diet"
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2
                    id="judul-revisi-diet"
                    className="text-sm font-bold text-slate-900 flex items-center gap-2"
                  >
                    <History className="size-4 text-blue-700" />
                    Perubahan & Koreksi Berversi Instruksi Diet (AB-004, AB-030)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Setiap pembaruan resep diet menghasilkan versi baru bertahap (+1) dengan alasan perubahan wajib dan jejak audit lengkap.
                  </p>
                </div>

                {detailKlinis?.instruksiDietAktif && (
                  <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                    Versi Terkini: Versi {detailKlinis.instruksiDietAktif.versi}
                  </span>
                )}
              </div>

              {!detailKlinis?.instruksiDietAktif ? (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-xs">
                  Pasien belum memiliki instruksi diet aktif. Buka tab <strong>Instruksi Diet Awal Sah</strong> terlebih dahulu.
                </div>
              ) : (
                <form onSubmit={tanganiSimpanKoreksiDiet} className="space-y-4">
                  {/* Banner Optimistic Concurrency Control */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 flex items-center justify-between">
                    <div>
                      Memperbarui dari: <strong>{detailKlinis.instruksiDietAktif.nomorInstruksi}</strong> (Versi {detailKlinis.instruksiDietAktif.versi}) → Akan menjadi <strong>Versi {detailKlinis.instruksiDietAktif.versi + 1}</strong>
                    </div>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      Terkunci Konkurensi Optimistik
                    </span>
                  </div>

                  <FormFieldMolecule
                    id="koreksi-alasan-input"
                    label="Alasan Perubahan / Evaluasi Klinis Pasien (Wajib sesuai AB-004 & AB-010)"
                    wajib
                  >
                    <textarea
                      id="koreksi-alasan-input"
                      required
                      rows={2}
                      value={koreksiAlasanPerubahan}
                      onChange={(e) => setKoreksiAlasanPerubahan(e.target.value)}
                      placeholder="Contoh: Evaluasi kadar gula darah terkontrol (GDS 130), naik bertahap dari bubur saring ke makanan lunak..."
                      className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                  </FormFieldMolecule>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormFieldMolecule id="koreksi-jenis-diet-select" label="Jenis Diet Baru" wajib>
                      <select
                        id="koreksi-jenis-diet-select"
                        value={koreksiJenisDiet}
                        onChange={(e) =>
                          setKoreksiJenisDiet(e.target.value as JenisDietKlinis)
                        }
                        className={KELAS_INPUT}
                      >
                        {DAFTAR_JENIS_DIET.map((j) => (
                          <option key={j.nilai} value={j.nilai}>
                            {j.label}
                          </option>
                        ))}
                      </select>
                    </FormFieldMolecule>

                    <FormFieldMolecule id="koreksi-bentuk-makanan-select" label="Bentuk Makanan Baru" wajib>
                      <select
                        id="koreksi-bentuk-makanan-select"
                        value={koreksiBentukMakanan}
                        onChange={(e) =>
                          setKoreksiBentukMakanan(
                            e.target.value as BentukMakananKlinis,
                          )
                        }
                        className={KELAS_INPUT}
                      >
                        {DAFTAR_BENTUK_MAKANAN.map((b) => (
                          <option key={b.nilai} value={b.nilai}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </FormFieldMolecule>

                    <FormFieldMolecule id="koreksi-rute-pemberian-select" label="Rute Pemberian Baru" wajib>
                      <select
                        id="koreksi-rute-pemberian-select"
                        value={koreksiRutePemberian}
                        onChange={(e) =>
                          setKoreksiRutePemberian(
                            e.target.value as RutePemberianNutrisi,
                          )
                        }
                        className={KELAS_INPUT}
                      >
                        {DAFTAR_RUTE_PEMBERIAN.map((r) => (
                          <option key={r.nilai} value={r.nilai}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </FormFieldMolecule>
                  </div>

                  {/* Kontrol Puasa Revisi */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={koreksiStatusPuasa}
                        onChange={(e) => setKoreksiStatusPuasa(e.target.checked)}
                        className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-amber-950">
                        Pasien Dipuasakan (NPO) pada Versi Diet Ini
                      </span>
                    </label>

                    {koreksiStatusPuasa && (
                      <FormFieldMolecule id="koreksi-alasan-puasa-input" label="Alasan Puasa (Wajib)" wajib>
                        <input
                          id="koreksi-alasan-puasa-input"
                          type="text"
                          required
                          placeholder="Alasan puasa pada revisi ini..."
                          value={koreksiAlasanPuasa}
                          onChange={(e) => setKoreksiAlasanPuasa(e.target.value)}
                          className={KELAS_INPUT}
                        />
                      </FormFieldMolecule>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <FormFieldMolecule id="koreksi-energi-input" label="Target Energi (kkal)">
                      <input
                        id="koreksi-energi-input"
                        type="number"
                        value={koreksiEnergiKkal}
                        onChange={(e) =>
                          setKoreksiEnergiKkal(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        className={KELAS_INPUT}
                      />
                    </FormFieldMolecule>

                    <FormFieldMolecule id="koreksi-protein-input" label="Target Protein (gram)">
                      <input
                        id="koreksi-protein-input"
                        type="number"
                        value={koreksiProteinGram}
                        onChange={(e) =>
                          setKoreksiProteinGram(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        className={KELAS_INPUT}
                      />
                    </FormFieldMolecule>

                    <FormFieldMolecule id="koreksi-cairan-input" label="Batasan Cairan (ml)">
                      <input
                        id="koreksi-cairan-input"
                        type="number"
                        value={koreksiCairanMl}
                        onChange={(e) =>
                          setKoreksiCairanMl(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        className={KELAS_INPUT}
                      />
                    </FormFieldMolecule>

                    <FormFieldMolecule id="koreksi-natrium-input" label="Batasan Natrium (mg)">
                      <input
                        id="koreksi-natrium-input"
                        type="number"
                        value={koreksiNatriumMg}
                        onChange={(e) =>
                          setKoreksiNatriumMg(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        className={KELAS_INPUT}
                      />
                    </FormFieldMolecule>
                  </div>

                  <FormFieldMolecule id="koreksi-instruksi-khusus-input" label="Instruksi Klinis Khusus Tambahan">
                    <textarea
                      id="koreksi-instruksi-khusus-input"
                      rows={2}
                      value={koreksiInstruksiKhusus}
                      onChange={(e) => setKoreksiInstruksiKhusus(e.target.value)}
                      placeholder="Instruksi tambahan..."
                      className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                  </FormFieldMolecule>

                  <div className="flex justify-end pt-2 border-t border-border">
                    <Button
                      type="submit"
                      disabled={sedangSimpanKoreksiDiet}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold h-9 px-4 gap-1.5"
                    >
                      <History className="size-4" />
                      {sedangSimpanKoreksiDiet
                        ? "Menyimpan Revisi..."
                        : `Simpan Revisi Diet (Versi ${detailKlinis.instruksiDietAktif.versi + 1})`}
                    </Button>
                  </div>
                </form>
              )}

              {/* Riwayat Versi Terdahulu */}
              {detailKlinis?.riwayatVersiDiet && detailKlinis.riwayatVersiDiet.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-slate-600" />
                    Jejak Rekam Riwayat Versi Diet ({detailKlinis.riwayatVersiDiet.length} Revisi)
                  </h3>

                  <div className="space-y-2">
                    {detailKlinis.riwayatVersiDiet.map((rv) => (
                      <div
                        key={rv.id}
                        className="rounded-lg border border-border bg-slate-50 p-3 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-[11px]">
                            Versi {rv.versi}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(rv.diubahPada).toLocaleString("id-ID")} • Oleh {rv.diubahOlehNama}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium">
                          Alasan: &ldquo;{rv.alasanPerubahan}&rdquo;
                        </p>
                        <div className="text-[11px] text-muted-foreground flex gap-3 pt-0.5">
                          <span>Jenis: {rv.snapshotData.jenisDiet.toUpperCase()}</span>
                          <span>•</span>
                          <span>Bentuk: {rv.snapshotData.bentukMakanan}</span>
                          <span>•</span>
                          <span>Rute: {rv.snapshotData.rutePemberian}</span>
                          {rv.snapshotData.statusPuasaNpo && (
                            <>
                              <span>•</span>
                              <span className="text-rose-700 font-bold">Puasa NPO</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* KONTEN TAB 6: Pengajuan Rawat Inap (BRD Bab IV.4.3) */}
        {tabAktif === "rawat_inap" && antreanTerpilih && (
          <section
            aria-labelledby="judul-pengajuan-ri"
            className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="judul-pengajuan-ri"
                  className="text-sm font-bold text-slate-900 flex items-center gap-2"
                >
                  <BedDouble className="size-4 text-purple-700" />
                  Pengajuan Rawat Inap Pasien (BRD Bab IV.4.3)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Dokter DPJP menerbitkan pengajuan hospitalisasi ke bangsal perawatan. Status akan menjadi &ldquo;menunggu_penempatan&rdquo; untuk dieksekusi oleh Petugas Rawat Inap rawat inap.
                </p>
              </div>

              {detailKlinis?.pengajuanRawatInapAktif && (
                <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
                  Status: {detailKlinis.pengajuanRawatInapAktif.statusPengajuan.replace(/_/g, " ").toUpperCase()}
                </span>
              )}
            </div>

            {detailKlinis?.pengajuanRawatInapAktif ? (
              <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-purple-950">
                      Pengajuan Rawat Inap Aktif: {detailKlinis.pengajuanRawatInapAktif.nomorPengajuan}
                    </h3>
                    <p className="text-xs text-purple-900/80">
                      Diagnosis: <strong>{detailKlinis.pengajuanRawatInapAktif.diagnosisUtama}</strong> • Rekomendasi Bangsal: <strong>{detailKlinis.pengajuanRawatInapAktif.rekomendasiBangsal}</strong>
                    </p>
                    <p className="text-[11px] text-purple-900/70">
                      Alasan: &ldquo;{detailKlinis.pengajuanRawatInapAktif.alasanRawatInap}&rdquo;
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded border border-amber-300">
                    Menunggu Penempatan Kasur
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={tanganiSimpanPengajuanRi} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormFieldMolecule id="ri-diagnosis-input" label="Diagnosis Utama Rawat Inap" wajib>
                    <input
                      id="ri-diagnosis-input"
                      type="text"
                      required
                      placeholder="Contoh: Diabetes Melitus Tipe 2 dengan Dehidrasi Sedang"
                      value={riDiagnosisUtama}
                      onChange={(e) => setRiDiagnosisUtama(e.target.value)}
                      className={KELAS_INPUT}
                    />
                  </FormFieldMolecule>

                  <div className="grid grid-cols-2 gap-3">
                    <FormFieldMolecule id="ri-prioritas-select" label="Prioritas Rawat Inap" wajib>
                      <select
                        id="ri-prioritas-select"
                        value={riPrioritas}
                        onChange={(e) =>
                          setRiPrioritas(e.target.value as PrioritasRawatInap)
                        }
                        className={KELAS_INPUT}
                      >
                        <option value="rutin">Rutin (Terjadwal)</option>
                        <option value="mendesak">Mendesak (Prioritas Tinggi)</option>
                        <option value="darurat">Darurat (Emergency Bed)</option>
                      </select>
                    </FormFieldMolecule>

                    <FormFieldMolecule id="ri-bangsal-select" label="Rekomendasi Bangsal" wajib>
                      <select
                        id="ri-bangsal-select"
                        value={riBangsal}
                        onChange={(e) => setRiBangsal(e.target.value)}
                        className={KELAS_INPUT}
                      >
                        <option value="BANGSAL-MELATI">BANGSAL-MELATI (Penyakit Dalam)</option>
                        <option value="BANGSAL-ANGGREK">BANGSAL-ANGGREK (Bedah/Umum)</option>
                      </select>
                    </FormFieldMolecule>
                  </div>
                </div>

                <FormFieldMolecule id="ri-alasan-input" label="Indikasi / Alasan Rawat Inap" wajib>
                  <textarea
                    id="ri-alasan-input"
                    required
                    rows={2}
                    value={riAlasan}
                    onChange={(e) => setRiAlasan(e.target.value)}
                    placeholder="Contoh: Memerlukan regulasi insulin ketat secara parenteral dan observasi tanda vital per 4 jam..."
                    className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule id="ri-kebutuhan-input" label="Kebutuhan Khusus / Tindakan Selama Perawatan">
                  <input
                    id="ri-kebutuhan-input"
                    type="text"
                    placeholder="Contoh: Infus RL 20 tpm, Diet Lunak DM 1700 kkal, Monitor GDS per 6 jam"
                    value={riKebutuhanKhusus}
                    onChange={(e) => setRiKebutuhanKhusus(e.target.value)}
                    className={KELAS_INPUT}
                  />
                </FormFieldMolecule>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    type="submit"
                    disabled={sedangSimpanPengajuanRi}
                    className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold h-9 px-4 gap-1.5"
                  >
                    <BedDouble className="size-4" />
                    {sedangSimpanPengajuanRi
                      ? "Menerbitkan Pengajuan..."
                      : "Terbitkan Pengajuan Rawat Inap"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>

      {/* Dialog Konfirmasi Otorisasi Diet */}
      <ConfirmDialog
        terbuka={dialogKonfirmasiTerbuka}
        onPerubahanTerbuka={setDialogKonfirmasiTerbuka}
        judul={konfirmasiDietData?.judul ?? "Konfirmasi Otorisasi"}
        deskripsiDampak={
          konfirmasiDietData?.deskripsi ??
          "Apakah Anda yakin ingin memproses tindakan medis ini?"
        }
        labelKonfirmasi="Ya, Sahkan Instruksi"
        labelBatal="Batal / Periksa Kembali"
        onKonfirmasi={async () => {
          if (konfirmasiDietData) {
            await konfirmasiDietData.eksekusi();
          }
        }}
      />

      {/* Dialog Penolakan Menu Lintas Peran / Fail-Closed (AB-032) */}
      {menuTerkunci && (
        <ConfirmDialog
          terbuka={Boolean(menuTerkunci)}
          onPerubahanTerbuka={(terbuka: boolean) => {
            if (!terbuka) setMenuTerkunci(null);
          }}
          judul={`Pembatasan Akses Peran: ${menuTerkunci.label}`}
          deskripsiDampak={`Sesuai prinsip pemisahan kewenangan BRD Bab III (AB-032), modul "${menuTerkunci.label}" hanya dapat diakses oleh peran yang memiliki otorisasi terkait.`}
          labelKonfirmasi="Saya Mengerti"
          onKonfirmasi={() => setMenuTerkunci(null)}
        />
      )}
    </AppShellTemplate>
  );
}
