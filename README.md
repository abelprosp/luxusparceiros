# Luxus Parceiros

Plataforma web (com aplicativo móvel) que a Luxus Telefonia (Grupo Luxus) usa para organizar a operação comercial feita por parceiros revendedores: parceiros, filiais, usuários, clientes, vendas com documentação, estoque, planos, comissões, campanhas, financeiro, chamados, demandas e auditoria. O sistema está em produção na Railway, com o domínio web `parceiros.grupoluxus.com.br`, e em desenvolvimento contínuo.

> Histórico completo de versões, decisões técnicas e pendências: [docs/HISTORICO-DE-VERSOES.md](docs/HISTORICO-DE-VERSOES.md).
> Documentação de todos os sistemas: repositório privado `redobrai-del/documentacao-sistemas`.

## Funcionalidades

### Operação comercial

- Cadastro de parceiros (matriz) e filiais (lojas), cada um com seus usuários. Vários cadastros de parceiro podem compartilhar o mesmo CNPJ; a tela de Parceiros destaca quando isso acontece.
- Isolamento de dados aplicado na API: um parceiro nunca enxerga dados de outro, e usuários de filial enxergam apenas a própria loja.
- Planos e operadoras compartilhados entre a matriz e as filiais do mesmo parceiro.
- Estoque de linhas e chips, movimentações, transferências e leitura do ICCID pela câmera (web e aplicativo).
- Clientes com edição e exclusão, inclusive em lote, dentro do escopo do usuário.
- Vendas dos tipos linha nova, portabilidade (com operadora doadora), eSIM (com IMEI, EID, sistema do aparelho e foto da tela) e upgrade de plano a partir de uma venda anterior (copia cliente e documentos).
- Documentos da venda (RG, CPF, selfie, contrato, foto do chip etc.) com lista de obrigatórios que depende do tipo de venda. Anexos de qualquer tipo de arquivo, até 50 MB, podem ser incluídos, trocados ou excluídos enquanto a venda estiver aberta.
- Opção "cobrança pela Luxus" em cada venda, que define se ela vai para o sistema de faturamento da Luxus depois de concluída.
- Edição da venda enquanto ela não estiver finalizada, com registro no histórico, e campos com contador que mostra quantos dígitos faltam (por exemplo RG e UF).
- Importação de vendas por planilha `.xlsx` (botão "Importar" em Vendas), em dois modos: "vendas novas", que seguem o fluxo normal até o Luxus Task, e "vendas já concluídas no Luxus Task" (somente administrador). Cada linha é validada isoladamente, até 300 linhas por arquivo.
- Exportação da lista de vendas e filtros por andamento, intervalo de datas e parceiro.

### Fluxo da venda com o Luxus Task

1. O parceiro ou a filial cadastra a venda, que entra em análise.
2. O administrador analisa a venda e a envia ao Luxus Task, escolhendo responsável, cliente e prazo (o prazo não pode ser anterior a hoje).
3. A equipe de operação executa a ativação no Task. O Parceiros espelha o andamento (quem está com a demanda, últimas mensagens, lembretes) e troca anexos com o Task nos dois sentidos.
4. A venda só é concluída quando o Task conclui a demanda. Nesse momento a venda passa a `ACTIVATED`, gera comissão e, se tiver cobrança pela Luxus, entra na fila de envio ao telefonia-2.

A aprovação interna e a finalização forçada que existiram no Parceiros foram desativadas; o Task é a fonte de verdade da conclusão (ver Versão 29 do histórico).

### Gestão e acompanhamento

- Dashboard administrativo e dashboard do parceiro, com períodos de mês, 30 dias, 60 dias e histórico. Vendas realizadas, receita, comissões e gráfico usam a data de criação da venda; cancelamentos usam a data do cancelamento.
- Somente vendas com status `ACTIVATED` contam como venda realizada em indicadores, rankings, campanhas e comissões.
- Cada indicador abre os registros que o compõem. O dashboard exporta planilha Excel com abas; as tabelas exportam PDF, CSV e TXT com colunas alinhadas.
- Campanhas e metas, comissões, financeiro, chamados com prazo (SLA) e Demandas (antigas Solicitações, restritas ao administrador e integradas ao Luxus Task).
- Notificações em tempo real com Socket.IO e janela de aviso para lembretes e conclusões vindos do Task.
- Auditoria das ações relevantes e histórico de atividades.
- Mapa de parceiros com Leaflet e busca de endereço por CEP.

