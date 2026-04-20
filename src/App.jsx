import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

// ─── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyARd7p4ThymwJaNvDrdCZKAGY089sPo-WA",
  authDomain: "shuffletube-62373.firebaseapp.com",
  projectId: "shuffletube-62373",
  storageBucket: "shuffletube-62373.firebasestorage.app",
  messagingSenderId: "477498530185",
  appId: "1:477498530185:web:c6fac9e7417aa1c6cc2958",
  measurementId: "G-KC4Y5KFJF9"
};
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const USER_DOC = "users/pablo";

async function saveAll(data) {
  try {
    await setDoc(doc(db, USER_DOC), data, { merge: true });
  } catch {}
}

const FEED_MAX = 50;
const uid = ()      => Date.now().toString(36) + Math.random().toString(36).slice(2);
const rnd = (a)     => a[Math.floor(Math.random() * a.length)];
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Pick helpers ─────────────────────────────────────────────
function pickUnseenNum(map, key, max) {
  const seen = new Set(map[key] || []);
  let avail = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) avail.push(i);
  if (!avail.length) { map[key] = []; for (let i = 1; i <= max; i++) avail.push(i); }
  const p = rnd(avail);
  if (!map[key]) map[key] = [];
  map[key].push(p);
  return p;
}

function pickUnseenFeed(arr) {
  const seen = new Set(arr);
  let avail = [];
  for (let i = 1; i <= FEED_MAX; i++) if (!seen.has(i)) avail.push(i);
  if (!avail.length) { arr.length = 0; for (let i = 1; i <= FEED_MAX; i++) avail.push(i); }
  const p = rnd(avail);
  arr.push(p);
  return p;
}

function pickUnseenId(pool, seenIds) {
  let avail = pool.filter(x => !seenIds.includes(x.id));
  if (!avail.length) { seenIds.length = 0; avail = [...pool]; }
  const p = rnd(avail);
  seenIds.push(p.id);
  return p;
}

// ─── Generators ───────────────────────────────────────────────
function genVideo(channels, savedVideos, seenCh, seenFeed, seenVids, excludeId) {
  const pool = [];
  channels.filter(c => c.id !== excludeId).forEach(c => pool.push({ kind: "channel", data: c }));
  pool.push({ kind: "feed" });
  const unseenSaved = savedVideos.filter(v => !seenVids.includes(v.id) && v.id !== excludeId);
  if (unseenSaved.length) pool.push({ kind: "savedVideo" });

  const pick = rnd(pool);
  if (pick.kind === "feed") return { type: "feed", slot: pickUnseenFeed(seenFeed) };
  if (pick.kind === "channel") {
    const ch = pick.data;
    return { type: "channel", channel: ch.name, channelId: ch.id, video: pickUnseenNum(seenCh, ch.id, ch.count) };
  }
  const v = pickUnseenId(unseenSaved, seenVids);
  return { type: "savedVideo", title: v.title, source: v.source, videoId: v.id };
}

function genContent(sources, items, podcasts, movies, seenItems, seenInbox, seenMovies, excludeId) {
  const pool = [];
  podcasts.filter(p => p.id !== excludeId).forEach(p => pool.push({ kind: "podcast", data: p }));
  sources.filter(s => s.type === "topic" && s.id !== excludeId).forEach(s => pool.push({ kind: "topic", data: s }));
  sources.filter(s => s.type === "inbox" && s.count > 0 && s.id !== excludeId).forEach(s => pool.push({ kind: "inbox", data: s }));
  const articlePool = items.filter(it => {
    const src = sources.find(s => s.id === it.sourceId);
    return src?.type === "articles" && !seenItems.includes(it.id) && it.id !== excludeId;
  });
  if (articlePool.length) pool.push({ kind: "article" });
  // Movies (no repeat)
  const moviePool = movies ? movies.filter(m => !seenMovies.includes(m.id) && m.id !== excludeId) : [];
  if (moviePool.length) pool.push({ kind: "movie" });
  if (!pool.length) return null;

  const pick = rnd(pool);
  if (pick.kind === "podcast") return { type: "podcast", name: pick.data.name, podcastId: pick.data.id };
  if (pick.kind === "topic")   return { type: "topic",   name: pick.data.name, searchIn: pick.data.searchIn, sourceId: pick.data.id };
  if (pick.kind === "inbox") {
    const num = pickUnseenNum(seenInbox, pick.data.id, pick.data.count);
    return { type: "inbox", sourceName: pick.data.name, sourceId: pick.data.id, num };
  }
  if (pick.kind === "movie") {
    const m = pickUnseenId(moviePool, seenMovies);
    return { type: "movie", title: m.title, movieId: m.id };
  }
  const it = pickUnseenId(articlePool, seenItems);
  const src = sources.find(s => s.id === it.sourceId);
  return { type: "article", title: it.title, searchIn: it.searchIn, sourceName: src?.name || "?", itemId: it.id };
}

