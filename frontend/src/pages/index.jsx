import { useState, useCallback, useRef } from "react";

// ⚠️ Chama EXCLUSIVAMENTE o backend — nunca a ConsultarPlaca diretamente
const BACKEND = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL)
  ? process.env.NEXT_PUBLIC_BACKEND_URL
  : "https://placafy.onrender.com";

const C = {
  bg:"#070C18", surface:"#0C1424", card:"#101926", border:"#1C2D45",
  primary:"#00BFFF", green:"#00E09A", amber:"#FFB547", red:"#FF4F6B",
  purple:"#A78BFA", text:"#EEF4FF", muted:"#6B88A8", faint:"#2E4560",
  plate:"#FFCC00", plateBg:"#00288A",
};

const fmt = (v) => v != null
  ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v) : "—";
const val = (v) => (v != null && String(v).trim()) ? String(v) : "Não informado";
const boolVal = (v) =>
  v === true ? "Sim" : v === false ? "Não" : "Não disponível";

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useConsulta() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [tipo, setTipo]       = useState(null);

  const consultar = useCallback(async (placa, modalidade) => {
    setLoading(true); setError(null); setData(null); setTipo(modalidade);
    try {
      const res  = await fetch(`${BACKEND}/api/veiculo/${modalidade}/${placa}`);
      const json = await res.json();
      if (!res.ok) { setError(json.message || "Erro ao consultar."); return; }
      setData(json);
    } catch {
      setError("Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, tipo, consultar, limpar: () => { setData(null); setError(null); setTipo(null); } };
}

// ─── SCAN STEPS ──────────────────────────────────────────────────────────────
const STEPS_SIMPLES       = ["Dados Cadastrais · DETRAN", "Tabela FIPE"];
const STEPS_INTERMEDIARIA = ["Dados Cadastrais · DETRAN", "Tabela FIPE", "Gravame · SNG/BACEN", "Roubo e Furto · SINESP"];
const STEPS_AVANCADA      = ["Dados Cadastrais · DETRAN", "Tabela FIPE", "Gravame · SNG/BACEN", "Roubo e Furto · SINESP", "Leilão Prime", "Sinistro / Perda Total"];

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
const Pill = ({ ok, label }) => {
  const col = ok === true ? C.green : ok === false ? C.red : C.muted;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      whiteSpace:"nowrap", background:`${col}15`, color:col, border:`1px solid ${col}30` }}>
      {ok===true?"✓":ok===false?"✗":"—"} {label}
    </span>
  );
};

const IR = ({ l, v, col }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
    padding:"7px 0", borderBottom:`1px solid ${C.border}`, gap:12 }}>
    <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>{l}</span>
    <span style={{ fontSize:12, fontWeight:600, color:col||C.text, textAlign:"right" }}>{v}</span>
  </div>
);

const Blk = ({ title, badge, bc, accent, children }) => (
  <div style={{ background:C.card, border:`1px solid ${C.border}`,
    borderLeft:accent?`3px solid ${accent}`:`1px solid ${C.border}`,
    borderRadius:12, padding:"16px 18px" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      marginBottom:14, gap:8 }}>
      <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{title}</span>
      {badge && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
        flexShrink:0, background:`${bc||C.primary}18`, color:bc||C.primary,
        border:`1px solid ${bc||C.primary}25` }}>{badge}</span>}
    </div>
    {children}
  </div>
);

