# Placafy FIPE DB — Banco de Dados FIPE Próprio

Extrai todos os dados da tabela FIPE oficial e serve via API REST.
**Custo: R$ 0,00 por consulta.**

---

## Como funciona

```
veiculos.fipe.org.br (site oficial da FIPE)
        ↓  scraping 1x por mês
   SQLite local (fipe.db)
        ↓  API REST
   Backend Placafy
        ↓
   Usuário
```

---

## Instalação

```bash
npm install
```

## Passo 1 — Popular o banco (1x por mês)

```bash
npm run scrape
```

Isso vai:
1. Acessar o site oficial da FIPE
2. Extrair todas as marcas, modelos, anos e valores
3. Salvar em `data/fipe.db`

**Tempo estimado: 2 a 4 horas** (são ~100k+ veículos)
**Rode novamente todo dia 2 de cada mês** quando a FIPE atualiza.

## Passo 2 — Subir a API

```bash
npm run api
```

API disponível em `http://localhost:3002`

---

## Endpoints

### Buscar por marca + modelo + ano
```
GET /fipe/buscar?marca=FIAT&modelo=SIENA&ano=2017
```

Resposta:
```json
{
  "codigoFipe": "001378-1",
  "versao": "Grand Siena ATTRAC. 1.4 EVO F.Flex 8V",
  "marca": "Fiat",
  "preco": 44228,
  "mesReferencia": "junho de 2026",
  "anoModelo": 2018,
  "combustivel": "Álcool / Gasolina",
  "historico": [
    { "mes": "junho de 2026", "valor": 44228 },
    { "mes": "maio de 2026",  "valor": 43890 }
  ]
}
```

### Buscar por código FIPE
```
GET /fipe/codigo/001378-1
```

### Listar marcas
```
GET /fipe/marcas
```

### Status do banco
```
GET /fipe/status
```

---

## Integração com o backend Placafy

No `server.ts` do Placafy, substitua a chamada ao parallelum por:

```typescript
const fipe = await fetch(`http://localhost:3002/fipe/buscar?marca=${cadastral.marca}&modelo=${cadastral.modelo}&ano=${cadastral.anoFab}`)
  .then(r => r.json())
  .catch(() => null);
```

---

## Automatizar atualização mensal

Adicione um cron job para rodar todo dia 2 do mês às 10h:

```bash
# crontab -e
0 10 2 * * cd /caminho/para/fipe-db && npm run scrape >> logs/scrape.log 2>&1
```

---

## Custo

| Item | Custo |
|---|---|
| Scraping mensal | R$ 0,00 |
| API REST | R$ 0,00 |
| Banco SQLite | R$ 0,00 |
| **Total** | **R$ 0,00/mês** |

vs R$ 0,99 por consulta no fipe.online.
