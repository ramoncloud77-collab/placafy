// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  PLACAFY — Frontend React                                               ║
// ║  Zero mocks. Zero hardcode. Todos os dados via backend NestJS.          ║
// ║  A API KEY da ConsultarPlaca NUNCA aparece aqui.                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { useState, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// ⚠️ PROIBIDO: fetch("https://api.consultarplaca.com.br/...")
// ✅ CORRETO:  fetch(`${BACKEND}/api/veiculo/:placa`)
// Em produção, NEXT_PUBLIC_BACKEND_URL vem do .env.local
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// ─── PALETA ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#070C18", surface:"#0C1424", card:"#101926", border:"#1C2D45",
  primary:"#00BFFF", green:"#00E09A", amber:"#FFB547", red:"#FF4F6B",
  purple:"#A78BFA", text:"#EEF4FF", muted:"#6B88A8", faint:"#2E4560",
  plate:"#FFCC00", plateBg:"#00288A",
};

// ─── FORMATADORES ─────────────────────────────────────────────────────────────
const fmt = (v) =>
  v != null ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v)
            : "Nenhuma informação disponível";
const val = (v) => (v != null && String(v).trim() !== "" ? v : "Nenhuma informação disponível");
const bool = (v, sim="Sim", nao="Não") =>
  v === true ? sim : v === false ? nao : "Nenhuma informação disponível";

// ─── HOOK: consulta veicular ──────────────────────────────────────────────────
function useVeiculo() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const consultar = useCallback(async (placa) => {
    const p = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setLoading(true); setError(null); setData(null);
    try {
      // Chama EXCLUSIVAMENTE o backend NestJS — nunca a ConsultarPlaca diretamente
      const res  = await fetch(`${BACKEND}/api/veiculo/${p}`);
      const json = await res.json();
      if (!res.ok) { setError(json); return; }
      setData(json);
    } catch {
      setError({ message: "Sem conexão com o servidor.", code: "REDE" });
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, consultar, limpar: () => { setData(null); setError(null); } };
}

// ─── SCAN STEPS ───────────────────────────────────────────────────────────────
const STEPS = [
  "Dados Cadastrais · DETRAN",
  "Restrições Estaduais · DENATRAN",
  "Restrições Nacionais · RENAJUD",
  "Débitos · RENAINF",
  "Roubo e Furto · SINESP",
  "Leilão com Classificação",
  "Sinistro / Perda Total",
  "Gravame · SNG/BACEN",
  "Tabela FIPE + Histórico 12m",
  "Agregando resultado final",
];

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
const Pill = ({ ok, label }) => {
  const col = ok === true ? C.green : ok === false ? C.red : C.muted;
  const sym = ok === true ? "✓" : ok === false ? "✗" : "—";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      whiteSpace:"nowrap", background:`${col}15`, color:col,
      border:`1px solid ${col}30` }}>{sym} {label}</span>
  );
};

const IR = ({ label, value, color }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
    padding:"7px 0", borderBottom:`1px solid ${C.border}`, gap:12 }}>
    <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>{label}</span>
    <span style={{ fontSize:12, fontWeight:600, color:color||C.text, textAlign:"right",
      wordBreak:"break-word", maxWidth:"60%" }}>{value}</span>
  </div>
);

const Blk = ({ title, badge, bc, accent, children }) => (
  <div style={{ background:C.card, border:`1px solid ${C.border}`,
    borderLeft:accent?`3px solid ${accent}`:`1px solid ${C.border}`,
    borderRadius:12, padding:"16px 18px" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      marginBottom:14, gap:8 }}>
      <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{title}</span>
      {badge && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px",
        borderRadius:20, flexShrink:0, background:`${bc||C.primary}18`,
        color:bc||C.primary, border:`1px solid ${bc||C.primary}25` }}>{badge}</span>}
    </div>
    {children}
  </div>
);

