import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Semua data disimpan sebagai satu dokumen per "key" di koleksi app_data,
// dengan field `value` berisi data aslinya (array/object). Ini menjaga
// interface getData/setData tetap sama seperti versi localStorage
// sebelumnya, supaya App.jsx tidak perlu diubah.

export async function getData(key) {
  try {
    const ref = doc(db, "app_data", key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data().value ?? null;
  } catch (err) {
    console.error("Firestore getData error:", err);
    return null;
  }
}

export async function setData(key, value) {
  try {
    const ref = doc(db, "app_data", key);
    await setDoc(ref, { value, updatedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    console.error("Firestore setData error:", err);
    return false;
  }
}