import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import axios, { AxiosInstance } from "axios";
import NodeCache from "node-cache";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT     = process.env.PORT     || 3001;
const EMAIL    = process.env.CONSULTAR_PLACA_EMAIL || "";
const API_KEY  = process.env.CONSULTAR_PLACA_KEY  || "";
const BASE_URL = "https://api.consultarplaca.com.br/v2";
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";

if (!EMAIL || !API_KEY) {
  console.error("❌ CONSULTAR_PLACA_EMAIL e CONSULTAR_PLACA_KEY são obrigatórios no .env");
  process.exit(1);
}

// Basic Auth — NUNCA exposto ao frontend
const AUTH_HEADER = "Basic " + Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");

// Cache em memória 24 horas
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// ─── HTTP CLIENT ──────────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    Authorization: AUTH_HEADER,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── RETRY COM ESPERA ─────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchComRetry(endpoint: string, placa: string, tentativa = 1): Promise<any> {
  try {
    const res = await api.get(endpoint, { params: { placa } });
    console.log(`✅ CONSULTARPLACA RESPONSE [${endpoint}]:`);
    console.log(JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 429 && tentativa < 3) {
      console.warn(`⚠️  429 Rate Limit em ${endpoint}. Tentativa ${tentativa}/3. Aguardando 3s...`);
      await sleep(3000);
      return fetchComRetry(endpoint, placa, tentativa + 1);
    }
    console.error(`❌ ERRO [${endpoint}] status=${status} msg=${err.message}`);
    return null; // não quebra as outras consultas paralelas
  }
}

// ─── NORMALIZAÇÃO ─────────────────────────────────────────────────────────────
function normalizarCadastral(raw: any) {
  const v = raw?.dados?.informacoes_veiculo?.dados_veiculo;
  const t = raw?.dados?.informacoes_veiculo?.dados_tecnicos;
  if (!v) return null;
  return {
    placa:       v.placa        ?? null,
    marca:       v.marca        ?? null,
    modelo:      v.modelo       ?? null,
    cor:         v.cor          ?? null,
    anoFab:      v.ano_fabricacao ?? null,
    anoModelo:   v.ano_modelo   ?? null,
    municipio:   v.municipio    ?? null,
    uf:          v.uf_municipio ?? null,
    combustivel: v.combustivel  ?? null,
    procedencia: v.procedencia  ?? null,
    motor:       t?.numero_motor ?? null,
    potencia:    t?.potencia     ?? null,
    tipoVeiculo: t?.tipo_veiculo ?? null,
    subSegmento: t?.sub_segmento ?? null,
    chassi:      v.chassi        ?? null,
  };
}

function normalizarFipe(raw: any) {
  const fipes = raw?.dados?.informacoes_fipe;
  if (!fipes?.length) return null;
  return fipes.map((f: any) => {
    const historico = Object.entries(f.historico || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({
        mes: mes.replace("_", "/"),
        valor: parseFloat(valor as string) || 0,
      }));
    return {
      codigoFipe:    f.codigo_fipe,
      versao:        f.modelo_versao,
      preco:         parseFloat(f.preco) || 0,
      mesReferencia: f.mes_referencia,
      historico,
    };
  });
}

function normalizarLeilao(raw: any) {
  const info = raw?.dados?.informacoes_sobre_leilao;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro === "sim" ? true
                  : info.possui_registro === "nao" ? false : null,
    classificacao: info.registro_sobre_oferta?.classificacao ?? null,
    registros: (info.registro_leiloes?.registros ?? []).map((r: any) => ({
      comitente:     r.comitente,
      lote:          r.lote,
      dataLeilao:    r.data_leilao,
      anoFabricacao: r.ano_fabricacao,
    })),
    possuiSinistro: info.registro_sinistros_acidentes?.possui_registro === "sim" ? true
                  : info.registro_sinistros_acidentes?.possui_registro === "nao" ? false : null,
  };
}

function normalizarRoubo(raw: any) {
  const info = raw?.dados?.historico_roubo_furto;
  if (!info) return null;
  return {
    possuiRegistro: info.possui_registro === "sim" ? true
                  : info.possui_registro === "nao" ? false : null,
    registros: (info.registros ?? []).map((r: any) => ({
      dataOcorrencia: r.data_ocorrencia,
      uf:   r.uf,
      tipo: r.tipo,
    })),
  };
}

function normalizarGravame(raw: any) {
  const info = raw?.dados?.informacoes_gravame;
  if (!info) return null;
  return {
    possuiGravame: info.possui_gravame === "sim" ? true
                 : info.possui_gravame === "nao" ? false : null,
    financiadora:  info.financiadora  ?? null,
    tipoContrato:  info.tipo_contrato ?? null,
    dataInclusao:  info.data_inclusao ?? null,
  };
}

// ─── VALIDAÇÃO DE PLACA ───────────────────────────────────────────────────────
const PLACA_REGEX = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

// ─── APP EXPRESS ──────────────────────────────────────────────────────────────
const app = express();

app.use(helmet());
app.use(cors({ origin: FRONTEND, methods: ["GET"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 30, message: { message: "Muitas requisições. Aguarde 1 minuto.", code: "RATE_LIMIT" } }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── ROTA PRINCIPAL ───────────────────────────────────────────────────────────
app.get("/api/veiculo/:placa", async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!PLACA_REGEX.test(placa)) {
    return res.status(400).json({
      message: "Formato de placa inválido. Use AAA0000 (antiga) ou AAA0A00 (Mercosul).",
      code: "FORMATO_INVALIDO",
    });
  }

  // Cache hit
  const cached = cache.get(placa);
  if (cached) {
    console.log(`📦 CACHE HIT: ${placa}`);
    return res.json(cached);
  }

  console.log(`🔍 Consultando placa: ${placa}`);

  // Consultas em paralelo
  const [cadastralRaw, fipeRaw, leilaoRaw, rouboRaw, gravameRaw] = await Promise.allSettled([
    fetchComRetry("/consultarPlaca",               placa),
    fetchComRetry("/consultarPrecoFipe",           placa),
    fetchComRetry("/consultarRegistroLeilaoPrime", placa),
    fetchComRetry("/consultarHistoricoRouboFurto", placa),
    fetchComRetry("/consultarGravame",             placa),
  ]);

  // Cadastral obrigatória
  const cadastralData = cadastralRaw.status === "fulfilled" ? cadastralRaw.value : null;
  const cadastral = normalizarCadastral(cadastralData);

  if (!cadastral) {
    return res.status(404).json({
      message: "Veículo não encontrado ou placa inválida.",
      code: "NAO_ENCONTRADO",
    });
  }

  const resultado = {
    placa,
    consultadoEm: new Date().toISOString(),
    cadastral,
    fipe:      fipeRaw.status    === "fulfilled" ? normalizarFipe(fipeRaw.value)       : null,
    leilao:    leilaoRaw.status  === "fulfilled" ? normalizarLeilao(leilaoRaw.value)   : null,
    rouboFurto:rouboRaw.status   === "fulfilled" ? normalizarRoubo(rouboRaw.value)     : null,
    gravame:   gravameRaw.status === "fulfilled" ? normalizarGravame(gravameRaw.value) : null,
  };

  cache.set(placa, resultado);
  console.log(`✅ Consulta concluída e cacheada: ${placa}`);

  return res.json(resultado);
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Placafy Backend rodando em http://localhost:${PORT}`);
  console.log(`📋 Teste: http://localhost:${PORT}/api/veiculo/AAA0000\n`);
});