const MiniChart = ({ data }) => {
  if (!data?.length) return null;
  const vals = data.map(d => d.valor).filter(v => v > 0);
  if (!vals.length) return null;
  const mn = Math.min(...vals)*0.985, mx = Math.max(...vals)*1.005;
  const W=400, H=72;
  const px = (i) => (i/(data.length-1||1))*W;
  const py = (v) => H-((v-mn)/((mx-mn)||1))*(H-14)-7;
  const pts = data.map((d,i) => `${px(i)},${py(d.valor)}`).join(" ");
  const area = `M0,${H} L${data.map((d,i)=>`${px(i)},${py(d.valor)}`).join(" L")} L${W},${H} Z`;
  return (
    <div style={{ width:"100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:60, display:"block" }}
        preserveAspectRatio="none">
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
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        {[data[0], data[Math.floor(data.length/2)], data[data.length-1]].map((d,i) => (
          <span key={i} style={{ fontSize:10, color:C.faint, fontFamily:"monospace" }}>{d.mes}</span>
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
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke={C.border} strokeWidth="8"/>
        <circle cx="48" cy="48" r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/>
        <text x="48" y="46" textAnchor="middle" fill={col} fontSize="19"
          fontWeight="800" fontFamily="Inter,sans-serif">{score}</text>
        <text x="48" y="60" textAnchor="middle" fill={C.muted} fontSize="8"
          fontFamily="Inter,sans-serif">SCORE</text>
      </svg>
      <span style={{ fontSize:11, fontWeight:700, color:col }}>{label}</span>
    </div>
  );
};

// ─── SCORE CALCULADO A PARTIR DOS DADOS REAIS ─────────────────────────────────
function calcularScore(data) {
  if (!data) return 0;
  let s = 100;
  if (data.leilao?.possuiRegistro === true)    s -= 30;
  if (data.leilao?.possuiSinistro === true)    s -= 25;
  if (data.rouboFurto?.possuiRegistro === true) s -= 25;
  if (data.gravame?.possuiGravame === true)    s -= 15;
  const classi = data.leilao?.classificacao;
  if (classi === "C") s -= 5;
  if (classi === "D") s -= 10;
  return Math.max(0, Math.min(100, s));
}

// ─── TELA LGPD ────────────────────────────────────────────────────────────────
function TelaLGPD({ onAceitar }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex",
      alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:520, background:C.card, border:`1px solid ${C.border}`,
        borderRadius:16, padding:32 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
        <h1 style={{ fontSize:22, fontWeight:900, margin:"0 0 8px", color:C.text }}>
          Privacidade e Proteção de Dados
        </h1>
        <p style={{ fontSize:13, color:C.muted, lineHeight:1.7, margin:"0 0 16px" }}>
          O <strong style={{ color:C.text }}>Placafy</strong> consulta informações públicas de veículos
          por meio de fontes oficiais. Para utilizar o serviço, você concorda com os seguintes termos:
        </p>
        {[
          "Os dados consultados são de natureza pública, provenientes de órgãos oficiais (DETRAN, DENATRAN, SINESP, SENATRAN).",
          "Não armazenamos placas ou dados pessoais sem consentimento expresso.",
          "Você pode solicitar a exclusão do seu histórico a qualquer momento.",
          "Não compartilhamos seus dados com terceiros sem autorização.",
          "Cumprimos integralmente a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).",
        ].map((t,i) => (
          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start",
            padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ color:C.green, fontSize:13, flexShrink:0 }}>✓</span>
            <span style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{t}</span>
          </div>
        ))}
        <p style={{ fontSize:11, color:C.faint, margin:"16px 0 0", lineHeight:1.6 }}>
          Ao continuar, você concorda com nossa{" "}
          <span style={{ color:C.primary, cursor:"pointer" }}>Política de Privacidade</span>{" "}
          e <span style={{ color:C.primary, cursor:"pointer" }}>Termos de Uso</span>.
        </p>
        <button onClick={onAceitar} style={{
          marginTop:20, width:"100%",
          background:`linear-gradient(135deg,${C.primary},#0077CC)`,
          color:"#fff", border:"none", borderRadius:10, padding:"13px 0",
          fontWeight:700, fontSize:15, cursor:"pointer",
          boxShadow:`0 4px 20px ${C.primary}30`,
        }}>Aceitar e Continuar</button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function Placafy() {
  const [lgpdAceito, setLgpdAceito] = useState(false);
  const [tab, setTab]               = useState("consulta");
  const [placa, setPlaca]           = useState("");
  const [step, setStep]             = useState(-1);
  const [historico, setHistorico]   = useState([]);
  const stepRef = useRef(null);
  const { data, loading, error, consultar, limpar } = useVeiculo();

  if (!lgpdAceito) return <TelaLGPD onAceitar={() => setLgpdAceito(true)}/>;

  const iniciarConsulta = async () => {
    if (placa.length < 7 || loading) return;
    setStep(0);
    let s = 0;
    stepRef.current = setInterval(() => {
      s++; setStep(s);
      if (s >= STEPS.length - 1) clearInterval(stepRef.current);
    }, 280);
    await consultar(placa);
    clearInterval(stepRef.current);
    setStep(STEPS.length);
    setTimeout(() => setStep(-1), 400);
  };

  // Salvar no histórico quando resultado chegar (sem dados pessoais)
  if (data && !historico.find(h => h.placa === data.placa)) {
    const score = calcularScore(data);
    setHistorico(prev => [
      { placa: data.placa, marca: data.cadastral.marca, modelo: data.cadastral.modelo,
        score, consultadoEm: data.consultadoEm },
      ...prev.slice(0, 19),
    ]);
  }

  const score = calcularScore(data);
  const fipePrincipal = data?.fipe?.[0] ?? null;

  const TABS = [
    { id:"consulta",   label:"Consulta"   },
    { id:"dashboard",  label:"Dashboard"  },
    { id:"privacidade",label:"Privacidade"},
    { id:"planos",     label:"Planos"     },
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
        .tbtn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;
          font-size:13px;transition:all .18s;white-space:nowrap;font-family:inherit}
        .tbtn.on{background:rgba(0,191,255,.15)!important;color:#00BFFF!important;
          outline:1px solid rgba(0,191,255,.3);font-weight:700}
        .tbtn.off{background:transparent;color:#6B88A8;font-weight:500}
        .tbtn:hover{background:rgba(0,191,255,.08)!important;color:#00BFFF!important}
        @media(max-width:580px){
          .desktop-tabs{display:none!important}
          .mobile-tabs{display:flex!important}
          .logo-sub{display:none!important}
        }
        @media(min-width:581px){
          .mobile-tabs{display:none!important}
          .desktop-tabs{display:flex!important}
        }
      `}</style>

      {/* ══ HEADER ══ */}
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
              <div style={{ fontWeight:900, fontSize:18, letterSpacing:"-0.5px",
                color:C.text, lineHeight:1.1 }}>
                Placa<span style={{ color:C.primary }}>fy</span>
              </div>
              <div className="logo-sub" style={{ fontSize:9, color:C.faint,
                letterSpacing:"2px", fontWeight:600 }}>CONSULTA VEICULAR</div>
            </div>
          </div>
          <div className="desktop-tabs" style={{ display:"flex", gap:4, flex:1 }}>
            {TABS.map(t => (
              <button key={t.id} className={`tbtn ${tab===t.id?"on":"off"}`}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0,
            marginLeft:"auto", background:`linear-gradient(135deg,${C.primary},#6366F1)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:800, fontSize:13, color:"#fff" }}>R</div>
        </div>
        <div className="mobile-tabs" style={{ borderTop:`1px solid ${C.border}`, display:"none" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:"10px 4px", border:"none", cursor:"pointer",
              fontSize:12, fontWeight:tab===t.id?700:400, background:"transparent",
              fontFamily:"inherit", color:tab===t.id?C.primary:C.muted,
              borderBottom:tab===t.id?`2px solid ${C.primary}`:"2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:960, margin:"0 auto", padding:"24px 20px", width:"100%" }}>

        {/* ══ CONSULTA ══ */}
        {tab === "consulta" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Hero */}
            <div style={{ background:`linear-gradient(135deg,${C.card},#0A1828)`,
              border:`1px solid ${C.border}`, borderRadius:16, padding:"28px 24px" }}>
              <p style={{ fontSize:11, color:C.primary, fontWeight:700,
                letterSpacing:"1.5px", margin:"0 0 6px" }}>CONSULTA VEICULAR COMPLETA</p>
              <h1 style={{ fontSize:"clamp(20px,4vw,28px)", fontWeight:900,
                letterSpacing:"-0.5px", lineHeight:1.2, margin:"0 0 6px" }}>
                Tudo sobre qualquer veículo<br/>
                <span style={{ color:C.primary }}>em segundos.</span>
              </h1>
              <p style={{ fontSize:13, color:C.muted, margin:"0 0 24px", lineHeight:1.6 }}>
                Dados oficiais: DETRAN · DENATRAN · SINESP · SENATRAN · FIPE
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center" }}>
                <div style={{ display:"inline-flex", borderRadius:10, overflow:"hidden",
                  border:`2px solid ${C.primary}45`, boxShadow:`0 0 20px ${C.primary}12` }}>
                  <div style={{ background:C.plateBg, padding:"0 14px", width:50,
                    display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", gap:2 }}>
                    <span style={{ fontSize:16 }}>🇧🇷</span>
                    <span style={{ fontSize:7, color:"#AACCFF", fontWeight:700, letterSpacing:"1.5px" }}>BRASIL</span>
                  </div>
                  <input value={placa}
                    onChange={e => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7))}
                    onKeyDown={e => e.key==="Enter" && placa.length===7 && iniciarConsulta()}
                    placeholder="ABC1D23" disabled={loading} maxLength={7}
                    style={{ background:"#080E1A", border:"none", outline:"none",
                      color:C.plate, fontSize:26, fontWeight:800,
                      fontFamily:"'Courier New',monospace", letterSpacing:6,
                      padding:"11px 18px", width:"clamp(150px,35vw,200px)",
                      caretColor:C.primary }}/>
                </div>
                <button onClick={iniciarConsulta} disabled={placa.length<7||loading} style={{
                  padding:"12px 28px", borderRadius:10, border:"none", fontWeight:700,
                  fontSize:15, transition:"all .2s", whiteSpace:"nowrap",
                  cursor:placa.length<7||loading?"not-allowed":"pointer",
                  background:placa.length===7&&!loading
                    ?`linear-gradient(135deg,${C.primary},#0077CC)`:C.border,
                  color:placa.length===7&&!loading?"#fff":C.faint,
                  boxShadow:placa.length===7&&!loading?`0 4px 20px ${C.primary}30`:"none" }}>
                  {loading ? "Consultando…" : "Consultar"}
                </button>
                {data && (
                  <button onClick={() => { limpar(); setPlaca(""); }} style={{
                    padding:"12px 16px", borderRadius:10, border:`1px solid ${C.border}`,
                    background:"transparent", color:C.muted, fontSize:13,
                    cursor:"pointer", fontWeight:500 }}>Nova consulta</button>
                )}
              </div>
              {error && (
                <div style={{ marginTop:14, padding:"10px 14px", background:"#FF4F6B12",
                  borderRadius:8, fontSize:13, color:C.red, border:`1px solid ${C.red}30` }}>
                  ⚠️ {error.message}
                </div>
              )}
            </div>

            {/* Scan progress */}
            {loading && (
              <div className="fadeUp" style={{ background:C.card,
                border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 20px" }}>
                <p style={{ fontSize:11, color:C.primary, fontWeight:700,
                  letterSpacing:"1.2px", margin:"0 0 14px" }}>CONSULTANDO BASES OFICIAIS…</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 20px" }}>
                  {STEPS.map((s,i) => {
                    const done=i<step, active=i===step;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center",
                        gap:8, opacity:i>step?0.3:1 }}>
                        <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                          background:done?"#00E09A18":active?`${C.primary}18`:C.border,
                          border:`1.5px solid ${done?C.green:active?C.primary:C.faint}`,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {done && <span style={{ color:C.green, fontSize:9 }}>✓</span>}
                          {active && <span style={{ width:6, height:6, borderRadius:"50%",
                            background:C.primary, display:"block", animation:"blink .7s infinite" }}/>}
                        </div>
                        <span style={{ fontSize:11, color:active?C.text:C.muted,
                          fontWeight:active?600:400, whiteSpace:"nowrap",
                          overflow:"hidden", textOverflow:"ellipsis" }}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Idle */}
            {!loading && !data && !error && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`,
                borderRadius:14, padding:"18px 20px" }}>
                <p style={{ fontSize:11, color:C.muted, fontWeight:700,
                  letterSpacing:"1.2px", margin:"0 0 12px" }}>O QUE VOCÊ RECEBE</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 24px" }}>
                  {[
                    ["📋","Dados Cadastrais Reais","DETRAN/SENATRAN"],
                    ["🚫","Restrições Estaduais e Nacionais","DENATRAN + RENAJUD"],
                    ["💰","Débitos por Infrações","RENAINF"],
                    ["🚔","Histórico de Roubo e Furto","SINESP"],
                    ["🏷️","Leilão com Classificação A–D","Leilões Prime"],
                    ["💥","Sinistro / Perda Total","Seguradoras"],
                    ["🏛️","Gravame / Alienação","SNG/BACEN"],
                    ["📈","Tabela FIPE + Histórico 12m","ConsultarPlaca"],
                  ].map(([e,l,s],i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:9,
                      padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:14, width:20, textAlign:"center", flexShrink:0 }}>{e}</span>
                      <div>
                        <div style={{ fontSize:12, color:C.text }}>{l}</div>
                        <div style={{ fontSize:10, color:C.faint }}>{s}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ RESULTADOS ══ */}
            {data && (
              <div className="fadeUp" style={{ display:"flex", flexDirection:"column", gap:12 }}>

                {/* Header veículo + FIPE em destaque */}
                <div style={{ background:`linear-gradient(135deg,${C.card},#0A1828)`,
                  border:`1px solid ${C.border}`, borderTop:`3px solid ${C.primary}`,
                  borderRadius:14, padding:"20px 22px" }}>
                  <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between",
                    alignItems:"flex-start", gap:16, marginBottom:fipePrincipal?18:0 }}>
                    <div>
                      <p style={{ fontSize:10, color:C.primary, fontWeight:700,
                        letterSpacing:"1.5px", margin:"0 0 4px" }}>VEÍCULO IDENTIFICADO</p>
                      <h2 style={{ fontSize:"clamp(18px,4vw,22px)", fontWeight:900,
                        letterSpacing:"-0.5px", margin:"0 0 4px" }}>
                        {val(data.cadastral.marca)} {val(data.cadastral.modelo) !== "Nenhuma informação disponível" ? data.cadastral.modelo : ""}
                      </h2>
                      <p style={{ fontSize:13, color:C.muted, margin:"0 0 12px" }}>
                        {val(data.cadastral.subSegmento)}
                      </p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        <Pill ok={data.leilao?.possuiRegistro === false} label="Sem Leilão"/>
                        <Pill ok={data.leilao?.possuiSinistro === false} label="Sem Sinistro"/>
                        <Pill ok={data.rouboFurto?.possuiRegistro === false} label="Sem Roubo/Furto"/>
                        <Pill ok={data.gravame?.possuiGravame === false} label="Sem Gravame"/>
                      </div>
                    </div>
                    <div style={{ background:C.plateBg, padding:"10px 22px", borderRadius:9,
                      flexShrink:0, color:C.plate, fontFamily:"monospace", fontWeight:900,
                      fontSize:"clamp(18px,4vw,24px)", letterSpacing:5,
                      boxShadow:`0 0 22px ${C.plateBg}55` }}>
                      {data.placa}
                    </div>
                  </div>

                  {/* FIPE — logo abaixo do nome */}
                  {fipePrincipal ? (
                    <div style={{ background:`${C.primary}0A`, border:`1px solid ${C.primary}25`,
                      borderRadius:12, padding:"16px 18px" }}>
                      <p style={{ fontSize:10, color:C.primary, fontWeight:700,
                        letterSpacing:"1.2px", margin:"0 0 12px" }}>TABELA FIPE</p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:14, alignItems:"flex-start" }}>
                        <div style={{ flex:1, minWidth:160 }}>
                          <div style={{ fontSize:"clamp(22px,5vw,30px)", fontWeight:900, color:C.green }}>
                            {fmt(fipePrincipal.preco)}
                          </div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{val(fipePrincipal.versao)}</div>
                          <div style={{ fontSize:10, color:C.faint, marginTop:1 }}>
                            Cód. {val(fipePrincipal.codigoFipe)} · Ref. {val(fipePrincipal.mesReferencia)}
                          </div>
                        </div>
                        {data.fipe.length > 1 && (
                          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                            + {data.fipe.length - 1} versões encontradas
                          </div>
                        )}
                      </div>
                      {fipePrincipal.historico?.length > 1 && (
                        <div style={{ marginTop:14 }}>
                          <p style={{ fontSize:10, color:C.muted, fontWeight:600,
                            letterSpacing:"0.5px", margin:"0 0 8px" }}>HISTÓRICO DE PREÇOS (12 MESES)</p>
                          <MiniChart data={fipePrincipal.historico}/>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background:`${C.faint}15`, border:`1px solid ${C.border}`,
                      borderRadius:10, padding:"12px 16px", display:"flex",
                      alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:16 }}>📈</span>
                      <span style={{ fontSize:13, color:C.muted }}>Nenhuma informação disponível para FIPE</span>
                    </div>
                  )}
                </div>

                {/* Grid de blocos */}
                <div style={{ display:"grid",
                  gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,290px),1fr))", gap:12 }}>

                  {/* Cadastral */}
                  <Blk title="📋 Dados de Registro" badge="DETRAN" bc={C.primary}>
                    {[
                      ["Marca",         val(data.cadastral.marca)],
                      ["Modelo",        val(data.cadastral.modelo)],
                      ["Cor",           val(data.cadastral.cor)],
                      ["Ano Fab./Modelo", `${val(data.cadastral.anoFab)} / ${val(data.cadastral.anoModelo)}`],
                      ["Combustível",   val(data.cadastral.combustivel)],
                      ["Procedência",   val(data.cadastral.procedencia)],
                      ["Município (UF)", `${val(data.cadastral.municipio)} (${val(data.cadastral.uf)})`],
                      ["Tipo de Veículo", val(data.cadastral.tipoVeiculo)],
                      ["Segmento",      val(data.cadastral.subSegmento)],
                      ["Motor",         val(data.cadastral.motor)],
                      ["Potência",      data.cadastral.potencia ? `${data.cadastral.potencia} cv` : "Nenhuma informação disponível"],
                      ["Chassi",        val(data.cadastral.chassi)],
                    ].map(([l,v]) => <IR key={l} label={l} value={v}/>)}
                  </Blk>

                  {/* Leilão */}
                  <Blk title="🏷️ Leilão" badge="Leilões Prime" bc={data.leilao?.possuiRegistro?C.red:C.green}>
                    <IR label="Passagem por Leilão"
                      value={bool(data.leilao?.possuiRegistro === false, "Não", "SIM — Ver abaixo")}
                      color={data.leilao?.possuiRegistro?C.red:C.green}/>
                    {data.leilao?.classificacao && (
                      <IR label="Classificação" value={`Grau ${data.leilao.classificacao}`}
                        color={C.amber}/>
                    )}
                    <IR label="Indício de Sinistro"
                      value={bool(data.leilao?.possuiSinistro === false, "Não", "SIM")}
                      color={data.leilao?.possuiSinistro?C.red:C.green}/>
                    {data.leilao?.registros?.length > 0 && (
                      <div style={{ marginTop:10 }}>
                        <p style={{ fontSize:10, color:C.muted, margin:"0 0 6px" }}>REGISTROS</p>
                        {data.leilao.registros.map((r,i) => (
                          <div key={i} style={{ padding:"8px 10px", marginBottom:6,
                            background:`${C.amber}08`, borderRadius:8,
                            border:`1px solid ${C.amber}20` }}>
                            <div style={{ fontSize:11, color:C.amber, fontWeight:600 }}>
                              {r.dataLeilao} · Lote {r.lote}
                            </div>
                            {r.comitente && <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{r.comitente}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {data.leilao?.possuiRegistro === null && (
                      <div style={{ marginTop:8, fontSize:12, color:C.faint }}>Nenhuma informação disponível</div>
                    )}
                  </Blk>

                  {/* Roubo e Furto */}
                  <Blk title="🚔 Roubo e Furto" badge="SINESP"
                    bc={data.rouboFurto?.possuiRegistro?C.red:C.green}>
                    <IR label="Histórico de Roubo/Furto"
                      value={bool(data.rouboFurto?.possuiRegistro === false, "Nenhuma ocorrência", "SIM — Ver abaixo")}
                      color={data.rouboFurto?.possuiRegistro?C.red:C.green}/>
                    {data.rouboFurto?.registros?.map((r,i) => (
                      <div key={i} style={{ marginTop:8, padding:"8px 10px",
                        background:`${C.red}08`, borderRadius:8, border:`1px solid ${C.red}20` }}>
                        <div style={{ fontSize:11, color:C.red, fontWeight:600 }}>{r.tipo}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{r.dataOcorrencia} · {r.uf}</div>
                      </div>
                    ))}
                    {data.rouboFurto?.possuiRegistro === null && (
                      <div style={{ fontSize:12, color:C.faint, marginTop:6 }}>Nenhuma informação disponível</div>
                    )}
                  </Blk>

                  {/* Gravame */}
                  <Blk title="🏛️ Gravame / Alienação" badge="SNG/BACEN"
                    bc={data.gravame?.possuiGravame?C.red:C.green}>
                    <IR label="Gravame Ativo"
                      value={bool(data.gravame?.possuiGravame === false, "Sem gravame", "SIM — Com gravame")}
                      color={data.gravame?.possuiGravame?C.red:C.green}/>
                    {data.gravame?.possuiGravame && (
                      <>
                        <IR label="Financiadora" value={val(data.gravame.financiadora)}/>
                        <IR label="Tipo de Contrato" value={val(data.gravame.tipoContrato)}/>
                        <IR label="Data de Inclusão" value={val(data.gravame.dataInclusao)}/>
                      </>
                    )}
                    {data.gravame?.possuiGravame === null && (
                      <div style={{ fontSize:12, color:C.faint, marginTop:6 }}>Nenhuma informação disponível</div>
                    )}
                  </Blk>

                  {/* Todas as versões FIPE */}
                  {data.fipe && data.fipe.length > 0 && (
                    <Blk title="📈 Versões FIPE" badge={`${data.fipe.length} versão(ões)`}
                      bc={C.primary} accent={C.primary}>
                      {data.fipe.map((f,i) => (
                        <div key={i} style={{ padding:"10px 0",
                          borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between",
                            alignItems:"center", gap:8 }}>
                            <div style={{ fontSize:12, color:C.text, fontWeight:500 }}>{f.versao}</div>
                            <div style={{ fontSize:14, fontWeight:800, color:C.green,
                              flexShrink:0 }}>{fmt(f.preco)}</div>
                          </div>
                          <div style={{ fontSize:10, color:C.faint, marginTop:2 }}>
                            Cód. {f.codigoFipe} · Ref. {f.mesReferencia}
                          </div>
                        </div>
                      ))}
                    </Blk>
                  )}

                </div>

                {/* Parecer — largura total */}
                <Blk title="🤖 Parecer Técnico — Placafy AI" badge="Análise" bc={C.purple} accent={C.purple}>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:20, alignItems:"flex-start" }}>
                    <Ring score={score}/>
                    <div style={{ flex:1, minWidth:240 }}>
                      <p style={{ fontSize:11, color:C.muted, margin:"0 0 12px" }}>
                        Score calculado com base nos dados reais retornados pela consulta.
                        Nenhum dado estimado ou fictício.
                      </p>
                      {[
                        { ok:data.leilao?.possuiRegistro===false,
                          msg: data.leilao?.possuiRegistro===null
                            ? "Leilão: sem informação disponível"
                            : data.leilao?.possuiRegistro
                            ? `Passou por leilão (grau ${data.leilao.classificacao||"—"})`
                            : "Sem registro de leilão" },
                        { ok:data.leilao?.possuiSinistro===false,
                          msg: data.leilao?.possuiSinistro===null
                            ? "Sinistro: sem informação disponível"
                            : data.leilao?.possuiSinistro
                            ? "Sinistro com perda total registrado"
                            : "Sem sinistro registrado" },
                        { ok:data.rouboFurto?.possuiRegistro===false,
                          msg: data.rouboFurto?.possuiRegistro===null
                            ? "Roubo/Furto: sem informação disponível"
                            : data.rouboFurto?.possuiRegistro
                            ? "Histórico de roubo ou furto encontrado"
                            : "Sem histórico de roubo ou furto" },
                        { ok:data.gravame?.possuiGravame===false,
                          msg: data.gravame?.possuiGravame===null
                            ? "Gravame: sem informação disponível"
                            : data.gravame?.possuiGravame
                            ? `Gravame ativo — ${val(data.gravame.financiadora)}`
                            : "Sem gravame — livre para transferência" },
                      ].map((p,i) => (
                        <div key={i} style={{ display:"flex", gap:9, padding:"6px 0",
                          borderBottom:`1px solid ${C.border}` }}>
                          <span style={{ color:p.ok?C.green:p.ok===false?C.red:C.faint,
                            fontSize:12, flexShrink:0, marginTop:1 }}>
                            {p.ok===true?"✓":p.ok===false?"✗":"—"}
                          </span>
                          <span style={{ fontSize:12, color:C.text, lineHeight:1.45 }}>{p.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Blk>

              </div>
            )}
          </div>
        )}

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.5px", margin:0 }}>Dashboard</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:12 }}>
              {[
                { l:"Consultas",    v:historico.length, sub:"nesta sessão",    col:C.primary },
                { l:"Alertas",      v:historico.filter(h=>h.score<60).length, sub:"score baixo", col:C.red },
                { l:"Sem Leilão",   v:historico.length, sub:"verificados",     col:C.green },
              ].map((s,i) => (
                <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`,
                  borderLeft:`3px solid ${s.col}`, borderRadius:12, padding:"16px 18px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{s.l}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:s.col }}>{s.v}</div>
                  <div style={{ fontSize:10, color:C.faint, marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <Blk title="Histórico de Consultas" badge="Sessão atual" bc={C.primary}>
              {historico.length === 0 ? (
                <p style={{ fontSize:13, color:C.faint, textAlign:"center", padding:"20px 0" }}>
                  Nenhuma consulta realizada ainda.
                </p>
              ) : historico.map((h,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 0", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap" }}>
                  <div style={{ background:C.plateBg, color:C.plate, fontFamily:"monospace",
                    fontWeight:700, fontSize:11, letterSpacing:2,
                    padding:"3px 9px", borderRadius:5, flexShrink:0 }}>{h.placa}</div>
                  <div style={{ flex:1, minWidth:130 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>
                      {val(h.marca)} {h.modelo || ""}
                    </div>
                    <div style={{ fontSize:10, color:C.faint }}>
                      {new Date(h.consultadoEm).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, padding:"3px 10px",
                    borderRadius:20, flexShrink:0,
                    background:h.score>=80?"#00E09A14":h.score>=60?"#FFB54714":"#FF4F6B14",
                    color:h.score>=80?C.green:h.score>=60?C.amber:C.red }}>Score {h.score}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => { setPlaca(h.placa); setTab("consulta"); }} style={{
                      fontSize:11, fontWeight:600, color:C.primary,
                      background:`${C.primary}12`, border:`1px solid ${C.primary}25`,
                      borderRadius:7, padding:"4px 11px", cursor:"pointer" }}>Abrir</button>
                  </div>
                </div>
              ))}
              {historico.length > 0 && (
                <button onClick={() => setHistorico([])} style={{
                  marginTop:12, fontSize:12, color:C.red, background:`${C.red}0A`,
                  border:`1px solid ${C.red}25`, borderRadius:7, padding:"6px 14px",
                  cursor:"pointer", fontWeight:600 }}>
                  🗑️ Excluir histórico da sessão
                </button>
              )}
            </Blk>
          </div>
        )}

        {/* ══ PRIVACIDADE ══ */}
        {tab === "privacidade" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:720 }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:0 }}>Privacidade e LGPD</h2>
            {[
              {
                titulo:"📋 Quais dados coletamos?",
                corpo:"Apenas a placa digitada por você para fins de consulta. Não coletamos nome, CPF, endereço ou qualquer dado pessoal identificável.",
              },
              {
                titulo:"🔒 Como protegemos sua chave de API?",
                corpo:"A API Key da ConsultarPlaca existe EXCLUSIVAMENTE no servidor backend (NestJS). Ela nunca trafega para o browser. A autenticação é feita por Basic Auth server-side.",
              },
              {
                titulo:"💾 Cache e armazenamento",
                corpo:"Resultados são armazenados em cache por 24 horas para otimizar consultas. Os dados são excluídos automaticamente após este período.",
              },
              {
                titulo:"⚖️ Lei 13.709/2018 (LGPD)",
                corpo:"Cumprimos integralmente a Lei Geral de Proteção de Dados. Você tem direito ao acesso, correção e exclusão dos seus dados a qualquer momento.",
              },
              {
                titulo:"🗑️ Excluir meus dados",
                corpo:"Para excluir seu histórico de consultas desta sessão, acesse a aba Dashboard e clique em 'Excluir histórico da sessão'. Para exclusão de dados do servidor, entre em contato com nosso suporte.",
              },
            ].map((item,i) => (
              <Blk key={i} title={item.titulo} bc={C.primary}>
                <p style={{ fontSize:13, color:C.muted, lineHeight:1.7, margin:0 }}>{item.corpo}</p>
              </Blk>
            ))}
          </div>
        )}

        {/* ══ PLANOS ══ */}
        {tab === "planos" && (
          <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
            <div style={{ textAlign:"center" }}>
              <h2 style={{ fontSize:"clamp(22px,5vw,28px)", fontWeight:900,
                letterSpacing:"-1px", margin:"0 0 8px" }}>Planos Placafy</h2>
              <p style={{ color:C.muted, fontSize:14, margin:0 }}>
                Do revendedor individual à concessionária com API.
              </p>
            </div>
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,260px),1fr))",
              gap:14, maxWidth:880, margin:"0 auto", width:"100%" }}>
              {[
                { nome:"Starter", preco:"R$ 0", periodo:"para sempre", cor:C.muted,
                  destaque:false, desc:"Para conhecer a plataforma",
                  inclui:["5 consultas/mês","Dados cadastrais","FIPE atual","Score de análise"],
                  nao:["Histórico completo de leilão","Sinistro + Gravame","Exportar PDF","API"] },
                { nome:"Profissional", preco:"R$ 97", periodo:"/mês", cor:C.primary,
                  destaque:true, desc:"Para revendedores ativos",
                  inclui:["Consultas ilimitadas","Dados reais: DETRAN + SINESP + SENATRAN",
                    "Leilão com classificação A–D","Sinistro / Perda Total",
                    "Gravame / Alienação","FIPE + histórico 12m","Score de análise",
                    "Cache 24h","Suporte prioritário"],nao:[] },
                { nome:"Empresa", preco:"R$ 347", periodo:"/mês", cor:C.purple,
                  destaque:false, desc:"Para concessionárias e frotas",
                  inclui:["Tudo do Profissional","Até 15 usuários","API REST dedicada",
                    "Webhook de alertas","Dashboard multi-usuário","Integração ERP/CRM",
                    "SLA 99.9%","Suporte dedicado"],nao:[] },
              ].map((p,i) => (
                <div key={i} style={{
                  background:p.destaque?`linear-gradient(160deg,${C.primary}0C,${C.card})`:C.card,
                  border:`1px solid ${p.destaque?C.primary+"45":C.border}`,
                  borderRadius:16, padding:"22px 20px", position:"relative",
                  boxShadow:p.destaque?`0 8px 32px ${C.primary}14`:"none" }}>
                  {p.destaque && (
                    <div style={{ position:"absolute", top:-1, left:"50%",
                      transform:"translateX(-50%)", background:C.primary, color:"#fff",
                      fontSize:9, fontWeight:700, padding:"3px 16px",
                      borderRadius:"0 0 8px 8px", letterSpacing:1, whiteSpace:"nowrap" }}>
                      MAIS POPULAR
                    </div>
                  )}
                  <div style={{ marginBottom:16, marginTop:p.destaque?10:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:p.cor,
                      marginBottom:4 }}>{p.nome.toUpperCase()}</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:4 }}>
                      <span style={{ fontSize:"clamp(24px,5vw,30px)", fontWeight:900 }}>{p.preco}</span>
                      <span style={{ fontSize:12, color:C.muted }}>{p.periodo}</span>
                    </div>
                    <div style={{ fontSize:12, color:C.muted }}>{p.desc}</div>
                  </div>
                  <button style={{ width:"100%",
                    background:p.destaque?C.primary:"transparent",
                    color:p.destaque?"#fff":p.cor, border:`2px solid ${p.cor}`,
                    borderRadius:9, padding:"10px 0", fontWeight:700, fontSize:13,
                    cursor:"pointer", marginBottom:14 }}>
                    {p.nome==="Starter"?"Começar Grátis":`Assinar ${p.nome}`}
                  </button>
                  {p.inclui.map((it,j) => (
                    <div key={j} style={{ display:"flex", gap:8, padding:"5px 0",
                      borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ color:C.green, fontSize:11, flexShrink:0 }}>✓</span>
                      <span style={{ fontSize:12 }}>{it}</span>
                    </div>
                  ))}
                  {p.nao.map((it,j) => (
                    <div key={j} style={{ display:"flex", gap:8, padding:"5px 0",
                      borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ color:C.faint, fontSize:11, flexShrink:0 }}>✗</span>
                      <span style={{ fontSize:12, color:C.faint }}>{it}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p style={{ textAlign:"center", fontSize:12, color:C.faint, margin:0 }}>
              PIX · Cartão · Boleto · Cancelamento imediato · Dados protegidos pela LGPD
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