### Experiência e conta

- Temas claro, escuro e sistema; menu lateral expansível e menu móvel em painel lateral.
- Foto de perfil com recorte, zoom e posicionamento; alteração de senha.
- Sessão persistente com renovação automática do token.
- Página "Guia de uso" (`/guia-de-uso`) com instruções por perfil e página "Esqueci minha senha".

## Stack

| Camada | Tecnologias |
| --- | --- |
| Monorepo | pnpm 9.15 (workspaces) e Turborepo 2; Node.js 20 ou superior; TypeScript 5.7 |
| API (`apps/api`) | NestJS 10, Prisma 6 com PostgreSQL 16, JWT com refresh token (Passport), Socket.IO 4 (namespace `/events`), Swagger, class-validator, Helmet e rate limiting (`@nestjs/throttler`) |
| Web (`apps/web`) | Next.js 14, React 18, Tailwind CSS 3, Radix UI (estilo shadcn/ui), Recharts, Leaflet, jsPDF, write-excel-file e read-excel-file, ZXing (leitor de ICCID) |
| Aplicativo (`apps/mobile`) | Expo 52 (React Native 0.76), Expo Router, Secure Store, biometria (`expo-local-authentication`) e câmera |
| Pacotes compartilhados | `packages/types` (tipos, enums, rótulos e permissões), `packages/utils` (utilitários) e `packages/ui` (componentes base) |
| Infraestrutura | Docker (`docker/api.Dockerfile` e `docker/web.Dockerfile`), Docker Compose com NGINX para ambiente local e Railway em produção |

Sobre o Redis: o Docker Compose sobe um Redis 7 e o `.env.example` traz `REDIS_URL`, mas o código atual da API não usa Redis (a biblioteca `ioredis` está apenas declarada como dependência). Ele não é necessário para rodar o sistema hoje.

## Estrutura de pastas

```text
Luxus Parceiros/
├── apps/
│   ├── api/                     # API NestJS
│   │   ├── prisma/              # schema.prisma, migrations (22), seed.ts e scripts de manutenção
│   │   ├── src/modules/         # um módulo por domínio (ver tabela abaixo)
│   │   ├── src/common/          # escopo por parceiro/filial, constantes e utilitários
│   │   ├── src/gateway/         # Socket.IO (namespace /events)
│   │   └── test/                # testes automatizados (node:test sobre o código compilado)
│   ├── web/                     # Next.js 14
│   │   └── src/app/(dashboard)/ # telas autenticadas
│   └── mobile/                  # aplicativo Expo
├── packages/                    # types, utils e ui compartilhados
├── docker/                      # Dockerfiles, nginx.conf e api-entrypoint.sh
├── docs/                        # histórico de versões e relatórios
├── docker-compose.yml           # ambiente local completo
├── railway.toml                 # serviço da API na Railway
└── railway.web.toml             # serviço web na Railway
```

Módulos da API (`apps/api/src/modules`): `auth`, `users` (inclui perfil), `partners`, `branches`, `clients`, `operators`, `plans`, `lines`, `sim-cards`, `stock`, `sales` (inclui importação por planilha), `commissions`, `campaigns`, `financial`, `requests` (Demandas), `tickets` (chamados), `notifications`, `audit`, `dashboard`, `uploads`, `task-integration` (Luxus Task), `external-sales` (API externa e cópia histórica do Task) e `telefonia-intake` (envio ao telefonia-2).

Telas da web (`apps/web/src/app/(dashboard)`): dashboard, vendas, clientes, parceiros, filiais, estoque, planos, operadoras, comissões, campanhas, financeiro, chamados, solicitações (menu "Demandas"), usuários, auditoria, perfil, configurações e guia de uso. Fora da área autenticada ficam `login` e `forgot-password`.

