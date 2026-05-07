import { useState, useEffect, useRef } from "react";

const STATUS_CONFIG = {
  pending:  { label: "許可待ち",       color: "#F5A623", bg: "#FFFBF2", border: "#F5A623", icon: "⏳" },
  ok:       { label: "許可取りOK",     color: "#5BB8C8", bg: "#F0FAFC", border: "#5BB8C8", icon: "✅" },
  story:    { label: "ストーリー済み", color: "#9B8FD4", bg: "#F5F3FC", border: "#9B8FD4", icon: "📱" },
  rejected: { label: "断られた",       color: "#D9736A", bg: "#FDF2F1", border: "#D9736A", icon: "🚫" },
};
const SOURCE_OPTIONS    = ["minne", "インスタDM", "その他"];
const STORAGE_KEY       = "feltoamori_v4";
const CANVA_KEY         = "feltoamori_canva_url";
const DEFAULT_CANVA_URL = "https://canva.link/ig96t6pusp6zg4u";
const VIEWS             = { grid: "grid", detail: "detail", form: "form", canvaSet: "canvaSet" };

const loadItems    = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } };
const saveItems    = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const loadCanvaUrl = () => localStorage.getItem(CANVA_KEY) || DEFAULT_CANVA_URL;
const saveCanvaUrl = (u) => localStorage.setItem(CANVA_KEY, u);

const toBase64 = (file) => new Promise((res) => {
  const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(file);
});

function emptyForm() {
  return { images: [], msgScreenshots: [], name: "", comment: "", status: "pending", source: "minne", date: new Date().toISOString().slice(0, 10) };
}

// ─── 画像をカメラロール（ダウンロード）に保存 ────────────────────────────────
// iPhoneのSafariでは <a download> が効かないため、新タブで開いて長押し保存を促す
const saveImageToDevice = async (src, filename = "tsukurepo.jpg") => {
  // PC・Androidは直接ダウンロード
  try {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    a.click();
    return "download"; // ダウンロード成功
  } catch {
    return "fallback";
  }
};

