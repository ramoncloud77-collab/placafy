import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import axios, { AxiosInstance } from "axios";
import NodeCache from "node-cache";

const PORT     = process.env.PORT                  || 3001;
const EMAIL    = process.env.CONSULTAR_PLACA_EMAIL || "";
const API_KEY  = process.env.CONSULTAR_PLACA_KEY   || "";
const FIPE_TOKEN = process.env.FIPE_TOKEN          || "";
const BASE_URL = "https://api.consultarplaca.com.br/v2";
const FIPE_URL = "https://fipe.parallelum.com.br/api/v2";
const FRONTEND = process.env.FRONTEND_URL          || "http://localhost:3000";

if (!EMAIL || !API_KEY) {
  console.error("❌ CONSULTAR_PLACA_EMAIL e CONSULTAR_PLACA_KEY são obrigatórios no .env");
  process.exit(1);
}

const AUTH_CP = "Basic " + Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");

// Cache 24h — evita cobrar 2x pela mesma placa
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

const apiCP: AxiosInstance = axios.create({
  baseURL: BASE_URL, timeout: 30000,
  headers: { Authorization: AUTH_CP, "Content-Type": "application/json", Accept: "application/json" },
});

// FIPE com token se disponível, sem token se não tiver
const fipeHeaders: Record<string, string> = { Accept: "application/json" };
if (FIPE_TOKEN) fipeHeaders["X-Subscription-Token"] = FIPE_TOKEN;

const apiFIPE: AxiosInstance = axios.create({
  baseURL: FIPE_URL, timeout: 20000, headers: fipeHeaders,
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchCP(endpoint: string, placa: string, tentativa = 1): Promise<any> {
  try {
    const res = await apiCP.get(endpoint, { params: { placa } });
    console.log(`✅ CONSULTARPLACA RESPONSE [${endpoint}] placa=${placa}`);
    console.log(JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 429 && tentativa < 3) {
      console.warn(`⚠️  429 em ${endpoint}. Tentativa ${tentativa}/3. Aguardando 3s...`);
      await sleep(3000);
      return fetchCP(endpoint, placa, tentativa + 1);
    }
    console.error(`❌ [${endpoint}] status=${status} msg=${err.message}`);
    return null;
  }
}

async function buscarFIPE(marca: string, modelo: string, anoFab: number): Promise<any> {
  try {
    const brandsRes = await apiFIPE.get("/cars/brands");
    const brands = brandsRes.data;
    const marcaNorm = marca.toLowerCase().replace(/[^a-z0-9]/g, "");
    const brand = brands.find((b: any) => {
      const bn = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return bn.includes(marcaNorm.slice(0, 5)) || marcaNorm.includes(bn.slice(0, 5));
    });
    if (!brand) return null;

    const modelsRes = await apiFIPE.get(`/cars/brands/${brand.code}/models`);
    const models = Array.isArray(modelsRes.data) ? modelsRes.data : (modelsRes.data.models || []);
    const modeloNorm = modelo.toLowerCase().replace(/[^a-z0-9]/g, "");
    const model = models.find((m: any) => {
      const mn = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return mn.includes(modeloNorm.slice(0, 6)) || modeloNorm.includes(mn.slice(0, 6));
    });
    if (!model) return null;

    const yearsRes = await apiFIPE.get(`/cars/brands/${brand.code}/models/${model.code}/years`);
    const years = yearsRes.data;
    const tgt = String(anoFab);
    const year = years.find((y: any) => y.code?.startsWith(tgt))
              || years.find((y: any) => y.code?.startsWith(String(Number(tgt) + 1)))
              || years[0];
    if (!year) return null;

    const detailRes = await apiFIPE.get(
      `/cars/brands/${brand.code}/models/${model.code}/years/${year.code}`
    );
    const detail = detailRes.data;
    const parsePrice = (s: any) => {
      if (!s) return 0;
      if (typeof s === "number") return s;
      return parseFloat(String(s).replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    };
    const valorAtual = parsePrice(detail.price);
    const historico = (detail.priceHistory || [])
      .slice(-12)
      .map((h: any) => ({ mes: h.month || "", valor: parsePrice(h.price) }))
      .filter((h: any) => h.valor > 0);

    console.log(`✅ FIPE: ${marca} ${modelo} → ${valorAtual}`);
    return { codigoFipe: detail.codeFipe || "—", versao: detail.model || modelo,
             preco: valorAtual, mesReferencia: detail.referenceMonth || "—", historico };
  } catch (err: any) {
    console.error(`❌ FIPE erro: ${err.message}`);
    return null;
  }
}

// ─── NORMALIZAÇÃO ─────────────────────────────────────────────────────────────
function normCadastral(raw: any) {
  const v = raw?.dados?.informacoes_veiculo?.dados_veiculo;
  const t = raw?.dados?.informacoes_veiculo?.dados_tecnicos;
  if (!v) return null;
  return {
    placa: v.placa??null, marca: v.marca??null, modelo: v.modelo??null,
    cor: v.cor??null, anoFab: v.ano_fabricacao??null, anoModelo: v.ano_modelo??null,
    municipio: v.municipio??null, uf: v.uf_municipio??null,
    combustivel: v.combustivel??null, procedencia: v.procedencia??null,
    motor: t?.numero_motor??null, potencia: t?.potencia??null,
    tipoVeiculo: t?.tipo_veiculo??null, subSegmento: t?.sub_segmento??null,
    chassi: v.chassi??null,
  };
}
function normGravame(raw: any) {
  const g = raw?.dados?.gravame;
  if (!g) return null;
  return {
    possuiGravame: g.possui_gravame==="sim"?true:g.possui_gravame==="nao"?false:null,
    agenteFinanceiro: g.registro?.agente_financeiro?.nome??null,
    cnpj: g.registro?.agente_financeiro?.cnpj??null,
    dataRegistro: g.registro?.data_registro??null, situacao: g.registro?.situacao??null,
  };
}
function normRoubo(raw: any) {
  const info = raw?.dados?.historico_roubo_furto;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro==="sim"?true:info.possui_registro==="nao"?false:null,
    registros: (info.registros??[]).map((r: any) => ({
      dataOcorrencia: r.data_ocorrencia, uf: r.uf, tipo: r.tipo,
    })),
  };
}
function normLeilao(raw: any) {
  const info = raw?.dados?.informacoes_sobre_leilao;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro==="sim"?true:info.possui_registro==="nao"?false:null,
    classificacao: info.registro_sobre_oferta?.classificacao??null,
    registros: (info.registro_leiloes?.registros??[]).map((r: any) => ({
      comitente: r.comitente, lote: r.lote, dataLeilao: r.data_leilao, anoFabricacao: r.ano_fabricacao,
    })),
  };
}
function normSinistro(raw: any) {
  const info = raw?.dados?.registro_sinistro_com_perda_total;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro==="sim"?true:info.possui_registro==="nao"?false:null,
    descricao: info.registro||null,
  };
}

