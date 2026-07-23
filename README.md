# Luxus Parceiros

Plataforma para gestão da operação comercial da Luxus Telefonia: parceiros, filiais, usuários, planos, estoque, clientes, vendas, portabilidade, comissões, campanhas, atendimento, financeiro e auditoria.

O repositório é um monorepo TypeScript preparado para desenvolvimento local e produção com Docker, além de deploy separado da API e do frontend na Railway.

## Funcionalidades

### Operação comercial

- Cadastro de parceiros, matriz, filiais e usuários vinculados.
- Isolamento de dados por parceiro e por filial aplicado na API.
- Planos e operadoras compartilhados entre matriz e filiais do mesmo parceiro.
- Estoque de linhas e chips, movimentações, transferências e leitura de ICCID.
- Clientes e vendas com documentos, portabilidade e histórico de situação.
- Venda rejeitada permanece consultável, mas não entra nos resultados realizados.
- Somente vendas `APPROVED` e `ACTIVATED` contam nos indicadores, rankings e comissões realizadas.

### Gestão e acompanhamento

- Dashboard administrativo e dashboard do parceiro.
- Cards, gráficos e rankings com abertura dos registros que formam cada indicador.
- Filtros por período, parceiro, filial, campanha, operadora e região, conforme permissão.
- Exportação protegida do dashboard em PDF, CSV compatível com Excel e TXT.
- Ordenação crescente e decrescente ao clicar nos cabeçalhos das tabelas.
- Campanhas, metas, comissões, financeiro, solicitações e chamados em Kanban.
- Notificações e atualizações em tempo real com Socket.IO.
- Auditoria de ações relevantes.

### Experiência e conta

- Temas claro, escuro e sistema.
- Menu responsivo para desktop e celular.
- Menu lateral com indicação de itens abaixo da área visível e preservação do scroll ao navegar.
- Foto de perfil com upload, enquadramento, zoom e posicionamento.
- Alteração de senha e preferências do usuário.

## Arquitetura

```text
luxusparceiros/
├── apps/
│   ├── api/                 # NestJS, Prisma, PostgreSQL, Redis e Socket.IO
│   ├── web/                 # Next.js 14, Tailwind CSS, Radix UI e Recharts
│   └── mobile/              # Expo/React Native
├── packages/
│   ├── types/               # Tipos, enums e contratos compartilhados
│   ├── utils/               # Funções utilitárias compartilhadas
│   └── ui/                  # Base de componentes compartilháveis
├── docker/                  # Dockerfiles, NGINX e scripts de inicialização
├── docs/                    # Relatórios e documentação complementar
├── docker-compose.yml       # Ambiente local completo
├── railway.toml             # Serviço da API na Railway
└── railway.web.toml         # Serviço web na Railway
```

| Camada | Tecnologias principais |
| --- | --- |
| API | NestJS, Prisma, PostgreSQL 16, Redis 7, JWT, Socket.IO |
| Web | Next.js 14, React 18, Tailwind CSS, Radix UI, Recharts, jsPDF |
| Mobile | Expo, Expo Router, Secure Store e biometria |
| Infraestrutura | Docker Compose, NGINX e Railway |

## Execução recomendada com Docker

### Requisitos

- Docker Desktop com o mecanismo de contêineres Linux em execução.
- Git.
- Portas `80`, `3000`, `3001`, `5432` e `6379` livres.

Não é necessário instalar Node.js, PostgreSQL ou Redis no computador para executar o ambiente Docker.

### Primeira execução

1. Copie as variáveis de exemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Troque `JWT_SECRET`, `JWT_REFRESH_SECRET` e a senha do PostgreSQL no `.env`.

3. Construa e inicie o ambiente:

   ```powershell
   docker compose up -d --build
   ```

4. Confira a saúde dos serviços:

   ```powershell
   docker compose ps
   ```

### Endereços locais

| Serviço | Endereço |
| --- | --- |
| Aplicação via NGINX | http://localhost |
| Web direto | http://localhost:3000 |
| API direta | http://localhost:3001/api |
| Swagger | http://localhost:3001/api/docs |
| Healthcheck | http://localhost:3001/api/health |

### Comandos Docker úteis

```powershell
# Acompanhar os logs
docker compose logs -f api web

# Reconstruir após uma alteração
docker compose up -d --build api web

# Parar sem apagar banco ou uploads
docker compose down

# Ver os serviços e healthchecks
docker compose ps
```

Os dados do PostgreSQL e os uploads usam volumes persistentes. Não execute `docker compose down -v` sem ter certeza, pois essa opção remove os volumes locais.

## Credenciais locais de demonstração

Disponíveis quando `RUN_DB_SEED=true`:

| Perfil | E-mail | Senha inicial |
| --- | --- | --- |
| Administrador | `admin@luxus.com.br` | `Luxus@2024` |
| Administrador alternativo | `admin@luxusparceiros.com` | `Luxus@2024` |
| Parceiro | `parceiro@demotelecom.com.br` | `Luxus@2024` |