// iOSかどうか判定
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function App() {
  const [items,      setItems]      = useState([]);
  const [filter,     setFilter]     = useState("all");
  const [view,       setView]       = useState(VIEWS.grid);
  const [selId,      setSelId]      = useState(null);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(emptyForm());
  const [lightbox,   setLightbox]   = useState(null);
  const [delConf,    setDelConf]    = useState(null);
  const [toast,      setToast]      = useState(null);
  const [canvaUrl,   setCanvaUrl]   = useState(DEFAULT_CANVA_URL);
  const [canvaInput, setCanvaInput] = useState(DEFAULT_CANVA_URL);
  // 保存→Canvaフローの状態
  const [saveFlow,   setSaveFlow]   = useState(null); // null | "saving" | "saved" | "ios_guide"

  const mainImgRef = useRef();
  const msgImgRef  = useRef();
  const importRef  = useRef();

  useEffect(() => { setItems(loadItems()); const u = loadCanvaUrl(); setCanvaUrl(u); setCanvaInput(u); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg) => setToast(msg);
  const filtered  = filter === "all" ? items : items.filter(i => i.status === filter);
  const counts    = Object.fromEntries(Object.keys(STATUS_CONFIG).map(k => [k, items.filter(i => i.status === k).length]));
  const selItem   = items.find(i => i.id === selId) || null;

  const update     = (next) => { setItems(next); saveItems(next); };
  const openAdd    = () => { setEditId(null); setForm(emptyForm()); setView(VIEWS.form); };
  const openEdit   = (item) => {
    setEditId(item.id);
    setForm({ images: item.images || (item.image ? [item.image] : []), msgScreenshots: item.msgScreenshots || [], name: item.name, comment: item.comment, status: item.status, source: item.source || "minne", date: item.date });
    setView(VIEWS.form);
  };
  const openDetail = (id) => { setSelId(id); setSaveFlow(null); setView(VIEWS.detail); };
  const backToGrid = () => { setView(VIEWS.grid); setSelId(null); setSaveFlow(null); };

  const handleSave = () => {
    if (form.images.length === 0) { showToast("📷 写真を1枚以上選んでください"); return; }
    let next;
    if (editId) {
      next = items.map(i => i.id === editId ? { ...i, ...form } : i);
      showToast("✏️ 編集しました");
    } else {
      next = [{ ...form, id: Date.now() }, ...items];
      showToast(`🎉 ${form.images.length}件追加しました！`);
    }
    update(next); setView(VIEWS.grid);
  };

  const handleDelete = (id) => { update(items.filter(i => i.id !== id)); setDelConf(null); backToGrid(); showToast("🗑️ 削除しました"); };
  const handleStatus = (id, status) => update(items.map(i => i.id === id ? { ...i, status } : i));

  const handleMainImgs = async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    const b64s = await Promise.all(files.map(toBase64));
    setForm(f => ({ ...f, images: [...f.images, ...b64s] })); e.target.value = "";
  };
  const removeMainImg = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const handleMsgImgs = async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    const b64s = await Promise.all(files.map(toBase64));
    setForm(f => ({ ...f, msgScreenshots: [...f.msgScreenshots, ...b64s] })); e.target.value = "";
  };
  const removeMsgImg = (idx) => setForm(f => ({ ...f, msgScreenshots: f.msgScreenshots.filter((_, i) => i !== idx) }));

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tsukurepo_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url); showToast("💾 エクスポートしました");
  };
  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error();
      update(data); showToast(`📥 ${data.length}件インポートしました`);
    } catch { showToast("⚠️ ファイルが正しくありません"); }
    e.target.value = "";
  };

  const saveCanva  = () => { saveCanvaUrl(canvaInput.trim()); setCanvaUrl(canvaInput.trim()); showToast("✅ Canva URLを保存しました"); setView(VIEWS.grid); };
  const openCanva  = () => window.open(canvaUrl || DEFAULT_CANVA_URL, "_blank");
  const resetCanva = () => { saveCanvaUrl(DEFAULT_CANVA_URL); setCanvaUrl(DEFAULT_CANVA_URL); setCanvaInput(DEFAULT_CANVA_URL); showToast("🔄 デフォルトURLに戻しました"); };

  // ── カメラロール保存 → Canva フロー ────────────────────────────────────────
  const handleSaveAndCanva = async (imgSrc) => {
    setSaveFlow("saving");
    if (isIOS()) {
      // iOSは新タブで開いて長押し保存を案内
      window.open(imgSrc, "_blank");
      setSaveFlow("ios_guide");
    } else {
      // PC / Android は直接ダウンロード
      await saveImageToDevice(imgSrc, `tsukurepo_${Date.now()}.jpg`);
      setSaveFlow("saved");
    }
  };

  const handleGoCanva = () => {
    setSaveFlow(null);
    openCanva();
  };

  const getThumb  = (item) => (item.images && item.images.length > 0) ? item.images[0] : (item.image || "");
  const getImgArr = (item) => item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);

  // ─── 共通パーツ ──────────────────────────────────────────────────────────
  const Header = ({ onBack, title, right }) => (
    <div style={{ background:"#fff", borderBottom:"1px solid #E2EDF2", position:"sticky", top:0, zIndex:50, padding:"12px 16px" }}>
      <div style={{ maxWidth:480, margin:"0 auto", display:"flex", alignItems:"center", gap:10 }}>
        {onBack && <button onClick={onBack} style={{ background:"#F0F4F6", border:"none", borderRadius:50, width:36, height:36, fontSize:20, cursor:"pointer", flexShrink:0, color:"#5BB8C8", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>}
        <div style={{ flex:1 }}>
          {!onBack && <div style={{ fontSize:10, color:"#9DC8D4", letterSpacing:2, fontWeight:600 }}>FELT OMAMORI</div>}
          <div style={{ fontSize: onBack ? 17:20, fontWeight:700, color:"#2C3E50" }}>{title}</div>
        </div>
        {right}
      </div>
    </div>
  );

  const FilterTabs = () => (
    <div style={{ background:"#fff", borderBottom:"1px solid #E2EDF2" }}>
      <div style={{ maxWidth:480, margin:"0 auto", display:"flex", gap:7, overflowX:"auto", padding:"10px 16px" }}>
        {[["all","すべて","🎀",items.length], ...Object.entries(STATUS_CONFIG).map(([k,v])=>[k,v.label,v.icon,counts[k]])].map(([k,label,icon,cnt])=>(
          <button key={k} onClick={() => setFilter(k)}
            style={{ flex:"0 0 auto", display:"flex", alignItems:"center", gap:4, padding:"5px 11px", borderRadius:20, border: filter===k?"1.5px solid #5BB8C8":"1.5px solid #D8E8EE", background: filter===k?"#EBF7FA":"#fff", color: filter===k?"#5BB8C8":"#90A8B4", fontSize:12, cursor:"pointer", fontWeight: filter===k?700:400, whiteSpace:"nowrap" }}>
            {icon} {label}
            <span style={{ background: filter===k?"#5BB8C8":"#D8E8EE", color: filter===k?"#fff":"#90A8B4", borderRadius:20, padding:"1px 7px", fontSize:11, fontWeight:700 }}>{cnt}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const Toast = () => toast ? (
    <div style={{ position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)", background:"rgba(40,60,70,0.92)", color:"#fff", padding:"10px 22px", borderRadius:30, fontSize:13, zIndex:300, whiteSpace:"nowrap", boxShadow:"0 4px 18px rgba(0,0,0,0.2)" }}>{toast}</div>
  ) : null;

  const SectionBox   = ({ children, mb }) => <div style={{ background:"#fff", borderRadius:16, padding:14, marginBottom:mb||12, boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>{children}</div>;
  const SectionLabel = ({ children }) => <div style={{ fontSize:12, color:"#7DB8C4", fontWeight:700, marginBottom:10 }}>{children}</div>;
  const inputStyle   = { width:"100%", padding:"11px 12px", borderRadius:10, border:"1.5px solid #D4E8EE", fontSize:14, outline:"none", boxSizing:"border-box", background:"#FAFCFD" };

  // ════════════════════════════════
  // VIEW: GRID
  // ════════════════════════════════
  if (view === VIEWS.grid) return (
    <div style={{ minHeight:"100vh", background:"#F4F7F9", fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>
      <Header title="レビュー管理 🎀" right={
        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          <button onClick={handleExport} title="バックアップ" style={{ background:"#F0F4F6", border:"none", borderRadius:50, width:36, height:36, fontSize:15, cursor:"pointer" }}>💾</button>
          <button onClick={() => importRef.current.click()} title="データ復元" style={{ background:"#F0F4F6", border:"none", borderRadius:50, width:36, height:36, fontSize:15, cursor:"pointer" }}>📥</button>
          <button onClick={() => { setCanvaInput(canvaUrl); setView(VIEWS.canvaSet); }} title="Canva設定" style={{ background:"#F0F4F6", border:"none", borderRadius:50, width:36, height:36, fontSize:15, cursor:"pointer" }}>🎨</button>
          <input ref={importRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleImport} />
          <button onClick={openAdd} style={{ background:"#5BB8C8", border:"none", color:"#fff", borderRadius:50, width:44, height:44, fontSize:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 3px 10px rgba(91,184,200,0.4)", fontWeight:700 }}>＋</button>
        </div>
      }/>
      <FilterTabs />
      <div style={{ maxWidth:480, margin:"0 auto", padding:"10px 2px 80px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"70px 20px", color:"#B8CDD5" }}>
            <div style={{ fontSize:52 }}>🎀</div>
            <div style={{ marginTop:12, fontSize:14 }}>まだレビューがありません</div>
            <div style={{ fontSize:12, marginTop:4 }}>右上の＋から追加しましょう</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:2 }}>
            {filtered.map(item => {
              const st = STATUS_CONFIG[item.status];
              const thumb = getThumb(item);
              const imgCnt = getImgArr(item).length;
              return (
                <div key={item.id} onClick={() => openDetail(item.id)}
                  style={{ position:"relative", aspectRatio:"1/1", overflow:"hidden", cursor:"pointer", background:"#E8F0F4" }}>
                  {thumb && <img src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />}
                  {imgCnt > 1 && <div style={{ position:"absolute", top:4, left:4, background:"rgba(0,0,0,0.5)", borderRadius:8, padding:"2px 6px", fontSize:10, color:"#fff", fontWeight:700 }}>🖼 {imgCnt}</div>}
                  <div style={{ position:"absolute", top:4, right:4, background:"rgba(255,255,255,0.92)", borderRadius:8, padding:"2px 5px", fontSize:12 }}>{st.icon}</div>
                  {(item.msgScreenshots||[]).length > 0 && <div style={{ position:"absolute", bottom:18, left:4, background:"rgba(91,184,200,0.88)", borderRadius:8, padding:"2px 6px", fontSize:9, color:"#fff", fontWeight:700 }}>💬{(item.msgScreenshots||[]).length}</div>}
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,0.5))", padding:"18px 5px 4px", fontSize:10, color:"#fff", fontWeight:600, textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {item.name || "（名前なし）"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Toast />
    </div>
  );

  // ════════════════════════════════
  // VIEW: CANVA設定
  // ════════════════════════════════
  if (view === VIEWS.canvaSet) return (
    <div style={{ minHeight:"100vh", background:"#F4F7F9", fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>
      <Header onBack={() => setView(VIEWS.grid)} title="🎨 Canva設定" />
      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px" }}>
        <SectionBox mb={14}>
          <SectionLabel>テンプレートURLの変更方法</SectionLabel>
          <div style={{ fontSize:12, color:"#6A8090", lineHeight:1.9 }}>
            1. Canvaでテンプレートを開く<br/>
            2. ブラウザのURLをコピー<br/>
            3. 下の欄に貼り付けて「保存する」
          </div>
        </SectionBox>
        <SectionBox>
          <SectionLabel>現在のCanvaテンプレートURL</SectionLabel>
          <input value={canvaInput} onChange={e => setCanvaInput(e.target.value)} placeholder="https://canva.link/..." style={inputStyle} />
          <div style={{ marginTop:6, fontSize:11, color:"#B8CDD5", wordBreak:"break-all" }}>{canvaInput}</div>
          <button onClick={saveCanva} style={{ width:"100%", marginTop:14, padding:13, borderRadius:12, border:"none", background:"linear-gradient(135deg,#00C4CC,#7B2FF7)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", boxShadow:"0 3px 12px rgba(0,196,204,0.3)" }}>保存する</button>
          <button onClick={resetCanva} style={{ width:"100%", marginTop:8, padding:10, borderRadius:12, border:"1.5px solid #D4E8EE", background:"#fff", color:"#90A8B4", fontSize:13, cursor:"pointer" }}>デフォルトURLに戻す</button>
        </SectionBox>
      </div>
      <Toast />
    </div>
  );

  // ════════════════════════════════
  // VIEW: DETAIL
  // ════════════════════════════════
  if (view === VIEWS.detail && selItem) {
    const live   = items.find(i => i.id === selId) || selItem;
    const liveSt = STATUS_CONFIG[live.status];
    const imgs   = getImgArr(live);

    return (
      <div style={{ minHeight:"100vh", background:"#F4F7F9", fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>
        <Header onBack={backToGrid} title={live.name || "（名前なし）"} right={
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => openEdit(live)} style={{ background:"#EBF7FA", border:"none", borderRadius:20, padding:"7px 14px", fontSize:13, color:"#5BB8C8", fontWeight:700, cursor:"pointer" }}>✏️ 編集</button>
            <button onClick={() => setDelConf(live.id)} style={{ background:"#FDF2F1", border:"none", borderRadius:20, padding:"7px 14px", fontSize:13, color:"#D9736A", fontWeight:700, cursor:"pointer" }}>🗑️</button>
          </div>
        }/>

        <div style={{ maxWidth:480, margin:"0 auto", padding:"14px 14px 80px" }}>

          {/* ── つくれぽ写真 ── */}
          <SectionBox mb={12}>
            <SectionLabel>📷 つくれぽ写真（{imgs.length}枚）</SectionLabel>
            {imgs.length > 0 && (
              <>
                <div onClick={() => setLightbox(imgs[0])} style={{ cursor:"pointer", borderRadius:12, overflow:"hidden", marginBottom: imgs.length > 1 ? 4 : 0 }}>
                  <img src={imgs[0]} alt="" style={{ width:"100%", maxHeight:280, objectFit:"cover", display:"block" }} />
                </div>
                {imgs.length > 1 && (
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(imgs.length-1,4)},1fr)`, gap:4 }}>
                    {imgs.slice(1).map((src, i) => (
                      <div key={i} onClick={() => setLightbox(src)} style={{ aspectRatio:"1/1", borderRadius:8, overflow:"hidden", cursor:"pointer" }}>
                        <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </SectionBox>

          {/* ── 基本情報 ── */}
          <SectionBox mb={12}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginBottom: live.comment ? 10 : 0 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:liveSt.bg, border:`1px solid ${liveSt.border}60`, borderRadius:20, padding:"5px 12px" }}>
                <span>{liveSt.icon}</span><span style={{ fontSize:13, color:liveSt.color, fontWeight:700 }}>{liveSt.label}</span>
              </div>
              <span style={{ background:"#EBF7FA", borderRadius:20, padding:"4px 10px", fontSize:11, color:"#5BB8C8", fontWeight:600 }}>{live.source||"minne"}</span>
              <span style={{ fontSize:11, color:"#B0C4CC", marginLeft:"auto" }}>{live.date}</span>
            </div>
            {live.comment && <div style={{ fontSize:14, color:"#4A6070", lineHeight:1.7, borderTop:"1px solid #EEF4F6", paddingTop:10 }}>{live.comment}</div>}
          </SectionBox>

          {/* ── ステータス変更 ── */}
          <SectionBox mb={12}>
            <SectionLabel>🏷️ ステータス変更</SectionLabel>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {Object.entries(STATUS_CONFIG).map(([k,v]) => (
                <button key={k} onClick={() => handleStatus(live.id, k)}
                  style={{ padding:"10px 8px", borderRadius:12, border: live.status===k?`2px solid ${v.color}`:"2px solid #DCE8EE", background: live.status===k?v.bg:"#fff", color: live.status===k?v.color:"#A8BCC4", fontSize:13, cursor:"pointer", fontWeight: live.status===k?700:400 }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </SectionBox>

          {/* ══════════════════════════════════════════
              Canvaフロー（許可OKのみ表示）
          ══════════════════════════════════════════ */}
          {live.status === "ok" && (
            <SectionBox mb={12}>
              <SectionLabel>🎨 Canvaでストーリーを作る</SectionLabel>

              {/* STEP表示 */}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
                {[["1","写真を保存","📲"], ["","→",""], ["2","Canvaで開く","🎨"]].map(([num, label, icon], i) => (
                  num ? (
                    <div key={i} style={{ flex:1, background: (saveFlow==="saved"||saveFlow==="ios_guide") && num==="1" ? "#EBF7FA" : "#F4F7F9", borderRadius:12, padding:"10px 6px", textAlign:"center", border: (saveFlow==="saved"||saveFlow==="ios_guide") && num==="1" ? "1.5px solid #5BB8C8" : "1.5px solid #E2EDF2" }}>
                      <div style={{ fontSize:18 }}>{icon}</div>
                      <div style={{ fontSize:10, color: (saveFlow==="saved"||saveFlow==="ios_guide") && num==="1" ? "#5BB8C8":"#90A8B4", fontWeight:700, marginTop:2 }}>STEP {num}</div>
                      <div style={{ fontSize:11, color:"#4A6070", marginTop:1 }}>{label}</div>
                    </div>
                  ) : (
                    <div key={i} style={{ fontSize:18, color:"#B8CDD5" }}>→</div>
                  )
                ))}
              </div>

              {/* 複数枚ある場合：どの写真を保存するか選ぶ */}
              {imgs.length > 1 && !saveFlow && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:"#90A8B4", marginBottom:7 }}>保存する写真を選んでください</div>
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(imgs.length,4)},1fr)`, gap:6 }}>
                    {imgs.map((src, i) => (
                      <div key={i} onClick={() => handleSaveAndCanva(src)}
                        style={{ aspectRatio:"1/1", borderRadius:10, overflow:"hidden", cursor:"pointer", border:"2px solid #E2EDF2", position:"relative" }}>
                        <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                        {i === 0 && <div style={{ position:"absolute", bottom:3, left:3, background:"rgba(91,184,200,0.88)", borderRadius:6, padding:"1px 5px", fontSize:9, color:"#fff", fontWeight:700 }}>メイン</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP1ボタン：写真を保存（1枚のみの場合） */}
              {imgs.length === 1 && !saveFlow && (
                <button onClick={() => handleSaveAndCanva(imgs[0])}
                  style={{ width:"100%", padding:13, borderRadius:12, border:"none", background:"linear-gradient(135deg,#5BB8C8,#7ECFDC)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 3px 10px rgba(91,184,200,0.35)", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span>📲</span><span>STEP1｜写真をカメラロールに保存</span>
                </button>
              )}

              {/* iOS向けガイド */}
              {saveFlow === "ios_guide" && (
                <div style={{ background:"#FFF8EC", border:"1.5px solid #F5A623", borderRadius:12, padding:"14px", marginBottom:10 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#D4880A", marginBottom:6 }}>📲 iPhoneでの保存方法</div>
                  <div style={{ fontSize:12, color:"#7A5A10", lineHeight:1.9 }}>
                    1. 開いた新しいタブの写真を<strong>長押し</strong><br/>
                    2.「写真に追加」をタップ<br/>
                    3. カメラロールに保存されたらこの画面に戻る
                  </div>
                  <button onClick={() => setSaveFlow("saved")}
                    style={{ width:"100%", marginTop:10, padding:10, borderRadius:10, border:"none", background:"#F5A623", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    ✅ 保存できました
                  </button>
                </div>
              )}

              {/* 保存完了 → STEP2 */}
              {saveFlow === "saved" && (
                <div style={{ background:"#F0FAFC", border:"1.5px solid #5BB8C8", borderRadius:12, padding:"14px", marginBottom:10 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#3A98A8", marginBottom:4 }}>✅ 写真の保存が完了しました！</div>
                  <div style={{ fontSize:12, color:"#5A8090", lineHeight:1.7 }}>
                    次にCanvaのテンプレートを開いて、<br/>
                    画像部分をタップ →「画像を変更」→ カメラロールから選んでください。
                  </div>
                </div>
              )}

              {/* STEP2ボタン：Canvaで開く（保存後に活性化） */}
              <button onClick={handleGoCanva}
                disabled={!saveFlow}
                style={{ width:"100%", padding:13, borderRadius:12, border:"none", background: saveFlow ? "linear-gradient(135deg,#00C4CC,#7B2FF7)" : "#E2EDF2", color: saveFlow ? "#fff" : "#B0C4CC", fontSize:14, fontWeight:700, cursor: saveFlow ? "pointer" : "default", boxShadow: saveFlow ? "0 3px 12px rgba(0,196,204,0.35)" : "none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s" }}>
                <span>🎨</span><span>STEP2｜Canvaでテンプレートを開く</span>
              </button>
              {!saveFlow && <div style={{ textAlign:"center", fontSize:11, color:"#B8CDD5", marginTop:6 }}>STEP1で写真を保存するとSTEP2が有効になります</div>}

              {/* リセット */}
              {saveFlow && (
                <button onClick={() => setSaveFlow(null)}
                  style={{ width:"100%", marginTop:8, padding:8, borderRadius:10, border:"none", background:"transparent", color:"#B8CDD5", fontSize:12, cursor:"pointer" }}>
                  やり直す
                </button>
              )}
            </SectionBox>
          )}

          {/* ── メッセージスクショ ── */}
          <SectionBox mb={0}>
            <SectionLabel>💬 メッセージのスクショ（{(live.msgScreenshots||[]).length}枚）</SectionLabel>
            {(live.msgScreenshots||[]).length > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                {(live.msgScreenshots||[]).map((src, i) => (
                  <div key={i} onClick={() => setLightbox(src)} style={{ aspectRatio:"9/16", borderRadius:10, overflow:"hidden", cursor:"pointer", border:"1px solid #E2EDF2" }}>
                    <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color:"#B8CDD5", fontSize:13, textAlign:"center", padding:"14px 0" }}>スクショがありません</div>
            )}
          </SectionBox>
        </div>

        {/* ライトボックス */}
        {lightbox && (
          <div onClick={() => setLightbox(null)} style={{ position:"fixed", inset:0, background:"rgba(10,20,30,0.92)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <img src={lightbox} alt="" style={{ maxWidth:"95vw", maxHeight:"92vh", objectFit:"contain", borderRadius:10 }} />
            <div onClick={() => setLightbox(null)} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.15)", borderRadius:50, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18, cursor:"pointer" }}>×</div>
          </div>
        )}

        {/* 削除確認 */}
        {delConf && (
          <div style={{ position:"fixed", inset:0, background:"rgba(30,50,60,0.5)", zIndex:150, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:20, padding:24, margin:20, width:"100%", maxWidth:320 }}>
              <div style={{ fontSize:42, textAlign:"center" }}>🗑️</div>
              <div style={{ fontWeight:700, fontSize:16, textAlign:"center", marginTop:10 }}>削除しますか？</div>
              <div style={{ color:"#A8BCC4", fontSize:13, textAlign:"center", marginTop:5 }}>この操作は取り消せません</div>
              <div style={{ display:"flex", gap:10, marginTop:20 }}>
                <button onClick={() => setDelConf(null)} style={{ flex:1, padding:12, borderRadius:12, border:"1.5px solid #D8E8EE", background:"#fff", color:"#888", fontSize:14, cursor:"pointer" }}>キャンセル</button>
                <button onClick={() => handleDelete(delConf)} style={{ flex:1, padding:12, borderRadius:12, border:"none", background:"#D9736A", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>削除する</button>
              </div>
            </div>
          </div>
        )}
        <Toast />
      </div>
    );
  }

  // ════════════════════════════════
  // VIEW: FORM
  // ════════════════════════════════
  if (view === VIEWS.form) return (
    <div style={{ minHeight:"100vh", background:"#F4F7F9", fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>
      <Header onBack={() => setView(editId ? VIEWS.detail : VIEWS.grid)} title={editId ? "✏️ 編集" : "📸 新規追加"} />
      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 14px 80px" }}>

        <SectionBox mb={12}>
          <SectionLabel>📷 つくれぽ写真（複数選択OK）*</SectionLabel>
          {form.images.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:8 }}>
              {form.images.map((src, i) => (
                <div key={i} style={{ position:"relative", aspectRatio:"1/1", borderRadius:10, overflow:"hidden", border:"1px solid #E2EDF2" }}>
                  <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                  <button onClick={() => removeMainImg(i)} style={{ position:"absolute", top:3, right:3, background:"rgba(217,115,106,0.88)", border:"none", borderRadius:50, width:22, height:22, color:"#fff", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>×</button>
                  {i === 0 && <div style={{ position:"absolute", bottom:3, left:3, background:"rgba(91,184,200,0.88)", borderRadius:6, padding:"1px 6px", fontSize:9, color:"#fff", fontWeight:700 }}>メイン</div>}
                </div>
              ))}
              <div onClick={() => mainImgRef.current.click()} style={{ aspectRatio:"1/1", borderRadius:10, border:"2px dashed #A8D8E4", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", background:"#F4FAFC", flexDirection:"column", gap:4 }}>
                <span style={{ fontSize:22, color:"#9DC8D4" }}>＋</span>
                <span style={{ fontSize:9, color:"#9DC8D4" }}>追加</span>
              </div>
            </div>
          )}
          {form.images.length === 0 && (
            <div onClick={() => mainImgRef.current.click()} style={{ border:"2px dashed #A8D8E4", borderRadius:14, height:120, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", background:"#F4FAFC", flexDirection:"column", gap:6 }}>
              <div style={{ fontSize:32, color:"#9DC8D4" }}>📷</div>
              <div style={{ fontSize:12, color:"#9DC8D4" }}>タップして写真を選ぶ（複数選択可）</div>
            </div>
          )}
          <input ref={mainImgRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleMainImgs} />
        </SectionBox>

        <SectionBox mb={12}>
          <SectionLabel>💬 メッセージのスクショ（複数可）</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:form.msgScreenshots.length > 0 ? 8 : 0 }}>
            {form.msgScreenshots.map((src, i) => (
              <div key={i} style={{ position:"relative", aspectRatio:"9/16", borderRadius:10, overflow:"hidden", border:"1px solid #E2EDF2" }}>
                <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                <button onClick={() => removeMsgImg(i)} style={{ position:"absolute", top:3, right:3, background:"rgba(217,115,106,0.88)", border:"none", borderRadius:50, width:22, height:22, color:"#fff", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>×</button>
              </div>
            ))}
            <div onClick={() => msgImgRef.current.click()} style={{ aspectRatio:"9/16", borderRadius:10, border:"2px dashed #A8D8E4", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", background:"#F4FAFC", flexDirection:"column", gap:4 }}>
              <span style={{ fontSize:22, color:"#9DC8D4" }}>＋</span>
              <span style={{ fontSize:9, color:"#9DC8D4" }}>追加</span>
            </div>
          </div>
          <input ref={msgImgRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleMsgImgs} />
          <div style={{ fontSize:10, color:"#B8CDD5" }}>スマホのスクリーンショットをそのまま追加できます</div>
        </SectionBox>

        <SectionBox mb={12}>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#7DB8C4", fontWeight:700, display:"block", marginBottom:5 }}>👤 お名前 <span style={{ color:"#B8CDD5", fontWeight:400 }}>（任意）</span></label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="例：〇〇さん" style={inputStyle} />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#7DB8C4", fontWeight:700, display:"block", marginBottom:7 }}>📍 届いた場所</label>
            <div style={{ display:"flex", gap:8 }}>
              {SOURCE_OPTIONS.map(src => (
                <button key={src} onClick={() => setForm(f=>({...f,source:src}))}
                  style={{ flex:1, padding:"9px 4px", borderRadius:12, border: form.source===src?"2px solid #5BB8C8":"1.5px solid #D4E8EE", background: form.source===src?"#EBF7FA":"#fff", color: form.source===src?"#5BB8C8":"#A8BCC4", fontSize:13, cursor:"pointer", fontWeight: form.source===src?700:400 }}>
                  {src}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#7DB8C4", fontWeight:700, display:"block", marginBottom:5 }}>💬 コメント</label>
            <textarea value={form.comment} onChange={e => setForm(f=>({...f,comment:e.target.value}))} placeholder="お客様のコメントを入力..." rows={3} style={{ ...inputStyle, resize:"vertical" }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#7DB8C4", fontWeight:700, display:"block", marginBottom:5 }}>📅 日付</label>
            <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} style={inputStyle} />
          </div>
        </SectionBox>

        <SectionBox mb={22}>
          <SectionLabel>🏷️ ステータス</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {Object.entries(STATUS_CONFIG).map(([k,v]) => (
              <button key={k} onClick={() => setForm(f=>({...f,status:k}))}
                style={{ padding:"11px 8px", borderRadius:12, border: form.status===k?`2px solid ${v.color}`:"2px solid #DCE8EE", background: form.status===k?v.bg:"#fff", color: form.status===k?v.color:"#A8BCC4", fontSize:13, cursor:"pointer", fontWeight: form.status===k?700:400 }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </SectionBox>

        <button onClick={handleSave} style={{ width:"100%", padding:15, borderRadius:14, border:"none", background:"linear-gradient(135deg,#5BB8C8,#7ECFDC)", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", letterSpacing:1, boxShadow:"0 3px 14px rgba(91,184,200,0.45)" }}>
          {editId ? "更新する" : "追加する"}
        </button>
      </div>
      <Toast />
    </div>
  );

  return null;
}