Outros arquivos na raiz: `HISTORICO_DE_VERSOES.txt` (histórico com numeração 0.1.0 a 1.12.0), `DOCUMENTACAO_COMPLETA.txt`, `RELATORIO_TECNICO.md` e `Luxus Parceiros.docx` (manual de processos). A pasta `__pycache__/` na raiz não faz parte do sistema e pode ser ignorada.

## Como rodar localmente

### Opção 1: Docker (recomendada)

Pré-requisitos: Docker Desktop com contêineres Linux em execução e Git. Não é preciso instalar Node.js nem PostgreSQL. As portas `3000`, `3001`, `5432`, `6379` e `8088` (NGINX) precisam estar livres em `127.0.0.1`.

1. Copie as variáveis de exemplo e troque `JWT_SECRET`, `JWT_REFRESH_SECRET` e `POSTGRES_PASSWORD` por valores próprios:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Ajuste os endereços da web para a porta do NGINX. O NGINX local escuta em `127.0.0.1:8088` (variável `NGINX_PORT`), mas os valores padrão de `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WS_URL` ainda apontam para `http://localhost` (porta 80). No `.env`, use `NEXT_PUBLIC_API_URL=http://localhost:8088`, `NEXT_PUBLIC_WS_URL=http://localhost:8088/events` e inclua `http://localhost:8088` em `CORS_ORIGINS`. Como alternativa, aponte as duas variáveis diretamente para a API em `http://localhost:3001`.

3. Construa e inicie o ambiente:

   ```powershell
   docker compose up -d --build
   docker compose ps
   ```

| Serviço | Endereço |
| --- | --- |
| Aplicação via NGINX | http://localhost:8088 (ou a porta definida em `NGINX_PORT`) |
| Web direto | http://localhost:3000 |
| API direta | http://localhost:3001/api |
| Swagger | http://localhost:3001/api/docs |
| Verificação de saúde | http://localhost:3001/api/health |

Comandos úteis:

```powershell
docker compose logs -f api web        # acompanhar logs
docker compose up -d --build api web  # reconstruir após alteração
docker compose down                   # parar sem apagar banco nem uploads
```

Os contêineres se chamam `luxus-parceiros-*` e usam os volumes `postgres_data`, `redis_data` e `uploads_data`. Não rode `docker compose down -v` sem certeza, porque isso apaga os volumes locais (banco e documentos).

Ao iniciar, a API roda `prisma migrate deploy` e, se `RUN_DB_SEED=true` (padrão no Docker local), o seed idempotente de demonstração, que cria usuários de exemplo (administradores e um parceiro), operadoras, planos e dados básicos. Os e-mails e a senha inicial desses usuários estão em `apps/api/prisma/seed.ts`; use-os somente em ambiente local.

Observação: o `docker-compose.yml` não repassa à API as variáveis `LUXUS_TASK_TIMEOUT_MS` e `TELEFONIA_INTAKE_*`. Para testar a integração com o telefonia-2 no Docker local, é preciso acrescentá-las ao serviço `api`.

### Opção 2: sem Docker

Pré-requisitos: Node.js 20 ou superior, pnpm 9 (via Corepack) e um PostgreSQL 16 acessível pela `DATABASE_URL` do `.env`.

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

O seed (`pnpm db:seed`) executa `dist/prisma/seed.js`; se ele não existir, compile a API antes com `pnpm --filter @luxus/api build`. Para trabalhar em um app específico:

```powershell
pnpm --filter @luxus/api dev     # API em watch (porta 3001)
pnpm --filter @luxus/web dev     # web em http://localhost:3000
pnpm --filter @luxus/mobile dev  # Expo
```

### Scripts da raiz

| Script | O que faz |
| --- | --- |
| `pnpm dev` | Sobe em paralelo todos os apps que têm script `dev` |
| `pnpm build` | Compila `types`, `utils`, `ui`, API e web, nessa ordem |
| `pnpm lint` | Verificação de tipos e lint de todos os pacotes |
| `pnpm test` | Compila a API e roda os testes de `apps/api/test` |
| `pnpm db:generate`, `db:migrate`, `db:seed`, `db:studio` | Prisma Client, migrations de desenvolvimento, seed e Prisma Studio |
| `pnpm db:cleanup` | Remove dados de demonstração (`prisma/cleanup-demo-data.ts`) |
| `pnpm docker:up`, `docker:down`, `docker:build` | Atalhos do Docker Compose |

