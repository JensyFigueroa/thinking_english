import { useState, useEffect, useRef, useMemo } from "react";
import {
  Mic, Play, Volume2, Trophy, Clock, RefreshCw, Zap, Target, Sparkles,
} from "lucide-react";
import { PHRASES } from "./phrases";

const SPEAKING_KEY = "speaking-attempts-v1";

const isIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.MSStream;

const isSecure =
  typeof window !== "undefined" &&
  (window.location.protocol === "https:" || window.location.hostname === "localhost");

/* ===== Sistema de maestría de frases ===== */
export const MASTERY_THRESHOLD = 80;      // % requerido
export const MASTERY_MIN_GOODS = 2;       // intentos ≥80% para dominarla

export function computeSpeakingMastery(attempts) {
  const byId = {};
  attempts.forEach((a) => {
    if (!byId[a.phraseId]) byId[a.phraseId] = {
      attempts: 0, best: 0, goodCount: 0, totalAcc: 0, totalLat: 0, lastDate: 0,
    };
    const b = byId[a.phraseId];
    b.attempts++;
    b.totalAcc += a.accuracy;
    b.totalLat += a.latency;
    if (a.accuracy >= MASTERY_THRESHOLD) b.goodCount++;
    if (a.accuracy > b.best) b.best = a.accuracy;
    const t = new Date(a.date).getTime();
    if (t > b.lastDate) b.lastDate = t;
  });
  return byId;
}

export function getPhraseStatus(m) {
  if (!m) return "pending";
  if (m.goodCount >= MASTERY_MIN_GOODS) return "mastered";
  return "practicing";
}

const loadAttempts = () => {
  try { return JSON.parse(localStorage.getItem(SPEAKING_KEY)) || []; }
  catch { return []; }
};
const saveAttempts = (a) =>
  localStorage.setItem(SPEAKING_KEY, JSON.stringify(a.slice(-200))); // últimos 200

