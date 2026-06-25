#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║  PLACAFY — Script de instalação e inicialização     ║
# ╚══════════════════════════════════════════════════════╝

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         PLACAFY — Setup completo         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Verifica Node.js ──────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js não encontrado.${NC}"
  echo "   Instale em: https://nodejs.org (versão 18 ou superior)"
  exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js versão $NODE_VERSION encontrada. Precisa da versão 18+.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version) encontrado${NC}"

# ── Backend ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}📦 Instalando dependências do backend...${NC}"
cd "$(dirname "$0")/backend"

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  Arquivo .env não encontrado. Copiando .env.example...${NC}"
  cp .env.example .env
  echo -e "${YELLOW}   → Edite backend/.env com seu email antes de continuar!${NC}"
fi

npm install --silent
echo -e "${GREEN}✅ Backend instalado${NC}"

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}📦 Instalando dependências do frontend...${NC}"
cd "../frontend"
npm install --silent
echo -e "${GREEN}✅ Frontend instalado${NC}"

# ── Iniciar os dois servidores ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}🚀 Iniciando Placafy...${NC}"
echo ""
echo -e "   Backend:  ${BLUE}http://localhost:3001${NC}"
echo -e "   Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "   Teste:    ${BLUE}http://localhost:3000${NC} (use a placa ${YELLOW}AAA0000${NC} para testar)"
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para parar${NC}"
echo ""

# Iniciar backend em background
cd "../backend"
npm run dev &
BACKEND_PID=$!

# Aguardar backend subir
sleep 3

# Iniciar frontend
cd "../frontend"
npm run dev &
FRONTEND_PID=$!

# Esperar sinais
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Placafy encerrado.'; exit 0" SIGINT SIGTERM

wait $BACKEND_PID $FRONTEND_PID
