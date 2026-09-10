import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  LayoutGrid, ClipboardList, LogOut, CheckSquare, ChevronDown,
  TrendingUp, Users, Package, CalendarDays, Trash2, Plus, Factory,
} from "lucide-react";
import { getData, setData } from "./storage";

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

/* ---------------------------------------------------------------
   ROOT APP
----------------------------------------------------------------*/
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setLoadingEntries(true);
      try {
        const saved = await getData(STORAGE_KEY);
        if (mounted) setEntries(saved || []);
      } catch {
        if (mounted) setEntries([]);
      } finally {
        if (mounted) setLoadingEntries(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  function showToast(msg, tone = "ok") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2600);
  }

  async function persist(nextEntries) {
    setEntries(nextEntries);
    try {
      const ok = await setData(STORAGE_KEY, nextEntries);
      if (!ok) showToast("Gagal menyimpan data di browser ini.", "error");
    } catch {
      showToast("Gagal menyimpan data di browser ini.", "error");
    }
  }

  async function addEntry(entry) {
    const full = { ...entry, id: uid(), createdBy: user?.name || "-", createdAt: new Date().toISOString() };
    full.totalButir = computeTotalButir(full);
    await persist([full, ...entries]);
    showToast("Data sampling tersimpan.");
    setPage("dashboard");
  }

  async function deleteEntry(id) {
    await persist(entries.filter((e) => e.id !== id));
    showToast("Data dihapus.", "warn");
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.paper, minHeight: "100vh", color: C.ink }}>
      <style>{`
        ${FONT_IMPORT}
        .disp { font-family: 'Oswald', sans-serif; letter-spacing: 0.01em; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; }
        .focus-ring:focus { outline: none; box-shadow: 0 0 0 3px ${C.greenSoft}; border-color: ${C.green}; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 4px; }
      `}</style>

      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <>
          <TopBar user={user} page={page} setPage={setPage} onLogout={() => setUser(null)} />
          <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 60px" }}>
            {page === "dashboard" ? (
              <Dashboard entries={entries} loading={loadingEntries} onDelete={deleteEntry} onNew={() => setPage("input")} />
            ) : (
              <InputForm onSubmit={addEntry} />
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
   LOGIN
----------------------------------------------------------------*/
function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Operator QC");

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onLogin({ name: name.trim(), role });
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26, justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 6, background: C.green, display: "grid", placeItems: "center" }}>
            <Factory size={22} color="#fff" />
          </div>
          <div>
            <div className="disp" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>QAD–QIN</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>Monitoring Sampling Produksi</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 28 }}>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
            Masuk dengan nama petugas untuk mengisi dan memantau data sampling harian.
          </div>

          <label style={labelStyle}>Nama petugas</label>
          <input
            className="focus-ring"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth. Dewi Aryani"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 14 }}>Peran</label>
          <select className="focus-ring" value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
            <option>Operator QC</option>
            <option>Supervisor QC</option>
            <option>Admin QAD-QIN</option>
          </select>

          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              marginTop: 20, width: "100%", padding: "11px 0", border: "none", borderRadius: 6,
              background: name.trim() ? C.green : C.line, color: "#fff", fontWeight: 600, fontSize: 14,
              cursor: name.trim() ? "pointer" : "not-allowed",
            }}
          >
            Masuk
          </button>

          <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
            Saat ini data tersimpan di browser perangkat ini saja. Setelah terhubung ke database, data bisa dibagi antar petugas.
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
function TopBar({ user, page, setPage, onLogout }) {
  return (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 60, gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: C.green, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Factory size={16} color="#fff" />
          </div>
          <div className="disp" style={{ fontSize: 16, fontWeight: 600 }}>QAD–QIN</div>
        </div>

        <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          <NavBtn active={page === "dashboard"} onClick={() => setPage("dashboard")} icon={<LayoutGrid size={15} />} label="Dashboard" />
          <NavBtn active={page === "input"} onClick={() => setPage("input")} icon={<ClipboardList size={15} />} label="Input Data" />
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.2 }}>{user.role}</div>
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
