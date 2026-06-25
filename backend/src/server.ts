import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import axios, { AxiosInstance } from "axios";
import NodeCache from "node-cache";

const PORT     = process.env.PORT     || 3001;
const EMAIL    = process.env.CONSULTAR_PLACA_EMAIL || "";
const API_KEY  = process.env.CONSULTAR_PLACA_KEY  || "";
const BASE_URL = "https://api.consultarplaca.com.br/v2";
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";

if (!EMAIL || !API_KEY) {
  console.error("❌ CONSULTAR_PLACA_EMAIL e CONSULTAR_PLACA_KEY são obrigatórios no .env");
  process.exit(1);
}

const AUTH = "Basic " + Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");
const cacheSimples      = new NodeCache({ stdTTL: 86400 });
const cacheIntermediaria = new NodeCache({ stdTTL: 86400 });
const cacheAvancada      = new NodeCache({ stdTTL: 86400 });

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { Authorization: AUTH, "Content-Type": "application/json", Accept: "application/json" },
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchRetry(endpoint: string, placa: string, tentativa = 1): Promise<any> {
  try {
    const res = await api.get(endpoint, { params: { placa } });
    console.log(`✅ [${endpoint}] placa=${placa}`);
    console.log(JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 429 && tentativa < 3) {
      console.warn(`⚠️  429 em ${endpoint}. Tentativa ${tentativa}/3. Aguardando 3s...`);
      await sleep(3000);
      return fetchRetry(endpoint, placa, tentativa + 1);
    }
    console.error(`❌ [${endpoint}] status=${status}`);
    return null;
  }
}

// ─── NORMALIZAÇÃO ─────────────────────────────────────────────────────────────
function normCadastral(raw: any) {
  const v = raw?.dados?.informacoes_veiculo?.dados_veiculo;
  const t = raw?.dados?.informacoes_veiculo?.dados_tecnicos;
  if (!v) return null;
  return {
    placa: v.placa ?? null, marca: v.marca ?? null, modelo: v.modelo ?? null,
    cor: v.cor ?? null, anoFab: v.ano_fabricacao ?? null, anoModelo: v.ano_modelo ?? null,
    municipio: v.municipio ?? null, uf: v.uf_municipio ?? null,
    combustivel: v.combustivel ?? null, procedencia: v.procedencia ?? null,
    motor: t?.numero_motor ?? null, potencia: t?.potencia ?? null,
    tipoVeiculo: t?.tipo_veiculo ?? null, subSegmento: t?.sub_segmento ?? null,
    chassi: v.chassi ?? null,
  };
}

function normFipe(raw: any) {
  const fipes = raw?.dados?.informacoes_fipe;
  if (!fipes?.length) return null;
  return fipes.map((f: any) => {
    const historico = Object.entries(f.historico || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes: mes.replace("_", "/"), valor: parseFloat(valor as string) || 0 }));
    return {
      codigoFipe: f.codigo_fipe, versao: f.modelo_versao,
      preco: parseFloat(f.preco) || 0, mesReferencia: f.mes_referencia, historico,
    };
  });
}

function normGravame(raw: any) {
  const g = raw?.dados?.gravame;
  if (!g) return null;
  return {
    possuiGravame: g.possui_gravame === "sim" ? true : g.possui_gravame === "nao" ? false : null,
    agenteFinanceiro: g.registro?.agente_financeiro?.nome ?? null,
    cnpj: g.registro?.agente_financeiro?.cnpj ?? null,
    dataRegistro: g.registro?.data_registro ?? null,
    situacao: g.registro?.situacao ?? null,
  };
}

function normRoubo(raw: any) {
  const info = raw?.dados?.historico_roubo_furto;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro === "sim" ? true : info.possui_registro === "nao" ? false : null,
    registros: (info.registros ?? []).map((r: any) => ({
      dataOcorrencia: r.data_ocorrencia, uf: r.uf, tipo: r.tipo,
    })),
  };
}

function normLeilao(raw: any) {
  const info = raw?.dados?.informacoes_sobre_leilao;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro === "sim" ? true : info.possui_registro === "nao" ? false : null,
    classificacao: info.registro_sobre_oferta?.classificacao ?? null,
    registros: (info.registro_leiloes?.registros ?? []).map((r: any) => ({
      comitente: r.comitente, lote: r.lote, dataLeilao: r.data_leilao, anoFabricacao: r.ano_fabricacao,
    })),
  };
}

function normSinistro(raw: any) {
  const info = raw?.dados?.registro_sinistro_com_perda_total;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro === "sim" ? true : info.possui_registro === "nao" ? false : null,
    descricao: info.registro || null,
  };
}

const PLACA_REGEX = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

