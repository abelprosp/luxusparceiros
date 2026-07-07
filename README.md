# Luxus Parceiros

Ecossistema SaaS enterprise para gestão de parceiros da **Luxus Telefonia**.

## Arquitetura

```
luxuspartner/
├── apps/
│   ├── api/          # NestJS + Prisma + Socket.io
│   ├── web/          # Next.js 14 Admin Panel
│   └── mobile/       # Expo React Native
├── packages/
│   ├── types/        # Tipos TypeScript compartilhados
│   ├── utils/        # Utilitários compartilhados
│   └── ui/           # Componentes UI compartilhados
├── docker/           # Dockerfiles e NGINX
└── docker-compose.yml
```

## Stack

| Camada | Tecnologias |
|--------|-------------|
| API | NestJS, Prisma, PostgreSQL, Redis, Socket.io, JWT |
| Web | Next.js 14, TailwindCSS, Shadcn/UI, Recharts |
| Mobile | Expo SDK 52, Expo Router, Secure Store, Biometria |
| Infra | Docker, NGINX, PostgreSQL 16, Redis 7 |

## Pré-requisitos

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Início Rápido

### 1. Infraestrutura

```bash
docker compose up -d postgres redis
```

### 2. Variáveis de Ambiente

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

### 3. Instalação

```bash
pnpm install
```

### 4. Banco de Dados

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Desenvolvimento

```bash
# Todos os apps
pnpm dev

# Individual (sem comentários na mesma linha — o shell pode repassá-los ao script)
pnpm --filter @luxus/api dev
pnpm --filter @luxus/web dev
pnpm --filter @luxus/mobile dev

# URLs: API http://localhost:3001 | Web http://localhost:3000 | Mobile via Expo
```

## Credenciais iniciais

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | admin@luxus.com.br | Luxus@2024 |
| Parceiro | parceiro@demotelecom.com.br | Luxus@2024 |

O seed cria apenas usuários e permissões. Operadoras, planos, estoque e demais dados devem ser cadastrados pelo painel.

## API Documentation

Swagger disponível em: `http://localhost:3001/api/docs`

### Endpoints Principais

| Módulo | Prefixo |
|--------|---------|
| Autenticação | `/api/auth` |
| Parceiros | `/api/partners` |
| Clientes | `/api/clients` |
| Vendas | `/api/sales` |
| Operadoras | `/api/operators` |
| Planos | `/api/plans` |
| Linhas | `/api/lines` |
| Estoque | `/api/stock` |
| Comissões | `/api/commissions` |
| Chamados | `/api/tickets` |
| Solicitações | `/api/requests` |
| Dashboard | `/api/dashboard` |
| Notificações | `/api/notifications` |
| Auditoria | `/api/audit` |

## Perfis de Usuário (RBAC)

- **Administrador** — acesso total
- **Supervisor** — gestão operacional
- **Parceiro** — dados próprios (app mobile)
- **Atendente** — suporte e solicitações
- **Financeiro** — comissões e financeiro

## Identidade Visual

| Token | Valor |
|-------|-------|
| Azul escuro | `#0057FF` |
| Azul claro | `#2D8CFF` |
| Preto | `#0B0B0B` |
| Branco | `#FFFFFF` |
| Cinza claro | `#F5F5F7` |

## Deploy na Railway

O repositório é um monorepo. Crie **um projeto** na [Railway](https://railway.com) com os serviços abaixo.

### 1. PostgreSQL

Adicione o plugin **PostgreSQL** e copie a variável `DATABASE_URL` gerada.

### 2. Serviço API

- **Source:** GitHub `abelprosp/luxusparceiros`
- **Builder:** Dockerfile → `docker/api.Dockerfile`
- **Variáveis:**

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | Referência ao Postgres |
| `JWT_SECRET` | String aleatória (mín. 32 chars) |
| `JWT_REFRESH_SECRET` | String aleatória (mín. 32 chars) |
| `CORS_ORIGINS` | URL pública do Web (ex: `https://seu-web.up.railway.app`) |
| `API_PORT` | `3001` (ou use `PORT` que a Railway injeta) |

Após o primeiro deploy, rode o seed uma vez no shell da Railway:

```bash
npx prisma db seed
```

### 3. Serviço Web

- **Builder:** Dockerfile → `docker/web.Dockerfile`
- **Build args / variáveis de build:**

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | URL pública da API |
| `NEXT_PUBLIC_WS_URL` | URL pública da API (WebSocket) |

### 4. Domínios

Gere domínios públicos para API e Web nos dois serviços e atualize `CORS_ORIGINS` e `NEXT_PUBLIC_*`.

## Deploy com Docker

```bash
docker compose up -d
```

Serviços:
- **NGINX** → `:80`
- **Web** → `:3000`
- **API** → `:3001`
- **PostgreSQL** → `:5432`
- **Redis** → `:6379`

## Tempo Real (Socket.io)

Namespace: `/events`

Eventos emitidos:
- `dashboard:update` — métricas do dashboard
- `sale:updated` — status de vendas
- `commission:updated` — comissões
- `notification:new` — notificações
- `ticket:updated` — chamados
- `stock:updated` — estoque

## Segurança

- JWT + Refresh Token
- RBAC com permissões granulares
- Rate limiting (Throttler)
- Helmet (headers de segurança)
- bcrypt (hash de senhas)
- Validação de uploads
- Auditoria completa de ações

## Licença

Proprietário — Luxus Telefonia © 2026
# luxusparceiros
