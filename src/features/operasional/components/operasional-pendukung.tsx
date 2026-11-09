"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/molecules/state-feedback";
import { BENTUK_MAKANAN, JADWAL_MAKAN_MENU, KATEGORI_MENU, type ItemKatalogMenuResepDto, type ProfilSesiPengguna, type ResponsApi } from "../../../../packages/shared-types/src/index.ts";

const inputClass = "mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600";
interface Episode { id: string; nomorEpisode: string; namaPasien: string; nomorRm: string; status: string }
interface Bahan { kodeBahan: string; namaBahan: string; satuan: string; alergen: string[] }
interface NilaiGizi { energiKkal: number; proteinGram: number }
interface EmpatTahap { dibutuhkan: NilaiGizi | null; direncanakan: NilaiGizi; disajikan: NilaiGizi; dikonsumsi: NilaiGizi | null; belumDicatat: number; porsiDisajikan: number }

async function minta<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json() as ResponsApi<T>;
  if (!json.sukses) throw new Error(json.galat.pesan);
  return json.data;
}

export function OperasionalPendukung({ profil }: { profil: ProfilSesiPengguna }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [rencana, setRencana] = useState<Array<{ id: string; nomorRencana: string; tanggalPelayanan: string; status: string }>>([]);
  const [recipes, setRecipes] = useState<ItemKatalogMenuResepDto[]>([]);
  const [ingredients, setIngredients] = useState<Bahan[]>([]);
  const [episodeId, setEpisodeId] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [rekap, setRekap] = useState<EmpatTahap | null>(null);
  const [komposisi, setKomposisi] = useState([{ kodeBahan: "", jumlah: 1, satuan: "gram" }]);
  const bolehRekap = ["dokter", "perawat", "ahli_gizi", "kepala_instalasi_gizi"].includes(profil.peran);
  const bolehInsiden = !["administrator", "petugas_pendaftaran", "petugas_rawat_inap"].includes(profil.peran);

  async function lakukan(aksi: () => Promise<void>) {
    setGalat(null); setPesan(null); setSibuk(true);
    try { await aksi(); } catch (error) { setGalat(error instanceof Error ? error.message : "Layanan lokal belum dapat dihubungi."); }
    finally { setSibuk(false); }
  }
  async function muatPilihan() {
    if (episodes.length || sibuk) return;
    await lakukan(async () => {
      setTanggal(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
      if (bolehRekap) {
        const hasil = await minta<{ items: Episode[] }>("/api/v1/operasional/episodes");
        setEpisodes(hasil.items);
        setEpisodeId(hasil.items[0]?.id ?? "");
      }
      if (["perawat", "ahli_gizi"].includes(profil.peran)) setRecipes((await minta<{ items: ItemKatalogMenuResepDto[] }>("/api/v1/operasional/recipes")).items);
      if (profil.peran === "ahli_gizi") setIngredients((await minta<{ items: Bahan[] }>("/api/v1/operasional/ingredients")).items);
    });
  }
  function pilihanEpisode() {
    return <label className="text-xs font-semibold text-slate-700">Episode pasien
      <select value={episodeId} onChange={(e) => { setEpisodeId(e.target.value); setRekap(null); }} className={inputClass} required>
        <option value="">Pilih episode perawatan</option>
        {episodes.map((e) => <option key={e.id} value={e.id}>{e.nomorRm} — {e.namaPasien} ({e.status})</option>)}
      </select>
    </label>;
  }
  async function simpanResep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    await lakukan(async () => {
      await minta("/api/v1/operasional/recipes", {
        kodeMenu: data.get("kodeMenu"), namaMenu: data.get("namaMenu"), kategoriMakanan: data.get("kategori"), bentukMakanan: data.get("bentuk"), jenisDietTerkait: data.get("jenisDiet"),
        energiKkal: Number(data.get("energi")), proteinGram: Number(data.get("protein")), lemakGram: Number(data.get("lemak")), karbohidratGram: Number(data.get("karbohidrat")),
        komposisiBahan: komposisi.map((row) => ({ ...row, namaBahan: ingredients.find((b) => b.kodeBahan === row.kodeBahan)?.namaBahan ?? "" })),
        alergen: String(data.get("alergen") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
      });
      form.reset(); setKomposisi([{ kodeBahan: "", jumlah: 1, satuan: "gram" }]);
      setPesan("Resep baru tersimpan. Segarkan katalog menu untuk memilihnya.");
    });
  }
  if (!bolehRekap && !bolehInsiden) return null;
  return <section aria-label="Pelayanan gizi dan tindak lanjut" className="space-y-3">
    {galat ? <ErrorState pesanAman={galat} /> : null}
    {pesan ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{pesan}</p> : null}
    {profil.peran === "perawat" ? <details className="rounded-xl border border-slate-200 bg-white p-5" onToggle={(e) => { if (e.currentTarget.open) void muatPilihan(); }}>
      <summary className="cursor-pointer text-sm font-bold text-slate-900">Proses pesanan diet awal</summary>
      <p className="mt-3 text-xs leading-5 text-slate-600">Gunakan instruksi dokter yang sudah sah dan verifikasi keamanan terkini. Pesanan awal dapat diproses sebelum penilaian ahli gizi selesai.</p>
      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void lakukan(async () => { await minta("/api/v1/operasional/initial-meals", { episodeId, tanggalPelayanan: tanggal, jadwalMakan: data.get("sesi"), menuId: data.get("menu") }); setPesan("Pesanan awal berhasil dibuat dan masuk daftar porsi dapur."); }); }}>
        {pilihanEpisode()}
        <label className="text-xs font-semibold text-slate-700">Tanggal pelayanan<input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={inputClass} required /></label>
        <label className="text-xs font-semibold text-slate-700">Sesi makan<select name="sesi" className={inputClass}>{JADWAL_MAKAN_MENU.map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">Menu sesuai instruksi dokter<select name="menu" className={inputClass} required><option value="">Pilih menu awal</option>{recipes.map((v) => <option key={v.id} value={v.id}>{v.namaMenu} · {v.jenisDietTerkait} · {v.bentukMakanan}</option>)}</select></label>
        <Button disabled={sibuk || !episodeId} type="submit" className="md:col-span-2 justify-self-start">Proses pesanan awal</Button>
      </form>
    </details> : null}
    {bolehRekap ? <details className="rounded-xl border border-slate-200 bg-white p-5" onToggle={(e) => { if (e.currentTarget.open) void muatPilihan(); }}>
      <summary className="cursor-pointer text-sm font-bold text-slate-900">Perbandingan empat tahap pemenuhan gizi</summary>
      <form className="mt-4 grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); void lakukan(async () => { setRekap(await minta<EmpatTahap>("/api/v1/operasional/nutrition?episodeId=" + encodeURIComponent(episodeId) + "&tanggal=" + tanggal)); }); }}>
        {pilihanEpisode()}
        <label className="text-xs font-semibold text-slate-700">Tanggal pelayanan<input type="date" value={tanggal} onChange={(e) => { setTanggal(e.target.value); setRekap(null); }} className={inputClass} required /></label>
        <Button disabled={sibuk || !episodeId} type="submit">Tampilkan</Button>
      </form>
      {rekap ? <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm"><caption className="mb-2 text-left text-xs text-slate-500">Nilai porsi aktual. Belum dicatat ditampilkan terpisah dari konsumsi nol.</caption>
          <thead><tr className="border-b bg-slate-50"><th className="p-3">Tahap</th><th className="p-3">Energi (kkal)</th><th className="p-3">Protein (g)</th></tr></thead>
          <tbody>{([["Dibutuhkan", rekap.dibutuhkan], ["Direncanakan", rekap.direncanakan], ["Disajikan", rekap.disajikan], ["Dikonsumsi", rekap.dikonsumsi]] as const).map(([label, nilai]) => <tr key={label} className="border-b"><th className="p-3 font-medium">{label}</th><td className="p-3">{nilai?.energiKkal ?? "Belum tersedia"}</td><td className="p-3">{nilai?.proteinGram ?? "Belum tersedia"}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-xs text-slate-600">{rekap.porsiDisajikan} porsi disajikan; {rekap.belumDicatat} porsi belum memiliki catatan konsumsi.</p>
      </div> : null}
    </details> : null}
    {profil.peran === "ahli_gizi" ? <details className="rounded-xl border border-slate-200 bg-white p-5" onToggle={(e) => { if (e.currentTarget.open) void muatPilihan(); }}>
      <summary className="cursor-pointer text-sm font-bold text-slate-900">Tambah resep dan komposisi bahan</summary>
      <p className="mt-3 text-xs text-slate-500">Gunakan kode baru untuk setiap versi resep agar nilai historis makanan tetap terjaga.</p>
      <form onSubmit={simpanResep} className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-xs font-semibold">Kode resep<input name="kodeMenu" className={inputClass} maxLength={32} required /></label>
          <label className="text-xs font-semibold">Nama menu<input name="namaMenu" className={inputClass} minLength={3} required /></label>
          <label className="text-xs font-semibold">Kategori<select name="kategori" className={inputClass}>{KATEGORI_MENU.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="text-xs font-semibold">Bentuk makanan<select name="bentuk" className={inputClass}>{BENTUK_MAKANAN.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="text-xs font-semibold">Jenis diet<select name="jenisDiet" className={inputClass}>{["makanan_biasa", "makanan_lunak", "rendah_garam", "diabetes_melitus", "rendah_lemak", "jantung", "lambung", "ginjal_rendah_protein", "tktp", "hati", "khusus_kombinasi"].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="text-xs font-semibold">Alergen (pisahkan dengan koma)<input name="alergen" className={inputClass} /></label>
          {([["energi", "Energi (kkal)"], ["protein", "Protein (g)"], ["lemak", "Lemak (g)"], ["karbohidrat", "Karbohidrat (g)"]] as const).map(([name, label]) => <label key={name} className="text-xs font-semibold">{label}<input name={name} type="number" min="0" max={name === "energi" ? "10000" : "1000"} step={name === "energi" ? "1" : "0.1"} className={inputClass} required /></label>)}
        </div>
        <fieldset className="space-y-3"><legend className="mb-2 text-xs font-semibold">Bahan mentah per satu porsi</legend>
          {komposisi.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_100px_auto]">
            <select aria-label={"Bahan " + (index + 1)} value={row.kodeBahan} onChange={(e) => setKomposisi(komposisi.map((r, i) => i === index ? { ...r, kodeBahan: e.target.value } : r))} className={inputClass} required><option value="">Pilih bahan gudang</option>{ingredients.map((b) => <option key={b.kodeBahan} value={b.kodeBahan}>{b.namaBahan} ({b.kodeBahan}){b.alergen.length ? " · Alergen: " + b.alergen.join(", ") : ""}</option>)}</select>
            <input aria-label={"Jumlah bahan " + (index + 1)} type="number" min="0.001" step="0.001" value={row.jumlah} onChange={(e) => setKomposisi(komposisi.map((r, i) => i === index ? { ...r, jumlah: Number(e.target.value) } : r))} className={inputClass} required />
            <select aria-label={"Satuan bahan " + (index + 1)} value={row.satuan} onChange={(e) => setKomposisi(komposisi.map((r, i) => i === index ? { ...r, satuan: e.target.value } : r))} className={inputClass}>{["gram", "kg", "ml", "liter", "butir", "pcs"].map((v) => <option key={v}>{v}</option>)}</select>
            <Button type="button" variant="outline" disabled={komposisi.length === 1} onClick={() => setKomposisi(komposisi.filter((_, i) => i !== index))}>Hapus</Button>
          </div>)}
          <Button type="button" variant="outline" onClick={() => setKomposisi([...komposisi, { kodeBahan: "", jumlah: 1, satuan: "gram" }])}>Tambah bahan</Button>
        </fieldset>
        <Button type="submit" disabled={sibuk}>Simpan resep baru</Button>
      </form>
    </details> : null}
    {profil.peran === "petugas_gudang" ? <details className="rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-bold text-slate-900">Tambah master bahan</summary>
      <p className="mt-3 text-xs text-slate-500">Stok awal selalu nol. Gunakan penerimaan lot dengan pemeriksaan mutu untuk menambah stok.</p>
      <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, data = new FormData(form);
        void lakukan(async () => {
          await minta("/api/v1/operasional/ingredients", { kodeBahan: data.get("kodeBahan"), namaBahan: data.get("namaBahan"), kategori: data.get("kategori"), satuan: data.get("satuan"), suhuPenyimpanan: data.get("suhuPenyimpanan"), stokMinimum: Number(data.get("stokMinimum")), daftarAlergen: String(data.get("alergen") ?? "").split(",").map((s) => s.trim()).filter(Boolean), kaloriPer100g: Number(data.get("kaloriPer100g")), proteinPer100g: Number(data.get("proteinPer100g")), lemakPer100g: Number(data.get("lemakPer100g")), karbohidratPer100g: Number(data.get("karbohidratPer100g")) });
          form.reset(); setPesan("Master bahan tersimpan dengan stok nol. Segarkan katalog gudang.");
        });
      }}>
        <label className="text-xs font-semibold">Kode bahan<input name="kodeBahan" className={inputClass} required /></label>
        <label className="text-xs font-semibold">Nama bahan<input name="namaBahan" className={inputClass} minLength={3} required /></label>
        <label className="text-xs font-semibold">Kategori<select name="kategori" className={inputClass}>{["makanan_pokok", "lauk_hewani", "lauk_nabati", "sayuran", "buah", "bumbu_minyak", "khusus_enteral", "lainnya"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold">Satuan stok<select name="satuan" className={inputClass}>{["kg", "gram", "liter", "ml", "butir", "bungkus", "kaleng"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold">Penyimpanan<select name="suhuPenyimpanan" className={inputClass}>{["suhu_ruang", "chiller_dingin", "freezer_beku"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold">Stok minimum<input type="number" name="stokMinimum" min="0" step="0.01" className={inputClass} required /></label>
        <label className="text-xs font-semibold">Alergen (pisahkan dengan koma)<input name="alergen" className={inputClass} /></label>
        {([ ["kaloriPer100g", "Energi per 100 g (kkal)"], ["proteinPer100g", "Protein per 100 g (g)"], ["lemakPer100g", "Lemak per 100 g (g)"], ["karbohidratPer100g", "Karbohidrat per 100 g (g)"] ] as const).map(([name, label]) => <label key={name} className="text-xs font-semibold">{label}<input type="number" name={name} min="0" step="0.1" className={inputClass} required /></label>)}
        <Button type="submit" disabled={sibuk} className="md:col-span-3 justify-self-start">Simpan master bahan</Button>
      </form>
    </details> : null}
    {profil.peran === "petugas_dapur" ? <details className="rounded-xl border border-slate-200 bg-white p-5" onToggle={(e) => { if (e.currentTarget.open) void lakukan(async () => { setRencana((await minta<{ items: typeof rencana }>("/api/v1/kitchen/production-plans")).items); }); }}>
      <summary className="cursor-pointer text-sm font-bold text-slate-900">Ajukan kebutuhan bahan ke gudang</summary>
      <p className="mt-3 text-xs text-slate-500">Jumlah dihitung dari resep, porsi, dan pesanan individual sah. Pengajuan ini tidak mengurangi stok.</p>
      <form className="mt-4 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void lakukan(async () => { await minta("/api/v1/operasional/material-requests", { rencanaId: data.get("rencanaId") }); setPesan("Permintaan bahan tersedia di ruang kerja gudang untuk alokasi dan pengeluaran."); }); }}>
        <label className="grow text-xs font-semibold">Rencana disetujui<select name="rencanaId" className={inputClass} required><option value="">Pilih rencana produksi</option>{rencana.filter((r) => r.status === "disetujui").map((r) => <option key={r.id} value={r.id}>{r.nomorRencana} ? {r.tanggalPelayanan}</option>)}</select></label>
        <Button type="submit" disabled={sibuk} className="self-end">Ajukan ke gudang</Button>
      </form>
    </details> : null}
    {bolehInsiden ? <details className="rounded-xl border border-amber-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-bold text-slate-900">Laporkan insiden pelayanan gizi</summary>
      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, data = new FormData(form);
        void lakukan(async () => { await minta("/api/v1/operasional/incidents", Object.fromEntries(data)); form.reset(); setPesan("Insiden tercatat dan tersedia untuk ditindaklanjuti Kepala Instalasi Gizi."); });
      }}>
        <label className="text-xs font-semibold">Jenis insiden<input name="jenisInsiden" className={inputClass} minLength={3} maxLength={100} required /></label>
        <label className="text-xs font-semibold">Derajat keparahan<select name="derajatKeparahan" className={inputClass}>{["rendah", "sedang", "tinggi", "kritis"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold">Kejadian<textarea name="deskripsiKejadian" className={inputClass} minLength={10} maxLength={5000} required /></label>
        <label className="text-xs font-semibold">Tindakan pengendalian segera<textarea name="tindakanAwalSegera" className={inputClass} minLength={5} maxLength={5000} required /></label>
        <Button type="submit" disabled={sibuk} className="justify-self-start">Kirim laporan insiden</Button>
      </form>
    </details> : null}
  </section>;
}
