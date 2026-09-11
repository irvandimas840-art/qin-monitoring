import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  LayoutGrid, ClipboardList, LogOut, CheckSquare, ChevronDown,
  TrendingUp, Users, Package, CalendarDays, Trash2, Plus, Factory,
  Copy, Check, Settings, Image as ImageIcon, UserPlus, ShieldCheck, X,
} from "lucide-react";
import { getData, setData } from "./storage";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { createUserAccount, usernameToEmail } from "./userAdmin";

/* ---------------------------------------------------------------
   TOKENS
   Palet & tipografi mengikuti nuansa panel kontrol pabrik/QC:
   hijau lolos-QC sebagai warna kerja utama, kertas abu-hangat
   sebagai dasar, kuning peringatan untuk aksen sekunder.
----------------------------------------------------------------*/
const C = {
  paper: "#F3F2EE",
  panel: "#FFFFFF",
  ink: "#1E2420",
  inkSoft: "#5B6560",
  line: "#DDE0DA",
  green: "#2F6D4F",
  greenSoft: "#E4EEE7",
  amber: "#B8860B",
  amberSoft: "#F6EDD8",
  slate: "#5B6B72",
  slateSoft: "#E7ECEE",
  danger: "#A23B2E",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');`;

const REPORT_TYPES = {
  riset: {
    key: "riset",
    label: "Riset Shift",
    sub: "RMD / MPD / WM",
    accent: C.green,
    accentSoft: C.greenSoft,
  },
  verifikasi: {
    key: "verifikasi",
    label: "Verifikasi Shift",
    sub: "RMD (RMR / MP / NST)",
    accent: C.amber,
    accentSoft: C.amberSoft,
  },
  total: {
    key: "total",
    label: "Total Sampel",
    sub: "Timbang / Sensory / Berkala",
    accent: C.slate,
    accentSoft: C.slateSoft,
  },
};

const RISET_RMD_ITEMS = ["KARA", "KJB", "RSUP", "RSTM SP 3 MIX", "GHS 1", "GHS 2", "KB B."];
const RISET_MPD_ITEMS = ["KARA NUTS", "NST HYBRIDA"];
const VERIFIKASI_RMD_ITEMS = ["RMR Kara Laut", "RMR Kanal", "RMR GHS", "NST Baru", "MP Kara", "MP Hybrida", "NST Lama"];
const SHIFTS = ["PAGI", "SIANG", "MALAM"];
const HARI_ID = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

const STORAGE_KEY = "qad_qin_entries";
const BACKGROUND_KEY = "app_background";

const ROLES = {
  admin: { label: "Admin", accent: "#2F6D4F" },
  supervisor: { label: "Supervisor", accent: "#B8860B" },
  anggota: { label: "Anggota", accent: "#5B6B72" },
};

/* ---------------------------------------------------------------
   HELPERS
----------------------------------------------------------------*/
function toNumberOrNull(v) {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function sumValues(obj) {
  return Object.values(obj || {}).reduce((acc, v) => acc + (toNumberOrNull(v) || 0), 0);
}

function hariFromTanggal(tanggalStr) {
  if (!tanggalStr) return "";
  const d = new Date(tanggalStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return HARI_ID[d.getDay()];
}

function formatTanggalPendek(tanggalStr) {
  if (!tanggalStr) return "-";
  const d = new Date(tanggalStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return tanggalStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function computeTotalButir(entry) {
  if (entry.type === "riset") {
    return sumValues(entry.rmd) + sumValues(entry.mpd) + (entry.wmProduksi ? toNumberOrNull(entry.wmButir) || 0 : 0);
  }
  if (entry.type === "verifikasi") {
    return sumValues(entry.rmd);
  }
  if (entry.type === "total") {
    return (
      (toNumberOrNull(entry.rmdTotal) || 0) +
      (toNumberOrNull(entry.sampelTimbang) || 0) +
      (toNumberOrNull(entry.sampelSensory) || 0) +
      (toNumberOrNull(entry.sampelMingguan) || 0) +
      (toNumberOrNull(entry.sampelHarian) || 0)
    );
  }
  return 0;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDDMMYYYY(tanggalStr) {
  const d = new Date(tanggalStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return tanggalStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatDDMMYY(tanggalStr) {
  const d = new Date(tanggalStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return tanggalStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${String(d.getFullYear()).slice(-2)}`;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function zeroLabel(v) {
  const n = toNumberOrNull(v);
  return n === null ? 0 : n;
}

function dashLabel(v) {
  const n = toNumberOrNull(v);
  return n === null ? "-" : n;
}

/* ---- Generator teks laporan, format meniru lembar/WA asli ---- */
function generateRisetText(e) {
  const hari = (e.hari || hariFromTanggal(e.tanggal)).toUpperCase();
  const tgl = formatDDMMYYYY(e.tanggal);
  const rmdLines = RISET_RMD_ITEMS.map((item) => `${item} \u27a1\ufe0f ${zeroLabel(e.rmd?.[item])} butir`).join("\n");
  const mpdLines = RISET_MPD_ITEMS.map((item) => `${item} \u27a1\ufe0f ${zeroLabel(e.mpd?.[item])} butir`).join("\n");
  const wmLine = e.wmProduksi ? `Produksi \u27a1\ufe0f ${zeroLabel(e.wmButir)} butir` : "# (TIDAK PRODUKSI)";
  return `DATA SAMPLING QAD-QIN
Hari / tgl : ${hari},${tgl}
Total personil : ${e.personil ?? 0} orang

Riset shift : ${e.shift}
  \u2713RMD
${rmdLines}
   \u2713MPD
${mpdLines}
\u2713WM H.JASRI
${wmLine}`;
}

function generateVerifikasiText(e) {
  const tgl = formatDDMMYYYY(e.tanggal);
  const lines = VERIFIKASI_RMD_ITEMS.map((item) => `${item} : ${dashLabel(e.rmd?.[item])} Butir`).join("\n");
  return `Data sampling QAD/QIN
Hari/Tanggal : ${tgl}
Total Personil : ${e.personil ?? 0} orang
Verifikasi Shift : ${(e.shift || "").toLowerCase()}
*RMD
${lines}`;
}

function generateTotalText(e) {
  const hari = capitalize(e.hari || hariFromTanggal(e.tanggal));
  const ddmmyy = formatDDMMYY(e.tanggal);
  return `Data sampling QAD-QIN
Ttl Sample hr/tgl ${hari}/${ddmmyy}
Total Personil ${e.personil ?? 0} orang
RMD ${zeroLabel(e.rmdTotal)}
Sampel timbang ${zeroLabel(e.sampelTimbang)}
Sampel Sensory ${zeroLabel(e.sampelSensory)}
Sampel Mingguan ${zeroLabel(e.sampelMingguan)}
Sampel harian ${zeroLabel(e.sampelHarian)}`;
}

function generateReportText(entry) {
  if (entry.type === "riset") return generateRisetText(entry);
  if (entry.type === "verifikasi") return generateVerifikasiText(entry);
  if (entry.type === "total") return generateTotalText(entry);
  return "";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

// Firestore membatasi ukuran dokumen ~1MB, jadi gambar background dikompres
// & diperkecil dulu sebelum diubah ke base64 dan disimpan.
function compressImageFile(file, maxDimension = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------
   ROOT APP
----------------------------------------------------------------*/
export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [fbUser, setFbUser] = useState(null);
  const [profile, setProfile] = useState(null); // {username, role}
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const [page, setPage] = useState("dashboard");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [background, setBackground] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } catch {
          setProfile(null);
        }
        setFbUser(u);
      } else {
        setFbUser(null);
        setProfile(null);
        try {
          const metaSnap = await getDoc(doc(db, "meta", "setup"));
          setNeedsBootstrap(!metaSnap.exists());
        } catch {
          setNeedsBootstrap(false);
        }
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    let mounted = true;
    (async () => {
      setLoadingEntries(true);
      try {
        const [savedEntries, savedBg] = await Promise.all([getData(STORAGE_KEY), getData(BACKGROUND_KEY)]);
        if (mounted) {
          setEntries(savedEntries || []);
          setBackground(savedBg || null);
        }
      } catch {
        if (mounted) setEntries([]);
      } finally {
        if (mounted) setLoadingEntries(false);
      }
    })();
    return () => { mounted = false; };
  }, [fbUser]);

  function showToast(msg, tone = "ok") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2600);
  }

  async function persist(nextEntries) {
    setEntries(nextEntries);
    try {
      const ok = await setData(STORAGE_KEY, nextEntries);
      if (!ok) showToast("Gagal menyimpan data.", "error");
    } catch {
      showToast("Gagal menyimpan data.", "error");
    }
  }

  async function addEntry(entry) {
    const full = { ...entry, id: uid(), createdBy: profile?.username || "-", createdAt: new Date().toISOString() };
    full.totalButir = computeTotalButir(full);
    await persist([full, ...entries]);
    showToast("Data sampling tersimpan.");
    setPage("dashboard");
  }

  async function deleteEntry(id) {
    await persist(entries.filter((e) => e.id !== id));
    showToast("Data dihapus.", "warn");
  }

  async function updateBackground(dataUrl) {
    setBackground(dataUrl);
    try {
      const ok = await setData(BACKGROUND_KEY, dataUrl);
      showToast(ok ? "Background diperbarui." : "Gagal menyimpan background.", ok ? "ok" : "error");
    } catch {
      showToast("Gagal menyimpan background.", "error");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setPage("dashboard");
  }

  const bgStyle = background
    ? {
      backgroundImage: `linear-gradient(rgba(243,242,238,0.90), rgba(243,242,238,0.94)), url(${background})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    }
    : { background: C.paper };

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: C.inkSoft, fontFamily: "Inter, sans-serif" }}>
        Memuat...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", ...bgStyle, minHeight: "100vh", color: C.ink }}>
      <style>{`
        ${FONT_IMPORT}
        .disp { font-family: 'Oswald', sans-serif; letter-spacing: 0.01em; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; }
        .focus-ring:focus { outline: none; box-shadow: 0 0 0 3px ${C.greenSoft}; border-color: ${C.green}; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 4px; }
      `}</style>

      {!fbUser ? (
        needsBootstrap ? (
          <BootstrapScreen onDone={() => setNeedsBootstrap(false)} />
        ) : (
          <LoginScreen />
        )
      ) : !profile ? (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Profil akun tidak ditemukan.</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>Hubungi admin untuk memeriksa akun ini.</div>
            <button onClick={handleLogout} style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", cursor: "pointer" }}>Keluar</button>
          </div>
        </div>
      ) : (
        <>
          <TopBar profile={profile} page={page} setPage={setPage} onLogout={handleLogout} />
          <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 60px" }}>
            {page === "dashboard" && (
              <Dashboard entries={entries} loading={loadingEntries} onDelete={deleteEntry} onNew={() => setPage("input")} />
            )}
            {page === "input" && <InputForm onSubmit={addEntry} />}
            {page === "settings" && (
              <SettingsPage profile={profile} background={background} onUpdateBackground={updateBackground} showToast={showToast} />
            )}
          </main>
        </>
      )}

      {toast && (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 50,
            background: toast.tone === "error" ? "#3A2320" : C.ink,
            color: "#F3F2EE", padding: "12px 18px", borderRadius: 6,
            fontSize: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            borderLeft: `4px solid ${toast.tone === "error" ? C.danger : toast.tone === "warn" ? C.amber : C.green}`,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   AUTH ERROR MESSAGES
----------------------------------------------------------------*/
function authErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Username atau password salah.";
  }
  if (code.includes("email-already-in-use")) return "Username sudah dipakai, coba nama lain.";
  if (code.includes("weak-password")) return "Password minimal 6 karakter.";
  if (code.includes("too-many-requests")) return "Terlalu banyak percobaan, coba lagi sebentar.";
  if (code.includes("network-request-failed")) return "Gagal terhubung ke server, cek koneksi internet.";
  return "Terjadi kesalahan, coba lagi.";
}

/* ---------------------------------------------------------------
   BOOTSTRAP (setup akun admin pertama kali)
----------------------------------------------------------------*/
function BootstrapScreen({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) return;
    if (password !== confirm) { setErr("Konfirmasi password tidak sama."); return; }
    if (password.length < 6) { setErr("Password minimal 6 karakter."); return; }
    setLoading(true);
    try {
      const email = usernameToEmail(username);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        username: username.trim(),
        role: "admin",
        createdAt: new Date().toISOString(),
        createdBy: username.trim(),
      });
      await setDoc(doc(db, "meta", "setup"), { adminCreated: true, at: new Date().toISOString() });
      onDone();
    } catch (e2) {
      setErr(authErrorMessage(e2));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <BrandHeader />
        <form onSubmit={submit} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ShieldCheck size={18} color={C.green} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Setup akun Admin pertama</div>
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
            Belum ada akun sama sekali di aplikasi ini. Buat akun Admin pertama untuk mulai — akun ini nanti bisa menambahkan Supervisor dan Anggota lain.
          </div>

          <label style={labelStyle}>Username</label>
          <input className="focus-ring" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cth. dimas" style={inputStyle} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
          <input className="focus-ring" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" style={inputStyle} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Konfirmasi password</label>
          <input className="focus-ring" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />

          {err && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 10 }}>{err}</div>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            style={{
              marginTop: 20, width: "100%", padding: "11px 0", border: "none", borderRadius: 6,
              background: loading ? C.line : C.green, color: "#fff", fontWeight: 600, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Membuat akun..." : "Buat akun Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26, justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 6, background: C.green, display: "grid", placeItems: "center" }}>
        <Factory size={22} color="#fff" />
      </div>
      <div>
        <div className="disp" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>QAD–QIN</div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>Monitoring Sampling Produksi</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   LOGIN
----------------------------------------------------------------*/
function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    } catch (e2) {
      setErr(authErrorMessage(e2));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <BrandHeader />

        <form onSubmit={submit} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 28 }}>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
            Masuk dengan username & password akun kamu.
          </div>

          <label style={labelStyle}>Username</label>
          <input className="focus-ring" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cth. dimas" style={inputStyle} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
          <input className="focus-ring" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />

          {err && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 10 }}>{err}</div>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            style={{
              marginTop: 20, width: "100%", padding: "11px 0", border: "none", borderRadius: 6,
              background: loading ? C.line : C.green, color: "#fff", fontWeight: 600, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>

          <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
            Belum punya akun? Minta Admin atau Supervisor untuk membuatkan akun kamu.
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: C.inkSoft, marginBottom: 6, fontWeight: 500 };
const inputStyle = {
  width: "100%", padding: "9px 11px", border: `1px solid ${C.line}`, borderRadius: 6,
  fontSize: 14, background: "#fff", color: C.ink, boxSizing: "border-box",
};

/* ---------------------------------------------------------------
   TOP BAR
----------------------------------------------------------------*/
function TopBar({ profile, page, setPage, onLogout }) {
  const roleMeta = ROLES[profile.role] || ROLES.anggota;
  const canSeeSettings = profile.role === "admin" || profile.role === "supervisor";
  return (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 60, gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: C.green, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Factory size={16} color="#fff" />
          </div>
          <div className="disp" style={{ fontSize: 16, fontWeight: 600 }}>QAD–QIN</div>
        </div>

        <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          <NavBtn active={page === "dashboard"} onClick={() => setPage("dashboard")} icon={<LayoutGrid size={15} />} label="Dashboard" />
          <NavBtn active={page === "input"} onClick={() => setPage("input")} icon={<ClipboardList size={15} />} label="Input Data" />
          {canSeeSettings && (
            <NavBtn active={page === "settings"} onClick={() => setPage("settings")} icon={<Settings size={15} />} label="Pengaturan" />
          )}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{profile.username}</div>
            <div style={{ fontSize: 11, color: roleMeta.accent, lineHeight: 1.2, fontWeight: 600 }}>{roleMeta.label}</div>
          </div>
          <button
            onClick={onLogout}
            title="Keluar"
            style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: 8, cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <LogOut size={15} color={C.inkSoft} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 6,
        border: "none", background: active ? C.greenSoft : "transparent",
        color: active ? C.green : C.inkSoft, fontWeight: active ? 600 : 500, fontSize: 13.5, cursor: "pointer",
      }}
    >
      {icon}{label}
    </button>
  );
}

/* ---------------------------------------------------------------
   SETTINGS: KELOLA AKUN + BACKGROUND
----------------------------------------------------------------*/
function SettingsPage({ profile, background, onUpdateBackground, showToast }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="disp" style={{ fontSize: 24, fontWeight: 600 }}>Pengaturan</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Kelola akun tim{profile.role === "admin" ? " dan tampilan aplikasi" : ""}.</div>
      </div>

      <UserManagement profile={profile} showToast={showToast} />

      {profile.role === "admin" && (
        <BackgroundSettings background={background} onUpdateBackground={onUpdateBackground} showToast={showToast} />
      )}
    </div>
  );
}

function UserManagement({ profile, showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("anggota");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const assignableRoles = profile.role === "admin" ? ["anggota", "supervisor", "admin"] : ["anggota"];

  async function loadUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setFormErr("");
    if (!username.trim() || !password) return;
    if (password.length < 6) { setFormErr("Password minimal 6 karakter."); return; }
    setSaving(true);
    try {
      const newUid = await createUserAccount(username, password);
      await setDoc(doc(db, "users", newUid), {
        username: username.trim(),
        role,
        createdAt: new Date().toISOString(),
        createdBy: profile.username,
      });
      setUsername(""); setPassword(""); setRole("anggota"); setShowForm(false);
      showToast("Akun baru berhasil dibuat.");
      loadUsers();
    } catch (err) {
      setFormErr(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u) {
    if (u.username === profile.username) return;
    if (!confirm(`Hapus profil akun "${u.username}"? (Login Firebase-nya perlu dihapus manual lewat Firebase Console jika perlu.)`)) return;
    try {
      await deleteDoc(doc(db, "users", u.id));
      showToast("Profil akun dihapus.", "warn");
      loadUsers();
    } catch {
      showToast("Gagal menghapus akun.", "error");
    }
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Kelola Akun</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>
            {profile.role === "admin" ? "Tambahkan Anggota, Supervisor, atau Admin lain." : "Tambahkan Anggota baru ke tim."}
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <UserPlus size={15} /> Tambah Akun
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 16, marginBottom: 16, background: C.paper }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input className="focus-ring" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cth. siti" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input className="focus-ring" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Peran</label>
              <select className="focus-ring" value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                {assignableRoles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
            </div>
          </div>
          {formErr && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 10 }}>{formErr}</div>}
          <button
            type="submit"
            disabled={saving || !username.trim() || !password}
            style={{ marginTop: 12, background: saving ? C.line : C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Menyimpan..." : "Simpan akun"}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: C.inkSoft, padding: "16px 0", textAlign: "center" }}>Memuat daftar akun...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.paper }}>
                {["Username", "Peran", "Dibuat oleh", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleMeta = ROLES[u.role] || ROLES.anggota;
                return (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={tdStyle}>{u.username}{u.username === profile.username && <span style={{ color: C.inkSoft }}> (kamu)</span>}</td>
                    <td style={tdStyle}>
                      <span style={{ background: `${roleMeta.accent}1A`, color: roleMeta.accent, padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 600 }}>
                        {roleMeta.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{u.createdBy || "-"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {profile.role === "admin" && u.username !== profile.username && (
                        <button onClick={() => handleDelete(u)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.inkSoft }} title="Hapus profil akun">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BackgroundSettings({ background, onUpdateBackground, showToast }) {
  const [preview, setPreview] = useState(background);
  const [processing, setProcessing] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const dataUrl = await compressImageFile(file);
      setPreview(dataUrl);
    } catch {
      showToast("Gagal memproses gambar.", "error");
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    await onUpdateBackground(preview);
  }

  async function handleRemove() {
    setPreview(null);
    await onUpdateBackground(null);
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ImageIcon size={16} color={C.ink} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>Background Aplikasi</div>
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>
        Berlaku untuk semua orang yang membuka aplikasi ini (tersimpan di database bersama).
      </div>

      <div
        style={{
          height: 140, borderRadius: 6, border: `1px dashed ${C.line}`, marginBottom: 14,
          backgroundImage: preview ? `url(${preview})` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          display: preview ? "block" : "grid", placeItems: "center", color: C.inkSoft, fontSize: 12.5,
        }}
      >
        {!preview && "Belum ada background"}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ background: C.ink, color: "#fff", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {processing ? "Memproses..." : "Pilih gambar"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={processing} style={{ display: "none" }} />
        </label>
        <button
          onClick={handleSave}
          disabled={!preview || processing}
          style={{ background: preview ? C.green : C.line, color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: preview ? "pointer" : "not-allowed" }}
        >
          Simpan sebagai background
        </button>
        {background && (
          <button onClick={handleRemove} style={{ background: "transparent", color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Hapus background
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   DASHBOARD
----------------------------------------------------------------*/
function Dashboard({ entries, loading, onDelete, onNew }) {
  const [period, setPeriod] = useState("week"); // week | month | all

  const filtered = useMemo(() => {
    if (period === "all") return entries;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === "week") cutoff.setDate(now.getDate() - 7);
    if (period === "month") cutoff.setDate(now.getDate() - 30);
    return entries.filter((e) => {
      const d = new Date(e.tanggal + "T00:00:00");
      return d >= cutoff && d <= now;
    });
  }, [entries, period]);

  const stats = useMemo(() => {
    const totalButir = filtered.reduce((a, e) => a + (e.totalButir || 0), 0);
    const avgPersonil = filtered.length ? filtered.reduce((a, e) => a + (toNumberOrNull(e.personil) || 0), 0) / filtered.length : 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = entries.filter((e) => e.tanggal === todayStr).length;
    return { totalEntri: filtered.length, totalButir, avgPersonil, today };
  }, [filtered, entries]);

  const dailyChart = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      map[e.tanggal] = (map[e.tanggal] || 0) + (e.totalButir || 0);
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ tanggal: formatTanggalPendek(k), butir: map[k] }));
  }, [filtered]);

  const typeChart = useMemo(() => {
    return Object.values(REPORT_TYPES).map((t) => ({
      tipe: t.label,
      butir: filtered.filter((e) => e.type === t.key).reduce((a, e) => a + (e.totalButir || 0), 0),
    }));
  }, [filtered]);

  const recent = useMemo(() => [...entries].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 8), [entries]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="disp" style={{ fontSize: 24, fontWeight: 600 }}>Ringkasan Sampling</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Pantauan data QAD-QIN dari seluruh petugas</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <PeriodBtn active={period === "week"} onClick={() => setPeriod("week")} label="Minggu ini" />
          <PeriodBtn active={period === "month"} onClick={() => setPeriod("month")} label="Bulan ini" />
          <PeriodBtn active={period === "all"} onClick={() => setPeriod("all")} label="Semua" />
          <button
            onClick={onNew}
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={15} /> Input Baru
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: C.inkSoft }}>Memuat data...</div>
      ) : entries.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
            <StatCard icon={<ClipboardList size={17} />} label="Total entri" value={stats.totalEntri} color={C.green} bg={C.greenSoft} />
            <StatCard icon={<Package size={17} />} label="Total butir sampel" value={stats.totalButir.toLocaleString("id-ID")} color={C.amber} bg={C.amberSoft} />
            <StatCard icon={<Users size={17} />} label="Rata-rata personil" value={stats.avgPersonil.toFixed(1)} color={C.slate} bg={C.slateSoft} />
            <StatCard icon={<CalendarDays size={17} />} label="Entri hari ini" value={stats.today} color={C.green} bg={C.greenSoft} />
          </div>

          <DailyCopySection entries={entries} />

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 22 }}>
            <ChartPanel title="Butir sampel per hari">
              {dailyChart.length ? (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={dailyChart}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="tanggal" tick={{ fontSize: 11, fill: C.inkSoft }} />
                    <YAxis tick={{ fontSize: 11, fill: C.inkSoft }} width={40} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${C.line}` }} />
                    <Line type="monotone" dataKey="butir" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} name="Butir" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={emptyChartStyle}>Tidak ada data pada periode ini</div>
              )}
            </ChartPanel>

            <ChartPanel title="Berdasarkan jenis laporan">
              {typeChart.some((t) => t.butir > 0) ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={typeChart} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke={C.line} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: C.inkSoft }} />
                    <YAxis type="category" dataKey="tipe" tick={{ fontSize: 11, fill: C.inkSoft }} width={100} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${C.line}` }} />
                    <Bar dataKey="butir" fill={C.amber} radius={[0, 4, 4, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={emptyChartStyle}>Tidak ada data pada periode ini</div>
              )}
            </ChartPanel>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.line}`, fontWeight: 600, fontSize: 14 }}>
              Entri terbaru
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.paper }}>
                    {["Tanggal", "Jenis", "Shift/Personil", "Total butir", "Petugas", ""].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => {
                    const meta = REPORT_TYPES[e.type];
                    return (
                      <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                        <td style={tdStyle}>{formatTanggalPendek(e.tanggal)}<div style={{ fontSize: 11, color: C.inkSoft }}>{e.hari}</div></td>
                        <td style={tdStyle}>
                          <span style={{ background: meta.accentSoft, color: meta.accent, padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 600 }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={tdStyle}>{e.shift ? `${e.shift} · ` : ""}{e.personil ?? "-"} orang</td>
                        <td style={{ ...tdStyle }} className="mono">{(e.totalButir || 0).toLocaleString("id-ID")} butir</td>
                        <td style={tdStyle}>{e.createdBy}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button onClick={() => onDelete(e.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.inkSoft }} title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = { textAlign: "left", padding: "9px 16px", fontSize: 11.5, color: C.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" };
const tdStyle = { padding: "10px 16px", verticalAlign: "top" };
const emptyChartStyle = { height: 230, display: "grid", placeItems: "center", color: C.inkSoft, fontSize: 13 };

function PeriodBtn({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? C.green : C.line}`, background: active ? C.greenSoft : "#fff",
        color: active ? C.green : C.inkSoft, borderRadius: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 16px", borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color, marginBottom: 8 }}>
        <div style={{ background: bg, borderRadius: 6, padding: 6, display: "grid", placeItems: "center" }}>{icon}</div>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ChartPanel({ title, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function DailyCopySection({ entries }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [copiedId, setCopiedId] = useState(null);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.tanggal === date).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [entries, date]
  );

  async function handleCopy(entry) {
    const ok = await copyText(generateReportText(entry));
    if (ok) {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Salin laporan harian</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Pilih tanggal untuk melihat & menyalin teks laporan siap kirim</div>
        </div>
        <input
          type="date" className="focus-ring" value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, width: 170 }}
        />
      </div>

      {dayEntries.length === 0 ? (
        <div style={{ fontSize: 13, color: C.inkSoft, padding: "18px 0", textAlign: "center", border: `1px dashed ${C.line}`, borderRadius: 6 }}>
          Tidak ada entri pada tanggal ini.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dayEntries.map((entry) => {
            const meta = REPORT_TYPES[entry.type];
            const copied = copiedId === entry.id;
            return (
              <div key={entry.id} style={{ border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: C.paper }}>
                  <span style={{ background: meta.accentSoft, color: meta.accent, padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 600 }}>
                    {meta.label}{entry.shift ? ` \u00b7 ${entry.shift}` : ""}
                  </span>
                  <button
                    onClick={() => handleCopy(entry)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, border: "none",
                      background: copied ? C.green : C.ink, color: "#fff", borderRadius: 5,
                      padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {copied ? (<><Check size={13} /> Disalin</>) : (<><Copy size={13} /> Salin</>)}
                  </button>
                </div>
                <pre
                  className="mono"
                  style={{ margin: 0, padding: "12px 14px", fontSize: 12.5, whiteSpace: "pre-wrap", lineHeight: 1.6, color: C.ink, background: "#fff" }}
                >
                  {generateReportText(entry)}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div style={{ background: C.panel, border: `1px dashed ${C.line}`, borderRadius: 8, padding: "60px 20px", textAlign: "center" }}>
      <TrendingUp size={28} color={C.inkSoft} style={{ marginBottom: 10 }} />
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Belum ada data sampling</div>
      <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>Mulai catat data sampling shift pertama hari ini.</div>
      <button onClick={onNew} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Isi data sekarang
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   INPUT FORM
----------------------------------------------------------------*/
function InputForm({ onSubmit }) {
  const [type, setType] = useState("riset");
  const todayStr = new Date().toISOString().slice(0, 10);

  const [tanggal, setTanggal] = useState(todayStr);
  const [personil, setPersonil] = useState("");
  const [shift, setShift] = useState("PAGI");

  const [rmdRiset, setRmdRiset] = useState({});
  const [mpdRiset, setMpdRiset] = useState({});
  const [wmProduksi, setWmProduksi] = useState(false);
  const [wmButir, setWmButir] = useState("");

  const [rmdVerif, setRmdVerif] = useState({});

  const [rmdTotal, setRmdTotal] = useState("");
  const [sampelTimbang, setSampelTimbang] = useState("");
  const [sampelSensory, setSampelSensory] = useState("");
  const [sampelMingguan, setSampelMingguan] = useState("");
  const [sampelHarian, setSampelHarian] = useState("");

  function resetTypeFields() {
    setRmdRiset({}); setMpdRiset({}); setWmProduksi(false); setWmButir("");
    setRmdVerif({});
    setRmdTotal(""); setSampelTimbang(""); setSampelSensory(""); setSampelMingguan(""); setSampelHarian("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    const base = { type, tanggal, hari: hariFromTanggal(tanggal), personil: toNumberOrNull(personil) };

    let entry;
    if (type === "riset") {
      entry = { ...base, shift, rmd: rmdRiset, mpd: mpdRiset, wmProduksi, wmButir };
    } else if (type === "verifikasi") {
      entry = { ...base, shift, rmd: rmdVerif };
    } else {
      entry = { ...base, rmdTotal, sampelTimbang, sampelSensory, sampelMingguan, sampelHarian };
    }
    onSubmit(entry);
    setPersonil(""); resetTypeFields();
  }

  const previewTotal = computeTotalButir(
    type === "riset" ? { type, rmd: rmdRiset, mpd: mpdRiset, wmProduksi, wmButir }
      : type === "verifikasi" ? { type, rmd: rmdVerif }
        : { type, rmdTotal, sampelTimbang, sampelSensory, sampelMingguan, sampelHarian }
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="disp" style={{ fontSize: 24, fontWeight: 600 }}>Input Data Sampling</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Pilih jenis laporan lalu isi sesuai form lembar sampling.</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {Object.values(REPORT_TYPES).map((t) => (
          <button
            key={t.key}
            onClick={() => { setType(t.key); resetTypeFields(); }}
            style={{
              flex: "1 1 180px", textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
              border: `1.5px solid ${type === t.key ? t.accent : C.line}`,
              background: type === t.key ? t.accentSoft : "#fff",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: type === t.key ? t.accent : C.ink }}>{t.label}</div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>{t.sub}</div>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Hari / Tanggal</label>
            <input className="focus-ring" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required style={inputStyle} />
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>{hariFromTanggal(tanggal)}</div>
          </div>
          <div>
            <label style={labelStyle}>Total personil</label>
            <input className="focus-ring" type="number" min="0" value={personil} onChange={(e) => setPersonil(e.target.value)} placeholder="cth. 5" style={inputStyle} />
          </div>
          {type !== "total" && (
            <div>
              <label style={labelStyle}>{type === "riset" ? "Riset shift" : "Verifikasi shift"}</label>
              <select className="focus-ring" value={shift} onChange={(e) => setShift(e.target.value)} style={inputStyle}>
                {SHIFTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {type === "riset" && (
          <>
            <SectionHeader accent={C.green} label="RMD" />
            <ItemGrid items={RISET_RMD_ITEMS} values={rmdRiset} setValues={setRmdRiset} />

            <SectionHeader accent={C.green} label="MPD" />
            <ItemGrid items={RISET_MPD_ITEMS} values={mpdRiset} setValues={setMpdRiset} />

            <SectionHeader accent={C.slate} label="WM H. JASRI" />
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={!wmProduksi} onChange={() => setWmProduksi(false)} /> Tidak produksi
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={wmProduksi} onChange={() => setWmProduksi(true)} /> Produksi
              </label>
              {wmProduksi && (
                <input
                  className="focus-ring mono" type="number" min="0" placeholder="Jumlah butir"
                  value={wmButir} onChange={(e) => setWmButir(e.target.value)}
                  style={{ ...inputStyle, width: 140 }}
                />
              )}
            </div>
          </>
        )}

        {type === "verifikasi" && (
          <>
            <SectionHeader accent={C.amber} label="RMD" />
            <ItemGrid items={VERIFIKASI_RMD_ITEMS} values={rmdVerif} setValues={setRmdVerif} allowDash />
          </>
        )}

        {type === "total" && (
          <>
            <SectionHeader accent={C.slate} label="Total sampel" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 8 }}>
              <NumberField label="RMD" value={rmdTotal} onChange={setRmdTotal} />
              <NumberField label="Sampel timbang" value={sampelTimbang} onChange={setSampelTimbang} />
              <NumberField label="Sampel sensory" value={sampelSensory} onChange={setSampelSensory} />
              <NumberField label="Sampel mingguan" value={sampelMingguan} onChange={setSampelMingguan} />
              <NumberField label="Sampel harian" value={sampelHarian} onChange={setSampelHarian} />
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 13, color: C.inkSoft }}>
            Total butir: <span className="mono" style={{ color: C.ink, fontWeight: 600, fontSize: 15 }}>{previewTotal.toLocaleString("id-ID")}</span>
          </div>
          <button type="submit" style={{ background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Simpan data
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionHeader({ accent, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "18px 0 10px", paddingTop: 4 }}>
      <CheckSquare size={15} color={accent} />
      <span style={{ fontWeight: 700, fontSize: 13, color: accent }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

function ItemGrid({ items, values, setValues, allowDash }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 6 }}>
      {items.map((item) => (
        <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 10px" }}>
          <span style={{ fontSize: 13, color: C.ink, marginRight: 8 }}>{item}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <input
              className="focus-ring mono"
              type="text"
              inputMode="numeric"
              placeholder={allowDash ? "-" : "0"}
              value={values[item] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [item]: e.target.value }))}
              style={{ width: 70, textAlign: "right", padding: "5px 8px", border: `1px solid ${C.line}`, borderRadius: 5, fontSize: 13 }}
            />
            <span style={{ fontSize: 11.5, color: C.inkSoft }}>butir</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        className="focus-ring mono" type="number" min="0" value={value}
        onChange={(e) => onChange(e.target.value)} placeholder="0" style={inputStyle}
      />
    </div>
  );
}