Na API também existe `prisma:fix-sale-branch`, que corrige a filial de vendas antigas a partir de quem as criou.

### Testes

`pnpm test` roda os testes listados no script `test` de `apps/api/package.json` (isolamento por parceiro, documentos obrigatórios, status realizados, filtros do dashboard, edição e exclusão segura, fluxo de análise, integração com o Task, notificações de suporte, cópia histórica e telefonia-2). O arquivo `test/sales-import.test.js` existe, mas não está na lista do script; para rodá-lo é preciso incluí-lo ou executá-lo manualmente. Antes de enviar para a `main`, rode `pnpm build`: o deploy na Railway é automático e um erro de TypeScript derruba a publicação.

## Variáveis de ambiente

O arquivo de exemplo é `.env.example` na raiz. Nunca versione o `.env` nem valores reais.

| Variável | Onde é usada | Descrição |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Docker Compose | Senha do PostgreSQL local |
| `DATABASE_URL` | API (Prisma) | Conexão com o PostgreSQL |
| `REDIS_URL` | Docker Compose | Endereço do Redis; hoje não é lido pelo código da API |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | API | Segredo e validade do token de acesso (padrão 15 minutos) |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | API | Segredo e validade do token de renovação. Sem a variável, o código usa 365 dias; o `.env.example` e o Docker Compose sugerem 7 dias |
| `API_PORT`, `PORT` | API | Porta da API; `PORT` (definida pela Railway) tem prioridade |
| `API_URL` | `.env.example` | Endereço da API para referência local; não é lido pelo código atual |
| `CORS_ORIGINS` | API e Socket.IO | Origens do frontend autorizadas, separadas por vírgula |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Web (no build) | Endereço da API (com ou sem `/api` no final) e do Socket.IO (`.../events`). Ficam visíveis no navegador; não coloque segredos nelas |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL` | Aplicativo | Mesmos endereços para o Expo (use o IP da máquina na rede local). Ficam embutidas no aplicativo |
| `RUN_DB_SEED` | Entrypoint da API | `true` roda o seed de demonstração ao iniciar; mantenha `false` em produção |
| `UPLOAD_DIR`, `UPLOAD_MAX_SIZE` | API | Pasta dos arquivos e tamanho máximo em bytes (padrão 50 MB) |
| `RAILWAY_VOLUME_MOUNT_PATH` | API | Usada como pasta de uploads quando `UPLOAD_DIR` não está definida |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | API | Janela (segundos) e número máximo de requisições do rate limiting |
| `LUXUS_TASK_API_URL`, `LUXUS_TASK_INTEGRATION_KEY`, `LUXUS_TASK_TIMEOUT_MS` | API | Endereço da API do Luxus Task, chave compartilhada (a mesma configurada no Task) e tempo limite das chamadas |
| `EXTERNAL_SALES_API_KEY` | API | Chave exigida pela API externa de vendas e pela cópia histórica |
| `TELEFONIA_INTAKE_URL`, `TELEFONIA_INTAKE_API_KEY`, `TELEFONIA_INTAKE_TIMEOUT_MS` | API | Origem do telefonia-2 (o caminho `/v1/intake/customers` é acrescentado), chave e tempo limite do envio. Sem URL ou chave, o envio fica aguardando |
| `NGINX_PORT` | Docker Compose | Porta local do NGINX (padrão 8088) |

## Autenticação e permissões

- Login por e-mail e senha (hash bcrypt), com token de acesso JWT de curta duração e refresh token revogável. A web guarda a sessão no armazenamento local do navegador e renova o token automaticamente (`apps/web/src/lib/api.ts`). O aplicativo usa Secure Store e biometria.
- Perfis (`UserRole`): `ADMIN` e `SUPERVISOR` (administração), `PARTNER` (dados do próprio parceiro), `ATTENDANT` (usuário de filial, limitado à loja) e `FINANCIAL` (comissões e financeiro). Permissões granulares por perfil ficam em `packages/types` e são conferidas na API e na web (`apps/web/src/lib/rbac.ts`).
- Visão global somente para `ADMIN`/`SUPERVISOR` sem vínculo com parceiro (`isPlatformAdmin`). Um administrador vinculado a um parceiro fica restrito a ele.

Regras obrigatórias para qualquer nova consulta na API:

1. Não confiar no `partnerId` enviado pelo navegador; usar os helpers de `apps/api/src/common/utils/partner-scope.ts`, que forçam o parceiro do usuário autenticado.
2. Aplicar também o filtro por `branchId` para usuários de filial (`branch-scope.ts`).
3. Ocultar elementos no frontend não substitui a autorização na API.

Outras proteções: Helmet, CORS restrito, rate limiting, `ValidationPipe` que rejeita campos não declarados nos DTOs, limite de 50 MB no corpo das requisições e nos uploads, arquivos servidos somente com autenticação, e auditoria. Fotos de perfil aceitam apenas imagens. As integrações servidor-a-servidor usam chaves em cabeçalho HTTP.

## Tempo real

O Socket.IO fica no namespace `/events` e exige o token JWT na conexão. Cada usuário entra na sala `user:<id>` e, se tiver parceiro, na sala `partner:<id>`. Eventos emitidos hoje: `sale:created`, `sale:updated`, `request:created`, `request:updated`, `request:comment`, `ticket:created`, `ticket:updated`, `ticket:message`, `ticket:deleted`, `commission:created`, `commission:approved`, `commission:paid`, `notification:new`, `notification:read` e `notification:read-all`. O evento antigo `notification` continua sendo emitido porque o aplicativo móvel ainda o escuta.

## Deploy

Produção na Railway, com dois serviços ligados a este repositório e um PostgreSQL. Cada push na `main` do remoto `origin` dispara nova publicação.

| Serviço | Configuração | Dockerfile | Verificação de saúde |
| --- | --- | --- | --- |
| API | `railway.toml` | `docker/api.Dockerfile` | `/api/health` |
| Web | `railway.web.toml` (definir em Settings, Config-as-code) | `docker/web.Dockerfile` | `/login` |

- API: variáveis mínimas `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e `CORS_ORIGINS` (incluindo o domínio web), além das variáveis das integrações. Mantenha `RUN_DB_SEED=false`. O contêiner roda `prisma migrate deploy` a cada inicialização (`docker/api-entrypoint.sh`).
- Volume obrigatório: conecte um volume persistente somente ao serviço da API, montado em `/app/uploads`. Sem ele, os documentos se perdem a cada publicação.
- Web: defina `NEXT_PUBLIC_API_URL` (domínio da API) e `NEXT_PUBLIC_WS_URL` (domínio da API com `/events`) como variáveis de build; elas são embutidas no build.
- Domínio web: `parceiros.grupoluxus.com.br`. O endereço público da API não está registrado neste repositório; o código do Luxus Task usa como padrão `https://luxusparceiros-production-df5d.up.railway.app`, o que indica ser a API de produção (a confirmar no painel da Railway).