Essas credenciais são somente para ambiente local. Em produção, mantenha `RUN_DB_SEED=false`, use senhas próprias e segredos fortes.

## Desenvolvimento sem Docker

### Requisitos

- Node.js 20 ou superior.
- pnpm 9, habilitado pelo Corepack.
- PostgreSQL e Redis acessíveis pelas URLs do `.env`.

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Para trabalhar em um serviço específico:

```powershell
pnpm --filter @luxus/api dev
pnpm --filter @luxus/web dev
pnpm --filter @luxus/mobile dev
```

## Variáveis de ambiente

Use `.env.example` como referência. As principais variáveis são:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma |
| `REDIS_URL` | Cache, filas e integração em tempo real |
| `JWT_SECRET` | Assinatura do token de acesso |
| `JWT_REFRESH_SECRET` | Assinatura do token de renovação |
| `CORS_ORIGINS` | Origens web autorizadas, separadas por vírgula |
| `NEXT_PUBLIC_API_URL` | URL pública da API, sem `/api` no final |
| `NEXT_PUBLIC_WS_URL` | URL pública da API com `/events` |
| `UPLOAD_DIR` | Diretório persistente dos arquivos |
| `UPLOAD_MAX_SIZE` | Tamanho máximo geral em bytes |
| `RUN_DB_SEED` | Executa o seed idempotente ao iniciar a API |

Nunca versione o arquivo `.env` nem segredos reais.

## Banco de dados e Prisma

O schema fica em `apps/api/prisma/schema.prisma` e as migrations em `apps/api/prisma/migrations`.

```powershell
# Gerar o Prisma Client
pnpm db:generate

# Criar/aplicar migration durante o desenvolvimento
pnpm db:migrate

# Popular dados iniciais
pnpm db:seed

# Abrir o Prisma Studio
pnpm db:studio
```

Toda alteração de schema deve vir acompanhada de migration. Evite editar migrations que já foram aplicadas em produção.

## API e módulos

Todas as rotas usam o prefixo `/api`. A documentação completa e interativa está no Swagger.

| Módulo | Prefixo |
| --- | --- |
| Autenticação | `/api/auth` |
| Perfil | `/api/profile` |
| Uploads | `/api/uploads` |
| Parceiros | `/api/partners` |
| Filiais | `/api/branches` |
| Usuários | `/api/users` |
| Clientes | `/api/clients` |
| Vendas | `/api/sales` |
| Operadoras | `/api/operators` |
| Planos | `/api/plans` |
| Linhas | `/api/lines` |
| Estoque | `/api/stock` |
| Comissões | `/api/commissions` |
| Campanhas | `/api/campaigns` |
| Chamados | `/api/tickets` |
| Solicitações | `/api/requests` |
| Financeiro | `/api/financial` |
| Dashboard | `/api/dashboard` |
| Notificações | `/api/notifications` |
| Auditoria | `/api/audit` |

### Uploads

- Formatos gerais permitidos: JPG, PNG, WebP e PDF.
- Foto de perfil: JPG, PNG ou WebP, com limite de 5 MB.
- O frontend recorta a foto em 512×512 antes de enviar.
- Os arquivos são servidos pela API e exigem autenticação.
- Documentos cujo arquivo físico foi perdido exibem a ação `Reanexar arquivo`; o sistema
  preserva o registro original e bloqueia a substituição quando o arquivo ainda existe.
- Em Docker, o volume `uploads_data` preserva os arquivos entre reconstruções.
- Na Railway, conecte um volume ao serviço da API e use exatamente o ponto de montagem
  `/app/uploads`. A API também reconhece automaticamente `RAILWAY_VOLUME_MOUNT_PATH`.

## Perfis e isolamento de dados

| Perfil | Responsabilidade geral |
| --- | --- |
| `ADMIN` | Administração global ou limitada ao parceiro ao qual estiver vinculado |
| `SUPERVISOR` | Gestão operacional conforme permissões |
| `PARTNER` | Dados do parceiro comercial vinculado |
| `ATTENDANT` | Operação limitada à filial vinculada |
| `FINANCIAL` | Comissões e rotinas financeiras conforme escopo |

Regras obrigatórias para qualquer nova consulta:

1. Não confiar em `partnerId` enviado pelo navegador.
2. Forçar o `partnerId` do usuário autenticado quando ele estiver vinculado.
3. Aplicar também `branchId` para usuários de filial.
4. Permitir visão global apenas aos perfis administrativos sem vínculo comercial.
5. Aplicar o isolamento na API; ocultar elementos no frontend não substitui autorização.

Utilize os helpers de escopo existentes em `apps/api/src/common/utils/partner-scope.ts`.

## Regras importantes de negócio