/* ===== Normalización (incluye apóstrofos iPhone) ===== */
const normCmp = (s) => s.toLowerCase()
  .replace(/[¿?¡!.,;:"]/g, "")
  .replace(/[\u0027\u0060\u00B4\u2018\u2019\u02BC\uFF07]/g, "")
  .replace(/\s+/g, " ")
  .trim();

/* ===== TTS con velocidad ===== */
function speakAt(text, rate = 1) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; u.rate = rate; u.pitch = 1;
  window.speechSynthesis.speak(u);
}

/* ===== Diff palabra a palabra (para resaltar en negrita/subrayado) ===== */
function diffWords(target, transcript) {
  const said = new Set(normCmp(transcript).split(" ").filter(Boolean));
  // Mantenemos espacios y puntuación para mostrar la frase original
  return target.split(/(\s+)/).map((token, i) => {
    if (/^\s+$/.test(token)) return { id: i, token, ok: true, isSpace: true };
    const norm = normCmp(token);
    return { id: i, token, ok: norm === "" || said.has(norm), isSpace: false };
  });
}

/* ===== Cálculo de precisión =====
   - 70% coincidencia de palabras del target
   - 30% confidence del Web Speech API
   - Penaliza palabras extra
*/
function computeAccuracy(transcript, target, confidence = 0.5) {
  const tWords = normCmp(target).split(" ").filter(Boolean);
  const rWords = normCmp(transcript).split(" ").filter(Boolean);
  if (!tWords.length) return 0;
  const said = new Set(rWords);
  const matched = tWords.filter((w) => said.has(w)).length;
  const wordScore = matched / tWords.length;
  const extraPenalty = Math.max(0, (rWords.length - tWords.length) * 0.04);
  const adjusted = Math.max(0, wordScore - extraPenalty);
  const final = adjusted * 0.7 + confidence * 0.3;
  return Math.min(100, Math.round(final * 100));
}

function getMotivation(acc) {
  if (acc >= 90) return { text: "¡Excelente pronunciación! 🌟", color: "emerald" };
  if (acc >= 75) return { text: "¡Muy bien! Vas por buen camino 💪", color: "emerald" };
  if (acc >= 50) return { text: "Buen intento, sigue practicando 👍", color: "amber" };
  if (acc >= 25) return { text: "Inténtalo otra vez, tú puedes 🎯", color: "amber" };
  return { text: "No te rindas. Escucha y repite 🔄", color: "rose" };
}

export default function SpeakingPractice({ onPractice }) {
  const [filter, setFilter] = useState("all");

  const [phrase, setPhrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  const [phraseShownAt, setPhraseShownAt] = useState(() => Date.now());
  const [rate, setRate] = useState(1);

  const [recording, setRecording] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [attempts, setAttempts]   = useState(loadAttempts);
  const [drillMode, setDrillMode] = useState(false);
  const [justMastered, setJustMastered] = useState(null);

  const mastery = useMemo(() => computeSpeakingMastery(attempts), [attempts]);

  const pool = useMemo(() => {
    let p = filter === "all" ? PHRASES : PHRASES.filter((x) => x.level === filter);
    if (drillMode) {
      p = p.filter((x) => {
        const m = mastery[x.id];
        return !m || m.best < MASTERY_THRESHOLD;
      });
    }
    return p.length ? p : (filter === "all" ? PHRASES : PHRASES.filter((x) => x.level === filter));
  }, [filter, drillMode, mastery, attempts.length]);

  const recognitionRef    = useRef(null);
  const recordStartRef    = useRef(0);
  const speechStartRef    = useRef(0);
  const lastTranscriptRef = useRef("");
  const lastConfidenceRef = useRef(0.6);
  const finishedRef       = useRef(false);
  const phraseRef         = useRef(phrase);
  const shownAtRef        = useRef(phraseShownAt);

  useEffect(() => { phraseRef.current  = phrase;        }, [phrase]);
  useEffect(() => { shownAtRef.current = phraseShownAt; }, [phraseShownAt]);
  useEffect(() => saveAttempts(attempts), [attempts]);

  useEffect(() => { next(); /* eslint-disable-next-line */ }, [filter]);

  /* === Setup Web Speech API una sola vez === */
   useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError(
        isIOS
          ? "Tu iPhone no soporta esta función. Abre en Chrome desktop o usa la versión web en HTTPS."
          : "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge."
      );
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;        // 🔑 clave para iOS: capturamos lo intermedio
    rec.maxAlternatives = 1;

    rec.onspeechstart = () => { speechStartRef.current = Date.now(); };

    rec.onresult = (event) => {
      // Recorremos todos los results para quedarnos con el último texto disponible
      let txt = "";
      let conf = 0.6;
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i][0];
        txt = r.transcript;
        if (typeof r.confidence === "number" && r.confidence > 0) conf = r.confidence;
        if (event.results[i].isFinal) isFinal = true;
      }
      lastTranscriptRef.current = txt;
      lastConfidenceRef.current = conf;
      // Si llega resultado FINAL, evaluamos enseguida
      if (isFinal && !finishedRef.current) {
        finishedRef.current = true;
        finishAttempt(txt, conf);
      }
    };

    rec.onerror = (e) => {
      const msg =
        e.error === "no-speech"   ? "No se detectó voz. Intenta otra vez."
      : e.error === "not-allowed" ? "Permite el acceso al micrófono en Ajustes."
      : e.error === "network"     ? "Error de red. Verifica tu conexión."
      : `Error: ${e.error}`;
      setError(msg);
      setRecording(false);
    };

    rec.onend = () => {
      setRecording(false);
      // 🔑 fallback iOS: si onresult final NO disparó, usamos el último interim
      if (!finishedRef.current && lastTranscriptRef.current) {
        finishedRef.current = true;
        finishAttempt(lastTranscriptRef.current, lastConfidenceRef.current);
      }
    };

    recognitionRef.current = rec;
    return () => { try { rec.abort(); } catch {} };
  }, []);

  function finishAttempt(transcript, confidence) {
    const target = phraseRef.current;
    const accuracy = computeAccuracy(transcript, target.en, confidence);
    const speechStart = speechStartRef.current || recordStartRef.current;
    const latency = Math.max(0, Math.round((speechStart - shownAtRef.current) / 100) / 10);
    const motivation = getMotivation(accuracy);

    setResult({ accuracy, transcript, confidence, latency, motivation });

    const newAttempt = {
      id: Date.now(),
      phraseId: target.id,
      en: target.en, es: target.es, level: target.level,
      accuracy, latency, transcript,
      date: new Date().toISOString(),
    };

    setAttempts((prev) => {
      const next = [...prev, newAttempt];
      // ¿Acaba de dominarla?
      const prevGoods = prev.filter((a) => a.phraseId === target.id && a.accuracy >= MASTERY_THRESHOLD).length;
      const wasMastered = prevGoods >= MASTERY_MIN_GOODS;
      const isNowMastered = (prevGoods + (accuracy >= MASTERY_THRESHOLD ? 1 : 0)) >= MASTERY_MIN_GOODS;
      if (!wasMastered && isNowMastered) {
        setJustMastered({ en: target.en, es: target.es });
        setTimeout(() => setJustMastered(null), 4500);
      }
      return next;
    });

    onPractice && onPractice();
  }

  function next() {
    let p = pool[Math.floor(Math.random() * pool.length)];
    let i = 0;
    while (p.id === phrase.id && pool.length > 1 && i++ < 5)
      p = pool[Math.floor(Math.random() * pool.length)];
    setPhrase(p);
    setPhraseShownAt(Date.now());
    speechStartRef.current = 0;
    setResult(null); setError(null);
  }

  function startRecording() {
    if (!recognitionRef.current || recording) return;
    setError(null); setResult(null);
    speechStartRef.current = 0;
    recordStartRef.current = Date.now();
    lastTranscriptRef.current = "";
    lastConfidenceRef.current = 0.6;
    finishedRef.current = false;
    try {
      recognitionRef.current.start();
      setRecording(true);
    } catch (e) {
      // En iOS a veces falla si ya estaba activo
      try { recognitionRef.current.abort(); } catch {}
      setTimeout(() => {
        try { recognitionRef.current.start(); setRecording(true); } catch {
          setError("No se pudo iniciar la grabación.");
        }
      }, 150);
    }
  }
  function stopRecording() {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch {}
  }
  function toggleRecording() {
    if (recording) stopRecording();
    else startRecording();
  }

  /* === KPIs agregados === */
  const totals = useMemo(() => {
    if (!attempts.length) return { avg: 0, count: 0, avgLat: 0, best: 0 };
    const avg = Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length);
    const avgLat = Math.round(attempts.reduce((s, a) => s + a.latency, 0) / attempts.length * 10) / 10;
    const best = attempts.reduce((m, a) => Math.max(m, a.accuracy), 0);
    return { avg, count: attempts.length, avgLat, best };
  }, [attempts]);

  return (
    <div className="max-w-2xl">
      {/* HEADER */}
      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-2">
          <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500" />
          Speaking Practice
        </h1>
        <div className="text-xs sm:text-sm font-semibold bg-rose-50 text-rose-700 px-3 py-2 rounded-xl">
          {totals.avg}% promedio · {totals.count} intentos
        </div>
      </div>
      <p className="text-slate-500 mb-5 text-sm sm:text-base">
        Cierra el <b>Thinking Gap</b>: escucha, piensa en inglés y dilo en voz alta.
      </p>

      {justMastered && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-soft flex items-center gap-3 animate-pulse">
          <Trophy className="w-7 h-7 shrink-0" />
          <div>
            <div className="font-extrabold text-base sm:text-lg">¡Frase dominada! 🎉</div>
            <div className="text-xs sm:text-sm opacity-90">"{justMastered.en}" — ¡a por la siguiente!</div>
          </div>
        </div>
      )}

      {!isSecure && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <b>⚠️ Necesitas HTTPS</b> para usar el micrófono en este dispositivo.
          {isIOS && <> En iPhone Safari requiere conexión segura (https://). Mira las instrucciones más abajo.</>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <KPI icon={Trophy} value={`${totals.avg}%`} label="Precisión prom." color="emerald" />
        <KPI icon={Clock}  value={`${totals.avgLat}s`} label="Latencia prom." color="amber" />
        <KPI icon={Target} value={`${totals.best}%`} label="Mejor intento"  color="rose" />
      </div>

      {/* FILTRO POR NIVEL + DRILL */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <button
          onClick={() => setDrillMode((d) => !d)}
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-soft
            ${drillMode
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              : "bg-white text-amber-700 border border-amber-200 hover:border-amber-400"}`}>
          <Sparkles className="w-4 h-4" />
          {drillMode ? "Drill ON · solo débiles" : "Smart Drill"}
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        {[
          { id: "all", label: "Todas" },
          { id: "A1", label: "A1" }, { id: "A2", label: "A2" }, { id: "B1", label: "B1" }, { id: "B2", label: "B2" }
        ].map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition
              ${filter === t.id ? "bg-rose-500 text-white shadow-soft" : "bg-white text-slate-600 border border-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CARD: FRASE OBJETIVO */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm mb-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
          Frase objetivo
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
            {phrase.level}
          </span>
        </div>

        {/* Frase con resaltado de errores tras intento */}
        <div className="text-2xl sm:text-3xl font-extrabold leading-snug mb-2">
          {result
            ? diffWords(phrase.en, result.transcript).map((d) =>
                d.ok
                  ? <span key={d.id}>{d.token}</span>
                  : <span key={d.id} className="font-extrabold underline decoration-rose-500 decoration-[3px] underline-offset-4 text-rose-600">{d.token}</span>
              )
            : phrase.en}
        </div>

        <div className="text-slate-500 italic mb-4 text-sm sm:text-base">{phrase.es}</div>

        {/* Audio + velocidad */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => speakAt(phrase.en, rate)}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold flex items-center gap-2 shadow-soft">
            <Play className="w-4 h-4" /> Escuchar
          </button>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {[0.5, 0.75, 1].map((r) => (
              <button key={r} onClick={() => setRate(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition
                  ${rate === r ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
                {r}x
              </button>
            ))}
          </div>
          <button onClick={next}
            className="ml-auto px-3 py-2 rounded-xl border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 font-semibold flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-4 h-4" /> Otra
          </button>
        </div>
      </div>

      {/* RECORD BUTTON */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm mb-4">
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-700 mb-1">Mantén presionado para hablar</div>
          <div className="text-xs text-slate-400 mb-5">Say it like a native</div>

          <button
            {...(isIOS
              ? { onClick: toggleRecording }
              : {
                  onMouseDown: startRecording,
                  onMouseUp:   stopRecording,
                  onMouseLeave: stopRecording,
                  onTouchStart: (e) => { e.preventDefault(); startRecording(); },
                  onTouchEnd:   (e) => { e.preventDefault(); stopRecording(); },
                })}
            disabled={!!error && error.startsWith("Tu navegador") || !isSecure}
            className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full grid place-items-center text-white transition shadow-soft select-none touch-manipulation
              ${recording
                ? "bg-rose-500 scale-110 ring-8 ring-rose-200 animate-pulse"
                : "bg-rose-500 hover:bg-rose-600 hover:scale-105 active:scale-95"}`}>
            <Mic className="w-10 h-10 sm:w-12 sm:h-12" />
          </button>

          <div className="mt-4 text-xs sm:text-sm font-semibold text-slate-600">
            {recording
              ? (isIOS ? "🔴 Grabando… toca para detener" : "🔴 Grabando…")
              : (isIOS ? "Toca el micrófono y habla" : "Toca y mantén presionado")}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm font-medium text-center">
            {error}
          </div>
        )}
      </div>

      {/* RESULT */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl grid place-items-center font-extrabold text-2xl sm:text-3xl shrink-0
              ${result.accuracy >= 75 ? "bg-emerald-100 text-emerald-700"
                : result.accuracy >= 50 ? "bg-amber-100 text-amber-700"
                : "bg-rose-100 text-rose-700"}`}>
              {result.accuracy}%
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base sm:text-xl leading-tight">{result.motivation.text}</div>
              <div className="text-xs sm:text-sm text-slate-500 mt-1.5 flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {result.latency}s latencia</span>
                <span className="text-slate-300">·</span>
                <span>Confianza: {Math.round(result.confidence * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 mb-3">
            <div className="text-xs text-slate-500 font-semibold mb-1">Lo que escuché:</div>
            <div className="text-sm text-slate-800 italic">"{result.transcript}"</div>
          </div>

          {result.accuracy < 100 && (
            <div className="text-xs text-slate-500 mb-3">
              💡 Las palabras <u className="decoration-rose-500 decoration-2">subrayadas</u> son las que necesitas mejorar.
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => speakAt(phrase.en, 0.5)}
              className="flex-1 py-2.5 rounded-xl bg-brand-50 text-brand-700 font-semibold hover:bg-brand-100 flex items-center justify-center gap-2 text-sm">
              <Volume2 className="w-4 h-4" /> Lento (0.5x)
            </button>
            <button onClick={next}
              className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold flex items-center justify-center gap-2 text-sm shadow-soft">
              <Zap className="w-4 h-4" /> Siguiente
            </button>
          </div>
        </div>
      )}

      {/* HISTORIAL */}
      {attempts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Últimos intentos
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {[...attempts].reverse().slice(0, 12).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className={`w-12 h-12 rounded-xl grid place-items-center font-extrabold text-xs shrink-0
                  ${a.accuracy >= 75 ? "bg-emerald-100 text-emerald-700"
                    : a.accuracy >= 50 ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"}`}>
                  {a.accuracy}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.en}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-600">{a.level}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.latency}s</span>
                    <span>·</span>
                    <span>{new Date(a.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, value, label, color }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber:   "bg-amber-50 text-amber-700",
    rose:    "bg-rose-50 text-rose-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl grid place-items-center mb-2 ${map[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-lg sm:text-xl font-extrabold">{value}</div>
      <div className="text-[10px] sm:text-xs text-slate-500">{label}</div>
    </div>
  );
}