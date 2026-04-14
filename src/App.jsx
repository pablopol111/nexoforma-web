import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Download,
  LogOut,
  Pencil,
  Trash2,
  UserPlus,
  Settings,
  Save,
  Shield,
  Copy,
  UserCog,
} from "lucide-react";

const APP_NAME = "NexoForma";
const APP_VERSION = "v1.0.0";
const STORAGE_KEY = "nexoforma_web_state_v100_clean";
const MAX_PROFILES = 25;
const ADMIN_TOKEN = "NXF-ADMIN-ROOT";
const TOKENS = [
  "NXF-A7K2-Q9M4",
  "NXF-B3L8-T5R1",
  "NXF-C6P1-V8N2",
  "NXF-D4X7-H2K9",
  "NXF-E9M3-J6Q4",
  "NXF-F2R5-W1P8",
  "NXF-G8N4-Y3L6",
  "NXF-H1Q9-Z7M2",
  "NXF-J5T2-K8R4",
  "NXF-K7V6-N1X3",
  "NXF-L3W8-P4H7",
  "NXF-M6Y1-Q2T9",
  "NXF-N4Z7-R5J1",
  "NXF-P8H3-S6V2",
  "NXF-Q1J5-T9W4",
  "NXF-R9K2-V3Y6",
  "NXF-S2L7-W8N1",
  "NXF-T4M9-X1Q5",
  "NXF-V6N3-Y4P8",
  "NXF-W8P1-Z2R7",
];

