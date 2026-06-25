# 🚗 Placafy — Consulta Veicular

Plataforma SaaS de consulta veicular usando a API ConsultarPlaca.

---

## ⚡ Início Rápido (3 passos)

### Pré-requisito
- [Node.js 18+](https://nodejs.org) instalado

### Passo 1 — Baixar o projeto
Se recebeu como .zip, extraia em uma pasta. Se clonou do Git:
```bash
git clone <seu-repositorio>
cd placafy
```

### Passo 2 — Configurar as credenciais
Edite o arquivo `backend/.env`:
```env
CONSULTAR_PLACA_EMAIL=seuemail@gmail.com
CONSULTAR_PLACA_KEY=abea818972a866252c3227cd63f3cefc
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Passo 3 — Instalar e rodar
```bash
chmod +x setup.sh
./setup.sh
```

Acesse: **http://localhost:3000**

---

## 🖥️ Rodar manualmente (sem o script)

### Terminal 1 — Backend
```bash
cd backend
npm install
npm run dev
# Rodando em http://localhost:3001
```

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
# Rodando em http://localhost:3000
```

---

## 🧪 Testar sem gastar crédito

Use a placa **AAA0000** — retorna dados de exemplo da ConsultarPlaca sem consumir créditos.

Também pode testar o backend direto no navegador:
```
http://localhost:3001/api/veiculo/AAA0000
http://localhost:3001/health
```

---

## 🏗️ Estrutura do Projeto

```
placafy/
├── backend/
│   ├── src/
│   │   └── server.ts          ← Servidor Express com todas as rotas
│   ├── .env                   ← Suas credenciais (NUNCA comitar)
│   ├── .env.example           ← Modelo do .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.jsx      ← App principal Placafy
│   │   │   └── _app.tsx
│   │   └── styles/
│   │       └── globals.css
│   ├── .env.local             ← URL do backend
│   └── package.json
│
├── setup.sh                   ← Script de instalação automática
└── README.md
```

---

## 🌐 Deploy em Produção

### Backend — Railway (recomendado, gratuito)
1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project" → "Deploy from GitHub"
3. Selecione a pasta `backend`
4. Em "Variables", adicione:
   - `CONSULTAR_PLACA_EMAIL` = seu email
   - `CONSULTAR_PLACA_KEY` = sua chave
   - `FRONTEND_URL` = URL do seu frontend
5. Railway detecta automaticamente o `package.json`

### Frontend — Vercel (recomendado, gratuito)
1. Acesse [vercel.com](https://vercel.com)
2. "New Project" → selecione a pasta `frontend`
3. Em "Environment Variables":
   - `NEXT_PUBLIC_BACKEND_URL` = URL do backend no Railway
4. Deploy automático

---

## 🔒 Segurança

- ✅ API Key existe APENAS no backend (`.env`)
- ✅ NUNCA aparece no browser/frontend
- ✅ CORS restrito ao domínio do frontend
- ✅ Rate limiting: 30 req/min por IP
- ✅ Cache 24h para economizar créditos
- ✅ Helmet com headers de segurança HTTP

---

## 📡 Endpoints da API ConsultarPlaca utilizados

| Endpoint | O que retorna |
|---|---|
| `/consultarPlaca` | Dados cadastrais completos |
| `/consultarPrecoFipe` | FIPE atual + histórico 12 meses |
| `/consultarRegistroLeilaoPrime` | Leilão (A/B/C/D) + sinistro |
| `/consultarHistoricoRouboFurto` | Histórico de roubo/furto |
| `/consultarGravame` | Gravame / alienação financeira |

Documentação: https://docs.consultarplaca.com.br