const PLACA_REGEX = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

const app = express();
app.use(helmet());
app.use(cors({ origin: FRONTEND, methods: ["GET"] }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 60, skip: (req) => req.path === "/health" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── SIMPLES: R$ 0,31 (com cache — não cobra 2x) ─────────────────────────────
app.get("/api/veiculo/simples/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PLACA_REGEX.test(placa))
    return res.status(400).json({ message: "Placa inválida.", code: "FORMATO_INVALIDO" });

  // CACHE — se já consultou hoje, retorna sem cobrar nada
  const cacheKey = `simples:${placa}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`📦 CACHE HIT simples:${placa} — R$ 0,00 (sem nova cobrança)`);
    return res.json(cached);
  }

  console.log(`🔍 [SIMPLES] placa=${placa} — R$ 0,31`);
  const cadastralRaw = await fetchCP("/consultarPlaca", placa);
  const cadastral = normCadastral(cadastralRaw);
  if (!cadastral)
    return res.status(404).json({ message: "Veículo não encontrado.", code: "NAO_ENCONTRADO" });

  const anoFab = parseInt(cadastral.anoFab || "0");
  const fipe = (cadastral.marca && cadastral.modelo)
    ? await buscarFIPE(cadastral.marca, cadastral.modelo, anoFab)
    : null;

  const resultado = {
    tipo: "simples", placa, consultadoEm: new Date().toISOString(),
    cadastral, fipe: fipe ? [fipe] : null,
  };

  // Salva no cache 24h
  cache.set(cacheKey, resultado);
  console.log(`💾 Cache salvo: simples:${placa} (24h)`);
  return res.json(resultado);
});

// ─── INTERMEDIÁRIA: R$ 11,81 (com cache) ─────────────────────────────────────
app.get("/api/veiculo/intermediaria/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PLACA_REGEX.test(placa))
    return res.status(400).json({ message: "Placa inválida.", code: "FORMATO_INVALIDO" });

  const cacheKey = `inter:${placa}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`📦 CACHE HIT inter:${placa} — R$ 0,00`);
    return res.json(cached);
  }

  console.log(`🔍 [INTERMEDIÁRIA] placa=${placa} — R$ 11,81`);
  const cadastralRaw = await fetchCP("/consultarPlaca", placa);
  const cadastral = normCadastral(cadastralRaw);
  if (!cadastral)
    return res.status(404).json({ message: "Veículo não encontrado.", code: "NAO_ENCONTRADO" });

  const anoFab = parseInt(cadastral.anoFab || "0");
  const [fipeRaw, gravameRaw, rouboRaw] = await Promise.allSettled([
    (cadastral.marca && cadastral.modelo)
      ? buscarFIPE(cadastral.marca, cadastral.modelo, anoFab)
      : Promise.resolve(null),
    fetchCP("/consultarGravame", placa),
    fetchCP("/consultarHistoricoRouboFurto", placa),
  ]);

  const resultado = {
    tipo: "intermediaria", placa, consultadoEm: new Date().toISOString(), cadastral,
    fipe:       fipeRaw.status    ==="fulfilled" && fipeRaw.value ? [fipeRaw.value] : null,
    gravame:    gravameRaw.status ==="fulfilled" ? normGravame(gravameRaw.value)   : null,
    rouboFurto: rouboRaw.status   ==="fulfilled" ? normRoubo(rouboRaw.value)      : null,
  };

  cache.set(cacheKey, resultado);
  console.log(`💾 Cache salvo: inter:${placa} (24h)`);
  return res.json(resultado);
});