Remotos Git: `origin` (`abelprosp/luxusparceiros`, de onde a Railway publica) e `redobrai` (`redobrai-del/luxus-parceiros`, cópia mantida pela REDOBRAI). Confira com `git remote -v` para onde está enviando.

Se o healthcheck falhar, confira se cada serviço usa o arquivo de configuração correto, as variáveis `PORT`, `DATABASE_URL` e `CORS_ORIGINS`, e os logs de inicialização. Se um deploy não for disparado após uma falha, use o redeploy do painel em vez de commits vazios.

## Integrações

### Luxus Task (sistema de demandas da operação)

Módulo `apps/api/src/modules/task-integration`. O Parceiros cria demandas no Task com o usuário técnico `LUXUSPARCEIROS`, envia dados e anexos (em base64) das vendas aprovadas e das Demandas, e recebe de volta status, respostas, anexos e a conclusão por callback. Vendas e demandas usam fila com nova tentativa automática, porque o Task pode demorar a responder.

| Rota (prefixo `/api`) | Uso |
| --- | --- |
| `POST /integrations/luxus-task/callback` | Callback do Task (protegido pela chave compartilhada) |
| `GET /integrations/luxus-task/sales/:saleId`, `.../documents`, `.../documents/:documentId` | Consulta de resumo e documentos da venda pelo Task |
| `GET /task-integration/responsibles`, `GET /task-integration/clients` | Listas de responsáveis e clientes do Task usadas nas telas |

