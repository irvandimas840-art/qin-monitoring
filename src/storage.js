// Penyimpanan sederhana pakai localStorage browser.
// Catatan: data ini HANYA tersimpan di browser & komputer masing-masing,
// belum dibagi antar pengguna/tim. Saat sudah deploy dan butuh data
// bersama (semua petugas melihat data yang sama), bagian ini perlu
// diganti dengan panggilan ke database/backend (mis. Supabase, Firebase,
// atau API sendiri).

export async function getData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