// ─── AVANÇADA: (com cache) ────────────────────────────────────────────────────
app.get("/api/veiculo/avancada/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PLACA_REGEX.test(placa))
    return res.status(400).json({ message: "Placa inválida.", code: "FORMATO_INVALIDO" });

  const cacheKey = `avancada:${placa}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`📦 CACHE HIT avancada:${placa} — R$ 0,00`);
    return res.json(cached);
  }

  console.log(`🔍 [AVANÇADA] placa=${placa}`);
  const cadastralRaw = await fetchCP("/consultarPlaca", placa);
  const cadastral = normCadastral(cadastralRaw);
  if (!cadastral)
    return res.status(404).json({ message: "Veículo não encontrado.", code: "NAO_ENCONTRADO" });

  const anoFab = parseInt(cadastral.anoFab || "0");
  const [fipeRaw, gravameRaw, rouboRaw, leilaoRaw, sinistroRaw] = await Promise.allSettled([
    (cadastral.marca && cadastral.modelo)
      ? buscarFIPE(cadastral.marca, cadastral.modelo, anoFab)
      : Promise.resolve(null),
    fetchCP("/consultarGravame", placa),
    fetchCP("/consultarHistoricoRouboFurto", placa),
    fetchCP("/consultarRegistroLeilaoPrime", placa),
    fetchCP("/consultarSinistroComPerdaTotal", placa),
  ]);

  const resultado = {
    tipo: "avancada", placa, consultadoEm: new Date().toISOString(), cadastral,
    fipe:       fipeRaw.status     ==="fulfilled" && fipeRaw.value ? [fipeRaw.value] : null,
    gravame:    gravameRaw.status  ==="fulfilled" ? normGravame(gravameRaw.value)   : null,
    rouboFurto: rouboRaw.status    ==="fulfilled" ? normRoubo(rouboRaw.value)      : null,
    leilao:     leilaoRaw.status   ==="fulfilled" ? normLeilao(leilaoRaw.value)    : null,
    sinistro:   sinistroRaw.status ==="fulfilled" ? normSinistro(sinistroRaw.value) : null,
  };

  cache.set(cacheKey, resultado);
  console.log(`💾 Cache salvo: avancada:${placa} (24h)`);
  return res.json(resultado);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Placafy Backend em http://localhost:${PORT}`);
  console.log(`💾 Cache 24h ativo — mesma placa não cobra 2x`);
  console.log(`📋 Teste: http://localhost:${PORT}/api/veiculo/simples/AAA0000\n`);
});
