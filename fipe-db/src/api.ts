/**
 * PLACAFY — API FIPE Local
 * Serve os dados do fipe.json via REST.
 * Custo: R$ 0,00 por consulta.
 */

import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";

const PORT    = process.env.PORT || 3002;
const DB_PATH = path.join(__dirname, "../data/fipe.json");

const app = express();
app.use(cors());
app.use(express.json());

// ─── CARREGAR BANCO ───────────────────────────────────────────────────────────
let banco: any = null;
let ultimaLeitura = 0;

function getDB() {
  // Recarrega o JSON se passou mais de 1 hora (sem reiniciar o servidor)
  const agora = Date.now();
  if (!banco || agora - ultimaLeitura > 3600000) {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error("fipe.json não encontrado. O scraper ainda não rodou.");
    }
    console.log("📂 Carregando fipe.json...");
    banco = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    ultimaLeitura = agora;
    console.log(`✅ ${banco.veiculos?.length || 0} veículos carregados`);
  }
  return banco;
}

// ─── NORMALIZAÇÃO ─────────────────────────────────────────────────────────────
function norm(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// ─── BUSCA POR MARCA + MODELO + ANO ──────────────────────────────────────────
app.get("/fipe/buscar", (req, res) => {
  const { marca, modelo, ano } = req.query as Record<string, string>;

  if (!marca || !modelo || !ano) {
    return res.status(400).json({ error: "marca, modelo e ano são obrigatórios" });
  }

  try {
    const db = getDB();
    const veiculos: any[] = db.veiculos || [];

    const marcaNorm  = norm(marca);
    const modeloNorm = norm(modelo);
    const anoNum     = parseInt(ano);

    // Primeira palavra do modelo (ex: "SIENA" de "SIENA ATTRACTIV 1.4")
    const primeiraPalavra = modeloNorm.replace(/[0-9].*/g, "").slice(0, 8);

    // Filtra por marca
    const porMarca = veiculos.filter(v => {
      const mn = norm(v.nomeMarca);
      return mn === marcaNorm || mn.includes(marcaNorm.slice(0, 5)) || marcaNorm.includes(mn.slice(0, 4));
    });

    if (!porMarca.length) {
      return res.status(404).json({ error: `Marca "${marca}" não encontrada` });
    }

    // Filtra por modelo
    const porModelo = porMarca.filter(v => {
      const mn = norm(v.nomeModelo);
      return mn === modeloNorm
        || mn.includes(modeloNorm.slice(0, 8))
        || mn.includes(primeiraPalavra)
        || modeloNorm.includes(mn.slice(0, 6));
    });

    if (!porModelo.length) {
      return res.status(404).json({ error: `Modelo "${modelo}" não encontrado` });
    }

    // Ordena pelo ano mais próximo
    const ordenado = porModelo.sort((a, b) =>
      Math.abs(a.anoModelo - anoNum) - Math.abs(b.anoModelo - anoNum)
    );

    const v = ordenado[0];

    // Histórico: todos os registros do mesmo código FIPE
    const historico = veiculos
      .filter(x => x.codigoFipe === v.codigoFipe)
      .sort((a, b) => b.anoModelo - a.anoModelo)
      .slice(0, 12)
      .map(x => ({ mes: x.mesReferencia, valor: x.valor }));

    return res.json({
      codigoFipe:    v.codigoFipe,
      versao:        v.nomeModelo,
      marca:         v.nomeMarca,
      preco:         v.valor,
      mesReferencia: v.mesReferencia,
      anoModelo:     v.anoModelo,
      combustivel:   v.combustivel,
      historico,
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── BUSCA POR CÓDIGO FIPE ───────────────────────────────────────────────────
app.get("/fipe/codigo/:codigoFipe", (req, res) => {
  try {
    const db = getDB();
    const v = db.veiculos?.find((x: any) => x.codigoFipe === req.params.codigoFipe);

    if (!v) return res.status(404).json({ error: "Código FIPE não encontrado" });

    return res.json({
      codigoFipe:    v.codigoFipe,
      versao:        v.nomeModelo,
      marca:         v.nomeMarca,
      preco:         v.valor,
      mesReferencia: v.mesReferencia,
      anoModelo:     v.anoModelo,
      combustivel:   v.combustivel,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── STATUS ──────────────────────────────────────────────────────────────────
app.get("/fipe/status", (_req, res) => {
  try {
    const db = getDB();
    return res.json({
      status:        "ok",
      totalVeiculos: db.veiculos?.length || 0,
      referencia:    db.referencia?.mes || "—",
      geradoEm:      db.geradoEm || "—",
    });
  } catch (err: any) {
    return res.status(503).json({
      status:  "sem dados",
      message: "fipe.json não encontrado. Aguarde o GitHub Actions rodar o scraper.",
    });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`\n🚀 FIPE API rodando em http://localhost:${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/fipe/status`);
  console.log(`🔍 Busca:  http://localhost:${PORT}/fipe/buscar?marca=FIAT&modelo=SIENA&ano=2017\n`);
});