function cls(...items) {
  return items.filter(Boolean).join(" ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function sanitizeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nutritionists: {}, workspaces: {}, lastToken: "" };
    const parsed = JSON.parse(raw);
    return {
      nutritionists: parsed.nutritionists || {},
      workspaces: parsed.workspaces || {},
      lastToken: parsed.lastToken || "",
    };
  } catch {
    return { nutritionists: {}, workspaces: {}, lastToken: "" };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultProfile(index = 1) {
  return {
    id: crypto.randomUUID(),
    name: index === 1 ? "Perfil principal" : `Perfil ${index}`,
    referenceWeight: 0,
    targetWeight: 0,
    heightCm: 0,
    entries: [],
  };
}

function defaultWorkspace(token, clinicName = "Espacio profesional") {
  return {
    token,
    clinicName,
    createdAt: new Date().toISOString(),
    profiles: [defaultProfile(1)],
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function weekStart(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function monthStart(isoDate) {
  return `${isoDate.slice(0, 7)}-01`;
}

function yearStart(isoDate) {
  return `${isoDate.slice(0, 4)}-01-01`;
}

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function aggregateEntries(entries, groupBy) {
  const rows = sortEntries(entries);
  const map = new Map();

  for (const row of rows) {
    let key = row.date;
    if (groupBy === "Semana") key = weekStart(row.date);
    if (groupBy === "Mes") key = monthStart(row.date);
    if (groupBy === "Año") key = yearStart(row.date);

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  return [...map.entries()].map(([key, items]) => ({
    label: key,
    weight: Number(average(items.map((x) => parseNum(x.weight))).toFixed(2)),
    steps: Math.round(average(items.map((x) => parseNum(x.steps)))),
    count: items.length,
  }));
}

function getLatest(entries) {
  const rows = sortEntries(entries);
  return rows.length ? rows[rows.length - 1] : null;
}

function bodyEstimate(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const h = heightCm / 100;
  if (!h) return null;
  const bmi = Number((weight / (h * h)).toFixed(1));
  let category = "Normopeso";
  let physique = "Composición equilibrada";
  if (bmi < 18.5) {
    category = "Bajo peso";
    physique = "Estructura ligera";
  } else if (bmi < 25) {
    category = "Normopeso";
    physique = "Composición equilibrada";
  } else if (bmi < 30) {
    category = "Sobrepeso";
    physique = "Constitución robusta";
  } else if (bmi < 35) {
    category = "Obesidad clase I";
    physique = "Alta carga ponderal";
  } else if (bmi < 40) {
    category = "Obesidad clase II";
    physique = "Muy alta carga ponderal";
  } else {
    category = "Obesidad clase III";
    physique = "Carga ponderal severa";
  }
  return { bmi, category, physique };
}

function progressToTarget(entries, targetWeight) {
  const rows = sortEntries(entries);
  if (!rows.length || !targetWeight) return null;
  const start = parseNum(rows[0].weight);
  const current = parseNum(rows[rows.length - 1].weight);
  if (start === targetWeight) return current === targetWeight ? 100 : 0;
  let progress = 0;
  if (targetWeight < start) progress = ((start - current) / (start - targetWeight)) * 100;
  else progress = ((current - start) / (targetWeight - start)) * 100;
  return Number(progress.toFixed(1));
}

function formatSigned(delta, suffix = "kg") {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return "-";
  if (delta > 0) return `↑ ${Math.abs(delta).toFixed(2)} ${suffix}`;
  if (delta < 0) return `↓ ${Math.abs(delta).toFixed(2)} ${suffix}`;
  return `→ 0.00 ${suffix}`;
}

function deltaColor(delta) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return "text-slate-300";
  if (delta < 0) return "text-emerald-400";
  if (delta > 0) return "text-red-400";
  return "text-slate-300";
}

function buildChartSvg(series, metricMode, referenceWeight, targetWeight) {
  const width = 820;
  const height = 300;
  const pad = 42;
  if (!series.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/><text x="50%" y="50%" text-anchor="middle" fill="#334155" font-size="16">Sin datos</text></svg>`;
  }

  const x = (i) => pad + (i * (width - pad * 2)) / Math.max(1, series.length - 1);
  const weights = series.map((s) => s.weight);
  const steps = series.map((s) => s.steps);

  const minW = Math.min(...weights, ...(referenceWeight ? [referenceWeight] : []), ...(targetWeight ? [targetWeight] : []));
  const maxW = Math.max(...weights, ...(referenceWeight ? [referenceWeight] : []), ...(targetWeight ? [targetWeight] : []));
  const minS = Math.min(...steps);
  const maxS = Math.max(...steps);

  const yWeight = (v) => {
    const min = minW - 1;
    const max = maxW + 1;
    return height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);
  };
  const ySteps = (v) => {
    const min = Math.max(0, minS - 500);
    const max = maxS + 500;
    return height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);
  };

  const poly = (vals, yFn) => vals.map((v, i) => `${x(i)},${yFn(v)}`).join(" ");
  const labels = series
    .map((s, i) => `<text x="${x(i)}" y="${height - 14}" text-anchor="middle" fill="#475569" font-size="10">${sanitizeHtml(s.label)}</text>`)
    .join("");

  const weightLayer = `
    <polyline fill="none" stroke="#0ea5e9" stroke-width="3" points="${poly(weights, yWeight)}"/>
    ${weights.map((v, i) => `<circle cx="${x(i)}" cy="${yWeight(v)}" r="4" fill="#0ea5e9"/>`).join("")}
  `;

  const stepsLayer = `
    <polyline fill="none" stroke="#22c55e" stroke-width="3" stroke-dasharray="8 6" points="${poly(steps, ySteps)}"/>
    ${steps.map((v, i) => `<circle cx="${x(i)}" cy="${ySteps(v)}" r="4" fill="#22c55e"/>`).join("")}
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#ffffff" rx="12"/>
      <text x="24" y="24" fill="#0f172a" font-size="18" font-weight="700">Evolución</text>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.5"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.5"/>
      ${referenceWeight ? `<line x1="${pad}" y1="${yWeight(referenceWeight)}" x2="${width - pad}" y2="${yWeight(referenceWeight)}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 4"/>` : ""}
      ${targetWeight ? `<line x1="${pad}" y1="${yWeight(targetWeight)}" x2="${width - pad}" y2="${yWeight(targetWeight)}" stroke="#22c55e" stroke-width="2" stroke-dasharray="2 4"/>` : ""}
      ${metricMode !== "Pasos" ? weightLayer : ""}
      ${metricMode !== "Peso" ? stepsLayer : ""}
      ${labels}
    </svg>
  `;
}

function Logo({ className = "w-10 h-10" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nxfCore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <circle cx="22" cy="20" r="4" fill="#e2e8f0" />
      <path d="M18 29 C22 25, 28 25, 33 29" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M18 43 L29 32 L37 39 L46 22" stroke="url(#nxfCore)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M41 22 H46 V27" stroke="url(#nxfCore)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-2">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ title, value, detail, colorClass = "text-slate-100" }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-400">{title}</div>
      <div className={cls("mt-2 text-2xl font-bold", colorClass)}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </div>
  );
}

function VersionFooter() {
  return <div className="mt-10 text-center text-xs text-slate-500">Versión {APP_VERSION}</div>;
}

function BodyVisual({ currentWeight, targetWeight, heightCm }) {
  const current = bodyEstimate(currentWeight, heightCm);
  const target = targetWeight ? bodyEstimate(targetWeight, heightCm) : null;

  const drawBody = (x, color, bmi, title, subtitle) => {
    const clamped = Math.max(16, Math.min(42, bmi || 22));
    const torsoW = 36 + (clamped - 22) * 2;
    const shoulderW = torsoW * 1.3;
    const hipW = torsoW * 1.02;
    return (
      <g transform={`translate(${x},0)`}>
        <text x="0" y="25" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="700">{title}</text>
        <text x="0" y="45" textAnchor="middle" fill="#94a3b8" fontSize="11">{subtitle}</text>
        <circle cx="0" cy="80" r="18" fill={color} />
        <path d={`M ${-shoulderW / 2} 108 L ${shoulderW / 2} 108 L ${torsoW / 2} 180 L ${-torsoW / 2} 180 Z`} fill={color} />
        <line x1={-shoulderW / 2 + 4} y1="112" x2={-shoulderW / 2 - 14} y2="152" stroke={color} strokeWidth="10" />
        <line x1={shoulderW / 2 - 4} y1="112" x2={shoulderW / 2 + 14} y2="152" stroke={color} strokeWidth="10" />
        <line x1={-hipW / 4} y1="180" x2={-12} y2="238" stroke={color} strokeWidth="10" />
        <line x1={hipW / 4} y1="180" x2={12} y2="238" stroke={color} strokeWidth="10" />
      </g>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4 overflow-x-auto">
      <div className="mb-3 text-sm text-slate-400">Comparativa visual simple entre estado actual y objetivo</div>
      <svg viewBox="0 0 720 270" className="w-full min-w-[680px] h-[240px]">
        {drawBody(180, "#38bdf8", current?.bmi || 22, "Estado actual", current ? `${currentWeight?.toFixed(2)} kg · IMC ${current.bmi}` : "Sin datos")}
        {target ? drawBody(540, "#22c55e", target.bmi, "Objetivo", `${targetWeight?.toFixed(2)} kg · IMC ${target.bmi}`) : <text x="540" y="120" textAnchor="middle" fill="#94a3b8" fontSize="14">Sin objetivo configurado</text>}
        <line x1="260" y1="120" x2="460" y2="120" stroke="#475569" strokeWidth="3" markerEnd="url(#arrowHead)" />
        <text x="360" y="102" textAnchor="middle" fill="#94a3b8" fontSize="12">Dirección estimada de progreso</text>
        <defs>
          <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#475569" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

function AdminPanel({ state, message, adminForm, setAdminForm, createNutritionist, removeNutritionist, copyToken, logout }) {
  const nutritionists = state.nutritionists || {};
  const workspaces = state.workspaces || {};
  const availableTokens = TOKENS.filter((token) => !nutritionists[token]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Logo className="w-14 h-14" />
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Panel de administrador</h1>
                <p className="mt-1 text-slate-400">Gestiona nutricionistas, asigna tokens y controla la implantación de NexoForma.</p>
              </div>
            </div>
            <button onClick={logout} className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold hover:bg-slate-700">Cerrar sesión</button>
          </div>
        </div>

        {message && <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

        <div className="grid md:grid-cols-3 gap-4">
          <StatCard title="Nutricionistas activos" value={String(Object.keys(nutritionists).length)} detail="Usuarios profesionales creados" />
          <StatCard title="Tokens disponibles" value={String(availableTokens.length)} detail="Licencias libres para asignar" />
          <StatCard title="Espacios creados" value={String(Object.keys(workspaces).length)} detail="Paneles profesionales iniciados" />
        </div>

        <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-sky-300" />
              <h2 className="text-2xl font-bold">Alta de nutricionista</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">Crea un profesional, asígnale un token y deja preparado su espacio de trabajo.</p>
            <div className="mt-6 grid gap-4">
              <Field label="Nombre del nutricionista">
                <input value={adminForm.name} onChange={(e) => setAdminForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" />
              </Field>
              <Field label="Clínica o marca profesional">
                <input value={adminForm.clinic} onChange={(e) => setAdminForm((f) => ({ ...f, clinic: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" />
              </Field>
              <Field label="Token asignado">
                <select value={adminForm.token} onChange={(e) => setAdminForm((f) => ({ ...f, token: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400">
                  <option value="">Selecciona un token libre</option>
                  {availableTokens.map((token) => <option key={token} value={token}>{token}</option>)}
                </select>
              </Field>
              <button onClick={createNutritionist} className="rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white hover:bg-sky-400">Crear nutricionista</button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg overflow-hidden">
            <div className="flex items-center gap-3">
              <UserCog className="w-5 h-5 text-emerald-300" />
              <h2 className="text-2xl font-bold">Nutricionistas registrados</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">Revisa a quién pertenece cada token y elimina accesos si es necesario.</p>
            <div className="mt-5 overflow-auto rounded-2xl border border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950 text-slate-300">
                  <tr>
                    <th className="px-3 py-3 text-left">Nutricionista</th>
                    <th className="px-3 py-3 text-left">Clínica</th>
                    <th className="px-3 py-3 text-left">Token</th>
                    <th className="px-3 py-3 text-left">Perfiles</th>
                    <th className="px-3 py-3 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(nutritionists).length ? Object.values(nutritionists).map((item) => (
                    <tr key={item.token} className="border-t border-slate-800 bg-slate-900/40">
                      <td className="px-3 py-3">{item.name}</td>
                      <td className="px-3 py-3">{item.clinic}</td>
                      <td className="px-3 py-3">{item.token}</td>
                      <td className="px-3 py-3">{workspaces[item.token]?.profiles?.length || 0}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => copyToken(item.token)} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700"><Copy className="w-4 h-4" /></button>
                          <button onClick={() => removeNutritionist(item.token)} className="rounded-xl bg-red-500/20 px-3 py-2 text-red-300 hover:bg-red-500/30">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Todavía no hay nutricionistas creados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <VersionFooter />
      </div>
    </div>
  );
}

function LoginScreen({ tokenInput, setTokenInput, login, message }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-8 items-stretch">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <div className="flex items-center gap-4">
            <Logo className="w-14 h-14" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
              <p className="mt-1 text-slate-400">Bienvenido a NexoForma, tu espacio para seguir de forma clara el peso, la actividad y la evolución corporal.</p>
              <p className="mt-2 text-sm text-sky-300">Cada registro cuenta. La constancia de hoy construye el resultado de mañana.</p>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Token de acceso</label>
              <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value.toUpperCase())} placeholder="NXF-XXXX-XXXX" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" />
            </div>

            <button onClick={login} className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white transition hover:bg-sky-400">Acceder</button>
            {message && <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <h2 className="text-2xl font-bold">Qué resuelve NexoForma</h2>
          <div className="mt-6 space-y-4 text-slate-300 text-sm leading-6">
            <p>Permite al nutricionista gestionar perfiles, evolución de peso, actividad diaria, comentarios y objetivos desde un único entorno.</p>
            <p>Incluye panel profesional, panel de administrador, exportación de informes y una estructura pensada para evolucionar a plataforma comercial.</p>
            <p>El acceso del profesional se hace únicamente mediante token, sin exponer listados de licencias en pantalla.</p>
          </div>
          <VersionFooter />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(loadState);
  const [tokenInput, setTokenInput] = useState(loadState().lastToken || "");
  const [activeToken, setActiveToken] = useState(loadState().lastToken || "");
  const [sessionMode, setSessionMode] = useState("");
  const [adminForm, setAdminForm] = useState({ name: "", clinic: "", token: "" });
  const [activeProfileId, setActiveProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [entryForm, setEntryForm] = useState({ date: todayISO(), weight: "", steps: 0, comment: "" });
  const [chartMetric, setChartMetric] = useState("Peso");
  const [chartGroupBy, setChartGroupBy] = useState("Semana");
  const [exportScope, setExportScope] = useState("Perfil actual");
  const [profileEdit, setProfileEdit] = useState(false);
  const [editingEntryDate, setEditingEntryDate] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceEditMode, setWorkspaceEditMode] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const nutritionists = state.nutritionists || {};
  const workspaces = state.workspaces || {};
  const currentWorkspace = activeToken ? workspaces[activeToken] || null : null;
  const currentNutritionist = activeToken ? nutritionists[activeToken] || null : null;
  const profiles = currentWorkspace?.profiles || [];
  const currentProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  useEffect(() => {
    if (profiles.length && !profiles.some((p) => p.id === activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    if (currentWorkspace) setWorkspaceName(currentWorkspace.clinicName || "");
  }, [currentWorkspace]);

  const latest = useMemo(() => (currentProfile ? getLatest(currentProfile.entries) : null), [currentProfile]);
  const sortedEntries = useMemo(() => (currentProfile ? sortEntries(currentProfile.entries) : []), [currentProfile]);
  const latestIndex = sortedEntries.length - 1;
  const prev = latestIndex > 0 ? sortedEntries[latestIndex - 1] : null;
  const latestWeight = latest ? parseNum(latest.weight) : 0;
  const latestSteps = latest ? parseNum(latest.steps) : 0;
  const refDelta = currentProfile && currentProfile.referenceWeight > 0 && latest ? latestWeight - parseNum(currentProfile.referenceWeight) : null;
  const targetDelta = currentProfile && currentProfile.targetWeight > 0 && latest ? latestWeight - parseNum(currentProfile.targetWeight) : null;
  const prevDelta = latest && prev ? latestWeight - parseNum(prev.weight) : null;
  const weekly = useMemo(() => (currentProfile ? aggregateEntries(currentProfile.entries, "Semana") : []), [currentProfile]);
  const chartData = useMemo(() => (currentProfile ? aggregateEntries(currentProfile.entries, chartGroupBy) : []), [currentProfile, chartGroupBy]);
  const currentWeek = weekly.length ? weekly[weekly.length - 1] : null;
  const bodyInfo = currentProfile ? bodyEstimate(latestWeight, parseNum(currentProfile.heightCm)) : null;
  const targetBodyInfo = currentProfile ? bodyEstimate(parseNum(currentProfile.targetWeight), parseNum(currentProfile.heightCm)) : null;
  const progress = currentProfile ? progressToTarget(currentProfile.entries, parseNum(currentProfile.targetWeight)) : null;

  function updateState(updater) {
    setState((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }

  function login() {
    const token = tokenInput.trim().toUpperCase();
    if (token === ADMIN_TOKEN) {
      setSessionMode("admin");
      setActiveToken("");
      setMessage("");
      return;
    }
    if (!TOKENS.includes(token)) {
      setMessage("Token no válido.");
      return;
    }
    if (!nutritionists[token]) {
      setMessage("Este token todavía no ha sido asignado a un nutricionista desde el panel administrador.");
      return;
    }
    if (!workspaces[token]) {
      updateState((prev) => ({
        ...prev,
        lastToken: token,
        workspaces: {
          ...prev.workspaces,
          [token]: defaultWorkspace(token, prev.nutritionists[token]?.clinic || "Espacio profesional"),
        },
      }));
    } else {
      updateState((prev) => ({ ...prev, lastToken: token }));
    }
    setActiveToken(token);
    setSessionMode("nutritionist");
    setMessage("");
    setProfileEdit(false);
  }

  function logout() {
    setSessionMode("");
    setActiveToken("");
    setActiveProfileId("");
    setProfileEdit(false);
    setWorkspaceEditMode(false);
  }

  function createNutritionist() {
    const name = adminForm.name.trim();
    const clinic = adminForm.clinic.trim();
    const token = adminForm.token.trim().toUpperCase();
    if (!name || !clinic || !token) {
      setMessage("Completa nombre, clínica y token para crear el nutricionista.");
      return;
    }
    if (!TOKENS.includes(token)) {
      setMessage("El token no pertenece al lote disponible.");
      return;
    }
    if (nutritionists[token]) {
      setMessage("Ese token ya está asignado.");
      return;
    }
    updateState((prev) => ({
      ...prev,
      nutritionists: {
        ...prev.nutritionists,
        [token]: {
          token,
          name,
          clinic,
          createdAt: new Date().toISOString(),
        },
      },
      workspaces: {
        ...prev.workspaces,
        [token]: defaultWorkspace(token, clinic),
      },
    }));
    setAdminForm({ name: "", clinic: "", token: "" });
    setMessage("Nutricionista creado correctamente.");
  }

  function removeNutritionist(token) {
    updateState((prev) => {
      const nextNutritionists = { ...prev.nutritionists };
      const nextWorkspaces = { ...prev.workspaces };
      delete nextNutritionists[token];
      delete nextWorkspaces[token];
      return { ...prev, nutritionists: nextNutritionists, workspaces: nextWorkspaces };
    });
    setMessage("Nutricionista eliminado.");
  }

  function copyToken(token) {
    navigator.clipboard.writeText(token);
    setMessage(`Token ${token} copiado.`);
  }

  function saveWorkspaceName() {
    const clean = workspaceName.trim();
    if (!clean || !activeToken || !currentWorkspace) {
      setMessage("Introduce un nombre de clínica válido.");
      return;
    }
    updateState((prev) => ({
      ...prev,
      workspaces: {
        ...prev.workspaces,
        [activeToken]: { ...prev.workspaces[activeToken], clinicName: clean },
      },
      nutritionists: prev.nutritionists[activeToken]
        ? {
            ...prev.nutritionists,
            [activeToken]: { ...prev.nutritionists[activeToken], clinic: clean },
          }
        : prev.nutritionists,
    }));
    setWorkspaceEditMode(false);
    setMessage("");
  }

  function patchProfile(profileId, patch) {
    if (!activeToken || !currentWorkspace) return;
    updateState((prev) => ({
      ...prev,
      workspaces: {
        ...prev.workspaces,
        [activeToken]: {
          ...prev.workspaces[activeToken],
          profiles: prev.workspaces[activeToken].profiles.map((p) => (p.id === profileId ? { ...p, ...patch } : p)),
        },
      },
    }));
  }

  function addProfile() {
    if (!activeToken || !currentWorkspace || currentWorkspace.profiles.length >= MAX_PROFILES) return;
    const newProfile = defaultProfile(currentWorkspace.profiles.length + 1);
    updateState((prev) => ({
      ...prev,
      workspaces: {
        ...prev.workspaces,
        [activeToken]: {
          ...prev.workspaces[activeToken],
          profiles: [...prev.workspaces[activeToken].profiles, newProfile],
        },
      },
    }));
    setActiveProfileId(newProfile.id);
    setProfileEdit(true);
  }

  function deleteProfile(profileId) {
    if (!activeToken || !currentWorkspace || currentWorkspace.profiles.length <= 1) return;
    updateState((prev) => ({
      ...prev,
      workspaces: {
        ...prev.workspaces,
        [activeToken]: {
          ...prev.workspaces[activeToken],
          profiles: prev.workspaces[activeToken].profiles.filter((p) => p.id !== profileId),
        },
      },
    }));
  }

  function saveEntry() {
    if (!activeToken || !currentProfile) return;
    const weight = parseNum(entryForm.weight);
    const steps = Math.max(0, Math.round(parseNum(entryForm.steps)));
    if (!entryForm.date || !weight) {
      setMessage("Introduce al menos fecha y peso.");
      return;
    }
    const row = { date: entryForm.date, weight: Number(weight.toFixed(2)), steps, comment: entryForm.comment?.trim() || "" };
    updateState((prev) => ({
      ...prev,
      workspaces: {
        ...prev.workspaces,
        [activeToken]: {
          ...prev.workspaces[activeToken],
          profiles: prev.workspaces[activeToken].profiles.map((p) => {
            if (p.id !== currentProfile.id) return p;
            const remaining = p.entries.filter((e) => e.date !== row.date);
            return { ...p, entries: sortEntries([...remaining, row]) };
          }),
        },
      },
    }));
    setEntryForm({ date: todayISO(), weight: "", steps: 0, comment: "" });
    setEditingEntryDate("");
    setMessage("");
  }

  function loadEntry(row) {
    setEntryForm({ date: row.date, weight: row.weight, steps: row.steps, comment: row.comment || "" });
    setEditingEntryDate(row.date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeEntry(date) {
    if (!activeToken || !currentProfile) return;
    updateState((prev) => ({
      ...prev,
      workspaces: {
        ...prev.workspaces,
        [activeToken]: {
          ...prev.workspaces[activeToken],
          profiles: prev.workspaces[activeToken].profiles.map((p) =>
            p.id === currentProfile.id ? { ...p, entries: p.entries.filter((e) => e.date !== date) } : p
          ),
        },
      },
    }));
  }

  function exportWord() {
    if (!currentWorkspace) return;
    const selectedProfiles = exportScope === "Todos los perfiles" ? currentWorkspace.profiles : currentProfile ? [currentProfile] : [];
    if (!selectedProfiles.length) {
      setMessage("No hay perfiles para exportar.");
      return;
    }
    const sections = selectedProfiles.map((profile) => {
      const rows = sortEntries(profile.entries);
      const latestRow = getLatest(profile.entries);
      const latestWeightProfile = latestRow ? parseNum(latestRow.weight) : 0;
      const info = bodyEstimate(latestWeightProfile, parseNum(profile.heightCm));
      const tInfo = bodyEstimate(parseNum(profile.targetWeight), parseNum(profile.heightCm));
      const prog = progressToTarget(profile.entries, parseNum(profile.targetWeight));
      const series = aggregateEntries(profile.entries, chartGroupBy);
      const chartSvg = buildChartSvg(series, chartMetric, parseNum(profile.referenceWeight), parseNum(profile.targetWeight));
      const chartDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(chartSvg)}`;
      const tableRows = rows.map((r) => `
        <tr>
          <td>${sanitizeHtml(r.date)}</td>
          <td>${sanitizeHtml(Number(r.weight).toFixed(2))} kg</td>
          <td>${sanitizeHtml(r.steps)}</td>
          <td>${sanitizeHtml(r.comment || "-")}</td>
        </tr>`).join("");
      return `
        <h2>${sanitizeHtml(profile.name)}</h2>
        <p><strong>Referencia:</strong> ${profile.referenceWeight || "-"} kg &nbsp; | &nbsp; <strong>Objetivo:</strong> ${profile.targetWeight || "-"} kg &nbsp; | &nbsp; <strong>Altura:</strong> ${profile.heightCm || "-"} cm</p>
        <p><strong>Estado actual:</strong> ${latestRow ? `${Number(latestRow.weight).toFixed(2)} kg` : "Sin datos"}</p>
        <p><strong>Comentario corporal:</strong> ${info ? `${info.category} · ${info.physique} · IMC ${info.bmi}` : "Sin datos suficientes"}</p>
        <p><strong>Objetivo estimado:</strong> ${tInfo ? `${tInfo.category} · ${tInfo.physique} · IMC ${tInfo.bmi}` : "Sin objetivo"}</p>
        <p><strong>Progreso estimado:</strong> ${prog === null ? "Sin cálculo" : `${prog}%`}</p>
        <img src="${chartDataUri}" style="width:100%;max-width:820px;border:1px solid #cbd5e1;border-radius:12px;" />
        <h3>Histórico</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Peso</th><th>Pasos</th><th>Comentario</th></tr></thead>
          <tbody>${tableRows || `<tr><td colspan="4">Sin datos</td></tr>`}</tbody>
        </table>`;
    }).join('<div style="page-break-after:always"></div>');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Informe NexoForma</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { color: #0f172a; }
            h2 { color: #0f172a; margin-top: 28px; }
            h3 { color: #334155; margin-top: 18px; }
            table { border-collapse: collapse; width: 100%; margin-top: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #e2e8f0; }
            p { line-height: 1.55; }
          </style>
        </head>
        <body>
          <h1>NexoForma · Informe estructurado</h1>
          <p><strong>Clínica:</strong> ${sanitizeHtml(currentWorkspace.clinicName)}</p>
          <p><strong>Profesional:</strong> ${sanitizeHtml(currentNutritionist?.name || "-")}</p>
          <p><strong>Ámbito:</strong> ${sanitizeHtml(exportScope)}</p>
          <p><strong>Agrupación de gráfica:</strong> ${sanitizeHtml(chartGroupBy)}</p>
          <p><strong>Modo de gráfica:</strong> ${sanitizeHtml(chartMetric)}</p>
          ${sections}
        </body>
      </html>`;

    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NexoForma_${currentWorkspace.clinicName.replace(/\s+/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (sessionMode === "admin") {
    return <AdminPanel state={state} message={message} adminForm={adminForm} setAdminForm={setAdminForm} createNutritionist={createNutritionist} removeNutritionist={removeNutritionist} copyToken={copyToken} logout={logout} />;
  }

  if (!activeToken || !currentWorkspace) {
    return <LoginScreen tokenInput={tokenInput} setTokenInput={setTokenInput} login={login} message={message} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-[1700px] px-4 md:px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Logo className="w-12 h-12" />
            <div>
              <div className="text-3xl font-bold">{APP_NAME}</div>
              <div className="text-sm text-slate-400">Clínica activa: {currentWorkspace.clinicName}</div>
              <div className="text-xs text-slate-500">Nutricionista: {currentNutritionist?.name || "Sin configurar"} | Máximo {MAX_PROFILES} perfiles</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setWorkspaceEditMode((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"><Settings className="w-4 h-4" /> Configurar clínica</button>
            <button onClick={addProfile} disabled={profiles.length >= MAX_PROFILES} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"><UserPlus className="w-4 h-4" /> Añadir perfil</button>
            <button onClick={exportWord} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"><Download className="w-4 h-4" /> Exportar Word</button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"><LogOut className="w-4 h-4" /> Cerrar sesión</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] px-4 md:px-6 py-6 space-y-6">
        {message && <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

        {workspaceEditMode && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-300 mb-2">Nombre de la clínica o espacio profesional</label>
                <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" />
              </div>
              <button onClick={saveWorkspaceName} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400"><Save className="w-4 h-4" /> Guardar</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {profiles.map((profile) => (
            <button key={profile.id} onClick={() => { setActiveProfileId(profile.id); setProfileEdit(false); }} className={cls("rounded-2xl px-4 py-2 text-sm font-semibold border transition", currentProfile?.id === profile.id ? "bg-sky-500 border-sky-400 text-white" : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800")}>{profile.name}</button>
          ))}
        </div>

        {currentProfile && (
          <>
            <div className="grid xl:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Perfil y objetivos</h2>
                    <p className="mt-1 text-sm text-slate-400">Estos datos se usan como base. Quedan bloqueados salvo que quieras editarlos.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setProfileEdit((v) => !v)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700">{profileEdit ? "Bloquear" : "Editar perfil"}</button>
                    {profiles.length > 1 && <button onClick={() => deleteProfile(currentProfile.id)} className="rounded-2xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30">Eliminar perfil</button>}
                  </div>
                </div>

                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <Field label="Nombre del perfil"><input value={currentProfile.name} disabled={!profileEdit} onChange={(e) => patchProfile(currentProfile.id, { name: e.target.value })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:text-slate-400 outline-none focus:border-sky-400" /></Field>
                  <Field label="Peso de referencia (kg)"><input value={currentProfile.referenceWeight || ""} disabled={!profileEdit} onChange={(e) => patchProfile(currentProfile.id, { referenceWeight: parseNum(e.target.value) })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:text-slate-400 outline-none focus:border-sky-400" /></Field>
                  <Field label="Peso objetivo (kg)"><input value={currentProfile.targetWeight || ""} disabled={!profileEdit} onChange={(e) => patchProfile(currentProfile.id, { targetWeight: parseNum(e.target.value) })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:text-slate-400 outline-none focus:border-sky-400" /></Field>
                  <Field label="Altura (cm)"><input value={currentProfile.heightCm || ""} disabled={!profileEdit} onChange={(e) => patchProfile(currentProfile.id, { heightCm: parseNum(e.target.value) })} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:text-slate-400 outline-none focus:border-sky-400" /></Field>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
                <h2 className="text-2xl font-bold">Registro diario</h2>
                <p className="mt-1 text-sm text-slate-400">Añade peso, pasos y comentarios para alimentar el histórico y el informe.</p>
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <Field label="Fecha"><input type="date" value={entryForm.date} onChange={(e) => setEntryForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></Field>
                  <Field label="Peso del día (kg)"><input value={entryForm.weight} onChange={(e) => setEntryForm((f) => ({ ...f, weight: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></Field>
                  <Field label="Número de pasos"><input value={entryForm.steps} onChange={(e) => setEntryForm((f) => ({ ...f, steps: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></Field>
                  <Field label="Comentario del día"><input value={entryForm.comment} onChange={(e) => setEntryForm((f) => ({ ...f, comment: e.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-400" /></Field>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={saveEntry} className="rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white hover:bg-sky-400">{editingEntryDate ? "Actualizar registro" : "Guardar registro"}</button>
                  <button onClick={() => latest && setEntryForm({ date: todayISO(), weight: latest.weight, steps: latest.steps, comment: latest.comment || "" })} className="rounded-2xl bg-slate-800 px-5 py-3 font-semibold hover:bg-slate-700">Cargar último registro</button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="Último peso" value={latest ? `${latestWeight.toFixed(2)} kg` : "-"} detail={latest ? `Registro del ${latest.date}` : "Sin registros"} />
              <StatCard title="Últimos pasos" value={latest ? `${latestSteps}` : "-"} detail="Pasos del último registro" />
              <StatCard title="Media semanal peso" value={currentWeek ? `${Number(currentWeek.weight).toFixed(2)} kg` : "-"} detail="Media del bloque semanal actual" />
              <StatCard title="Media semanal pasos" value={currentWeek ? `${currentWeek.steps}` : "-"} detail="Media del bloque semanal actual" />
              <StatCard title="Vs. referencia" value={formatSigned(refDelta)} detail="Comparado con el peso de referencia" colorClass={deltaColor(refDelta)} />
              <StatCard title="Vs. día anterior" value={formatSigned(prevDelta)} detail="Comparado con el registro anterior" colorClass={deltaColor(prevDelta)} />
              <StatCard title="Vs. objetivo" value={formatSigned(targetDelta)} detail="Comparado con el peso objetivo" colorClass={deltaColor(targetDelta)} />
              <StatCard title="Movimiento" value={prevDelta === null ? "Sin base" : prevDelta < 0 ? "Descenso" : prevDelta > 0 ? "Incremento" : "Estable"} detail={prevDelta === null ? "Aún no hay comparativa" : prevDelta < 0 ? "La última lectura refleja bajada" : prevDelta > 0 ? "La última lectura refleja subida" : "Sin cambios"} colorClass={prevDelta === null ? "text-slate-100" : prevDelta < 0 ? "text-emerald-400" : prevDelta > 0 ? "text-red-400" : "text-slate-100"} />
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
              <h2 className="text-2xl font-bold">Cuerpo estimado y comentarios</h2>
              <div className="mt-3 space-y-1 text-slate-200 leading-7">
                <div>Estado actual: {bodyInfo ? `${latestWeight.toFixed(2)} kg con IMC ${bodyInfo.bmi} (${bodyInfo.category} · ${bodyInfo.physique}).` : "Sin datos suficientes."}</div>
                <div>Altura registrada: {currentProfile.heightCm ? `${currentProfile.heightCm} cm.` : "No configurada."}</div>
                <div>Objetivo configurado: {targetBodyInfo ? `${Number(currentProfile.targetWeight).toFixed(2)} kg con IMC estimado ${targetBodyInfo.bmi} (${targetBodyInfo.category} · ${targetBodyInfo.physique}).` : "Sin objetivo configurado."}</div>
                <div>Progreso estimado: {progress === null ? "Sin cálculo." : `${progress}% del recorrido objetivo completado.`}</div>
              </div>
              <div className="mt-5">
                <BodyVisual currentWeight={latestWeight} targetWeight={parseNum(currentProfile.targetWeight)} heightCm={parseNum(currentProfile.heightCm)} />
              </div>
            </div>

            <div className="grid xl:grid-cols-[1.3fr_1fr] gap-6 items-start">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Evolución</h2>
                    <p className="mt-1 text-sm text-slate-400">Puedes visualizar peso, pasos o ambos y agrupar por día, semana, mes o año.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select value={chartMetric} onChange={(e) => setChartMetric(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3"><option>Peso</option><option>Pasos</option><option>Ambos</option></select>
                    <select value={chartGroupBy} onChange={(e) => setChartGroupBy(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3"><option>Día</option><option>Semana</option><option>Mes</option><option>Año</option></select>
                    <select value={exportScope} onChange={(e) => setExportScope(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3"><option>Perfil actual</option><option>Todos los perfiles</option></select>
                  </div>
                </div>

                <div className="mt-6 h-[420px] rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 25, left: 0, bottom: 10 }}>
                        <CartesianGrid stroke="#334155" strokeDasharray="4 4" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis yAxisId="left" stroke="#94a3b8" />
                        {chartMetric === "Ambos" && <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />}
                        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 16, color: "#e2e8f0" }} />
                        <Legend />
                        {chartMetric !== "Pasos" && <Line yAxisId="left" type="monotone" dataKey="weight" name="Peso" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} />}
                        {chartMetric !== "Peso" && <Line yAxisId={chartMetric === "Ambos" ? "right" : "left"} type="monotone" dataKey="steps" name="Pasos" stroke="#22c55e" strokeWidth={3} strokeDasharray="8 6" dot={{ r: 4 }} />}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-slate-400">Todavía no hay suficientes datos para construir la gráfica.</div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg overflow-hidden">
                <h2 className="text-2xl font-bold">Histórico y comparativas</h2>
                <p className="mt-1 text-sm text-slate-400">Puedes editar o eliminar cada línea. Los comentarios también se incorporan al informe.</p>
                <div className="mt-5 overflow-auto rounded-2xl border border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-950 text-slate-300"><tr><th className="px-3 py-3 text-left">Fecha</th><th className="px-3 py-3 text-left">Peso</th><th className="px-3 py-3 text-left">Pasos</th><th className="px-3 py-3 text-left">Comentario</th><th className="px-3 py-3 text-left">Acciones</th></tr></thead>
                    <tbody>
                      {sortedEntries.length ? sortEntries(currentProfile.entries).slice().reverse().map((row, index, arr) => {
                        const previous = arr[index + 1] || null;
                        const delta = previous ? parseNum(row.weight) - parseNum(previous.weight) : null;
                        return (
                          <tr key={row.date} className="border-t border-slate-800 bg-slate-900/40">
                            <td className="px-3 py-3">{row.date}</td>
                            <td className="px-3 py-3 whitespace-nowrap"><span className={deltaColor(delta)}>{Number(row.weight).toFixed(2)} kg</span></td>
                            <td className="px-3 py-3">{row.steps}</td>
                            <td className="px-3 py-3 min-w-[240px] text-slate-300">{row.comment || "-"}</td>
                            <td className="px-3 py-3"><div className="flex gap-2"><button onClick={() => loadEntry(row)} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700"><Pencil className="w-4 h-4" /></button><button onClick={() => removeEntry(row.date)} className="rounded-xl bg-red-500/20 p-2 text-red-300 hover:bg-red-500/30"><Trash2 className="w-4 h-4" /></button></div></td>
                          </tr>
                        );
                      }) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Todavía no hay registros.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
        <VersionFooter />
      </div>
    </div>
  );
}

export default App;