// ─── Design ───────────────────────────────────────────────────
const C = {
  bg:      "linear-gradient(160deg,#fdf3e7 0%,#f5e6ce 60%,#eedad0 100%)",
  card:    "#fffaf4",
  border:  "#ede0ce",
  brown:   "#5a3e28",
  mid:     "#b09070",
  light:   "#d4c0a8",
  orange:  "#c8845a",
  oG:      "linear-gradient(135deg,#d4895e,#c8705a)",
  green:   "#7aaa8a",
  gG:      "linear-gradient(90deg,#8aba9a,#7aaa8a)",
  blue:    "#7a9aaa",
  purple:  "#9a7aaa",
  pG:      "linear-gradient(90deg,#ac8aba,#9a7aaa)",
};
const card  = { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14, boxShadow: "0 2px 10px rgba(160,100,40,0.07)" };
const lbl   = { color: C.mid, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" };
const iStyle = { width: "100%", padding: "10px 14px", background: "#fff8f0", border: "1.5px solid #e0ccb5", borderRadius: 10, color: C.brown, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box", outline: "none" };

// ─── Shared components ────────────────────────────────────────
function Bar({ value, max, color = C.oG }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s" }} />
      </div>
      <span style={{ color: C.mid, fontSize: 10, whiteSpace: "nowrap" }}>{value}/{max}</span>
    </div>
  );
}

function SecHdr({ title, onAdd }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={lbl}>{title}</span>
      {onAdd && <button onClick={onAdd} style={{ background: "#fff3e6", border: "1.5px solid #e8d0b0", borderRadius: 8, color: C.orange, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>+ Añadir</button>}
    </div>
  );
}

function Empty({ text }) { return <div style={{ color: C.light, fontSize: 13, padding: "8px 0 18px" }}>{text}</div>; }

function RowAct({ onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 6, marginLeft: 10, flexShrink: 0 }}>
      <button onClick={onEdit}   style={{ background: "transparent", border: "1px solid #e0ccb5", borderRadius: 6, color: C.mid,    fontSize: 11, padding: "3px 9px" }}>editar</button>
      <button onClick={onDelete} style={{ background: "transparent", border: "1px solid #f0d8c8", borderRadius: 6, color: "#d4a090", fontSize: 11, padding: "3px 9px" }}>✕</button>
    </div>
  );
}

function Tag({ text, color, bg }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 20 }}>{text}</span>;
}