const app = express();
app.use(helmet());
app.use(cors({ origin: FRONTEND, methods: ["GET"] }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── SIMPLES: dados básicos + FIPE (R$ 0,31 + R$ 0,99 = R$ 1,30) ────────────
app.get("/api/veiculo/simples/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PLACA_REGEX.test(placa)) return res.status(400).json({ message: "Placa inválida.", code: "FORMATO_INVALIDO" });

  const cached = cacheSimples.get(placa);
  if (cached) { console.log(`📦 CACHE SIMPLES: ${placa}`); return res.json(cached); }

  console.log(`🔍 [SIMPLES] placa=${placa}`);
  const [cadastralRaw, fipeRaw] = await Promise.allSettled([
    fetchRetry("/consultarPlaca", placa),
    fetchRetry("/consultarPrecoFipe", placa),
  ]);

  const cadastral = cadastralRaw.status === "fulfilled" ? normCadastral(cadastralRaw.value) : null;
  if (!cadastral) return res.status(404).json({ message: "Veículo não encontrado.", code: "NAO_ENCONTRADO" });

  const resultado = {
    tipo: "simples", placa, consultadoEm: new Date().toISOString(), cadastral,
    fipe: fipeRaw.status === "fulfilled" ? normFipe(fipeRaw.value) : null,
  };

  cacheSimples.set(placa, resultado);
  return res.json(resultado);
});

// ─── INTERMEDIÁRIA: + gravame + roubo/furto (R$ 4,60 + R$ 6,90) ──────────────
app.get("/api/veiculo/intermediaria/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PLACA_REGEX.test(placa)) return res.status(400).json({ message: "Placa inválida.", code: "FORMATO_INVALIDO" });

  const cached = cacheIntermediaria.get(placa);
  if (cached) { console.log(`📦 CACHE INTERMEDIÁRIA: ${placa}`); return res.json(cached); }

  console.log(`🔍 [INTERMEDIÁRIA] placa=${placa}`);
  const [cadastralRaw, fipeRaw, gravameRaw, rouboRaw] = await Promise.allSettled([
    fetchRetry("/consultarPlaca", placa),
    fetchRetry("/consultarPrecoFipe", placa),
    fetchRetry("/consultarGravame", placa),
    fetchRetry("/consultarHistoricoRouboFurto", placa),
  ]);

  const cadastral = cadastralRaw.status === "fulfilled" ? normCadastral(cadastralRaw.value) : null;
  if (!cadastral) return res.status(404).json({ message: "Veículo não encontrado.", code: "NAO_ENCONTRADO" });

  const resultado = {
    tipo: "intermediaria", placa, consultadoEm: new Date().toISOString(), cadastral,
    fipe:      fipeRaw.status    === "fulfilled" ? normFipe(fipeRaw.value)     : null,
    gravame:   gravameRaw.status === "fulfilled" ? normGravame(gravameRaw.value) : null,
    rouboFurto:rouboRaw.status   === "fulfilled" ? normRoubo(rouboRaw.value)   : null,
  };

  cacheIntermediaria.set(placa, resultado);
  return res.json(resultado);
});

// ─── AVANÇADA: + leilão + sinistro (R$ 16,90 + sinistro) ─────────────────────
app.get("/api/veiculo/avancada/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PLACA_REGEX.test(placa)) return res.status(400).json({ message: "Placa inválida.", code: "FORMATO_INVALIDO" });

  const cached = cacheAvancada.get(placa);
  if (cached) { console.log(`📦 CACHE AVANÇADA: ${placa}`); return res.json(cached); }

  console.log(`🔍 [AVANÇADA] placa=${placa}`);
  const [cadastralRaw, fipeRaw, gravameRaw, rouboRaw, leilaoRaw, sinistroRaw] = await Promise.allSettled([
    fetchRetry("/consultarPlaca", placa),
    fetchRetry("/consultarPrecoFipe", placa),
    fetchRetry("/consultarGravame", placa),
    fetchRetry("/consultarHistoricoRouboFurto", placa),
    fetchRetry("/consultarRegistroLeilaoPrime", placa),
    fetchRetry("/consultarSinistroComPerdaTotal", placa),
  ]);

  const cadastral = cadastralRaw.status === "fulfilled" ? normCadastral(cadastralRaw.value) : null;
  if (!cadastral) return res.status(404).json({ message: "Veículo não encontrado.", code: "NAO_ENCONTRADO" });

  const resultado = {
    tipo: "avancada", placa, consultadoEm: new Date().toISOString(), cadastral,
    fipe:       fipeRaw.status     === "fulfilled" ? normFipe(fipeRaw.value)       : null,
    gravame:    gravameRaw.status  === "fulfilled" ? normGravame(gravameRaw.value)  : null,
    rouboFurto: rouboRaw.status    === "fulfilled" ? normRoubo(rouboRaw.value)     : null,
    leilao:     leilaoRaw.status   === "fulfilled" ? normLeilao(leilaoRaw.value)   : null,
    sinistro:   sinistroRaw.status === "fulfilled" ? normSinistro(sinistroRaw.value): null,
  };

  cacheAvancada.set(placa, resultado);
  return res.json(resultado);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Placafy Backend rodando em http://localhost:${PORT}`);
  console.log(`📋 Simples:       http://localhost:${PORT}/api/veiculo/simples/AAA0000`);
  console.log(`📋 Intermediária: http://localhost:${PORT}/api/veiculo/intermediaria/AAA0000`);
  console.log(`📋 Avançada:      http://localhost:${PORT}/api/veiculo/avancada/AAA0000\n`);
});
