/**
 * PLACAFY — Scraper FIPE Oficial
 * Acessa veiculos.fipe.org.br e extrai todos os dados para carros.
 * Roda 1x por mês via GitHub Actions.
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const FIPE_API = "https://veiculos.fipe.org.br/api/veiculos";
const FIPE_HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://veiculos.fipe.org.br",
  "Host": "veiculos.fipe.org.br",
  "Origin": "https://veiculos.fipe.org.br",
  "Accept": "application/json, text/plain, */*",
};

const DB_PATH = path.join(__dirname, "../data/fipe.json");
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function post(endpoint: string, body: object, tentativa = 1): Promise<any> {
  try {
    const res = await axios.post(`${FIPE_API}/${endpoint}`, body, {
      headers: FIPE_HEADERS, timeout: 15000,
    });
    return res.data;
  } catch (err: any) {
    if (tentativa < 4) {
      const wait = tentativa * 3000;
      console.warn(`  ⚠️  Erro em ${endpoint}. Aguardando ${wait/1000}s... (${tentativa}/3)`);
      await sleep(wait);
      return post(endpoint, body, tentativa + 1);
    }
    return null;
  }
}

async function main() {
  console.log("🚀 PLACAFY — Scraper FIPE\n");

  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  // 1. Referência atual
  const refs = await post("ConsultarTabelaDeReferencia", {});
  if (!refs?.length) { console.error("❌ Erro ao buscar referências"); process.exit(1); }
  const ref = refs[0];
  console.log(`✅ Referência: ${ref.Mes} (código: ${ref.Codigo})\n`);

  // 2. Marcas
  const marcas = await post("ConsultarMarcas", {
    codigoTabelaReferencia: ref.Codigo,
    codigoTipoVeiculo: 1,
  });
  if (!marcas?.length) { console.error("❌ Erro ao buscar marcas"); process.exit(1); }
  console.log(`✅ ${marcas.length} marcas encontradas\n`);

  // Estrutura do banco JSON
  const banco: Record<string, any> = {
    referencia: { codigo: ref.Codigo, mes: ref.Mes },
    geradoEm: new Date().toISOString(),
    veiculos: [] as any[],
  };

  let total = 0;

  for (let mi = 0; mi < marcas.length; mi++) {
    const marca = marcas[mi];
    const marcaId = parseInt(marca.Value);
    const pct = Math.round(((mi + 1) / marcas.length) * 100);
    console.log(`[${pct}%] ${marca.Label} (${mi + 1}/${marcas.length})`);

    const modData = await post("ConsultarModelos", {
      codigoTabelaReferencia: ref.Codigo,
      codigoTipoVeiculo: 1,
      codigoMarca: marcaId,
    });
    if (!modData?.Modelos?.length) continue;

    for (const modelo of modData.Modelos) {
      const modeloId = parseInt(modelo.Value);
      await sleep(200);

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
        await sleep(150);

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
          (detalhe.Valor || "0").replace("R$","").replace(/\./g,"").replace(",",".").trim()
        );

        banco.veiculos.push({
          codigoFipe:    detalhe.CodigoFipe,
          nomeMarca:     detalhe.Marca,
          nomeModelo:    detalhe.Modelo,
          anoModelo:     anoModelo,
          combustivel:   detalhe.Combustivel,
          valor,
          mesReferencia: detalhe.MesReferencia?.trim(),
          idMarca:       marcaId,
          idModelo:      modeloId,
        });
        total++;
      }
    }

    // Salva parcialmente a cada marca (segurança)
    if (mi % 5 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(banco));
      console.log(`  💾 Salvo parcialmente: ${total} veículos`);
    }
  }

  // Salva final
  fs.writeFileSync(DB_PATH, JSON.stringify(banco));

  console.log(`\n✅ Scraping concluído!`);
  console.log(`📊 Total: ${total} veículos`);
  console.log(`💾 Salvo em: ${DB_PATH}`);
  console.log(`📦 Tamanho: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
