import { useEffect, useMemo, useState } from "react";
import {
  Zap, LayoutDashboard, BookOpen, Target, BarChart3, Brain,
  RotateCcw, Check, X, Search, Trophy, Flame, Star, Volume2,
  Lightbulb, RefreshCw, Menu,
} from "lucide-react";
import { VERBS } from "./verbs";
import { REGULAR_VERBS } from "./regularVerbs";
import { PHRASES } from "./phrases";

const ALL_VERBS = [...VERBS, ...REGULAR_VERBS];
const STORAGE_KEY = "verb-trainer-v1";
const PHRASE_KEY  = "think-english-v1";

const loadJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ===== Racha de días ===== */
const STREAK_KEY = "streak-v1";
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const yesterdayKey = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const loadStreak = () => {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { current: 0, best: 0, last: null }; }
  catch { return { current: 0, best: 0, last: null }; }
};
function bumpStreak() {
  const s = loadStreak();
  const today = todayKey();
  if (s.last === today) return s;
  const current = s.last === yesterdayKey() ? s.current + 1 : 1;
  const next = { current, best: Math.max(s.best, current), last: today };
  localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  return next;
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const matches = (input, expected) => expected.split("/").map(norm).includes(norm(input));

function speak(text, rate = 0.9) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; u.rate = rate; u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export default function App() {
  const [view, setView] = useState("dashboard");
const [progress, setProgress] = useState(() => loadJSON(STORAGE_KEY));
  const [streak,   setStreak]   = useState(() => loadStreak());
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => saveJSON(STORAGE_KEY, progress), [progress]);

  const stats = useMemo(() => {
    const total = ALL_VERBS.length;
    let mastered = 0, attempts = 0, correct = 0;
    Object.values(progress).forEach((v) => {
      attempts += v.attempts || 0;
      correct  += v.correct  || 0;
      if ((v.streak || 0) >= 3) mastered++;
    });
    return {
      total, mastered, remaining: total - mastered, attempts, correct,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
      pctMastered: Math.round((mastered / total) * 100),
    };
  }, [progress]);

  const goTo = (v) => { setView(v); setMobileOpen(false); };
  const resetAll = () => { if (confirm("¿Borrar todo tu progreso?")) setProgress({}); };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* OVERLAY mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed md:static z-40 w-64 h-screen md:h-auto bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 grid place-items-center shadow-soft">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-lg leading-none">VerbMaster</div>
            <div className="text-xs text-slate-500 mt-1">Aprende rápido</div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden ml-auto p-2 -mr-2 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-2 flex-1 space-y-1 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="Dashboard"        active={view==="dashboard"} onClick={()=>goTo("dashboard")} />
          <NavItem icon={BookOpen}        label="Lista de verbos"  active={view==="study"}     onClick={()=>goTo("study")}     badge={`${ALL_VERBS.length}`} />
          <NavItem icon={Target}          label="Reto"             active={view==="challenge"} onClick={()=>goTo("challenge")} />
          <NavItem icon={Brain}           label="Think in English" active={view==="think"}     onClick={()=>goTo("think")}     badge={`${PHRASES.length}`} />
          <NavItem icon={BarChart3}       label="Mi progreso"      active={view==="progress"}  onClick={()=>goTo("progress")} />
        </nav>

        <button onClick={resetAll}
          className="m-3 px-4 py-2 text-sm rounded-xl border border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 justify-center">
          <RotateCcw className="w-4 h-4" /> Reiniciar progreso
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        {/* TOPBAR mobile */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-slate-700">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 grid place-items-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold">VerbMaster</span>
          </div>
          <div className="w-9" />
        </div>

        <div className="p-4 sm:p-6 md:p-8 max-w-[1200px]">
          {view === "dashboard" && <Dashboard stats={stats} go={goTo} streak={streak} />}
          {view === "study"     && <StudyList />}
          {view === "challenge" && <Challenge progress={progress} setProgress={setProgress} onPractice={() => setStreak(bumpStreak())} />}
          {view === "think"     && <ThinkInEnglish onPractice={() => setStreak(bumpStreak())} />}
          {view === "progress"  && <ProgressView progress={progress} stats={stats} />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium transition
        ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-brand-600" : "text-slate-400"}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

/* ---------- DASHBOARD ---------- */
function Dashboard({ stats, go, streak }) {
  const flame = streak.current >= 7 ? "🔥🔥" : streak.current >= 3 ? "🔥" : "";
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">¡Hola! 👋</h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">Domina los verbos y piensa en inglés</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Pill icon={Flame}  color="amber"  text={`${stats.accuracy}% eficacia`} />
          <Pill icon={Star}   color="violet" text={`${stats.mastered} dominados`} />
        </div>
      </div>

      {/* Banner de racha */}
      <div className="rounded-2xl p-5 sm:p-6 mb-5 bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-soft flex items-center gap-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 grid place-items-center text-3xl sm:text-4xl shrink-0">
          🔥
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm text-white/85 font-semibold uppercase tracking-wider">Racha actual</div>
          <div className="text-2xl sm:text-4xl font-extrabold leading-tight flex items-baseline gap-2 flex-wrap">
            {streak.current} <span className="text-sm sm:text-base font-semibold text-white/90">{streak.current === 1 ? "día" : "días"}</span>
            <span className="text-lg sm:text-2xl">{flame}</span>
          </div>
          <div className="text-xs sm:text-sm text-white/85 mt-0.5">
            Mejor racha: <b>{streak.best}</b> {streak.best === 1 ? "día" : "días"} · ¡practica hoy para mantenerla!
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard color="amber"  icon={Flame}   value={stats.mastered}       label="Dominados" />
        <StatCard color="violet" icon={Star}    value={stats.remaining}      label="Faltan" />
        <StatCard color="blue"   icon={Trophy}  value={`${stats.accuracy}%`} label="Eficacia" />
        <StatCard color="rose"   icon={Target}  value={stats.attempts}       label="Intentos" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-bold">Progreso global</h2>
          <button onClick={() => go("challenge")} className="text-xs sm:text-sm font-semibold text-brand-600">Reto →</button>
        </div>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-slate-600 font-medium">Verbos dominados</span>
          <span className="font-semibold">{stats.mastered}/{stats.total}</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
               style={{ width: `${stats.pctMastered}%` }} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => go("study")}
          className="px-4 py-4 rounded-2xl border border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50 font-semibold flex items-center gap-3 text-left">
          <BookOpen className="w-5 h-5 text-brand-600" />
          <div>
            <div>Estudiar lista</div>
            <div className="text-xs font-normal text-slate-500">{ALL_VERBS.length} verbos con audio</div>
          </div>
        </button>
        <button onClick={() => go("think")}
          className="px-4 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold flex items-center gap-3 text-left shadow-soft">
          <Brain className="w-5 h-5" />
          <div>
            <div>Think in English</div>
            <div className="text-xs font-normal text-white/85">Piensa en inglés · A1/A2/B1</div>
          </div>
        </button>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, color, text }) {
  const map = { amber:"bg-amber-50 text-amber-700", violet:"bg-violet-50 text-violet-700" };
  return <div className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${map[color]}`}><Icon className="w-4 h-4" />{text}</div>;
}

function StatCard({ color, icon: Icon, value, label }) {
  const map = {
    amber:"bg-amber-50 text-amber-600", violet:"bg-violet-50 text-violet-600",
    blue:"bg-brand-50 text-brand-600",  rose:"bg-rose-50 text-rose-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm">
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl grid place-items-center mb-3 sm:mb-4 ${map[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold">{value}</div>
      <div className="text-xs sm:text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function SpeakBtn({ text, size = "sm" }) {
  const sz = size === "lg" ? "w-9 h-9" : "w-7 h-7";
  const ic = size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <button onClick={(e) => { e.stopPropagation(); speak(text); }}
      title={`Escuchar: ${text}`}
      className={`${sz} grid place-items-center rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white transition shrink-0`}>
      <Volume2 className={ic} />
    </button>
  );
}

/* ---------- STUDY LIST ---------- */
function StudyList() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = ALL_VERBS.filter((v) => {
    if (filter !== "all" && v.type !== filter) return false;
    const s = q.toLowerCase();
    return !s || v.base.includes(s) || v.past.includes(s) || v.pp.includes(s) || v.es.toLowerCase().includes(s);
  });


  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-1 sm:mb-2">Lista de verbos</h1>
      <p className="text-slate-500 mb-4 sm:mb-6 text-sm">{ALL_VERBS.length} verbos · toca 🔊 para escuchar</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <StudyTab id="all"       label="Todos"       count={ALL_VERBS.length}    active={filter} onChange={setFilter} />
        <StudyTab id="irregular" label="Irregulares" count={VERBS.length}        active={filter} onChange={setFilter} />
        <StudyTab id="regular"   label="Regulares"   count={REGULAR_VERBS.length} active={filter} onChange={setFilter} />
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 text-sm" />
      </div>

      {/* DESKTOP table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hidden sm:block">
        <div className="grid grid-cols-12 px-5 py-3 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Presente</div>
          <div className="col-span-3">Pasado</div>
          <div className="col-span-3">Participio</div>
          <div className="col-span-2">Significado</div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {filtered.map((v, i) => (
            <div key={v.id} className="grid grid-cols-12 px-5 py-3 text-sm hover:bg-brand-50/40 items-center">
              <div className="col-span-1 text-slate-400 flex items-center gap-1">
                {i + 1}
                <span className={`w-2 h-2 rounded-full ${v.type==="regular" ? "bg-emerald-400" : "bg-brand-500"}`} />
              </div>
              <div className="col-span-3 flex items-center gap-2"><span className="font-semibold">{v.base}</span><SpeakBtn text={v.base} /></div>
              <div className="col-span-3 flex items-center gap-2 text-slate-700"><span>{v.past}</span><SpeakBtn text={v.past} /></div>
              <div className="col-span-3 flex items-center gap-2 text-slate-700"><span>{v.pp}</span><SpeakBtn text={v.pp} /></div>
              <div className="col-span-2 text-slate-500 italic truncate" title={v.es}>{v.es}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MOBILE cards */}
      <div className="sm:hidden space-y-2 max-h-[65vh] overflow-y-auto">
        {filtered.map((v, i) => (
          <div key={v.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">#{i + 1}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${v.type==="regular" ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"}`}>
                {v.type}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <MobileCell label="Pres." word={v.base} bold />
              <MobileCell label="Past"  word={v.past} />
              <MobileCell label="P.P."  word={v.pp} />
            </div>
            <div className="text-xs text-slate-500 italic mt-2">{v.es}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileCell({ label, word, bold }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className={bold ? "font-semibold" : "text-slate-700"}>{word}</span>
        <SpeakBtn text={word} />
      </div>
    </div>
  );
}

