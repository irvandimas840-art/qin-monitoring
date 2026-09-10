# QAD-QIN Monitoring

Aplikasi monitoring & input data sampling QAD-QIN (Riset Shift, Verifikasi Shift, Total Sampel).

## Menjalankan di lokal (VS Code)

1. Pastikan **Node.js** sudah terinstal (versi 18 ke atas). Cek dengan:
   ```
   node -v
   ```
2. Buka folder ini di VS Code.
3. Buka terminal di VS Code (Terminal > New Terminal), lalu install dependency:
   ```
   npm install
   ```
4. Jalankan mode development:
   ```
   npm run dev
   ```
5. Buka link yang muncul di terminal (biasanya `http://localhost:5173`) di browser.

Setiap perubahan kode akan otomatis ter-refresh di browser (hot reload).

## Build untuk produksi

```
npm run build
```

Hasilnya ada di folder `dist/`, siap di-deploy (mis. lewat Vercel).

## Catatan penyimpanan data

Saat ini data disimpan di `localStorage` browser (lihat `src/storage.js`), jadi:
- Data tetap ada walau browser ditutup/komputer di-restart.
- Data **hanya ada di browser & perangkat itu saja** — belum bisa dilihat bersama oleh petugas lain.

Kalau nanti deploy ke Vercel dan tim ingin melihat data yang sama (bukan per-perangkat), `src/storage.js` perlu diganti untuk memanggil database/backend (mis. Supabase, Firebase, atau API buatan sendiri) alih-alih `localStorage`. Komponen `App.jsx` tidak perlu banyak berubah karena sudah memakai fungsi `getData` / `setData` yang terpisah.

## Struktur folder

```
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx      # entry point React
    ├── App.jsx       # seluruh halaman (login, dashboard, form input)
    ├── storage.js     # helper penyimpanan data
    └── index.css      # reset css dasar
```
