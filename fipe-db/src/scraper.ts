/**
 * PLACAFY — Scraper FIPE Oficial
 * Usa headers de browser para não ser bloqueado
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const FIPE_API = "https://veiculos.fipe.org.br/api/veiculos";

// Headers que simulam um browser real
const FIPE_HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://veiculos.fipe.org.br/",
  "Origin": "https://veiculos.fipe.org.br",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

const DB_PATH = path.join(__dirname, "../data/fipe.json");
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function post(endpoint: string, body: object, tentativa = 1): Promise<any> {
  try {
    // Delay aleatório entre requisições (simula humano)
    await sleep(500 + Math.random() * 1000);

    const res = await axios.post(`${FIPE_API}/${endpoint}`, body, {
      headers: FIPE_HEADERS,
      timeout: 20000,
    });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (tentativa < 4) {
      const wait = tentativa * 5000;
      console.warn(`  ⚠️  Erro ${status} em ${endpoint}. Aguardando ${wait/1000}s... (${tentativa}/3)`);
      await sleep(wait);
      return post(endpoint, body, tentativa + 1);
    }
    console.error(`  ❌ Falha em ${endpoint}: status=${status} msg=${err.message}`);
    return null;
  }
}

async function main() {
  console.log("🚀 PLACAFY — Scraper FIPE\n");

  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  // 1. Referência atual
  console.log("📅 Buscando tabela de referência...");
  const refs = await post("ConsultarTabelaDeReferencia", {});
  if (!refs?.length) {
    console.error("❌ Erro ao buscar referências — site pode estar bloqueando");
    process.exit(1);
  }
  const ref = refs[0];
  console.log(`✅ Referência: ${ref.Mes} (código: ${ref.Codigo})\n`);

  // 2. Marcas
  console.log("🏎️  Buscando marcas...");
  const marcas = await post("ConsultarMarcas", {
    codigoTabelaReferencia: ref.Codigo,
    codigoTipoVeiculo: 1,
  });
  if (!marcas?.length) {
    console.error("❌ Erro ao buscar marcas");
    process.exit(1);
  }
  console.log(`✅ ${marcas.length} marcas encontradas\n`);

  const banco: any = {
    referencia: { codigo: ref.Codigo, mes: ref.Mes },
    geradoEm: new Date().toISOString(),
    veiculos: [],
  };

  let total = 0;

  for (let mi = 0; mi < marcas.length; mi++) {
    const marca = marcas[mi];
    const marcaId = parseInt(marca.Value);
    const pct = Math.round(((mi + 1) / marcas.length) * 100);
    console.log(`[${pct}%] ${marca.Label} (${mi + 1}/${marcas.length})`);

    // Delay maior entre marcas
    await sleep(1000 + Math.random() * 2000);

    const modData = await post("ConsultarModelos", {
      codigoTabelaReferencia: ref.Codigo,
      codigoTipoVeiculo: 1,
      codigoMarca: marcaId,
    });
    if (!modData?.Modelos?.length) continue;

    for (const modelo of modData.Modelos) {
      const modeloId = parseInt(modelo.Value);

      const anosData = await post("ConsultarAnoModelo", {
        codigoTabelaReferencia: ref.Codigo,
        codigoTipoVeiculo: 1,
        codigoMarca: marcaId,
        codigoModelo: modeloId,
      });
      if (!anosData?.length) continue;

      for (const ano of anosData) {
        const parts = ano.Value.split("-");
        const anoModelo = parseInt(parts[0]);
        const codCombustivel = parseInt(parts[1]);

        const detalhe = await post("ConsultarValorComTodosParametros", {
          codigoTabelaReferencia: ref.Codigo,
          codigoTipoVeiculo: 1,
          codigoMarca: marcaId,
          codigoModelo: modeloId,
          ano: anoModelo,
          codigoTipoCombustivel: codCombustivel,
          anoModelo: anoModelo,
          tipoConsulta: "tradicional",
        });

        if (!detalhe?.CodigoFipe) continue;

        const valor = parseFloat(
          (detalhe.Valor || "0")
            .replace("R$","").replace(/\./g,"").replace(",",".").trim()
        );

        banco.veiculos.push({
          codigoFipe:    detalhe.CodigoFipe,
          nomeMarca:     detalhe.Marca,
          nomeModelo:    detalhe.Modelo,
          anoModelo,
          combustivel:   detalhe.Combustivel,
          valor,
          mesReferencia: detalhe.MesReferencia?.trim(),
          idMarca:       marcaId,
          idModelo:      modeloId,
        });
        total++;
      }
    }

    // Salva a cada 5 marcas
    if (mi % 5 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(banco));
      console.log(`  💾 ${total} veículos salvos`);
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(banco));
  console.log(`\n✅ Concluído! ${total} veículos em ${DB_PATH}`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