// ─── Modal shell ──────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(80,50,20,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "0 16px" }}>
      <div style={{ background: "#fdf6ee", border: "1.5px solid #e8d9c4", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(140,80,30,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
function MTitle({ t }) { return <h3 style={{ margin: "0 0 20px", color: C.brown, fontFamily: "'Playfair Display',serif", fontSize: 20 }}>{t}</h3>; }
function MField({ label: l, children }) { return <div style={{ marginBottom: 14 }}><label style={{ display: "block", marginBottom: 5, ...lbl }}>{l}</label>{children}</div>; }
function MBtns({ onClose, onSave }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
      <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "transparent", border: "1.5px solid #e0ccb5", borderRadius: 10, color: C.mid, fontFamily: "inherit", fontSize: 13 }}>Cancelar</button>
      <button onClick={onSave}  style={{ flex: 1, padding: "10px", background: C.oG, border: "none", borderRadius: 10, color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>Guardar</button>
    </div>
  );
}
function TBtn({ label: l, active, onClick }) {
  return <button onClick={onClick} style={{ flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 11, fontFamily: "inherit", background: active ? C.oG : "#fff8f0", border: active ? "none" : "1.5px solid #e0ccb5", color: active ? "#fff" : C.mid, fontWeight: active ? 700 : 400 }}>{l}</button>;
}

// ─── Modals ───────────────────────────────────────────────────
function ChannelModal({ ch, onSave, onClose }) {
  const [name, setName]   = useState(ch?.name || "");
  const [count, setCount] = useState(ch?.count || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t={ch ? "Editar canal" : "Nuevo canal"} />
      <MField label="Nombre"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Kurzgesagt" style={iStyle} /></MField>
      <MField label="Número de videos"><input type="number" value={count} onChange={e => setCount(e.target.value)} placeholder="Ej: 180" min={1} style={iStyle} /></MField>
      <MBtns onClose={onClose} onSave={() => { if (!name.trim() || !count || +count < 1) return; onSave({ id: ch?.id || uid(), name: name.trim(), count: parseInt(count) }); }} />
    </Modal>
  );
}

function SavedVideoModal({ vid, onSave, onClose }) {
  const [title, setTitle]   = useState(vid?.title || "");
  const [source, setSource] = useState(vid?.source || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t={vid ? "Editar video guardado" : "Nuevo video guardado"} />
      <MField label="Título del video"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: How F1 cars generate downforce" style={iStyle} /></MField>
      <MField label="Canal o fuente"><input value={source} onChange={e => setSource(e.target.value)} placeholder="Ej: Engineering Explained" style={iStyle} /></MField>
      <MBtns onClose={onClose} onSave={() => { if (!title.trim()) return; onSave({ id: vid?.id || uid(), title: title.trim(), source: source.trim() }); }} />
    </Modal>
  );
}

function PodcastModal({ pod, onSave, onClose }) {
  const [name, setName] = useState(pod?.name || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t={pod ? "Editar podcast" : "Nuevo podcast"} />
      <MField label="Nombre del podcast"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Lex Fridman Podcast" style={iStyle} /></MField>
      <p style={{ color: C.mid, fontSize: 12, margin: "0 0 4px" }}>Cuando te salga, tú eliges el episodio. Puede repetir.</p>
      <MBtns onClose={onClose} onSave={() => { if (!name.trim()) return; onSave({ id: pod?.id || uid(), name: name.trim() }); }} />
    </Modal>
  );
}

function SourceModal({ src, onSave, onClose }) {
  const [name, setName]       = useState(src?.name || "");
  const [type, setType]       = useState(src?.type || "articles");
  const [count, setCount]     = useState(src?.count || "");
  const [searchIn, setSearchIn] = useState(src?.searchIn || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t={src ? "Editar fuente" : "Nueva fuente"} />
      <MField label="Nombre"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Substack de X, Astrofísica…" style={iStyle} /></MField>
      <MField label="Tipo">
        <div style={{ display: "flex", gap: 6 }}>
          <TBtn label="📝 Artículos" active={type === "articles"} onClick={() => setType("articles")} />
          <TBtn label="📬 Bandeja"   active={type === "inbox"}    onClick={() => setType("inbox")} />
          <TBtn label="🔭 Tema"      active={type === "topic"}    onClick={() => setType("topic")} />
        </div>
      </MField>
      {type === "inbox" && <MField label="Artículos / emails pendientes"><input type="number" value={count} onChange={e => setCount(e.target.value)} placeholder="Ej: 30" min={1} style={iStyle} /></MField>}
      {type === "topic" && <MField label="Buscar en (opcional)"><input value={searchIn} onChange={e => setSearchIn(e.target.value)} placeholder="Ej: YouTube, Google, libro…" style={iStyle} /></MField>}
      <MBtns onClose={onClose} onSave={() => {
        if (!name.trim()) return;
        if (type === "inbox" && (!count || +count < 1)) return;
        onSave({ id: src?.id || uid(), name: name.trim(), type, count: type === "inbox" ? parseInt(count) : undefined, searchIn: type === "topic" ? searchIn : undefined });
      }} />
    </Modal>
  );
}

function ItemModal({ item, sources, onSave, onClose }) {
  const artSrcs = sources.filter(s => s.type === "articles");
  const [title, setTitle]     = useState(item?.title || "");
  const [srcId, setSrcId]     = useState(item?.sourceId || artSrcs[0]?.id || "");
  const [searchIn, setSearchIn] = useState(item?.searchIn || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t={item ? "Editar artículo" : "Nuevo artículo"} />
      <MField label="Título o tema"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Cómo funciona el turbo" style={iStyle} /></MField>
      <MField label="Fuente">
        <select value={srcId} onChange={e => setSrcId(e.target.value)} style={{ ...iStyle, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%23b09070' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", appearance: "none" }}>
          {artSrcs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </MField>
      <MField label="Buscar en (opcional)"><input value={searchIn} onChange={e => setSearchIn(e.target.value)} placeholder="Ej: YouTube, Google, libro…" style={iStyle} /></MField>
      <MBtns onClose={onClose} onSave={() => { if (!title.trim() || !srcId) return; onSave({ id: item?.id || uid(), title: title.trim(), sourceId: srcId, searchIn }); }} />
    </Modal>
  );
}

function NoteModal({ label: l, initial, onSave, onClose }) {
  const [note, setNote] = useState(initial || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t="¿Qué tal? (opcional)" />
      <p style={{ color: C.mid, fontSize: 13, margin: "0 0 16px" }}>{l}</p>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Una frase de lo que aprendiste o te pareció…" style={{ ...iStyle, height: 90, resize: "vertical", lineHeight: 1.5 }} />
      <MBtns onClose={onClose} onSave={() => onSave(note.trim())} />
    </Modal>
  );
}

// ─── Today card ───────────────────────────────────────────────
function TodayCard({ item, accent, emoji, title: cardTitle, done, note, onDone, onPostpone, onNote }) {
  return (
    <div style={{ ...card, padding: "16px 18px", marginBottom: 12, borderLeft: `4px solid ${accent}` }}>
      <div style={{ ...lbl, marginBottom: 10 }}>{emoji} {cardTitle}</div>

      {item.type === "channel" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.channel}</div>
        <div style={{ color: C.mid, fontSize: 13 }}>Ve el video <strong style={{ color: accent }}>#{item.video}</strong> del canal</div>
      </>}
      {item.type === "feed" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Tu feed de YouTube</div>
        <div style={{ color: C.mid, fontSize: 13 }}>Posición <strong style={{ color: accent }}>#{item.slot}</strong> en tu página de inicio</div>
      </>}
      {item.type === "savedVideo" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
        {item.source && <div style={{ color: C.mid, fontSize: 13 }}>Canal: <strong style={{ color: accent }}>{item.source}</strong></div>}
      </>}
      {item.type === "podcast" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
        <div style={{ color: C.mid, fontSize: 13 }}>Elige el episodio que más te apetezca hoy</div>
      </>}
      {item.type === "topic" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
        {item.searchIn && <div style={{ color: C.mid, fontSize: 13 }}>Buscar en <strong style={{ color: accent }}>{item.searchIn}</strong></div>}
      </>}
      {item.type === "inbox" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.sourceName}</div>
        <div style={{ color: C.mid, fontSize: 13 }}>Abre y lee el nº <strong style={{ color: accent }}>#{item.num}</strong></div>
      </>}
      {item.type === "movie" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
        <div style={{ color: C.mid, fontSize: 13 }}>🎬 Película pendiente</div>
      </>}
      {item.type === "article" && <>
        <div style={{ color: C.brown, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
        <div style={{ color: C.mid, fontSize: 13 }}>Fuente: <strong style={{ color: accent }}>{item.sourceName}</strong>{item.searchIn && ` · ${item.searchIn}`}</div>
      </>}

      {note && <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff3e6", borderRadius: 8, color: C.brown, fontSize: 12, fontStyle: "italic" }}>"{note}"</div>}

      {!done && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onPostpone} style={{ flex: 1, padding: "8px", background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.mid, fontSize: 12, fontFamily: "inherit" }}>⏭ Posponer</button>
          <button onClick={onDone}    style={{ flex: 2, padding: "8px", background: C.oG, border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>✓ Hecho</button>
        </div>
      )}
      {done && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: C.green, fontSize: 12, fontWeight: 700 }}>✓ Completado</span>
          <button onClick={onNote} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.mid, fontSize: 11, padding: "3px 10px" }}>{note ? "editar nota" : "+ nota"}</button>
        </div>
      )}
    </div>
  );
}

// ─── Movie modal ──────────────────────────────────────────────
function MovieModal({ mov, onSave, onClose }) {
  const [title, setTitle] = useState(mov?.title || "");
  return (
    <Modal onClose={onClose}>
      <MTitle t={mov ? "Editar película" : "Nueva película"} />
      <MField label="Título"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Interstellar" style={iStyle} /></MField>
      <MBtns onClose={onClose} onSave={() => { if (!title.trim()) return; onSave({ id: mov?.id || uid(), title: title.trim() }); }} />
    </Modal>
  );
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const [channels,    setChannels]    = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [podcasts,    setPodcasts]    = useState([]);
  const [sources,     setSources]     = useState([]);
  const [items,       setItems]       = useState([]);
  const [movies,      setMovies]      = useState([]);
  const [seenMovies,  setSeenMovies]  = useState([]);
  const [seenCh,      setSeenCh]      = useState({});
  const [seenFeed,    setSeenFeed]    = useState([]);
  const [seenVids,    setSeenVids]    = useState([]);
  const [seenItems,   setSeenItems]   = useState([]);
  const [seenInbox,   setSeenInbox]   = useState({});
  const [todayData,   setTodayData]   = useState(null);
  const [streak,      setStreak]      = useState({ count: 0, lastDate: null });
  const [history,     setHistory]     = useState([]);
  const [tab,         setTab]         = useState("today");
  const [modal,       setModal]       = useState(null);
  const [animKey,     setAnimKey]     = useState(0);
  const [loaded,      setLoaded]      = useState(false);

  // Listen to Firebase in real time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, USER_DOC), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const arr = (v, fb) => Array.isArray(v) ? v : [];
      const obj = (v, fb) => (v && typeof v === "object" && !Array.isArray(v)) ? v : fb;
      setChannels(arr(data.channels, []));
      setSavedVideos(arr(data.savedVideos, []));
      setPodcasts(arr(data.podcasts, []));
      setSources(arr(data.sources, []));
      setItems(arr(data.items, []));
      setMovies(arr(data.movies, []));
      setSeenCh(obj(data.seenCh, {}));
      setSeenFeed(arr(data.seenFeed, []));
      setSeenVids(arr(data.seenVids, []));
      setSeenItems(arr(data.seenItems, []));
      setSeenInbox(obj(data.seenInbox, {}));
      setSeenMovies(arr(data.seenMovies, []));
      if (data.todayData) setTodayData(data.todayData);
      if (data.streak)    setStreak(data.streak);
      setHistory(arr(data.history, []));
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  // Save to Firebase whenever data changes
  useEffect(() => {
    if (!loaded) return;
    saveAll({ channels, savedVideos, podcasts, sources, items, movies, seenCh, seenFeed, seenVids, seenItems, seenInbox, seenMovies, todayData, streak, history });
  }, [channels, savedVideos, podcasts, sources, items, movies, seenCh, seenFeed, seenVids, seenItems, seenInbox, seenMovies, todayData, streak, history, loaded]);

  const handleGenerate = (skipVideo = false, skipContent = false) => {
    const sCh    = JSON.parse(JSON.stringify(seenCh));
    const sFeed  = [...seenFeed];c
    const sVids  = [...seenVids];
    const sItems = [...seenItems];
    const sInbox = JSON.parse(JSON.stringify(seenInbox));

    const exVideo   = skipVideo   ? (todayData?.video?.channelId || todayData?.video?.videoId || null) : null;
    const exContent = skipContent ? (todayData?.content?.podcastId || todayData?.content?.sourceId || todayData?.content?.itemId || null) : null;

    const video   = genVideo(channels, savedVideos, sCh, sFeed, sVids, exVideo);
    const sMovies = [...seenMovies];
    const content = genContent(sources, items, podcasts, movies, sItems, sInbox, sMovies, exContent);


    setTodayData({ date: todayStr(), video, content, videoDone: false, contentDone: false, videoNote: "", contentNote: "" });
    setSeenCh(sCh); setSeenFeed(sFeed); setSeenVids(sVids); setSeenItems(sItems); setSeenInbox(sInbox); setSeenMovies(sMovies);
    setAnimKey(k => k + 1);
    setTab("today");
  };

  const markDone = (which) => {
    const updated = { ...todayData, [`${which}Done`]: true };
    setTodayData(updated);
    if ((which === "video" && updated.contentDone) || (which === "content" && updated.videoDone)) {
      const t  = todayStr();
      const yd = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newCount = (streak.lastDate === yd) ? streak.count + 1 : (streak.lastDate === t ? streak.count : 1);
      setStreak({ count: newCount, lastDate: t });
      setHistory(prev => [{ date: t, video: updated.video, content: updated.content, videoNote: updated.videoNote, contentNote: updated.contentNote }, ...prev.slice(0, 59)]);
    }
  };

  const saveNote = (which, note) => { setTodayData(p => ({ ...p, [`${which}Note`]: note })); setModal(null); };

  const artSrcs   = sources.filter(s => s.type === "articles");
  const fire      = streak.count >= 7 ? "🔥" : streak.count >= 3 ? "✨" : "🌱";
  const isToday   = todayData?.date === todayStr();

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lato',sans-serif" }}>
      <div style={{ textAlign: "center", color: "#b09070" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>☕</div>
        <div style={{ fontSize: 14 }}>Cargando tu ShuffleTube…</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Lato',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@300;400;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #c8b09a; }
        input:focus, select:focus, textarea:focus { border-color: #c8845a !important; box-shadow: 0 0 0 3px rgba(200,132,90,0.12) !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade { animation: fadeUp .38s ease both; }
        button { cursor: pointer; transition: opacity .15s, transform .1s; border: none; }
        button:hover { opacity: .82; }
        button:active { transform: scale(.97); }
        select { appearance: none; }
      `}</style>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 480, paddingTop: 40, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>☕</span>
            <h1 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 34, color: C.brown, lineHeight: 1 }}>ShuffleTube</h1>
          </div>
          {streak.count > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 20, padding: "6px 14px" }}>
              <span style={{ fontSize: 16 }}>{fire}</span>
              <span style={{ color: C.brown, fontWeight: 700, fontSize: 15 }}>{streak.count}</span>
              <span style={{ color: C.mid, fontSize: 11 }}>días</span>
            </div>
          )}
        </div>
        <p style={{ margin: "6px 0 0 38px", color: C.mid, fontSize: 12 }}>Un video · Un contenido · Cada día</p>
      </div>

      {/* Tabs */}
      <div style={{ width: "100%", maxWidth: 480, display: "flex", marginBottom: 20, gap: 5 }}>
        {[["today","✨ Hoy"],["videos","🎬 Videos"],["content","📚 Contenido"],["stats","📊 Stats"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "9px 2px", background: tab===k ? C.card : "transparent", border: tab===k ? `1.5px solid ${C.border}` : "1.5px solid transparent", borderRadius: 12, color: tab===k ? C.brown : C.mid, fontSize: 11, fontWeight: tab===k ? 700 : 400, boxShadow: tab===k ? "0 2px 12px rgba(160,100,40,0.09)" : "none" }}>{l}</button>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* ── HOY ── */}
        {tab === "today" && (
          <div>
            {!isToday && (
              <button onClick={() => handleGenerate()} style={{ width: "100%", padding: "17px", background: C.oG, borderRadius: 14, color: "#fff", fontFamily: "'Playfair Display',serif", fontSize: 19, marginBottom: 22, boxShadow: "0 6px 28px rgba(200,112,90,0.3)" }}>
                ✨ Generar para hoy
              </button>
            )}
            {!todayData && <div style={{ textAlign: "center", color: C.light, fontSize: 13, marginTop: 44 }}>Pulsa el botón para ver qué te toca hoy ✨</div>}
            {todayData && (
              <div key={animKey}>
                {todayData.video && (
                  <div className="fade">
                    <TodayCard item={todayData.video} accent={C.orange} emoji="📺" title="Video de hoy"
                      done={todayData.videoDone} note={todayData.videoNote}
                      onDone={() => markDone("video")}
                      onPostpone={() => handleGenerate(true, false)}
                      onNote={() => setModal({ type: "note", which: "video", lbl: `¿Qué tal el video?` })} />
                  </div>
                )}
                {todayData.content ? (
                  <div className="fade" style={{ animationDelay: "80ms" }}>
                    <TodayCard item={todayData.content} accent={C.green} emoji="📖" title="Contenido de hoy"
                      done={todayData.contentDone} note={todayData.contentNote}
                      onDone={() => markDone("content")}
                      onPostpone={() => handleGenerate(false, true)}
                      onNote={() => setModal({ type: "note", which: "content", lbl: "¿Qué aprendiste hoy?" })} />
                  </div>
                ) : (
                  <div className="fade" style={{ ...card, padding: "16px 18px", animationDelay: "80ms", borderLeft: `4px solid ${C.border}`, opacity: 0.6 }}>
                    <div style={{ ...lbl, marginBottom: 8 }}>📖 Contenido de hoy</div>
                    <div style={{ color: C.light, fontSize: 13 }}>Añade podcasts, fuentes o artículos en la pestaña Contenido.</div>
                  </div>
                )}
                {isToday && (!todayData.videoDone || !todayData.contentDone) && (
                  <button onClick={() => handleGenerate()} style={{ width: "100%", marginTop: 14, padding: "13px", background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.mid, fontSize: 13 }}>🔀 Regenerar todo</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── VIDEOS ── */}
        {tab === "videos" && (
          <div>
            {/* Canales */}
            <SecHdr title="Canales" onAdd={() => setModal({ type: "newCh" })} />
            {channels.length === 0 && <Empty text="Sin canales todavía…" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 24 }}>
              {channels.map(ch => (
                <div key={ch.id} style={{ display: "flex", alignItems: "center", ...card, padding: "11px 14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{ch.name}</div>
                    <Bar value={(seenCh[ch.id]||[]).length} max={ch.count} />
                  </div>
                  <RowAct onEdit={() => setModal({ type: "editCh", ch })} onDelete={() => { setChannels(p => p.filter(c => c.id !== ch.id)); setSeenCh(p => { const n={...p}; delete n[ch.id]; return n; }); }} />
                </div>
              ))}
            </div>

            {/* Feed */}
            <SecHdr title="Feed de YouTube" />
            <div style={{ ...card, padding: "14px 16px", marginBottom: 24 }}>
              <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Página de inicio · slots 1–{FEED_MAX}</div>
              <Bar value={seenFeed.length} max={FEED_MAX} color={C.gG} />
            </div>

            {/* Videos guardados */}
            <SecHdr title="Videos guardados" onAdd={() => setModal({ type: "newVid" })} />
            {savedVideos.length === 0 && <Empty text="Sin videos guardados todavía…" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {savedVideos.map(v => {
                const done = seenVids.includes(v.id);
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", ...card, padding: "11px 14px", opacity: done ? 0.5 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, textDecoration: done ? "line-through" : "none" }}>{v.title}</div>
                      {v.source && <div style={{ color: C.mid, fontSize: 11, marginTop: 2 }}>{v.source}</div>}
                    </div>
                    <RowAct onEdit={() => setModal({ type: "editVid", vid: v })} onDelete={() => { setSavedVideos(p => p.filter(x => x.id !== v.id)); setSeenVids(p => p.filter(id => id !== v.id)); }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONTENIDO ── */}
        {tab === "content" && (
          <div>
            {/* Podcasts */}
            <SecHdr title="Podcasts" onAdd={() => setModal({ type: "newPod" })} />
            {podcasts.length === 0 && <Empty text="Sin podcasts todavía…" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 24 }}>
              {podcasts.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", ...card, padding: "11px 14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.brown, fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: C.mid, fontSize: 11, marginTop: 2 }}>Puede repetir · tú eliges el episodio</div>
                  </div>
                  <RowAct onEdit={() => setModal({ type: "editPod", pod: p })} onDelete={() => setPodcasts(p2 => p2.filter(x => x.id !== p.id))} />
                </div>
              ))}
            </div>

            {/* Fuentes */}
            <SecHdr title="Fuentes de contenido" onAdd={() => setModal({ type: "newSrc" })} />
            {sources.length === 0 && <Empty text="Sin fuentes todavía…" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 24 }}>
              {sources.map(s => {
                const info = { articles:["📝",C.orange,"#fff3ec"], inbox:["📬",C.green,"#f0faf2"], topic:["🔭",C.blue,"#f0f5fa"] }[s.type] || ["?",C.mid,"#f5f5f5"];
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", ...card, padding: "11px 14px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: s.type==="inbox" ? 5 : 2 }}>
                        <span style={{ color: C.brown, fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                        <Tag text={`${info[0]} ${s.type}`} color={info[1]} bg={info[2]} />
                      </div>
                      {s.type === "inbox"    && <Bar value={(seenInbox[s.id]||[]).length} max={s.count} color={C.gG} />}
                      {s.type === "articles" && <div style={{ color: C.mid, fontSize: 11 }}>{items.filter(it => it.sourceId===s.id).length} artículos</div>}
                      {s.type === "topic"    && <div style={{ color: C.mid, fontSize: 11 }}>{s.searchIn ? `Buscar en ${s.searchIn} · ` : ""}Puede repetir</div>}
                    </div>
                    <RowAct onEdit={() => setModal({ type: "editSrc", src: s })} onDelete={() => { setSources(p => p.filter(x => x.id!==s.id)); setItems(p => p.filter(it => it.sourceId!==s.id)); setSeenInbox(p => { const n={...p}; delete n[s.id]; return n; }); }} />
                  </div>
                );
              })}
            </div>

            {/* Artículos */}
            <SecHdr title="Artículos guardados" onAdd={artSrcs.length > 0 ? () => setModal({ type: "newItem" }) : null} />
            {artSrcs.length === 0 && <Empty text="Crea primero una fuente de tipo 'artículos'." />}
            {artSrcs.length > 0 && items.length === 0 && <Empty text="Sin artículos todavía…" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {items.map(it => {
                const src  = sources.find(s => s.id === it.sourceId);
                const done = seenItems.includes(it.id);
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", ...card, padding: "11px 14px", opacity: done ? 0.5 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, textDecoration: done ? "line-through" : "none" }}>{it.title}</div>
                      <div style={{ color: C.mid, fontSize: 11, marginTop: 2 }}>{src?.name||"?"}{it.searchIn && ` · ${it.searchIn}`}</div>
                    </div>
                    <RowAct onEdit={() => setModal({ type: "editItem", item: it })} onDelete={() => { setItems(p => p.filter(i => i.id!==it.id)); setSeenItems(p => p.filter(id => id!==it.id)); }} />
                  </div>
                );
              })}
            </div>

            {/* Películas */}
            <SecHdr title="Películas pendientes" onAdd={() => setModal({ type: "newMov" })} />
            {movies.length === 0 && <Empty text="Sin películas todavía…" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {movies.map(m => {
                const done = seenMovies.includes(m.id);
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", ...card, padding: "11px 14px", opacity: done ? 0.5 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, textDecoration: done ? "line-through" : "none" }}>{m.title}</div>
                      <div style={{ color: C.mid, fontSize: 11, marginTop: 2 }}>🎬 Película</div>
                    </div>
                    <RowAct onEdit={() => setModal({ type: "editMov", mov: m })} onDelete={() => { setMovies(p => p.filter(x => x.id !== m.id)); setSeenMovies(p => p.filter(id => id !== m.id)); }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {tab === "stats" && (
          <div>
            <div style={{ ...card, padding: "16px 18px", marginBottom: 24, borderLeft: `4px solid ${C.orange}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{fire}</span>
                <div>
                  <div style={{ color: C.brown, fontSize: 22, fontFamily: "'Playfair Display',serif", fontWeight: 700 }}>{streak.count} días seguidos</div>
                  <div style={{ color: C.mid, fontSize: 12 }}>{streak.lastDate ? `Último día: ${streak.lastDate}` : "Completa tu primer día"}</div>
                </div>
              </div>
            </div>

            {history.length > 0 && <>
              <div style={{ ...lbl, marginBottom: 14 }}>Historial reciente</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {history.slice(0,7).map((h,i) => (
                  <div key={i} style={{ ...card, padding: "12px 16px" }}>
                    <div style={{ color: C.mid, fontSize: 11, marginBottom: 6 }}>{h.date}</div>
                    {h.video && <div style={{ color: C.brown, fontSize: 12, marginBottom: 2 }}>
                      📺 {h.video.type==="channel" ? `${h.video.channel} #${h.video.video}` : h.video.type==="savedVideo" ? h.video.title : `Feed #${h.video.slot}`}
                      {h.videoNote && <span style={{ color: C.mid }}> · "{h.videoNote}"</span>}
                    </div>}
                    {h.content && <div style={{ color: C.brown, fontSize: 12 }}>
                      📖 {h.content.type==="podcast" ? h.content.name : h.content.type==="topic" ? h.content.name : h.content.type==="movie" ? h.content.title : h.content.type==="article" ? h.content.title : `${h.content.sourceName} #${h.content.num}`}
                      {h.contentNote && <span style={{ color: C.mid }}> · "{h.contentNote}"</span>}
                    </div>}
                  </div>
                ))}
              </div>
            </>}

            <div style={{ ...lbl, marginBottom: 14 }}>Progreso de videos</div>
            {savedVideos.length > 0 && (
              <div style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Videos guardados</div>
                <Bar value={seenVids.length} max={savedVideos.length} color={C.pG} />
              </div>
            )}
            <div style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
              <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Feed de YouTube</div>
              <Bar value={seenFeed.length} max={FEED_MAX} color={C.gG} />
            </div>
            {channels.map(ch => (
              <div key={ch.id} style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{ch.name}</div>
                <Bar value={(seenCh[ch.id]||[]).length} max={ch.count} />
              </div>
            ))}

            <div style={{ ...lbl, marginBottom: 14, marginTop: 20 }}>Progreso de contenido</div>
            {movies.length > 0 && (
              <div style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🎬 Películas</div>
                <Bar value={seenMovies.length} max={movies.length} color="linear-gradient(90deg,#ba9a8a,#aa7a8a)" />
              </div>
            )}
            {sources.filter(s => s.type!=="topic").map(s => (
              <div key={s.id} style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{s.name}</div>
                {s.type==="inbox"
                  ? <Bar value={(seenInbox[s.id]||[]).length} max={s.count} color={C.gG} />
                  : <Bar value={items.filter(it => it.sourceId===s.id && seenItems.includes(it.id)).length} max={items.filter(it => it.sourceId===s.id).length} />
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === "newCh"      && <ChannelModal    onSave={ch  => { setChannels(p    => [...p, ch]);    setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "editCh"     && <ChannelModal ch={modal.ch}   onSave={ch  => { setChannels(p    => p.map(x => x.id===ch.id  ? ch  : x)); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "newVid"     && <SavedVideoModal onSave={v   => { setSavedVideos(p => [...p, v]);   setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "editVid"    && <SavedVideoModal vid={modal.vid} onSave={v => { setSavedVideos(p => p.map(x => x.id===v.id ? v : x)); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "newPod"     && <PodcastModal    onSave={p   => { setPodcasts(p2   => [...p2, p]);  setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "editPod"    && <PodcastModal pod={modal.pod} onSave={p => { setPodcasts(p2 => p2.map(x => x.id===p.id ? p : x)); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "newSrc"     && <SourceModal     onSave={s   => { setSources(p     => [...p, s]);   setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "editSrc"    && <SourceModal src={modal.src} onSave={s => { setSources(p => p.map(x => x.id===s.id ? s : x)); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "newItem"    && <ItemModal sources={sources}  onSave={it => { setItems(p => [...p, it]); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "editItem"   && <ItemModal item={modal.item} sources={sources} onSave={it => { setItems(p => p.map(x => x.id===it.id ? it : x)); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "newMov"     && <MovieModal onSave={m => { setMovies(p => [...p, m]); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "editMov"    && <MovieModal mov={modal.mov} onSave={m => { setMovies(p => p.map(x => x.id===m.id ? m : x)); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === "note"       && <NoteModal label={modal.lbl} initial={todayData?.[`${modal.which}Note`]} onSave={note => saveNote(modal.which, note)} onClose={() => setModal(null)} />}
    </div>
  );
}
