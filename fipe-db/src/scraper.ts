/**
 * PLACAFY — Scraper FIPE via parallelum.com.br
 * API pública, sem bloqueio, sem autenticação necessária.
 * Roda 1x por mês via GitHub Actions.
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://fipe.parallelum.com.br/api/v2";
const DB_PATH = path.join(__dirname, "../data/fipe.json");
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function get(url: string, tentativa = 1): Promise<any> {
  try {
    await sleep(300 + Math.random() * 500);
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { Accept: "application/json" },
    });
    return res.data;
  } catch (err: any) {
    if (tentativa < 4) {
      const wait = tentativa * 3000;
      console.warn(`  ⚠️  Erro em ${url}. Aguardando ${wait/1000}s... (${tentativa}/3)`);
      await sleep(wait);
      return get(url, tentativa + 1);
    }
    console.error(`  ❌ Falha: ${url} → ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("🚀 PLACAFY — Scraper FIPE (parallelum)\n");

  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  // 1. Referência atual
  console.log("📅 Buscando referência atual...");
  const refs = await get(`${BASE}/references`);
  if (!refs?.length) { console.error("❌ Erro ao buscar referências"); process.exit(1); }
  const ref = refs[0];
  console.log(`✅ Referência: ${ref.month} (código: ${ref.code})\n`);

  // 2. Marcas de carros
  console.log("🏎️  Buscando marcas...");
  const marcas = await get(`${BASE}/cars/brands`);
  if (!marcas?.length) { console.error("❌ Erro ao buscar marcas"); process.exit(1); }
  console.log(`✅ ${marcas.length} marcas encontradas\n`);

  const banco: any = {
    referencia: { codigo: ref.code, mes: ref.month },
    geradoEm: new Date().toISOString(),
    veiculos: [],
  };

  let total = 0;

  for (let mi = 0; mi < marcas.length; mi++) {
    const marca = marcas[mi];
    const pct = Math.round(((mi + 1) / marcas.length) * 100);
    process.stdout.write(`[${pct}%] ${marca.name} (${mi + 1}/${marcas.length})... `);

    // Modelos da marca
    const modelos = await get(`${BASE}/cars/brands/${marca.code}/models`);
    if (!modelos?.length) { console.log("sem modelos"); continue; }

    for (const modelo of modelos) {
      // Anos do modelo
      const anos = await get(`${BASE}/cars/brands/${marca.code}/models/${modelo.code}/years`);
      if (!anos?.length) continue;

      for (const ano of anos) {
        // Detalhe com preço
        const detalhe = await get(
          `${BASE}/cars/brands/${marca.code}/models/${modelo.code}/years/${ano.code}`
        );
        if (!detalhe?.price) continue;

        const parsePrice = (s: any) => {
          if (typeof s === "number") return s;
          return parseFloat(String(s).replace(/[^\d,]/g,"").replace(",",".")) || 0;
        };

        banco.veiculos.push({
          codigoFipe:    detalhe.codeFipe || "",
          nomeMarca:     detalhe.brand || marca.name,
          nomeModelo:    detalhe.model || modelo.name,
          anoModelo:     parseInt(ano.code?.split("-")[0]) || 0,
          combustivel:   detalhe.fuel || "",
          valor:         parsePrice(detalhe.price),
          mesReferencia: detalhe.referenceMonth || ref.month,
          idMarca:       marca.code,
          idModelo:      modelo.code,
        });
        total++;
      }
    }

    console.log(`${modelos.length} modelos`);

    // Salva a cada 5 marcas
    if (mi % 5 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(banco));
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(banco));

  const sizeMB = (fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Concluído!`);
  console.log(`📊 Total: ${total} veículos`);
  console.log(`💾 Arquivo: ${DB_PATH} (${sizeMB} MB)`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