const MiniChart = ({ data }) => {
  if (!data?.length) return null;
  const vals = data.map(d=>d.valor).filter(v=>v>0);
  if (!vals.length) return null;
  const mn=Math.min(...vals)*0.985, mx=Math.max(...vals)*1.005;
  const W=400, H=70;
  const px=(i)=>(i/(data.length-1||1))*W;
  const py=(v)=>H-((v-mn)/((mx-mn)||1))*(H-14)-7;
  const pts=data.map((d,i)=>`${px(i)},${py(d.valor)}`).join(" ");
  const area=`M0,${H} L${data.map((d,i)=>`${px(i)},${py(d.valor)}`).join(" L")} L${W},${H} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:56,display:"block"}} preserveAspectRatio="none">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.primary} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={C.primary} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cg)"/>
        <polyline points={pts} fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinejoin="round"/>
        <circle cx={px(data.length-1)} cy={py(data[data.length-1].valor)}
          r="4" fill={C.bg} stroke={C.primary} strokeWidth="2.5"/>
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        {[data[0],data[Math.floor(data.length/2)],data[data.length-1]].map((d,i)=>(
          <span key={i} style={{fontSize:10,color:C.faint,fontFamily:"monospace"}}>{d.mes}</span>
        ))}
      </div>
    </div>
  );
};

const Ring = ({ score }) => {
  const col = score>=80?C.green:score>=60?C.amber:C.red;
  const label = score>=80?"Excelente":score>=60?"Bom":"Atenção";
  const r=38, circ=2*Math.PI*r, dash=(score/100)*circ;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke={C.border} strokeWidth="8"/>
        <circle cx="48" cy="48" r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/>
        <text x="48" y="46" textAnchor="middle" fill={col} fontSize="19"
          fontWeight="800" fontFamily="Inter,sans-serif">{score}</text>
        <text x="48" y="60" textAnchor="middle" fill={C.muted} fontSize="8"
          fontFamily="Inter,sans-serif">SCORE</text>
      </svg>
      <span style={{fontSize:11,fontWeight:700,color:col}}>{label}</span>
    </div>
  );
};

function calcScore(data) {
  let s = 100;
  if (data.leilao?.possuiRegistro === true)    s -= 30;
  if (data.sinistro?.possuiRegistro === true)  s -= 25;
  if (data.rouboFurto?.possuiRegistro === true) s -= 25;
  if (data.gravame?.possuiGravame === true)    s -= 15;
  const cl = data.leilao?.classificacao;
  if (cl === "C") s -= 5;
  if (cl === "D") s -= 10;
  return Math.max(0, Math.min(100, s));
}

// ─── MODAL DE UPGRADE ─────────────────────────────────────────────────────────
const ModalUpgrade = ({ tipo, placa, onConfirm, onClose }) => {
  const isInter = tipo === "intermediaria";
  const preco   = isInter ? "R$ 49,90" : "R$ 64,90";
  const titulo  = isInter ? "Consulta Intermediária" : "Consulta Avançada";
  const itens   = isInter
    ? ["✓ Gravame / Alienação Fiduciária · SNG/BACEN", "✓ Histórico de Roubo e Furto · SINESP"]
    : ["✓ Gravame / Alienação Fiduciária · SNG/BACEN", "✓ Histórico de Roubo e Furto · SINESP",
       "✓ Passagem por Leilão com Classificação", "✓ Sinistro com Perda Total · Seguradoras"];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`,
        borderRadius:16, padding:"28px 24px", maxWidth:420, width:"100%" }}>
        <div style={{ fontSize:22, marginBottom:8 }}>{isInter ? "🔍" : "🔬"}</div>
        <h2 style={{ margin:"0 0 6px", fontSize:18, fontWeight:800 }}>{titulo}</h2>
        <div style={{ fontSize:28, fontWeight:900, color:C.primary, margin:"4px 0 16px" }}>{preco}</div>
        <p style={{ fontSize:13, color:C.muted, margin:"0 0 16px", lineHeight:1.6 }}>
          Consulta única para a placa <strong style={{color:C.text}}>{placa}</strong>.
          Pagamento de uso único — sem assinatura, sem mensalidade.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
          {itens.map((it,i) => (
            <div key={i} style={{ fontSize:13, color:C.green }}>{it}</div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, padding:"11px 0", borderRadius:9, border:`1px solid ${C.border}`,
            background:"transparent", color:C.muted, cursor:"pointer", fontWeight:600, fontSize:14 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{
            flex:2, padding:"11px 0", borderRadius:9, border:"none",
            background:`linear-gradient(135deg,${C.primary},#0077CC)`,
            color:"#fff", cursor:"pointer", fontWeight:700, fontSize:14,
            boxShadow:`0 4px 18px ${C.primary}30` }}>
            Pagar {preco} e Consultar
          </button>
        </div>
        <p style={{ fontSize:11, color:C.faint, textAlign:"center", marginTop:12, marginBottom:0 }}>
          Integração com Stripe/Asaas — pagamento seguro via PIX ou cartão
        </p>
      </div>
    </div>
  );
};