/* ---------- CHALLENGE ---------- */
function Challenge({ progress, setProgress, onPractice }) {
  const [verb, setVerb] = useState(() => pickVerb(progress));
  const [past, setPast] = useState(""); const [pp, setPp] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [streakSession, setStreakSession] = useState(0);

  function next() { setVerb(pickVerb(progress)); setPast(""); setPp(""); setFeedback(null); }
  function check(e) {
    e.preventDefault();
    if (feedback) return next();
    const okPast = matches(past, verb.past);
    const okPp   = matches(pp, verb.pp);
    const ok = okPast && okPp;
    setProgress((prev) => {
      const cur = prev[verb.id] || { attempts: 0, correct: 0, streak: 0 };
      return { ...prev, [verb.id]: {
        attempts: cur.attempts + 1, correct: cur.correct + (ok ? 1 : 0),
        streak: ok ? (cur.streak || 0) + 1 : 0, last: Date.now(),
      }};
    });
    if (!ok) setTimeout(() => speak(`${verb.base}, ${verb.past}, ${verb.pp}`, 0.8), 250);
    setFeedback({ ok, okPast, okPp });
    setStreakSession((s) => (ok ? s + 1 : 0));
    onPractice && onPractice();
  }

  const stat = progress[verb.id] || { attempts: 0, correct: 0, streak: 0 };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold">Modo Reto</h1>
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold bg-amber-50 text-amber-700 px-3 py-2 rounded-xl">
          <Flame className="w-4 h-4" /> Racha: {streakSession}
        </div>
      </div>
      <p className="text-slate-500 mb-6 text-sm sm:text-base">Escribe el pasado simple y el participio pasado</p>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-8 shadow-sm">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600 mb-3">
            Verbo en presente
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${verb.type==="regular" ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"}`}>{verb.type}</span>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight">{verb.base}</div>
            <SpeakBtn text={verb.base} size="lg" />
          </div>
          <div className="text-slate-500 italic mt-2 text-sm sm:text-base">{verb.es}</div>
        </div>

        <form onSubmit={check} className="space-y-4">
          <Field label="Pasado simple" value={past} onChange={setPast} disabled={!!feedback} ok={feedback?.okPast} expected={verb.past} shown={!!feedback} autoFocus />
          <Field label="Participio pasado" value={pp} onChange={setPp} disabled={!!feedback} ok={feedback?.okPp} expected={verb.pp} shown={!!feedback} />
          <button type="submit"
            className={`w-full py-3.5 rounded-xl font-bold text-white transition shadow-soft
              ${feedback ? "bg-brand-600 hover:bg-brand-700" : "bg-brand-500 hover:bg-brand-600"}`}>
            {feedback ? "Siguiente verbo →" : "Comprobar"}
          </button>
        </form>

        {feedback && (
          <div className={`mt-5 p-4 rounded-xl flex items-center gap-3 font-semibold text-sm
            ${feedback.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {feedback.ok ? <><Check className="w-5 h-5" /> ¡Correcto! +1 a tu racha</> : <><X className="w-5 h-5" /> Escucha y revisa las formas</>}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 text-center">
          <Mini label="Intentos" value={stat.attempts} />
          <Mini label="Aciertos" value={stat.correct} />
          <Mini label="Racha" value={stat.streak} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, ok, expected, shown, autoFocus }) {
  const border = !shown
    ? "border-slate-200 focus:border-brand-400 focus:ring-brand-100"
    : ok ? "border-emerald-300 bg-emerald-50/40" : "border-rose-300 bg-rose-50/40";
  return (
    <div>
      <label className="text-sm font-semibold text-slate-600 mb-1.5 block">{label}</label>
      <div className="relative">
        <input autoFocus={autoFocus} disabled={disabled} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Escribe el ${label.toLowerCase()}...`}
          className={`w-full px-4 py-3 pr-12 rounded-xl border-2 bg-white focus:outline-none focus:ring-4 transition ${border}`} />
        {shown && (
          <button type="button" onClick={() => speak(expected.split("/")[0])}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white">
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {shown && !ok && (
        <div className="text-xs mt-1.5 text-rose-600 font-medium">Correcto: <span className="font-bold">{expected}</span></div>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return <div><div className="text-xl sm:text-2xl font-extrabold">{value}</div><div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider">{label}</div></div>;
}

function pickVerb(progress) {
  const weighted = ALL_VERBS.map((v) => {
    const p = progress[v.id] || { attempts: 0, correct: 0, streak: 0 };
    if ((p.streak || 0) >= 3) return { v, w: 0.2 };
    const accuracy = p.attempts ? p.correct / p.attempts : 0;
    return { v, w: 1 + (1 - accuracy) * 2 + (p.attempts === 0 ? 1.5 : 0) };
  });
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.v; }
  return weighted[0].v;
}

/* ---------- THINK IN ENGLISH ---------- */
const normPhrase = (s) => s.toLowerCase()
  .replace(/[¿?¡!.,;:"]/g, "")
  .replace(/[\u0027\u0060\u00B4\u2018\u2019\u02BC\uFF07]/g, "") // strip ALL apostrophe variants
  .replace(/\s+/g, " ")
  .trim();

function expandContractions(s) {
  return (" " + s + " ")
    .replaceAll(" im ", " i'm ")
    .replaceAll(" dont ", " don't ")
    .replaceAll(" doesnt ", " doesn't ")
    .replaceAll(" cant ", " can't ")
    .replaceAll(" wont ", " won't ")
    .replaceAll(" its ", " it's ")
    .replaceAll(" thats ", " that's ")
    .replaceAll(" whats ", " what's ")
    .replaceAll(" wheres ", " where's ")
    .replaceAll(" hows ", " how's ")
    .replaceAll(" lets ", " let's ")
    .replaceAll(" ill ", " i'll ")
    .replaceAll(" id ", " i'd ")
    .replaceAll(" ive ", " i've ")
    .replaceAll(" youre ", " you're ")
    .replaceAll(" hes ", " he's ");
}

function checkPhrase(input, phrase) {
  const a = normPhrase(input);
  const all = [phrase.en, ...(phrase.alts || [])].map(normPhrase);
  if (all.includes(a)) return { ok: true };
  // similitud por palabras compartidas
  const set = new Set(a.split(" "));
  const target = new Set(normPhrase(phrase.en).split(" "));
  const overlap = [...set].filter((w) => target.has(w)).length;
  const close = overlap >= Math.max(2, Math.floor(target.size * 0.6));
  return { ok: false, close };
}


function ThinkInEnglish({ onPractice }) {
  const [progress, setProgress] = useState(() => loadJSON(PHRASE_KEY));
  const [filter, setFilter]     = useState("all");
  const pool = useMemo(() => filter === "all" ? PHRASES : PHRASES.filter((p) => p.level === filter), [filter]);
  const [phrase, setPhrase] = useState(() => pool[Math.floor(Math.random() * pool.length)]);
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => saveJSON(PHRASE_KEY, progress), [progress]);
  useEffect(() => { setPhrase(pool[Math.floor(Math.random() * pool.length)]); resetCard(); /* eslint-disable-next-line */ }, [filter]);

  function resetCard() { setAnswer(""); setShowHint(false); setFeedback(null); }
  function next() {
    let p = pool[Math.floor(Math.random() * pool.length)];
    let i = 0;
    while (p.id === phrase.id && pool.length > 1 && i++ < 5) p = pool[Math.floor(Math.random() * pool.length)];
    setPhrase(p); resetCard();
  }
  function check(e) {
    e.preventDefault();
    if (feedback) return next();
    if (!answer.trim()) return;
    const r = checkPhrase(answer, phrase);
    setFeedback(r);
    setProgress((prev) => {
      const cur = prev[phrase.id] || { attempts: 0, correct: 0 };
      return { ...prev, [phrase.id]: {
        attempts: cur.attempts + 1, correct: cur.correct + (r.ok ? 1 : 0), last: Date.now(),
      }};
    });
    if (r.ok) setTimeout(() => speak(phrase.en), 200);
    else      setTimeout(() => speak(phrase.en, 0.85), 250);
    onPractice && onPractice();
  }

  const totalAttempts = Object.values(progress).reduce((a,b) => a + (b.attempts||0), 0);
  const totalCorrect  = Object.values(progress).reduce((a,b) => a + (b.correct||0), 0);
  const acc = totalAttempts ? Math.round((totalCorrect/totalAttempts)*100) : 0;

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-2">
          <Brain className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
          Think in English
        </h1>
        <div className="text-xs sm:text-sm font-semibold bg-amber-50 text-amber-700 px-3 py-2 rounded-xl">
          Eficacia: {acc}% · {totalAttempts} intentos
        </div>
      </div>
      <p className="text-slate-500 mb-5 text-sm sm:text-base">Traduce sin traducir palabra por palabra</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        <LevelTab id="all" label={`Todas (${PHRASES.length})`}                         active={filter} onChange={setFilter} />
        <LevelTab id="A1"  label={`A1 (${PHRASES.filter(p=>p.level==="A1").length})`}  active={filter} onChange={setFilter} />
        <LevelTab id="A2"  label={`A2 (${PHRASES.filter(p=>p.level==="A2").length})`}  active={filter} onChange={setFilter} />
        <LevelTab id="B1"  label={`B1 (${PHRASES.filter(p=>p.level==="B1").length})`}  active={filter} onChange={setFilter} />
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 grid place-items-center shrink-0">
            <Zap className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-sm text-slate-700">
            <div className="font-bold mb-0.5">Think, don't translate!</div>
            Lee la frase en español y exprésala en inglés <b>de forma natural</b>. No traduzcas palabra por palabra.
          </div>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-4 relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Frase en español</div>
            <div className="text-[10px] mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">
              {phrase.level}
            </div>
          </div>
          <button onClick={next} title="Otra frase"
            className="w-9 h-9 grid place-items-center rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:text-amber-600 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold leading-snug mb-3">{phrase.es}</div>

        {phrase.hint && (
          <button onClick={() => setShowHint((s) => !s)}
            className="text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300">
            <Lightbulb className="w-4 h-4" /> {showHint ? "Ocultar pista" : "Ver pista"}
          </button>
        )}
        {showHint && phrase.hint && (
          <div className="mt-2 text-xs sm:text-sm text-amber-800 bg-amber-100/60 rounded-xl p-3">{phrase.hint}</div>
        )}
      </div>

      <form onSubmit={check} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-4">
        <label className="text-sm font-bold text-slate-700 mb-2 block">Tu traducción al inglés:</label>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!feedback}
          autoFocus rows={3} placeholder="Type in English..."
          className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-4 transition resize-none
            ${!feedback ? "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
              : feedback.ok ? "border-emerald-300 bg-emerald-50/30" : "border-rose-300 bg-rose-50/30"}`} />
        <button type="submit"
          className={`mt-4 w-full py-3.5 rounded-xl font-bold text-white shadow-soft transition
            ${feedback ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"}`}>
          {feedback ? "Siguiente frase →" : "Comprobar"}
        </button>
      </form>

      {feedback && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl grid place-items-center text-white
              ${feedback.ok ? "bg-emerald-500" : "bg-rose-500"}`}>
              {feedback.ok ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </div>
            <div className="font-bold text-lg">
              {feedback.ok ? "¡Excelente!" : feedback.close ? "Buen intento" : "Inténtalo de nuevo"}
            </div>
          </div>

          {!feedback.ok && (
            <div className="bg-slate-50 rounded-xl p-3 mb-3 text-sm text-slate-700">
              {feedback.close
                ? "Estás cerca, pero la forma más natural en inglés americano es:"
                : "Esta es la forma más natural de decirlo:"}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
            <div className="text-xs text-amber-700 font-semibold mb-1">Forma sugerida:</div>
            <div className="flex items-center gap-2">
              <div className="font-extrabold text-base sm:text-lg">{phrase.en}</div>
              <SpeakBtn text={phrase.en} />
            </div>
          </div>

          {phrase.alts && phrase.alts.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-2">Otras formas válidas:</div>
              <div className="space-y-2">
                {phrase.alts.map((a, i) => (
                  <div key={i} className="bg-brand-50/60 rounded-xl p-3 flex items-center gap-2 text-sm">
                    <span className="flex-1">{a}</span>
                    <SpeakBtn text={a} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- PROGRESS ---------- */
function ProgressView({ progress, stats }) {
  const [filter, setFilter] = useState("all"); // all | pending | practicing | mastered | failed
  const [sort,   setSort]   = useState("attempts"); // attempts | failed | accuracyAsc | recent

  const enriched = ALL_VERBS.map((v) => {
    const p = progress[v.id] || { attempts: 0, correct: 0, streak: 0, last: 0 };
    const acc = p.attempts ? Math.round((p.correct / p.attempts) * 100) : 0;
    const fails = (p.attempts || 0) - (p.correct || 0);
    const status = (p.streak || 0) >= 3 ? "mastered" : p.attempts ? "practicing" : "pending";
    const isFailed = p.attempts > 0 && acc < 60; // < 60% = "fallado"
    return { ...v, ...p, acc, fails, status, isFailed };
  });

  const counts = {
    all: enriched.length,
    pending: enriched.filter(r => r.status === "pending").length,
    practicing: enriched.filter(r => r.status === "practicing").length,
    mastered: enriched.filter(r => r.status === "mastered").length,
    failed: enriched.filter(r => r.isFailed).length,
  };

  let rows = enriched;
  if (filter === "pending")    rows = rows.filter(r => r.status === "pending");
  if (filter === "practicing") rows = rows.filter(r => r.status === "practicing");
  if (filter === "mastered")   rows = rows.filter(r => r.status === "mastered");
  if (filter === "failed")     rows = rows.filter(r => r.isFailed);

  rows = [...rows].sort((a, b) => {
    if (sort === "attempts")    return b.attempts - a.attempts;
    if (sort === "failed")      return b.fails - a.fails;
    if (sort === "accuracyAsc") return (a.attempts ? a.acc : 999) - (b.attempts ? b.acc : 999);
    if (sort === "recent")      return (b.last || 0) - (a.last || 0);
    return 0;
  });

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">Mi progreso</h1>
      <p className="text-slate-500 mb-5 text-sm">
        Llevas <b>{stats.mastered}</b> dominados, <b>{counts.failed}</b> fallados y <b>{stats.remaining}</b> por aprender.
      </p>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <StatCard color="violet" icon={Star}   value={`${stats.pctMastered}%`} label="Completado" />
        <StatCard color="blue"   icon={Trophy} value={`${stats.accuracy}%`}    label="Eficacia" />
        <StatCard color="rose"   icon={Target} value={stats.attempts}          label="Intentos" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2 -mx-1 px-1">
        <FilterTab id="all"        label="Todos"       active={filter} onChange={setFilter} count={counts.all} />
        <FilterTab id="pending"    label="Pendientes"  active={filter} onChange={setFilter} count={counts.pending} />
        <FilterTab id="practicing" label="Practicando" active={filter} onChange={setFilter} count={counts.practicing} color="amber" />
        <FilterTab id="mastered"   label="Dominados"   active={filter} onChange={setFilter} count={counts.mastered}   color="emerald" />
        <FilterTab id="failed"     label="Fallados"    active={filter} onChange={setFilter} count={counts.failed}     color="rose" />
      </div>

      {/* Orden */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold">Ordenar:</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="text-xs sm:text-sm font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-400">
          <option value="attempts">Más practicados</option>
          <option value="failed">Más fallos</option>
          <option value="accuracyAsc">Menor eficacia</option>
          <option value="recent">Más recientes</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="hidden sm:grid grid-cols-12 px-5 py-3 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
          <div className="col-span-3">Verbo</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-1">Int.</div>
          <div className="col-span-1">OK</div>
          <div className="col-span-1">Fallos</div>
          <div className="col-span-2">Eficacia</div>
          <div className="col-span-2">Estado</div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
          {rows.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              {filter === "failed"
                ? "¡Genial! No tienes verbos fallados todavía."
                : "Sin resultados en este filtro."}
            </div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="px-4 sm:px-5 py-3 text-sm sm:grid sm:grid-cols-12 flex flex-wrap items-center gap-2">
              <div className="sm:col-span-3 font-semibold flex items-center gap-2 w-full sm:w-auto">
                {r.base} <SpeakBtn text={r.base} />
                {r.isFailed && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    fallado
                  </span>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.type==="regular" ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"}`}>
                  {r.type}
                </span>
              </div>
              <div className="sm:col-span-1 text-xs sm:text-sm"><span className="sm:hidden text-slate-400">Int: </span>{r.attempts}</div>
              <div className="sm:col-span-1 text-xs sm:text-sm"><span className="sm:hidden text-slate-400">OK: </span>{r.correct}</div>
              <div className="sm:col-span-1 text-xs sm:text-sm">
                <span className="sm:hidden text-slate-400">Fall: </span>
                <span className={r.fails > 0 ? "text-rose-600 font-semibold" : ""}>{r.fails}</span>
              </div>
              <div className="sm:col-span-2 text-xs sm:text-sm">
                <span className={r.attempts && r.acc < 60 ? "text-rose-600 font-semibold" : ""}>{r.acc}%</span>
              </div>
              <div className="sm:col-span-2"><StatusBadge status={statusEs(r.status)} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function statusEs(s) {
  return s === "mastered" ? "dominado" : s === "practicing" ? "practicando" : "pendiente";
}

function StatusBadge({ status }) {
  const map = { dominado:"bg-emerald-50 text-emerald-700", practicando:"bg-amber-50 text-amber-700", pendiente:"bg-slate-100 text-slate-500" };
  const label = { dominado:"Dominado", practicando:"Practicando", pendiente:"Pendiente" };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${map[status]}`}>{label[status]}</span>;
}

function FilterTab({ id, label, active, onChange, count, color = "slate" }) {
  const isActive = active === id;
  const palette = {
    slate:   isActive ? "bg-brand-500 text-white shadow-soft"   : "bg-white text-slate-600 border border-slate-200",
    rose:    isActive ? "bg-rose-500 text-white shadow-soft"    : "bg-white text-rose-600 border border-rose-200",
    emerald: isActive ? "bg-emerald-500 text-white shadow-soft" : "bg-white text-emerald-700 border border-emerald-200",
    amber:   isActive ? "bg-amber-500 text-white shadow-soft"   : "bg-white text-amber-700 border border-amber-200",
  };
  return (
    <button
      onClick={() => onChange(id)}
      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shrink-0 ${palette[color]}`}
    >
      {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
        {count}
      </span>
    </button>
  );
}

function StudyTab({ id, label, count, active, onChange }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onChange(id)}
      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2
        ${isActive ? "bg-brand-500 text-white shadow-soft" : "bg-white text-slate-600 border border-slate-200"}`}
    >
      {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/25" : "bg-slate-100"}`}>
        {count}
      </span>
    </button>
  );
}

function LevelTab({ id, label, active, onChange }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onChange(id)}
      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition
        ${isActive ? "bg-amber-500 text-white shadow-soft" : "bg-white text-slate-600 border border-slate-200"}`}
    >
      {label}
    </button>
  );
}