- Matriz e filiais compartilham planos e operadoras do parceiro mestre.
- Um parceiro não pode visualizar lojas, vendas ou relatórios de concorrentes.
- Portabilidade pode ser cadastrada antes do contrato assinado; o documento entra no momento correto do fluxo.
- Vendas rejeitadas continuam disponíveis para consulta e correção.
- Indicadores de venda realizada consideram apenas `APPROVED` e `ACTIVATED`.
- Exportações e detalhes do dashboard respeitam o mesmo escopo do usuário autenticado.

## Como editar com segurança

### Backend

Cada domínio normalmente contém controller, service, DTOs e módulo em `apps/api/src/modules/<dominio>`.

- Valide entradas com `class-validator` nos DTOs.
- Documente endpoints com decorators do Swagger.
- Mantenha regras e consultas no service, não no controller.
- Use transações Prisma quando uma operação altera várias entidades dependentes.
- Registre ações sensíveis no módulo de auditoria.
- Não retorne senha, refresh token ou dados de outro parceiro.

### Frontend

- Páginas autenticadas ficam em `apps/web/src/app/(dashboard)`.
- Componentes reutilizáveis ficam em `apps/web/src/components`.
- Chamadas autenticadas devem passar pelo cliente em `apps/web/src/lib/api.ts`.
- Tipos usados por mais de um app devem ficar em `packages/types`.
- Preserve estados de carregamento, vazio, erro e confirmação nas operações assíncronas.
- Tabelas usam o componente compartilhado para manter a ordenação padronizada.

### Antes de entregar uma alteração

```powershell
pnpm test
pnpm build
git diff --check
docker compose up -d --build api web
docker compose ps
```

Teste pelo menos um administrador, um parceiro e, quando aplicável, um usuário de filial.

## Testes automatizados

```powershell
# Testes da API
pnpm test

# Build e validação TypeScript de todos os pacotes
pnpm build
```

Os testes atuais cobrem regras críticas como isolamento por parceiro, documentos obrigatórios, status realizados e filtros do dashboard. Novas regras de negócio devem receber testes de regressão.

## Tempo real

Namespace Socket.IO: `/events`.

- `dashboard:update`
- `sale:updated`
- `commission:updated`
- `notification:new`
- `ticket:updated`
- `stock:updated`

## Deploy na Railway

O projeto utiliza dois serviços ligados ao mesmo repositório, além do PostgreSQL.

### API

- Config-as-code: `railway.toml`.
- Dockerfile: `docker/api.Dockerfile`.
- Healthcheck: `/api/health`.
- Variáveis mínimas: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e `CORS_ORIGINS`.
- Configure `RUN_DB_SEED=false` após a preparação inicial.
- Adicione um volume persistente ao serviço da API, com ponto de montagem `/app/uploads`.
  Não conecte esse volume ao frontend `web`.

### Web

- Config-as-code: `railway.web.toml`.
- Dockerfile: `docker/web.Dockerfile`.
- Healthcheck: `/login`.
- Defina `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WS_URL` durante o build.

### Domínios

1. Gere ou associe um domínio ao serviço da API.
2. Gere ou associe o domínio web, por exemplo `parceiros.grupoluxus.com.br`.
3. Inclua o domínio web em `CORS_ORIGINS` na API.
4. Aponte `NEXT_PUBLIC_API_URL` para o domínio da API, sem `/api` ao final.
5. Faça novo deploy dos dois serviços e confirme os healthchecks.

## Solução de problemas

### Docker não inicia no Windows

- Abra o Docker Desktop e aguarde o status “Engine running”.
- Confirme que o mecanismo de contêineres Linux está ativo.
- Execute `docker version` e `docker compose ps`.
- Se o Docker solicitar atualização do componente WSL, isso é requisito do mecanismo interno do Docker Desktop; não altera o Windows para Linux.

### Railway falha no healthcheck

- Verifique se o serviço usa o arquivo correto: `railway.toml` para API e `railway.web.toml` para web.
- Confira `PORT`, `DATABASE_URL`, domínio público, CORS e logs de inicialização.
- A API deve responder em `/api/health`; o web deve responder em `/login`.

### Foto ou documento desaparece após deploy

- Confirme que existe um volume persistente no serviço da API.
- Confira se o ponto de montagem é `/app/uploads`.
- Arquivos no sistema efêmero da Railway são perdidos quando a instância é substituída.
- Registros antigos podem continuar no banco mesmo quando o arquivo físico já foi perdido;
  nesse caso, o documento original precisa ser anexado novamente.

## Segurança

- JWT de curta duração e refresh token revogável.
- Hash de senha com bcrypt.
- RBAC com permissões granulares.
- Helmet, CORS e rate limiting.
- Validação de tamanho, extensão e MIME type dos uploads.
- Auditoria das ações administrativas.
- Isolamento por parceiro e filial no backend.

Antes de produção, execute auditoria de dependências e planeje as atualizações de versões principais com testes de regressão.

## Licença

Software proprietário — Luxus Telefonia © 2026.
