import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseConfig } from "./firebase";

// Firebase Auth otomatis login sebagai user yang baru dibuat setiap kali
// createUserWithEmailAndPassword dipanggil. Supaya sesi admin/supervisor yang
// sedang aktif tidak ikut tergantikan, akun baru dibuat lewat instance
// Firebase terpisah ("Secondary"), lalu instance itu langsung sign-out.
export async function createUserAccount(username, password) {
  const email = usernameToEmail(username);
  const appName = "Secondary";
  const secondaryApp = getApps().find((a) => a.name === appName) || initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUid = cred.user.uid;
  await signOut(secondaryAuth);
  return newUid;
}

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@qadqin.local`;
}