Se o Task ficar fora do ar, as vendas não concluem (não há mais finalização forçada no Parceiros).

### telefonia-2 / Luxus Connect (faturamento)

Módulo `apps/api/src/modules/telefonia-intake`. Vendas concluídas com cobrança pela Luxus entram em uma fila processada a cada 20 segundos e são enviadas para `/v1/intake/customers` do telefonia-2, com o cabeçalho `X-API-Key`. O envio nunca desfaz a conclusão da venda; dados fora do padrão vão para as observações.

### API externa de vendas (sistemas terceiros)

Módulo `apps/api/src/modules/external-sales`, autenticado pelo cabeçalho `x-api-key` (ou `x-integration-key`) comparado com `EXTERNAL_SALES_API_KEY`.

| Rota (prefixo `/api`) | Uso |
| --- | --- |
| `GET /integrations/external/sales` | Lista paginada. Filtros: `page`, `limit` (máximo 100), `search`, `status`, `partnerId`, `branchId`, `createdFrom`, `createdTo`, `onlyActivated` |
| `GET /integrations/external/sales/:idOrProtocol` | Detalhe por identificador ou protocolo |
| `POST /integrations/external/sales/historical` | Copia para o Parceiros uma demanda já existente no Task, sem alterá-la |
| `POST /integrations/external/sales/historical/rehome` | Move uma venda histórica copiada para o parceiro correto |

### Outros

- Busca de endereço por CEP (`apps/web/src/lib/cep.ts`) e mapa de parceiros com Leaflet.

## Pontos de atenção

Resumo; detalhes na seção 7 de [docs/HISTORICO-DE-VERSOES.md](docs/HISTORICO-DE-VERSOES.md).

- Credenciais de demonstração: se o seed já rodou em produção, as contas de exemplo existem lá. Confirme `RUN_DB_SEED=false` e que essas contas foram removidas ou tiveram a senha trocada.
- Refresh token com validade padrão de 365 dias no código quando `JWT_REFRESH_EXPIRES_IN` não está definida.
- Dependência do Luxus Task para concluir vendas, sem procedimento de contingência documentado.
- Aplicativo móvel sem mudanças desde 24/08/2026: eSIM, upgrade, importação e cobrança pela Luxus podem não existir nele.
- Docker local com endereços padrão da web apontando para a porta 80, enquanto o NGINX usa a 8088 (ver "Como rodar localmente").
- Redis declarado na infraestrutura, mas não usado pelo código.
- Duas numerações de versão (`docs/HISTORICO-DE-VERSOES.md` e `HISTORICO_DE_VERSOES.txt`) e muitas branches antigas já mescladas.

## Convenções

- Commits no formato `tipo: descrição` (por exemplo `feat: ...`, `fix: ...`, `docs: ...`), com mensagens descritivas.
- Nunca commitar `.env`, planilhas, documentos de clientes ou dados pessoais. A pasta `uploads/` local é ignorada pelo Git.
- Toda alteração no `schema.prisma` deve vir com migration; não edite migrations já aplicadas em produção.
- Na API, cada domínio tem controller, service, DTOs (validados com class-validator e documentados no Swagger) e módulo; regras ficam no service, e ações sensíveis são auditadas.
- Na web, chamadas autenticadas passam por `apps/web/src/lib/api.ts`; tipos usados por mais de um app ficam em `packages/types`.
- Antes de publicar, rode `pnpm build` e `pnpm test` e teste com um administrador, um parceiro e um usuário de filial.
- Ao publicar, acrescente a nova versão em `docs/HISTORICO-DE-VERSOES.md`.

## Licença

Software proprietário da Luxus Telefonia.