// ─── TELA LGPD ───────────────────────────────────────────────────────────────
const TelaLGPD = ({ onAceitar }) => (
  <div style={{ minHeight:"100vh", background:C.bg, display:"flex",
    alignItems:"center", justifyContent:"center", padding:24 }}>
    <div style={{ maxWidth:500, background:C.card, border:`1px solid ${C.border}`,
      borderRadius:16, padding:32 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
      <h1 style={{ fontSize:20, fontWeight:900, margin:"0 0 8px", color:C.text }}>
        Privacidade e Proteção de Dados
      </h1>
      <p style={{ fontSize:13, color:C.muted, lineHeight:1.7, margin:"0 0 16px" }}>
        O <strong style={{color:C.text}}>Placafy</strong> consulta informações públicas de veículos
        por fontes oficiais (DETRAN, DENATRAN, SINESP, SENATRAN). Seus dados são protegidos pela LGPD.
      </p>
      {["Não armazenamos dados pessoais sem consentimento.",
        "A API Key nunca é exposta ao browser — fica apenas no servidor.",
        "Você pode excluir seu histórico a qualquer momento.",
        "Cumprimos integralmente a Lei 13.709/2018 (LGPD)."].map((t,i) => (
        <div key={i} style={{ display:"flex", gap:10, padding:"7px 0",
          borderBottom:`1px solid ${C.border}` }}>
          <span style={{ color:C.green, fontSize:13, flexShrink:0 }}>✓</span>
          <span style={{ fontSize:12, color:C.muted }}>{t}</span>
        </div>
      ))}
      <button onClick={onAceitar} style={{ marginTop:20, width:"100%",
        background:`linear-gradient(135deg,${C.primary},#0077CC)`,
        color:"#fff", border:"none", borderRadius:10, padding:"13px 0",
        fontWeight:700, fontSize:15, cursor:"pointer" }}>
        Aceitar e Continuar
      </button>
    </div>
  </div>
);

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function Placafy() {
  const [lgpd, setLgpd]         = useState(false);
  const [tab, setTab]           = useState("consulta");
  const [placa, setPlaca]       = useState("");
  const [step, setStep]         = useState(-1);
  const [steps, setSteps]       = useState([]);
  const [modal, setModal]       = useState(null); // "intermediaria" | "avancada" | null
  const [historico, setHistorico] = useState([]);
  const stepRef = useRef(null);
  const { data, loading, error, tipo, consultar, limpar } = useConsulta();

  if (!lgpd) return <TelaLGPD onAceitar={() => setLgpd(true)}/>;

  const iniciar = async (modalidade) => {
    const p = placa.replace(/[^A-Z0-9]/gi,"").toUpperCase();
    if (p.length < 7 || loading) return;
    const stps = modalidade==="simples" ? STEPS_SIMPLES
               : modalidade==="intermediaria" ? STEPS_INTERMEDIARIA : STEPS_AVANCADA;
    setSteps(stps); setStep(0);
    let s = 0;
    stepRef.current = setInterval(() => { s++; setStep(s); if(s>=stps.length-1) clearInterval(stepRef.current); }, 350);
    await consultar(p, modalidade);
    clearInterval(stepRef.current);
    setStep(stps.length);
    setTimeout(()=>setStep(-1), 300);
  };

  const handleConsultar = () => iniciar("simples");
  const handleUpgrade   = (t) => { setModal(t); };
  const handlePagar     = () => {
    // Em produção: abrir Stripe/Asaas com o valor correto antes de consultar
    setModal(null);
    iniciar(modal);
  };

  if (data && !historico.find(h=>h.placa===data.placa)) {
    setHistorico(prev => [
      { placa:data.placa, marca:data.cadastral?.marca, modelo:data.cadastral?.modelo,
        tipo:data.tipo, consultadoEm:data.consultadoEm },
      ...prev.slice(0,19)
    ]);
  }

  const fipe1 = data?.fipe?.[0] ?? null;
  const score = data ? calcScore(data) : 0;

  const TABS = [
    { id:"consulta", label:"Consulta" },
    { id:"dashboard", label:"Dashboard" },
    { id:"privacidade", label:"Privacidade" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text,
      fontFamily:"'Inter',-apple-system,sans-serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        button,input{font-family:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1C2D45;border-radius:4px}
        @keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fadeUp{animation:fadeUp .35s ease both}
        .tbtn{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;
          font-size:14px;transition:all .18s;white-space:nowrap;font-family:inherit}
        .tbtn.on{background:rgba(0,191,255,.15)!important;color:#00BFFF!important;
          outline:1px solid rgba(0,191,255,.3);font-weight:700}
        .tbtn.off{background:transparent;color:#6B88A8;font-weight:500}
        .tbtn:hover{background:rgba(0,191,255,.08)!important;color:#00BFFF!important}
        @media(max-width:580px){
          .dtabs{display:none!important}
          .mtabs{display:flex!important}
          .lsub{display:none!important}
        }
        @media(min-width:581px){
          .mtabs{display:none!important}
          .dtabs{display:flex!important}
        }
      `}</style>

      {modal && (
        <ModalUpgrade tipo={modal} placa={placa}
          onConfirm={handlePagar} onClose={()=>setModal(null)}/>
      )}

      {/* HEADER */}
      <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        position:"sticky", top:0, zIndex:200, width:"100%" }}>
        <div style={{ maxWidth:960, margin:"0 auto", padding:"0 20px",
          display:"flex", alignItems:"center", height:62 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, marginRight:24 }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
              background:`linear-gradient(135deg,${C.primary},#004EA0)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, boxShadow:`0 0 16px ${C.primary}30` }}>🔍</div>
            <div>
              <div style={{ fontWeight:900, fontSize:18, letterSpacing:"-0.5px", color:C.text, lineHeight:1.1 }}>
                Placa<span style={{color:C.primary}}>fy</span>
              </div>
              <div className="lsub" style={{ fontSize:9, color:C.faint, letterSpacing:"2px", fontWeight:600 }}>
                CONSULTA VEICULAR
              </div>
            </div>
          </div>
          <div className="dtabs" style={{ display:"flex", gap:4, flex:1 }}>
            {TABS.map(t=>(
              <button key={t.id} className={`tbtn ${tab===t.id?"on":"off"}`}
                onClick={()=>setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, marginLeft:"auto",
            background:`linear-gradient(135deg,${C.primary},#6366F1)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:800, fontSize:13, color:"#fff" }}>R</div>
        </div>
        <div className="mtabs" style={{ borderTop:`1px solid ${C.border}`, display:"none" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"10px 4px", border:"none", cursor:"pointer",
              fontSize:12, fontWeight:tab===t.id?700:400, background:"transparent",
              color:tab===t.id?C.primary:C.muted,
              borderBottom:tab===t.id?`2px solid ${C.primary}`:"2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:960, margin:"0 auto", padding:"24px 20px", width:"100%" }}>

        {/* ══ CONSULTA ══ */}
        {tab==="consulta" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Hero */}
            <div style={{ background:`linear-gradient(135deg,${C.card},#0A1828)`,
              border:`1px solid ${C.border}`, borderRadius:16, padding:"28px 24px" }}>
              <p style={{ fontSize:11, color:C.primary, fontWeight:700,
                letterSpacing:"1.5px", margin:"0 0 6px" }}>CONSULTA VEICULAR</p>
              <h1 style={{ fontSize:"clamp(20px,4vw,28px)", fontWeight:900,
                letterSpacing:"-0.5px", lineHeight:1.2, margin:"0 0 6px" }}>
                Consulta simples <span style={{color:C.green}}>100% grátis</span>,<br/>
                histórico completo <span style={{color:C.primary}}>quando precisar.</span>
              </h1>
              <p style={{ fontSize:13, color:C.muted, margin:"0 0 24px", lineHeight:1.6 }}>
                Dados oficiais: DETRAN · DENATRAN · SINESP · SENATRAN · Tabela FIPE
              </p>

              {/* Input placa */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center" }}>
                <div style={{ display:"inline-flex", borderRadius:10, overflow:"hidden",
                  border:`2px solid ${C.primary}45`, boxShadow:`0 0 20px ${C.primary}12` }}>
                  <div style={{ background:C.plateBg, padding:"0 14px", width:50,
                    display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", gap:2 }}>
                    <span style={{fontSize:16}}>🇧🇷</span>
                    <span style={{fontSize:7,color:"#AACCFF",fontWeight:700,letterSpacing:"1.5px"}}>BRASIL</span>
                  </div>
                  <input value={placa}
                    onChange={e=>setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7))}
                    onKeyDown={e=>e.key==="Enter"&&placa.length===7&&handleConsultar()}
                    placeholder="ABC1D23" disabled={loading} maxLength={7}
                    style={{ background:"#080E1A", border:"none", outline:"none",
                      color:C.plate, fontSize:26, fontWeight:800,
                      fontFamily:"'Courier New',monospace", letterSpacing:6,
                      padding:"11px 18px", width:"clamp(150px,35vw,200px)",
                      caretColor:C.primary }}/>
                </div>
                <button onClick={handleConsultar} disabled={placa.length<7||loading} style={{
                  padding:"12px 28px", borderRadius:10, border:"none", fontWeight:700,
                  fontSize:15, transition:"all .2s", whiteSpace:"nowrap",
                  cursor:placa.length<7||loading?"not-allowed":"pointer",
                  background:placa.length===7&&!loading
                    ?`linear-gradient(135deg,${C.primary},#0077CC)`:C.border,
                  color:placa.length===7&&!loading?"#fff":C.faint,
                  boxShadow:placa.length===7&&!loading?`0 4px 20px ${C.primary}30`:"none" }}>
                  {loading?"Consultando…":"Consultar Grátis"}
                </button>
                {data && (
                  <button onClick={()=>{limpar();setPlaca("");}} style={{
                    padding:"12px 16px", borderRadius:10, border:`1px solid ${C.border}`,
                    background:"transparent", color:C.muted, fontSize:13,
                    cursor:"pointer", fontWeight:500 }}>Nova consulta</button>
                )}
              </div>
              {error && (
                <div style={{ marginTop:14, padding:"10px 14px", background:"#FF4F6B12",
                  borderRadius:8, fontSize:13, color:C.red, border:`1px solid ${C.red}30` }}>
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* Scan */}
            {loading && (
              <div className="fadeUp" style={{ background:C.card,
                border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 20px" }}>
                <p style={{ fontSize:11, color:C.primary, fontWeight:700,
                  letterSpacing:"1.2px", margin:"0 0 14px" }}>CONSULTANDO BASES OFICIAIS…</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 20px" }}>
                  {steps.map((s,i)=>{
                    const done=i<step, active=i===step;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8,
                        opacity:i>step?0.3:1 }}>
                        <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                          background:done?"#00E09A18":active?`${C.primary}18`:C.border,
                          border:`1.5px solid ${done?C.green:active?C.primary:C.faint}`,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {done&&<span style={{color:C.green,fontSize:9}}>✓</span>}
                          {active&&<span style={{width:6,height:6,borderRadius:"50%",
                            background:C.primary,display:"block",animation:"blink .7s infinite"}}/>}
                        </div>
                        <span style={{ fontSize:11, color:active?C.text:C.muted,
                          fontWeight:active?600:400 }}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Idle */}
            {!loading && !data && !error && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
                {[
                  { icon:"🆓", title:"Simples — Grátis", desc:"Dados cadastrais + Tabela FIPE + histórico de preços", col:C.green },
                  { icon:"🔍", title:"Intermediária — R$ 49,90", desc:"+ Gravame / Alienação Fiduciária e Roubo e Furto", col:C.amber },
                  { icon:"🔬", title:"Avançada — R$ 64,90", desc:"+ Passagem por Leilão com classificação e Sinistro com Perda Total", col:C.red },
                ].map((c,i)=>(
                  <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`,
                    borderLeft:`3px solid ${c.col}`, borderRadius:12, padding:"16px 18px" }}>
                    <div style={{ fontSize:22, marginBottom:8 }}>{c.icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:c.col, marginBottom:4 }}>{c.title}</div>
                    <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{c.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ══ RESULTADO ══ */}
            {data && !loading && (
              <div className="fadeUp" style={{ display:"flex", flexDirection:"column", gap:12 }}>

                {/* Header veículo + FIPE */}
                <div style={{ background:`linear-gradient(135deg,${C.card},#0A1828)`,
                  border:`1px solid ${C.border}`, borderTop:`3px solid ${C.primary}`,
                  borderRadius:14, padding:"20px 22px" }}>
                  <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between",
                    alignItems:"flex-start", gap:16, marginBottom:16 }}>
                    <div>
                      <p style={{ fontSize:10, color:C.primary, fontWeight:700,
                        letterSpacing:"1.5px", margin:"0 0 4px" }}>VEÍCULO IDENTIFICADO</p>
                      <h2 style={{ fontSize:"clamp(18px,4vw,22px)", fontWeight:900,
                        letterSpacing:"-0.5px", margin:"0 0 4px" }}>
                        {val(data.cadastral.marca)} {data.cadastral.modelo||""}
                      </h2>
                      <p style={{ fontSize:13, color:C.muted, margin:"0 0 10px" }}>
                        {val(data.cadastral.subSegmento)}
                      </p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {/* Só mostra pills se a consulta intermediária/avançada foi feita */}
                        {data.tipo !== "simples" && <>
                          <Pill ok={data.rouboFurto?.possuiRegistro===false} label="Sem Roubo/Furto"/>
                          <Pill ok={data.gravame?.possuiGravame===false} label="Sem Gravame"/>
                        </>}
                        {data.tipo === "avancada" && <>
                          <Pill ok={data.leilao?.possuiRegistro===false} label="Sem Leilão"/>
                          <Pill ok={data.sinistro?.possuiRegistro===false} label="Sem Sinistro"/>
                        </>}
                        {data.tipo === "simples" && (
                          <span style={{ fontSize:11, color:C.muted,
                            background:`${C.muted}12`, padding:"3px 10px",
                            borderRadius:20, border:`1px solid ${C.muted}25` }}>
                            Consulta Simples
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ background:C.plateBg, padding:"10px 22px", borderRadius:9,
                      flexShrink:0, color:C.plate, fontFamily:"monospace", fontWeight:900,
                      fontSize:"clamp(18px,4vw,24px)", letterSpacing:5,
                      boxShadow:`0 0 22px ${C.plateBg}55` }}>
                      {data.placa}
                    </div>
                  </div>

                  {/* FIPE em destaque */}
                  {fipe1 ? (
                    <div style={{ background:`${C.primary}0A`, border:`1px solid ${C.primary}25`,
                      borderRadius:12, padding:"16px 18px" }}>
                      <p style={{ fontSize:10, color:C.primary, fontWeight:700,
                        letterSpacing:"1.2px", margin:"0 0 12px" }}>TABELA FIPE</p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:14, alignItems:"flex-start" }}>
                        <div style={{ flex:1, minWidth:160 }}>
                          <div style={{ fontSize:"clamp(22px,5vw,30px)", fontWeight:900, color:C.green }}>
                            {fmt(fipe1.preco)}
                          </div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{val(fipe1.versao)}</div>
                          <div style={{ fontSize:10, color:C.faint, marginTop:1 }}>
                            Cód. {fipe1.codigoFipe} · Ref. {fipe1.mesReferencia}
                          </div>
                          {data.fipe.length > 1 && (
                            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                              +{data.fipe.length-1} versões encontradas
                            </div>
                          )}
                        </div>
                      </div>
                      {fipe1.historico?.length > 1 && (
                        <div style={{ marginTop:14 }}>
                          <p style={{ fontSize:10, color:C.muted, fontWeight:600,
                            margin:"0 0 8px" }}>HISTÓRICO DE PREÇOS (12 MESES)</p>
                          <MiniChart data={fipe1.historico}/>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background:`${C.faint}12`, border:`1px solid ${C.border}`,
                      borderRadius:10, padding:"12px 16px", fontSize:13, color:C.muted }}>
                      FIPE não localizada para este veículo.
                    </div>
                  )}
                </div>

                {/* Dados cadastrais */}
                <Blk title="📋 Dados de Registro" badge="DETRAN" bc={C.primary}>
                  {[
                    ["Marca",        val(data.cadastral.marca)],
                    ["Modelo",       val(data.cadastral.modelo)],
                    ["Cor",          val(data.cadastral.cor)],
                    ["Ano Fab./Modelo", `${val(data.cadastral.anoFab)} / ${val(data.cadastral.anoModelo)}`],
                    ["Combustível",  val(data.cadastral.combustivel)],
                    ["Procedência",  val(data.cadastral.procedencia)],
                    ["Município (UF)", `${val(data.cadastral.municipio)} (${val(data.cadastral.uf)})`],
                    ["Tipo de Veículo", val(data.cadastral.tipoVeiculo)],
                    ["Segmento",     val(data.cadastral.subSegmento)],
                    ["Motor",        val(data.cadastral.motor)],
                    ["Potência",     data.cadastral.potencia ? `${data.cadastral.potencia} cv` : "Não informado"],
                    ["Chassi",       val(data.cadastral.chassi)],
                  ].map(([l,v])=><IR key={l} l={l} v={v}/>)}
                </Blk>

                {/* Intermediária: Gravame + Roubo */}
                {(data.tipo === "intermediaria" || data.tipo === "avancada") && (
                  <>
                    <Blk title="🏛️ Gravame / Alienação Fiduciária" badge="SNG/BACEN"
                      bc={data.gravame?.possuiGravame?C.red:C.green}>
                      <IR l="Gravame Ativo"
                        v={boolVal(data.gravame?.possuiGravame===false?false:data.gravame?.possuiGravame===true?true:null)}
                        col={data.gravame?.possuiGravame===false?C.green:data.gravame?.possuiGravame===true?C.red:C.muted}/>
                      {data.gravame?.possuiGravame === true && <>
                        <IR l="Agente Financeiro" v={val(data.gravame.agenteFinanceiro)}/>
                        <IR l="Data de Registro"  v={val(data.gravame.dataRegistro)}/>
                        <IR l="Situação"          v={val(data.gravame.situacao)} col={C.red}/>
                      </>}
                      {data.gravame?.possuiGravame === false && (
                        <div style={{ marginTop:10, padding:"9px 11px", background:"#00E09A0A",
                          borderRadius:8, border:"1px solid #00E09A20", fontSize:12, color:C.green }}>
                          ✓ Veículo livre para transferência — sem pendências financeiras
                        </div>
                      )}
                    </Blk>

                    <Blk title="🚔 Histórico de Roubo e Furto" badge="SINESP"
                      bc={data.rouboFurto?.possuiRegistro?C.red:C.green}>
                      <IR l="Ocorrência de Roubo/Furto"
                        v={data.rouboFurto?.possuiRegistro===true?"SIM — Ver registros"
                          :data.rouboFurto?.possuiRegistro===false?"Nenhuma ocorrência"
                          :"Não disponível"}
                        col={data.rouboFurto?.possuiRegistro===true?C.red
                          :data.rouboFurto?.possuiRegistro===false?C.green:C.muted}/>
                      {data.rouboFurto?.registros?.map((r,i)=>(
                        <div key={i} style={{ marginTop:8, padding:"8px 10px",
                          background:`${C.red}08`, borderRadius:8, border:`1px solid ${C.red}20` }}>
                          <div style={{fontSize:11,color:C.red,fontWeight:600}}>{r.tipo}</div>
                          <div style={{fontSize:10,color:C.muted}}>{r.dataOcorrencia} · {r.uf}</div>
                        </div>
                      ))}
                    </Blk>
                  </>
                )}

                {/* Avançada: Leilão + Sinistro */}
                {data.tipo === "avancada" && (
                  <>
                    <Blk title="🏷️ Passagem por Leilão" badge="Leilões Prime"
                      bc={data.leilao?.possuiRegistro?C.red:C.green}>
                      <IR l="Passagem por Leilão"
                        v={data.leilao?.possuiRegistro===true?"SIM — Ver registros"
                          :data.leilao?.possuiRegistro===false?"Nenhum registro"
                          :"Não disponível"}
                        col={data.leilao?.possuiRegistro===true?C.red
                          :data.leilao?.possuiRegistro===false?C.green:C.muted}/>
                      {data.leilao?.classificacao && (
                        <IR l="Classificação" v={`Grau ${data.leilao.classificacao}`} col={C.amber}/>
                      )}
                      {data.leilao?.registros?.map((r,i)=>(
                        <div key={i} style={{ marginTop:8, padding:"8px 10px",
                          background:`${C.amber}08`, borderRadius:8, border:`1px solid ${C.amber}20` }}>
                          <div style={{fontSize:11,color:C.amber,fontWeight:600}}>
                            {r.dataLeilao} · Lote {r.lote}
                          </div>
                          {r.comitente && <div style={{fontSize:10,color:C.muted}}>{r.comitente}</div>}
                        </div>
                      ))}
                    </Blk>

                    <Blk title="💥 Sinistro com Perda Total" badge="Seguradoras"
                      bc={data.sinistro?.possuiRegistro?C.red:C.green}>
                      <IR l="Sinistro com Perda Total"
                        v={data.sinistro?.possuiRegistro===true?"SIM — Indenização registrada"
                          :data.sinistro?.possuiRegistro===false?"Nenhum registro"
                          :"Não disponível"}
                        col={data.sinistro?.possuiRegistro===true?C.red
                          :data.sinistro?.possuiRegistro===false?C.green:C.muted}/>
                      {data.sinistro?.descricao && (
                        <div style={{ marginTop:8, padding:"8px 10px",
                          background:`${C.red}08`, borderRadius:8, border:`1px solid ${C.red}20`,
                          fontSize:12, color:C.muted }}>
                          {data.sinistro.descricao}
                        </div>
                      )}
                    </Blk>
                  </>
                )}

                {/* Score — só aparece quando tem dados suficientes */}
                {data.tipo !== "simples" && (
                  <Blk title="🤖 Parecer Técnico — Placafy AI" badge="Análise" bc={C.purple} accent={C.purple}>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:20, alignItems:"flex-start" }}>
                      <Ring score={score}/>
                      <div style={{ flex:1, minWidth:220 }}>
                        <p style={{ fontSize:12, color:C.muted, margin:"0 0 12px", lineHeight:1.6 }}>
                          Score calculado com base nos dados reais da consulta.
                        </p>
                        {[
                          { ok:data.rouboFurto?.possuiRegistro===false,
                            msg:data.rouboFurto?.possuiRegistro===null?"Roubo/Furto: sem informação"
                              :data.rouboFurto?.possuiRegistro?"Histórico de roubo ou furto encontrado"
                              :"Sem histórico de roubo ou furto" },
                          { ok:data.gravame?.possuiGravame===false,
                            msg:data.gravame?.possuiGravame===null?"Gravame: sem informação"
                              :data.gravame?.possuiGravame?`Gravame ativo — ${val(data.gravame.agenteFinanceiro)}`
                              :"Sem gravame — livre para transferência" },
                          ...(data.tipo==="avancada"?[
                            { ok:data.leilao?.possuiRegistro===false,
                              msg:data.leilao?.possuiRegistro===null?"Leilão: sem informação"
                                :data.leilao?.possuiRegistro?`Passou por leilão (grau ${data.leilao.classificacao||"—"})`
                                :"Sem registro de leilão" },
                            { ok:data.sinistro?.possuiRegistro===false,
                              msg:data.sinistro?.possuiRegistro===null?"Sinistro: sem informação"
                                :data.sinistro?.possuiRegistro?"Sinistro com perda total registrado"
                                :"Sem sinistro registrado" },
                          ]:[]),
                        ].map((p,i)=>(
                          <div key={i} style={{ display:"flex", gap:9, padding:"6px 0",
                            borderBottom:`1px solid ${C.border}` }}>
                            <span style={{ color:p.ok===true?C.green:p.ok===false?C.red:C.faint,
                              fontSize:12, flexShrink:0, marginTop:1 }}>
                              {p.ok===true?"✓":p.ok===false?"✗":"—"}
                            </span>
                            <span style={{ fontSize:12, color:C.text, lineHeight:1.45 }}>{p.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Blk>
                )}

                {/* Botões de upgrade */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                  borderRadius:14, padding:"20px 22px" }}>
                  <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 6px" }}>
                    Quer saber mais sobre este veículo?
                  </p>
                  <p style={{ fontSize:12, color:C.muted, margin:"0 0 16px" }}>
                    Escolha uma consulta aprofundada — pagamento único, sem assinatura.
                  </p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                    {data.tipo === "simples" && (
                      <button onClick={()=>handleUpgrade("intermediaria")} style={{
                        flex:1, minWidth:200, padding:"12px 20px", borderRadius:10,
                        border:`2px solid ${C.amber}`, background:`${C.amber}10`,
                        color:C.amber, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                        🔍 Intermediária — R$ 49,90
                        <div style={{ fontSize:11, fontWeight:400, color:C.muted, marginTop:2 }}>
                          + Gravame · Roubo e Furto
                        </div>
                      </button>
                    )}
                    {(data.tipo === "simples" || data.tipo === "intermediaria") && (
                      <button onClick={()=>handleUpgrade("avancada")} style={{
                        flex:1, minWidth:200, padding:"12px 20px", borderRadius:10,
                        border:`2px solid ${C.red}`, background:`${C.red}10`,
                        color:C.red, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                        🔬 Avançada — R$ 64,90
                        <div style={{ fontSize:11, fontWeight:400, color:C.muted, marginTop:2 }}>
                          + Leilão · Sinistro · Gravame · Roubo e Furto
                        </div>
                      </button>
                    )}
                    {data.tipo === "avancada" && (
                      <div style={{ fontSize:13, color:C.green, padding:"12px 0" }}>
                        ✓ Você já tem a consulta completa desta placa.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.5px", margin:0 }}>Dashboard</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
              {[
                { l:"Consultas Simples",   v:historico.filter(h=>h.tipo==="simples").length,       col:C.green  },
                { l:"Intermediárias",      v:historico.filter(h=>h.tipo==="intermediaria").length, col:C.amber  },
                { l:"Avançadas",           v:historico.filter(h=>h.tipo==="avancada").length,      col:C.red    },
                { l:"Total",               v:historico.length,                                     col:C.primary},
              ].map((s,i)=>(
                <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`,
                  borderLeft:`3px solid ${s.col}`, borderRadius:12, padding:"16px 18px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{s.l}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:s.col }}>{s.v}</div>
                  <div style={{ fontSize:10, color:C.faint, marginTop:4 }}>nesta sessão</div>
                </div>
              ))}
            </div>
            <Blk title="Histórico de Consultas" badge="Sessão atual" bc={C.primary}>
              {historico.length === 0 ? (
                <p style={{ fontSize:13, color:C.faint, textAlign:"center", padding:"20px 0", margin:0 }}>
                  Nenhuma consulta realizada ainda.
                </p>
              ) : historico.map((h,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 0", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap" }}>
                  <div style={{ background:C.plateBg, color:C.plate, fontFamily:"monospace",
                    fontWeight:700, fontSize:11, letterSpacing:2,
                    padding:"3px 9px", borderRadius:5, flexShrink:0 }}>{h.placa}</div>
                  <div style={{ flex:1, minWidth:130 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{val(h.marca)} {h.modelo||""}</div>
                    <div style={{ fontSize:10, color:C.faint }}>
                      {new Date(h.consultadoEm).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    background:h.tipo==="avancada"?`${C.red}15`:h.tipo==="intermediaria"?`${C.amber}15`:`${C.green}15`,
                    color:h.tipo==="avancada"?C.red:h.tipo==="intermediaria"?C.amber:C.green }}>
                    {h.tipo==="avancada"?"Avançada":h.tipo==="intermediaria"?"Intermediária":"Simples"}
                  </span>
                  <button onClick={()=>{setPlaca(h.placa);setTab("consulta");}} style={{
                    fontSize:11, fontWeight:600, color:C.primary,
                    background:`${C.primary}12`, border:`1px solid ${C.primary}25`,
                    borderRadius:7, padding:"4px 11px", cursor:"pointer" }}>Abrir</button>
                </div>
              ))}
              {historico.length > 0 && (
                <button onClick={()=>setHistorico([])} style={{
                  marginTop:12, fontSize:12, color:C.red, background:`${C.red}0A`,
                  border:`1px solid ${C.red}25`, borderRadius:7,
                  padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                  🗑️ Excluir histórico da sessão
                </button>
              )}
            </Blk>
          </div>
        )}

        {/* ══ PRIVACIDADE ══ */}
        {tab==="privacidade" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:720 }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:0 }}>Privacidade e LGPD</h2>
            {[
              { t:"📋 Quais dados coletamos?", c:"Apenas a placa digitada para fins de consulta. Não coletamos nome, CPF, endereço ou qualquer dado pessoal identificável." },
              { t:"🔒 Como protegemos sua API Key?", c:"A API Key da ConsultarPlaca existe EXCLUSIVAMENTE no servidor backend. Ela nunca trafega para o browser. A autenticação é feita por Basic Auth server-side." },
              { t:"💾 Cache e armazenamento", c:"Resultados são armazenados em cache por 24 horas para otimizar consultas. Os dados são excluídos automaticamente após este período." },
              { t:"⚖️ Lei 13.709/2018 (LGPD)", c:"Cumprimos integralmente a Lei Geral de Proteção de Dados. Você tem direito ao acesso, correção e exclusão dos seus dados a qualquer momento." },
              { t:"🗑️ Excluir meus dados", c:"Para excluir seu histórico desta sessão, acesse o Dashboard e clique em 'Excluir histórico da sessão'. Para exclusão no servidor, entre em contato com o suporte." },
            ].map((item,i)=>(
              <Blk key={i} title={item.t} bc={C.primary}>
                <p style={{ fontSize:13, color:C.muted, lineHeight:1.7, margin:0 }}>{item.c}</p>
              </Blk>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
