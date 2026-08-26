# Monitoring Bujet HIS

Executive Dashboard untuk monitoring realisasi anggaran Deputi Hilirisasi Investasi Strategis.

## Menjalankan proyek

Proyek ini tidak memerlukan instalasi dependency tambahan.

```bash
npm run dev
```

Lalu buka `http://127.0.0.1:4300`.

## Struktur utama

- `index.html` — struktur halaman dashboard
- `app.js` — data mock dan interaksi Module 1
- `styles.css` — gaya responsif dashboard
- `serve.js` — static development server
- `package.json` — perintah `npm run dev`

## Module 4 — Rencana Kegiatan

Module 4 memakai baris akun SAKTI pada periode aktif untuk menghitung:

- Potensi saat ini = SP2D + akrual berjalan
- Sisa saat ini = pagu - potensi saat ini
- Proyeksi realisasi = potensi saat ini + rencana berstatus `Confirmed`

Master tarif versi `2026.2` tersedia di `data/sbm-2026.json`, bersumber dari PMK Nomor 32 Tahun 2025 tentang SBM TA 2026. Master mencakup uang harian dan penginapan (38 provinsi), paket rapat (38 provinsi × 3 kelompok jabatan), 303 rute tiket domestik PP, 361 rute transportasi darat provinsi, 9 rute Jakarta–Jabodetabek, serta referensi honorarium. Skrip reproduksi `scripts/build_sbm_2026_master.py` memakai ekstrak PDF resmi yang sengaja tidak disimpan di repositori.

Penyimpanan rencana menggunakan abstraksi `module4-data.js`, terpisah dari snapshot SAKTI. Untuk sinkronisasi cloud, jalankan migrasi [004_create_planner_activities.sql](supabase/migrations/004_create_planner_activities.sql) pada proyek Supabase terlebih dahulu. Sampai migrasi tersedia atau cloud tidak dapat diakses, rencana disimpan lokal pada browser sebagai fallback.
