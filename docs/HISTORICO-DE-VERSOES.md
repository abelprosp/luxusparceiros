# Luxus Parceiros — Histórico de versões e guia do sistema

> Documento gerado em 19/10/2026 a partir do histórico Git (do primeiro commit até `2d45af7` de 2026-10-19). Para atualizar, acrescente novas versões ao final da seção "Histórico de versões".
>
> Neste documento, cada **dia com commits** na branch `main` é tratado como uma versão publicada (Versão 0 a Versão 35). Existe também o arquivo `HISTORICO_DE_VERSOES.txt` na raiz do repositório, que usa outra numeração (0.1.0 a 1.12.0, agrupando vários dias). As duas numerações descrevem o mesmo histórico; quando for útil, a numeração do arquivo `.txt` é citada entre parênteses.

## 1. O que é este sistema

O **Luxus Parceiros** é a plataforma web (com aplicativo móvel) que a **Luxus Telefonia** (Grupo Luxus) usa para organizar a operação comercial feita por **parceiros revendedores**. Cada parceiro é uma empresa que vende linhas e planos de telefonia móvel em nome da Luxus; o parceiro pode ter uma **matriz** e várias **filiais** (lojas), cada uma com seus usuários.

O sistema resolve os seguintes problemas de negócio:

- **Registro de vendas com documentação:** o parceiro cadastra o cliente e a venda (linha nova, portabilidade, eSIM ou upgrade de plano), anexa documentos (RG, CPF, selfie, contrato, foto do chip etc.) e acompanha a situação da venda até a conclusão.
- **Análise e execução pela Luxus:** o administrador da Luxus analisa a venda e a envia ao **Luxus Task** (sistema interno de demandas da operação), onde a equipe executa a ativação. O resultado volta automaticamente ao Parceiros.
- **Faturamento:** vendas concluídas cuja cobrança é feita pela Luxus são enviadas ao **telefonia-2** (sistema de faturamento da Luxus, também chamado de Luxus Connect).
- **Gestão:** estoque de linhas e chips, planos e operadoras, comissões, campanhas e metas, financeiro, chamados de suporte, solicitações, notificações em tempo real, auditoria e dashboards com exportação.
- **Isolamento de dados:** um parceiro nunca enxerga dados de outro parceiro; usuários de filial enxergam apenas a própria filial.

**Quem usa:** administradores e supervisores da Luxus (visão global), parceiros (visão da própria empresa), atendentes de filial (visão da loja) e o perfil financeiro (comissões e pagamentos).

**Estado atual (19/10/2026):** em produção, publicado na Railway, com domínio web `parceiros.grupoluxus.com.br` (citado no README e no `HISTORICO_DE_VERSOES.txt`). O desenvolvimento é contínuo: houve commits em 36 dias entre 30/06/2026 e 19/10/2026.

## 2. Guia rápido para quem está chegando

### 2.1 Repositório, remotos e branches

| Remoto | Endereço | Uso |
| --- | --- | --- |
| `origin` | `https://github.com/abelprosp/luxusparceiros.git` | Repositório principal, na conta GitHub `abelprosp`. É nele que ficam os pull requests (#2 a #28) e é a partir dele que a Railway publica. |
| `redobrai` | `https://github.com/redobrai-del/luxus-parceiros.git` | Cópia mantida pela **REDOBRAI** (conta GitHub `redobrai-del`). A REDOBRAI publica (faz push) neste remoto; por isso, ao trabalhar localmente, confira com `git remote -v` para qual remoto está enviando. |

- **Branch principal:** `main`. Toda a documentação abaixo se refere ao que entrou na `main`.
- **Outras branches:** existem dezenas de branches `agent/*`, `fix/*`, `feature/*` e `railway/code-change-*` (estas últimas criadas pelo robô da Railway). Elas foram usadas para preparar pull requests e já foram mescladas; não são documentadas separadamente. Quando um merge trouxe uma funcionalidade, isso é dito na versão correspondente.
- **Autores no histórico:** `Artur` (código inicial, julho/2026), `abelprosp` (a grande maioria dos commits e todos os merges de pull request), `redobrai` / `RedobrAI` (dois commits de correção em agosto/2026) e `railway-app[bot]` (três commits sugeridos pelo assistente da Railway em 07/07/2026).
- **Forma de trabalho:** até 06/08/2026 as mudanças entravam por pull request (merge commits ou "squash" com o número do PR no título). A partir de 06/08/2026 os commits passaram a ser feitos diretamente na `main`.

### 2.2 Stack

| Camada | Tecnologias e versões principais |
| --- | --- |
| Monorepo | pnpm 9.15 (workspaces) e Turborepo 2; Node.js 20 ou superior; TypeScript 5.7 |
| API (`apps/api`) | NestJS 10, Prisma 6 com PostgreSQL 16, Redis 7 (ioredis), JWT com refresh token, Socket.IO 4 (namespace `/events`), Swagger, class-validator, Helmet e rate limiting |
| Web (`apps/web`) | Next.js 14, React 18, Tailwind CSS, Radix UI (estilo shadcn/ui), Recharts, Leaflet (mapa), jsPDF, write-excel-file e read-excel-file |
| Mobile (`apps/mobile`) | Expo 52 (React Native 18.3), Expo Router, Secure Store e biometria, leitor de ICCID pela câmera |
| Pacotes compartilhados | `packages/types` (tipos, enums e permissões), `packages/utils` (funções utilitárias), `packages/ui` (componentes base) |
| Infraestrutura | Docker (Dockerfiles da API e da web), Docker Compose com NGINX para ambiente local, Railway para produção |

### 2.3 Onde roda e como é publicado

- **Produção:** Railway, com dois serviços ligados ao mesmo repositório e um PostgreSQL:
  - **API:** configurada por `railway.toml`, imagem `docker/api.Dockerfile`, verificação de saúde em `/api/health`. Precisa de um **volume persistente** montado em `/app/uploads` para que os documentos não se percam a cada publicação.
  - **Web:** configurada por `railway.web.toml`, imagem `docker/web.Dockerfile`, verificação de saúde em `/login`.
- A cada push na `main` a Railway refaz a publicação. Ao iniciar, o contêiner da API roda `prisma migrate deploy` (script `docker/api-entrypoint.sh`) e, somente se `RUN_DB_SEED=true`, o seed de dados de demonstração.
- **Domínio web:** `parceiros.grupoluxus.com.br`.

### 2.4 Como rodar localmente (resumo)

Com Docker (recomendado):

1. Copie `.env.example` para `.env` e troque os segredos JWT e a senha do PostgreSQL.
2. Rode `docker compose up -d --build`.
3. Acesse `http://localhost` (via NGINX), `http://localhost:3000` (web), `http://localhost:3001/api` (API) e `http://localhost:3001/api/docs` (Swagger).

Sem Docker: `corepack enable`, `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed` e `pnpm dev`, com PostgreSQL e Redis acessíveis. Os testes da API rodam com `pnpm test`.

O seed cria usuários de demonstração (administrador e parceiro). As credenciais estão no README e servem **apenas** para ambiente local; em produção mantenha `RUN_DB_SEED=false`.

### 2.5 Variáveis de ambiente (somente nomes e finalidade)

| Variável | Finalidade |
| --- | --- |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL no Docker Compose local |
| `DATABASE_URL` | Conexão do Prisma com o PostgreSQL |
| `REDIS_URL` | Conexão com o Redis |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Assinatura e validade do token de acesso |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Assinatura e validade do token de renovação da sessão |
| `API_PORT`, `API_URL`, `PORT` | Porta e endereço da API (`PORT` é definida pela Railway) |
| `CORS_ORIGINS` | Endereços do frontend autorizados a chamar a API, separados por vírgula |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Endereço da API e do Socket.IO usados pela web (definidos no build) |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL` | Mesmos endereços para o aplicativo móvel |
| `RUN_DB_SEED` | Quando `true`, roda o seed de demonstração ao iniciar a API |
| `UPLOAD_DIR`, `UPLOAD_MAX_SIZE` | Pasta e tamanho máximo dos arquivos enviados |
| `RAILWAY_VOLUME_MOUNT_PATH` | Reconhecida automaticamente como pasta de uploads quando há volume na Railway |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Limite de requisições por intervalo (proteção contra abuso) |
| `LUXUS_TASK_API_URL`, `LUXUS_TASK_INTEGRATION_KEY`, `LUXUS_TASK_TIMEOUT_MS` | Endereço, chave compartilhada e tempo limite da integração com o Luxus Task |
| `EXTERNAL_SALES_API_KEY` | Chave exigida pela API externa de consulta de vendas |
| `TELEFONIA_INTAKE_URL`, `TELEFONIA_INTAKE_API_KEY`, `TELEFONIA_INTAKE_TIMEOUT_MS` | Endereço, chave e tempo limite do envio de vendas concluídas ao telefonia-2 |

O arquivo `.env` nunca foi versionado no histórico (conferido em 19/10/2026).

### 2.6 Estrutura de pastas principal

| Caminho | Conteúdo |
| --- | --- |
| `apps/api/src/modules/<domínio>` | Um módulo NestJS por domínio: `auth`, `users`, `partners`, `branches`, `clients`, `operators`, `plans`, `lines`, `sim-cards`, `stock`, `sales`, `commissions`, `campaigns`, `financial`, `requests` (demandas), `tickets` (chamados), `notifications`, `audit`, `dashboard`, `uploads`, `task-integration` (Luxus Task), `external-sales` (API externa e cópia histórica), `telefonia-intake` (telefonia-2) |
| `apps/api/src/common/utils` | Regras de escopo por parceiro (`partner-scope.ts`) e por filial (`branch-scope.ts`) |
| `apps/api/prisma` | `schema.prisma`, migrations (22 até 19/10/2026) e `seed.ts` |
| `apps/api/test` | Testes automatizados (node:test sobre o código compilado) |
| `apps/web/src/app/(dashboard)` | Telas autenticadas: dashboard, vendas, clientes, parceiros, filiais, estoque, planos, operadoras, comissões, campanhas, financeiro, chamados, solicitações (Demandas), usuários, auditoria, perfil, configurações e guia de uso |
| `apps/web/src/components` | Componentes reutilizáveis (vendas, dashboard, layout, notificações, UI) |
| `apps/mobile` | Aplicativo Expo |
| `packages/*` | Tipos, utilitários e componentes compartilhados |
| `docker/` | Dockerfiles, `nginx.conf` e `api-entrypoint.sh` |
| `docs/` | Relatórios e este histórico |

A pasta `__pycache__/` na raiz não faz parte do sistema e pode ser ignorada.

### 2.7 Autenticação, perfis e segurança

- Login por e-mail e senha (hash bcrypt), com token de acesso JWT de curta duração e refresh token revogável. Desde a Versão 7 a sessão é mantida com renovação automática.
- Perfis (`UserRole`): `ADMIN` e `SUPERVISOR` (administração; visão global quando não estão vinculados a um parceiro), `PARTNER` (dados do próprio parceiro), `ATTENDANT` (usuário de filial, limitado à loja) e `FINANCIAL` (comissões e financeiro).
- Permissões granulares por perfil definidas em `packages/types` e verificadas na API e na web (`apps/web/src/lib/rbac.ts`).
- O isolamento é aplicado na API: o `partnerId` enviado pelo navegador não é confiável e é substituído pelo do usuário autenticado; usuários de filial também recebem filtro por `branchId`.
- Helmet, CORS restrito, rate limiting, validação de tamanho e tipo dos uploads, arquivos servidos somente com autenticação e auditoria das ações relevantes.
- As integrações servidor-a-servidor (Luxus Task, API externa e telefonia-2) usam chaves enviadas em cabeçalho HTTP.

### 2.8 Integrações externas

- **Luxus Task (demandas):** desde a Versão 6. O Parceiros cria demandas no Task (usuário técnico `LUXUSPARCEIROS`), envia os dados e anexos da venda aprovada e recebe de volta, por callback, status, respostas, anexos e a conclusão. Módulo `apps/api/src/modules/task-integration`.
- **telefonia-2 / Luxus Connect (faturamento):** desde a Versão 34. Vendas concluídas com cobrança pela Luxus são enviadas para a rota de entrada de clientes do telefonia-2, com fila e nova tentativa. Módulo `apps/api/src/modules/telefonia-intake`.
- **API externa de consulta de vendas:** desde a Versão 18. Permite que sistemas terceiros consultem vendas (lista e detalhe) com a chave `EXTERNAL_SALES_API_KEY`.
- **ViaCEP / busca de endereço por CEP** (`apps/web/src/lib/cep.ts`) e mapa de parceiros com Leaflet.

### 2.9 Relação com outros sistemas da REDOBRAI / Grupo Luxus

O Luxus Parceiros faz parte do ecossistema do Grupo Luxus: ele alimenta o **Luxus Task** (onde a operação executa as vendas e demandas) e o **telefonia-2 / Luxus Connect** (faturamento). A **REDOBRAI** mantém uma cópia do repositório no remoto `redobrai` e já fez commits diretamente neste projeto.

## 3. Linha do tempo resumida

| Versão | Data | Resumo em uma linha |
| --- | --- | --- |
| 0 | 2026-06-30 | Criação do repositório com o README inicial |
| 1 | 2026-07-07 | Código completo do monorepo, primeiro deploy na Railway, portal do parceiro, login de filial, notificações e nova identidade visual |
| 2 | 2026-07-10 | Portabilidade com operadora doadora, leitor de ICCID, histórico de atividades, busca por CEP e mapa de parceiros |
| 3 | 2026-07-21 | Correção do isolamento entre parceiros, regras de portabilidade e ambiente Docker |
| 4 | 2026-07-22 | Dashboard conta só vendas realizadas, detalhes e exportação do dashboard, foto de perfil e contrato exigido só na aprovação |
| 5 | 2026-07-23 | Documentos persistentes em volume e opção de reanexar arquivos perdidos |
| 6 | 2026-07-28 | Edição de venda e integração com o Luxus Task (demandas unificadas) |
| 7 | 2026-07-30 | Sessão persistente, menu lateral expandido, fluxo completo de chamados e guia de uso |
| 8 | 2026-07-31 | Indicadores de carregamento nas operações assíncronas |
| 9 | 2026-08-04 | Aprovação de vendas enviada ao Luxus Task, exclusão segura e ciclo de contratos |
| 10 | 2026-08-06 | Fluxo ao vivo entre venda e Task e anexos sincronizados nos dois sentidos |
| 11 | 2026-08-07 | Vários parceiros com o mesmo CNPJ e status do contrato alinhados ao Task |
| 12 | 2026-08-10 | "De quem é a vez" visível e transferência real dos anexos entre os sistemas |
| 13 | 2026-08-11 | Reenvio de anexos, contrato assinado devolvido ao Task e vendas de filial corrigidas no dashboard |
| 14 | 2026-08-12 | Edição da venda até a conclusão, contador de dígitos e favicon da marca |
| 15 | 2026-08-17 | Ajuste de configuração de build da API (nest-cli) |
| 16 | 2026-08-18 | Pedido de vez com justificativa e bloqueio de troca em venda concluída |
| 17 | 2026-08-19 | Contêineres Docker isolados e porta do NGINX configurável |
| 18 | 2026-08-21 | API externa de consulta de vendas para sistemas terceiros |
| 19 | 2026-08-24 | Resolver vendas e demandas no Parceiros sem depender do Task |
| 20 | 2026-08-25 | Sincronização confiável com o Task e controle de prazos |
| 21 | 2026-08-26 | Fluxo simplificado: o Task assume a demanda e conclui a venda |
| 22 | 2026-08-27 | Melhorias nas notificações e na integração com o Task |
| 23 | 2026-08-31 | Manual de processos em Word |
| 24 | 2026-09-03 | Receita e comissões do dashboard corrigidas e dashboard de 30 dias |
| 25 | 2026-09-09 | Anexos em vendas abertas e edição/exclusão de clientes em lote |
| 26 | 2026-09-15 | Envio de vendas ao Luxus Task em modo "handoff" |
| 27 | 2026-09-22 | Relatórios tabulares e exportação de vendas |
| 28 | 2026-09-29 | Anexos de qualquer tipo até 50 MB e períodos do dashboard |
| 29 | 2026-10-01 | Venda concluída automaticamente com a demanda do Task e troca de anexos |
| 30 | 2026-10-05 | Excel do dashboard organizado e exclusão de anexos |
| 31 | 2026-10-06 | Venda de eSIM e conclusão de vendas já concluídas no Task |
| 32 | 2026-10-07 | Upgrade de plano, cópia de vendas históricas do Task e filtros de vendas |
| 33 | 2026-10-09 | Alias de caminhos da API e mover venda histórica para o parceiro dono |
| 34 | 2026-10-14 | Envio de vendas concluídas ao telefonia-2 e escolha de cobrança pela Luxus |
| 35 | 2026-10-19 | Dashboard pela data da venda e importação de vendas por planilha |

## 4. Histórico de versões

### Versão 0 — 2026-06-30 — Criação do repositório

**Commits:** `86cbaca` (Artur)

- **Tipo:** Documentação
- **Situação anterior / problema:** o repositório não existia no GitHub.
- **O que foi feito:** primeiro commit com apenas o `README.md` (164 linhas) descrevendo o projeto. Nenhum código foi enviado neste dia.
- **Por quê:** reservar o repositório e registrar a proposta do sistema antes de subir o código. As primeiras migrations do banco que chegaram depois têm datas de 28/06 a 02/07/2026, o que indica que o código já estava sendo desenvolvido localmente.

### Versão 1 — 2026-07-07 — Código completo, primeiro deploy na Railway e portal do parceiro

**Commits:** `a48af7a`, `7915f57`, `bb407bb`, `82b349a`, `e092b29`, `6436a17`, `acec7c8` (merge PR #2), `d09481b`, `ea96739` (merge), `841bfd0`, `7dd34d2`, `c821566`, `d5691b3`, `1a05df6` (merge PR #3), `114c161`, `e8651a4` (merge), `79a17ea`, `7ce01e9`, `d09ea2b`, `358f3c9`, `8672cac`, `495fead`, `8bf9d61`, `06709e5`, `7ee9c9a`, `0b3c4cf`, `1c945b4`, `49058ea`, `14ec222`, `6479262` (Artur, railway-app[bot], abelprosp)

Dia mais intenso do projeto: o código chegou, foi publicado e recebeu várias rodadas de ajustes. Muitas mensagens são vagas ("jmekj", "nlk", "klndkjn"); o conteúdo abaixo foi descrito a partir dos arquivos alterados.

- **Tipo:** Novidade
- **Situação anterior / problema:** só existia o README.
- **O que foi feito:** `a48af7a` enviou o monorepo inteiro (280 arquivos): API NestJS com Prisma e os módulos de autenticação, usuários, parceiros, filiais, clientes, operadoras, planos, linhas, chips (SIM cards), estoque, vendas, comissões, financeiro, campanhas, solicitações, chamados, notificações, auditoria e dashboard; painel web Next.js; aplicativo Expo; pacotes compartilhados; Dockerfiles e Docker Compose.
- **Por quê:** colocar no ar a primeira versão da plataforma de parceiros.

- **Tipo:** Infraestrutura/Deploy
- **Situação anterior / problema:** o primeiro deploy na Railway falhava por vários motivos.
- **O que foi feito:** `7915f57` corrigiu o `.gitignore`, que ignorava por engano a pasta `apps/api/src/modules/uploads`, e fez os Dockerfiles compilarem `@luxus/types` e `@luxus/utils` antes da API e da web; `bb407bb` fixou o Prisma 6 no contêiner (o `npx` baixava o Prisma 7, incompatível); `82b349a` criou o `docker/api-entrypoint.sh`, definiu a porta explicitamente e moveu o Prisma para as dependências de produção para a API passar na verificação de saúde; `e092b29` passou a usar `pnpm deploy` para empacotar as dependências. `841bfd0` reorganizou o `railway.toml` e criou o `railway.web.toml` (serviço web separado); `7dd34d2` criou o `.dockerignore`; `c821566` passou a limpar espaços na lista de `CORS_ORIGINS` e fez a web aceitar `NEXT_PUBLIC_API_URL` com ou sem `/api` no final.
- **Por quê:** sem essas correções a API não subia em produção.

- **Tipo:** Melhoria
- **Situação anterior / problema:** abrir o endereço raiz da API retornava 404 e o banco novo vinha vazio.
- **O que foi feito:** o robô da Railway propôs (PR #2, `6436a17`) um redirecionamento da raiz para `/login` e um seed ampliado com operadoras, planos, filiais e chips; `d09481b` criou o `root.controller.ts` com uma resposta informativa, mantida no merge `ea96739`. O PR #3 (`d5691b3`) passou a rodar o seed no entrypoint; `114c161` compilou o seed para JavaScript e condicionou sua execução à variável `RUN_DB_SEED=true`.
- **Por quê:** facilitar o diagnóstico em produção e ter dados de exemplo.

- **Tipo:** Novidade
- **Situação anterior / problema:** o usuário parceiro via menus e ações de administrador na web.
- **O que foi feito:** `79a17ea` alinhou a web ao aplicativo móvel para o perfil parceiro: controle de acesso por rota (`apps/web/src/lib/rbac.ts`), novas telas de Clientes, Filiais e Perfil, dashboard próprio do parceiro (`partner-dashboard.tsx`) e menu filtrado. O entrypoint deixou de rodar o seed em todo deploy.
- **Por quê:** cada perfil deve ver somente a sua operação.

- **Tipo:** Correção de erro / Melhoria
- **Situação anterior / problema:** o dashboard exibia números fictícios quando não havia filtros, o filtro de status de parceiros e campanhas quebrava e o estoque não carregava.
- **O que foi feito:** `7ce01e9` removeu os dados fictícios (tendências, gráfico e ranking de exemplo) do dashboard e tirou o campo "slug" do cadastro de operadoras; `358f3c9` criou DTOs de consulta validados para parceiros e campanhas, corrigiu o carregamento do estoque e adicionou a página "Esqueci minha senha"; `d09ea2b` e `8672cac` ajustaram estoque e linhas (novas rotas de consulta); `495fead` criou o vínculo entre parceiro e planos disponíveis; `8bf9d61` criou a tela de reenvio de documentos da venda (`resubmit-sale-documents-dialog.tsx`).
- **Por quê:** o dashboard precisava mostrar apenas dados reais e as telas operacionais precisavam funcionar para o parceiro.

- **Tipo:** Novidade
- **Situação anterior / problema:** filiais não tinham login próprio e não havia avisos no sistema.
- **O que foi feito:** `06709e5` criou a migration `branch_user_login` e o escopo por filial (`branch-scope.ts`), permitindo que usuários de filial entrem e vejam só a sua loja; criou o sino de notificações com Socket.IO (`notifications-bell.tsx` e `notifications-provider.tsx`), a tela de detalhe da venda (`sale-detail-dialog.tsx`) e ampliou estoque, comissões e filiais na web e no aplicativo.
- **Por quê:** a filial precisa operar de forma isolada e todos precisam ser avisados quando algo muda.

- **Tipo:** Ajuste visual
- **Situação anterior / problema:** identidade visual genérica e layout pouco adequado ao celular.
- **O que foi feito:** `7ee9c9a` a `6479262` trouxeram logotipos claro e escuro da Luxus Parceiros, nova tela de login, mapa de parceiros por estado e depois com Leaflet (`partners-leaflet-map.tsx`), edição de chamados (`edit-ticket-dialog.tsx`), página de Configurações, menu móvel em painel lateral (`mobile-nav.tsx`), cartões de lista para celular (`mobile-list-card.tsx`) e configuração central do menu (`nav-config.ts`).
- **Por quê:** dar identidade à marca e permitir o uso no celular.

### Versão 2 — 2026-07-10 — Portabilidade, leitor de ICCID, CEP e mapa

**Commits:** `3062f8d`, `627da5c`, `62f191e`, `3543152`, `d1e58b5` (Artur)

Todas as mensagens deste dia são vagas ("kmfk'", "kjkfn", "nslfkn", "fnoeknf"); a descrição vem dos arquivos alterados.

- **Tipo:** Novidade
- **Situação anterior / problema:** a venda não registrava a operadora de origem na portabilidade, o ICCID do chip era digitado à mão e as solicitações tinham fluxo limitado.
- **O que foi feito:** `3062f8d` criou o campo de operadora doadora (migration `sale_donor_operator`, com Vivo, TIM, Claro, Surf e outra), o leitor de ICCID pela câmera no aplicativo (`IccidScannerModal.tsx`) e ampliou a tela de Solicitações (fluxo e anexos). `627da5c` levou o leitor de ICCID para a web (`iccid-scanner.tsx`), criou o histórico de atividades (`ActivityLog`) na web e no aplicativo, a tela de detalhe da venda no aplicativo, a busca de endereço pelo CEP (`apps/web/src/lib/cep.ts`) e selos de status padronizados. `62f191e` e `3543152` refinaram o leitor; `3543152` também adicionou coordenadas aos parceiros (migration `partner_coordinates`), usadas pelo mapa, e `d1e58b5` melhorou o mapa Leaflet.
- **Por quê:** reduzir erros de digitação, registrar corretamente as portabilidades e mostrar a distribuição geográfica dos parceiros.

### Versão 3 — 2026-07-21 — Isolamento entre parceiros, portabilidade e Docker

**Commits:** `066791f` (abelprosp, PR #4)

- **Tipo:** Correção de erro (segurança)
- **Situação anterior / problema:** um administrador vinculado a um parceiro era tratado como administrador global e podia consultar dados de outros parceiros; vários controladores aceitavam o `partnerId` enviado pelo navegador.
- **O que foi feito:** a regra em `apps/api/src/common/utils/partner-scope.ts` passou a forçar o parceiro do usuário autenticado sempre que ele tiver vínculo e a recusar pedidos para outro parceiro; a visão global ficou restrita a administradores sem vínculo (`isPlatformAdmin`). Os controladores de auditoria, filiais, clientes, dashboard, financeiro, operadoras, parceiros, planos e chamados foram revistos, e foi criado o teste `partner-scope.test.js`.
- **Por quê:** um parceiro não pode ver lojas, vendas ou relatórios de concorrentes.

- **Tipo:** Melhoria
- **Situação anterior / problema:** a venda de portabilidade exigia contrato no cadastro, embora o documento só exista mais tarde no fluxo.
- **O que foi feito:** a lista de documentos obrigatórios passou a depender do tipo de venda (`getRequiredDocumentsForSale`), com teste `sale-documents.test.js`; também foi criada a edição do próprio perfil e a troca de senha (`profile.controller.ts`).
- **Por quê:** permitir cadastrar a portabilidade antes do contrato assinado.

- **Tipo:** Infraestrutura/Deploy / Documentação
- **O que foi feito:** revisão do `docker-compose.yml`, Dockerfiles, `nginx.conf` e entrypoint para o ambiente local completo; `.env.example` atualizado; criação do `RELATORIO_TECNICO.md` e atualização do README.
- **Por quê:** permitir rodar todo o sistema localmente com Docker, sem instalar Node.js, PostgreSQL ou Redis.

### Versão 4 — 2026-07-22 — Dashboard correto, exportações, perfil e contrato na aprovação

**Commits:** `2d1eade` (PR #5), `739dc7b`, `d83ccfa` (merge PR #6), `1429504`, `64b3f78` (merge PR #7), `fa7aa5c`, `c108470` (merge PR #8) (abelprosp)

- **Tipo:** Correção de erro
- **Situação anterior / problema:** o dashboard e as campanhas somavam vendas ainda em análise ou rejeitadas.
- **O que foi feito:** `2d1eade` criou a constante `realized-sale-statuses.ts` (somente `APPROVED` e `ACTIVATED` contam como venda realizada), aplicada ao dashboard e às campanhas, com teste de regressão.
- **Por quê:** os indicadores precisam refletir só vendas efetivamente realizadas.

- **Tipo:** Novidade
- **O que foi feito:** `739dc7b` (PR #6, branch `agent/dashboard-profile-reporting`) adicionou: detalhes clicáveis em cada indicador do dashboard (`dashboard-details-dialog.tsx`); exportação do dashboard em PDF, CSV compatível com Excel e TXT (`dashboard-export-button.tsx`); ordenação crescente e decrescente nas tabelas; foto de perfil com recorte, zoom e posicionamento (`avatar-editor-dialog.tsx`); indicação de itens abaixo da área visível no menu lateral; reescrita do README e o relatório `docs/RELATORIO-MELHORIAS-2026-07-22.md`.
- **Por quê:** permitir conferir a origem de cada número e levar relatórios para fora do sistema.

- **Tipo:** Melhoria
- **Situação anterior / problema:** o contrato era cobrado já no cadastro da venda.
- **O que foi feito:** `1429504` (PR #7) passou a exigir o contrato somente quando a venda é aprovada.
- **Por quê:** o contrato só fica pronto depois da análise.

- **Tipo:** Ajuste visual
- **O que foi feito:** `fa7aa5c` (PR #8) impediu a quebra de linha dentro dos selos de status (`badge.tsx`).

### Versão 5 — 2026-07-23 — Documentos persistentes e reanexo de arquivos perdidos

**Commits:** `3f49ecb`, `7237401` (merge PR #9), `0bb7a24`, `2f15ee6` (merge PR #10) (abelprosp)

- **Tipo:** Correção de erro
- **Situação anterior / problema:** documentos enviados sumiam a cada nova publicação e o download falhava, porque o disco do contêiner da Railway é apagado quando a instância é substituída.
- **O que foi feito:** `3f49ecb` fez a API usar a pasta persistente (`UPLOAD_DIR` ou `RAILWAY_VOLUME_MOUNT_PATH`), indicou no `railway.toml` e no README o volume em `/app/uploads` e corrigiu o download autenticado na web.
- **Por quê:** os documentos da venda são obrigatórios e não podem se perder.

- **Tipo:** Novidade
- **Situação anterior / problema:** registros antigos continuavam no banco, mas o arquivo físico já tinha sido perdido.
- **O que foi feito:** `0bb7a24` criou a ação "Reanexar arquivo", que substitui apenas documentos cujo arquivo não existe mais, preservando o registro original, com o teste `upload-replacement.test.js`.
- **Por quê:** recuperar os documentos perdidos antes da correção do volume.

### Versão 6 — 2026-07-28 — Edição de venda e integração com o Luxus Task

**Commits:** `a5d82a2`, `0cbe58c` (merge PR #11), `6d2d5c3`, `8084987` (merge PR #12), `d28774b`, `d70f450` (merge PR #13), `a652469`, `af3ca8b` (merge PR #14), `2c26693`, `97b6290` (merge PR #15), `381471c`, `78caf4c` (merge PR #16), `ce045e5`, `4c68517` (merge PR #17) (abelprosp)

Este dia marca o início da integração com o **Luxus Task** (no `HISTORICO_DE_VERSOES.txt` corresponde à versão 1.0.0).

- **Tipo:** Novidade
- **Situação anterior / problema:** não era possível corrigir uma venda já cadastrada nem anexar o contrato depois.
- **O que foi feito:** `a5d82a2` (PR #11) criou a edição de venda (`edit-sale-dialog.tsx`) com anexo de contrato e o teste `sale-edit.test.js`.
- **Por quê:** evitar recadastrar vendas por erro de digitação.

- **Tipo:** Novidade (integração Luxus Task)
- **Situação anterior / problema:** as demandas operacionais eram tratadas fora do sistema, sem ligação com o Luxus Task, onde a equipe de operação trabalha.
- **O que foi feito:** `6d2d5c3` (PR #12) criou o módulo `task-integration`: o menu "Demandas" (antigas Solicitações) passou a ser o ponto único de novos atendimentos; o usuário escolhe um responsável ativo do Task e a API cria a demanda lá; o Task devolve status e resposta por callback protegido por chave compartilhada (`task-integration.guard.ts`). Foram criadas a migration `luxus_task_integration`, as variáveis `LUXUS_TASK_API_URL` e `LUXUS_TASK_INTEGRATION_KEY`, o teste `task-integration.test.js` e o arquivo `DOCUMENTACAO_COMPLETA.txt` (2.250 linhas). Chamados antigos ficaram em "Chamados anteriores".
- **Por quê:** integrar o Parceiros ao fluxo real de trabalho da operação.

- **Tipo:** Correção de erro / Melhoria
- **O que foi feito:** `d28774b` (PR #13) impediu que as janelas fechassem por clique acidental fora delas; `a652469` (PR #14) restringiu as demandas ao administrador; `2c26693` (PR #15) passou a criar a demanda no Task em segundo plano e criou `LUXUS_TASK_TIMEOUT_MS` (o Task hospedado em plano gratuito pode demorar a "acordar"); `381471c` (PR #16) incluiu cliente e prazo na demanda (migration `task_client_deadline`); `ce045e5` (PR #17) permitiu informar cliente manualmente e melhorou a sincronização (migration `task_manual_client`).
- **Por quê:** a criação síncrona estourava o tempo de resposta e a operação precisava de cliente e prazo para trabalhar a demanda.

### Versão 7 — 2026-07-30 — Sessão persistente, menu expandido, chamados completos e guia de uso

**Commits:** `d1af3a6`, `a40da72` (merge PR #18), `8fea2cb`, `9c4a97e` (merge PR #19), `0776fa9`, `116a866` (merge PR #20), `26fe52a`, `dea2d6b` (merge PR #21), `38a0a79`, `10a7481` (merge PR #22) (abelprosp)

- **Tipo:** Melhoria
- **Situação anterior / problema:** a sessão caía com frequência (o login só era lembrado se o usuário marcasse a opção, e o token de renovação valia 7 dias).
- **O que foi feito:** `d1af3a6` (PR #18) passou a guardar a sessão sempre no armazenamento local do navegador (migrando sessões antigas), ampliou a validade padrão do token de renovação para 365 dias (`JWT_REFRESH_EXPIRES_IN`) e tornou a renovação automática mais robusta em `apps/web/src/lib/api.ts`. O menu lateral passou a poder ser expandido; `38a0a79` (PR #22) refinou esse menu.
- **Por quê:** os usuários das lojas trabalham o dia todo no sistema e não deveriam precisar entrar novamente a cada pouco.

- **Tipo:** Novidade
- **Situação anterior / problema:** o suporte era pouco visível e não havia orientação de uso.
- **O que foi feito:** `8fea2cb` (PR #19) criou a página **Guia de uso** (`/guia-de-uso`) com instruções por perfil, destacou a abertura de chamados e passou a notificar administradores e solicitantes sobre novos chamados e respostas, com o teste `support-notifications.test.js`.
- **Por quê:** reduzir dúvidas recorrentes e garantir que nenhum chamado passe despercebido.

- **Tipo:** Correção de erro / Novidade
- **Situação anterior / problema:** respostas em chamados e demandas falhavam ou não apareciam.
- **O que foi feito:** `0776fa9` (PR #20) corrigiu o envio de respostas nas janelas de detalhe; `26fe52a` (PR #21) completou o fluxo: fila de sincronização com nova tentativa para demandas e comentários enviados ao Luxus Task (migration `support_workflow_reliability`, com estado, tentativas e próxima tentativa), descrição e aviso de prazo (SLA) nos chamados e status completos nos dois módulos.
- **Por quê:** a comunicação com a operação precisava ser confiável mesmo quando o Task estivesse indisponível.

### Versão 8 — 2026-07-31 — Indicadores de carregamento

**Commits:** `e1213c7`, `968c47a` (merge PR #23) (abelprosp)

- **Tipo:** Melhoria
- **Situação anterior / problema:** em operações demoradas (por exemplo, carregar responsáveis do Luxus Task) a tela parecia travada.
- **O que foi feito:** criação de uma barra de carregamento global (`global-loading-bar.tsx`), acionada automaticamente pelas chamadas da API, e estados de carregamento na janela de nova demanda.
- **Por quê:** dar retorno visual ao usuário e evitar cliques repetidos.

### Versão 9 — 2026-08-04 — Aprovação de vendas pelo Luxus Task, exclusão segura e contratos

**Commits:** `8aaa318` (PR #24), `382bccd` (PR #25), `cb8cdff` (PR #26), `3ef1b58` (PR #27) (abelprosp)

- **Tipo:** Novidade (integração Luxus Task)
- **Situação anterior / problema:** aprovar uma venda não gerava nada no Luxus Task; a ativação dependia de trabalho manual.
- **O que foi feito:** `8aaa318` criou o **fluxo de análise da venda** (migration `sale_task_approval_flow`): situações de análise `DRAFT` (rascunho), `AWAITING_REVIEW` (aguardando análise), `UNDER_REVIEW` (em análise), `CHANGES_REQUESTED` (correção solicitada), `APPROVED`, `REJECTED` e `CANCELLED`, e campos de sincronização com o Task (demanda, protocolo, responsável, cliente, prazo, prioridade, estado e tentativas). O administrador aprova pela janela `approve-sale-for-task-dialog.tsx`, que cria a demanda no Task. O contrato saiu da lista de documentos obrigatórios do cadastro e a constante de venda realizada passou a considerar **somente `ACTIVATED`**. `382bccd` fez a venda ser ativada e gerar comissão quando o Task informa a demanda como concluída.
- **Por quê:** a equipe de operação executa as ativações no Task; o Parceiros precisava enviar a venda aprovada e receber o resultado.

- **Tipo:** Novidade
- **O que foi feito:** `cb8cdff` criou a exclusão segura de vendas e chamados, com janela de confirmação (`delete-confirmation-dialog.tsx`), remoção dos arquivos ligados e teste `safe-deletion.test.js`.
- **Por quê:** permitir apagar registros de teste ou duplicados sem deixar arquivos órfãos.

- **Tipo:** Novidade (integração Luxus Task)
- **O que foi feito:** `3ef1b58` implementou o **ciclo de contratos** (migration `sale_contract_roundtrip`): o Task gera o contrato em branco, o administrador repassa ao parceiro, o parceiro devolve assinado e o Task valida. Foram criadas as etapas de contrato (`SaleContractStage`) e a finalidade de cada documento (`DocumentPurpose`: geral, venda original, contrato em branco, contrato assinado).
- **Por quê:** o contrato assinado é exigência da operadora e circulava fora do sistema.

### Versão 10 — 2026-08-06 — Fluxo ao vivo entre venda e Task e anexos nos dois sentidos

**Commits:** `1616b54`, `5e87bb2` (merge PR #28), `aa60261`, `399614f` (abelprosp)

A partir deste dia os commits passam a ser feitos diretamente na `main`, sem pull request.

- **Tipo:** Novidade (integração Luxus Task)
- **O que foi feito:** `1616b54` (PR #28, branch `agent/sale-task-live-workflow`) passou a mostrar na venda quem está editando a demanda no Task e o que está fazendo, além da última mensagem recebida (migration `sale_task_live_status`), e criou as etapas "aprovado no Task, aguardando revisão" e "rejeitado no Task, aguardando revisão". `aa60261` fez a janela de aprovação sugerir automaticamente responsável, cliente e prazo e unificou a aba de documentos no detalhe da venda.
- **Por quê:** dar visibilidade em tempo real do andamento da venda na operação.

- **Tipo:** Novidade (integração Luxus Task)
- **Situação anterior / problema:** anexos adicionados no Task não chegavam ao Parceiros e vice-versa.
- **O que foi feito:** `399614f` fez o callback receber todos os anexos da demanda e passou a enviar ao Task os novos uploads feitos no Parceiros.
- **Por quê:** os dois sistemas precisam ter os mesmos documentos da venda.

### Versão 11 — 2026-08-07 — Mesmo CNPJ para vários parceiros e status de contrato alinhados

**Commits:** `cbc32b9`, `419590d` (abelprosp), `939fb39` (redobrai)

- **Tipo:** Melhoria
- **Situação anterior / problema:** o CNPJ do parceiro era único, impedindo dar mais de um acesso de parceiro para a mesma empresa.
- **O que foi feito:** `cbc32b9` removeu a unicidade do documento (migration `partner_document_not_unique`) e passou a destacar na tela de Parceiros quando há cadastros compartilhando o CNPJ. `939fb39` (commit da REDOBRAI) ajustou o seed, que dependia da unicidade e quebrava o build da API.
- **Por quê:** alguns parceiros precisavam de acessos separados sob o mesmo CNPJ.

- **Tipo:** Melhoria (integração Luxus Task)
- **O que foi feito:** `419590d` passou a entregar documentos ao Task como conteúdo em memória, notificar quem abriu a venda quando o contrato muda de etapa e unificou os rótulos das etapas em `packages/types`.

### Versão 12 — 2026-08-10 — "De quem é a vez" e transferência real dos anexos

**Commits:** `ce6328a`, `7363793`, `10188af`, `6abe2d6`, `dd7193c`, `456bdd2`, `768a5b3`, `42a15f8` (abelprosp)

- **Tipo:** Novidade
- **O que foi feito:** `ce6328a` deixou visível, na lista e no detalhe da venda, **de quem é a vez** de agir (Parceiros ou Task), com filtro, selo, botão de reenvio da sincronização, origem de cada anexo e registro na linha do tempo e notificação a cada troca de vez.
- **Por quê:** evitar que a venda fique parada sem que ninguém saiba quem deve agir.

- **Tipo:** Correção de erro (integração Luxus Task)
- **Situação anterior / problema:** o Task recebia só os nomes dos anexos listados nas instruções; o callback recusava a requisição (erro HTTP 400) por causa de campos extras; arquivos voltavam para o sistema de onde tinham saído.
- **O que foi feito:** `7363793` passou a ignorar campos extras no callback; `10188af` tirou a lista de documentos das instruções e forçou a importação dos arquivos após criar a demanda; `6abe2d6` passou a enviar os arquivos (CPF, RG, chip) codificados em base64 e a gravar em `/uploads` o contrato recebido do Task; `dd7193c` fez a sincronização falhar de forma explícita quando o arquivo não existe no disco; `456bdd2` incluiu vendas já vinculadas na fila de nova tentativa; `768a5b3` aumentou o limite do corpo das requisições para 20 MB, preservou os arquivos recebidos e impediu o retorno do anexo à origem; `42a15f8` incluiu o Express nas dependências de produção, necessário para esse limite no contêiner da Railway.
- **Por quê:** a operação precisava dos arquivos reais para ativar a linha.

### Versão 13 — 2026-08-11 — Reenvio de anexos, contrato assinado e vendas de filial

**Commits:** `b63701e`, `c581d93`, `a1929a3`, `8749283`, `6dd0bec` (abelprosp), `603fc61` (RedobrAI)

- **Tipo:** Melhoria (integração Luxus Task)
- **O que foi feito:** `b63701e` e `c581d93` permitiram reenviar os anexos ao Task mesmo depois de a venda estar sincronizada, reforçando o envio logo após a aprovação e destacando o botão; `603fc61` (commit da REDOBRAI) exibiu esse botão também na aba Documentos. `a1929a3` permitiu anexar o contrato assinado e devolver a vez ao Task; `8749283` reorganizou o fluxo de contrato na aba Documentos e restringiu quem pode trocar a vez.
- **Por quê:** havia vendas em que os anexos não tinham chegado ao Task e o contrato assinado precisava voltar para validação.

- **Tipo:** Correção de erro
- **Situação anterior / problema:** vendas feitas por usuários de filial apareciam no dashboard como vendas da Matriz.
- **O que foi feito:** `6dd0bec` corrigiu a atribuição da filial ao criar a venda e no dashboard e criou o script `apps/api/prisma/fix-sale-branch-from-creator.ts` para corrigir as vendas antigas a partir de quem as criou.
- **Por quê:** o ranking e os relatórios por loja estavam errados.

### Versão 14 — 2026-08-12 — Edição até a conclusão, contador de dígitos e favicon

**Commits:** `960b3b9`, `3df8096`, `5f0867f`, `db8799c` (abelprosp)

- **Tipo:** Melhoria
- **Situação anterior / problema:** um CPF digitado errado travava a venda, porque não era possível corrigir depois do envio ao Task.
- **O que foi feito:** `960b3b9` permitiu que parceiro e administrador editem a venda enquanto ela não estiver finalizada e reenfileirem o envio ao Task; `3df8096` registrou as edições no histórico, substituiu o botão "Contestar" por "Editar" e criou o campo com contador de dígitos (`digit-countdown-input.tsx`), que mostra quantos dígitos faltam; `5f0867f` aplicou o contador ao RG (de 7 a 11 caracteres, cobrindo formatos estaduais e a Carteira de Identidade Nacional) e à UF (2 letras).
- **Por quê:** reduzir erros de digitação e permitir correção sem recadastrar.

- **Tipo:** Ajuste visual
- **O que foi feito:** `db8799c` definiu o ícone do navegador (favicon) com o pequeno globo da marca Luxus.

### Versão 15 — 2026-08-17 — Ajuste no nest-cli da API

**Commits:** `de0aeba` (abelprosp)

- **Tipo:** Manutenção
- **Situação anterior / problema:** motivo não registrado no commit.
- **O que foi feito:** o diff mostra apenas espaços acrescentados na primeira linha de `apps/api/nest-cli.json`, sem mudança de configuração. O efeito prático é um novo commit na `main`, o que normalmente dispara uma nova publicação na Railway.
- **Por quê:** motivo não registrado no commit; provavelmente forçar uma nova publicação da API.

### Versão 16 — 2026-08-18 — Pedido de vez com justificativa

**Commits:** `1875db1` (abelprosp)

- **Tipo:** Correção de erro / Novidade
- **Situação anterior / problema:** era possível trocar a vez de uma venda já concluída, e não havia como um lado pedir a vez ao outro explicando o motivo.
- **O que foi feito:** a troca de vez passou a ser bloqueada em vendas concluídas; foi criado o **pedido de vez com justificativa** entre Luxus Task, administração do Parceiros e loja (migration `sale_turn_request`, campos de quem pediu, motivo e data), com tratamento no callback do Task e na tela de detalhe da venda.
- **Por quê:** evitar alterações indevidas em vendas encerradas e registrar o motivo de cada pedido.

### Versão 17 — 2026-08-19 — Contêineres Docker isolados

**Commits:** `a1d3272` (abelprosp)

- **Tipo:** Infraestrutura/Deploy
- **Situação anterior / problema:** os contêineres locais tinham nomes genéricos (`luxus-api`, `luxus-postgres` etc.) e o NGINX ocupava a porta 80 do computador, conflitando com outros sistemas Luxus rodando na mesma máquina.
- **O que foi feito:** o `docker-compose.yml` ganhou o nome de projeto `luxus-parceiros`, os contêineres passaram a se chamar `luxus-parceiros-*` e o NGINX passou a escutar apenas em `127.0.0.1`, na porta definida por `NGINX_PORT` (padrão 8088).
- **Por quê:** permitir rodar o Parceiros ao lado de outros projetos Docker. Observação: o README ainda cita `http://localhost` na porta 80.

### Versão 18 — 2026-08-21 — API externa de consulta de vendas

**Commits:** `85b5e4e` (abelprosp)

- **Tipo:** Novidade
- **Situação anterior / problema:** sistemas de terceiros precisavam consultar vendas de parceiros sem acesso ao painel.
- **O que foi feito:** criação do módulo `external-sales` com as rotas `GET /api/integrations/external/sales` (lista paginada com filtros de busca, status, parceiro, filial, período e somente ativadas) e `GET /api/integrations/external/sales/:idOrProtocol` (detalhe por identificador ou protocolo). A autenticação é feita pelo cabeçalho `x-api-key` (ou `x-integration-key`) comparado com `EXTERNAL_SALES_API_KEY`. README e `.env.example` atualizados.
- **Por quê:** integrar outros sistemas sem expor o login de usuários.

### Versão 19 — 2026-08-24 — Resolver no Parceiros sem depender do Task

**Commits:** `62d88de`, `806ef79`, `dcd2ed4` (abelprosp)

- **Tipo:** Novidade
- **Situação anterior / problema:** toda venda e toda demanda precisava passar pelo Luxus Task; quando o Task travava, a venda ficava parada.
- **O que foi feito:** `62d88de` criou a aprovação interna (`POST /api/sales/:id/approve-internal`), que aprova e conclui a venda sem enviar ao Task, e a opção de manter uma demanda só no Parceiros (`resolveInternally`), na web e no aplicativo; a etapa "Aguardando Luxus Task" passou a mostrar o nome de quem está com a demanda no Task. `806ef79` criou a finalização forçada de venda travada no Task (`POST /api/sales/:id/force-finalize`) e a reabertura de venda concluída para correção (`POST /api/sales/:id/reopen`), ambas com justificativa obrigatória. `dcd2ed4` corrigiu um erro de TypeScript que quebrava o build.
- **Por quê:** dar ao administrador uma saída quando a integração falha ou quando a venda não precisa da operação.

### Versão 20 — 2026-08-25 — Sincronização confiável com o Task e controle de prazos

**Commits:** `31a3af6`, `dc356b0`, `48d10ab`, `d668da9`, `5880c6e`, `0b1a95d`, `c663149`, `324b6db`, `fac9eb7` (abelprosp)

- **Tipo:** Correção de erro (integração Luxus Task)
- **Situação anterior / problema:** a sincronização falhava quando o Task acusava protocolo duplicado, marcava a venda como sincronizada mesmo sem RG ou CPF terem sido enviados e mandava poucos dados da venda.
- **O que foi feito:** `dc356b0` recupera o vínculo com a demanda existente quando o Task responde que o protocolo já existe; `48d10ab` deixou de marcar como sincronizada quando faltam arquivos no disco, reenviou anexos no reforço automático e aumentou o limite do corpo das requisições para 50 MB; `d668da9` passou a enviar no assunto e nas observações a linha do chip, endereço, telefone e demais dados da venda, atualizando a demanda já existente; `5880c6e` fez o botão **Sincronizar** aguardar o resultado e mostrar o erro real; `0b1a95d` criou uma rota para o Task consultar o resumo da venda (linha, cliente e endereço) e melhorou a localização dos arquivos para download.
- **Por quê:** a operação recebia demandas incompletas e o Parceiros mostrava sucesso falso.

- **Tipo:** Melhoria
- **Situação anterior / problema:** era possível aprovar uma venda com prazo no passado e não era possível alterar o prazo depois.
- **O que foi feito:** `c663149` e `324b6db` bloquearam prazo anterior a hoje na API e no formulário de aprovação (sugestão padrão de hoje mais 7 dias); `fac9eb7` permitiu editar o prazo na edição da venda e atualizá-lo na demanda do Task.
- **Por quê:** prazos inválidos geravam demandas já atrasadas.

- **Tipo:** Ajuste visual
- **O que foi feito:** `31a3af6` refez o favicon só com a marca Luxus e fundo transparente (inclui o script auxiliar `apps/web/scripts/make-favicon-transparent.py`).

### Versão 21 — 2026-08-26 — Fluxo simplificado: o Task assume a demanda

**Commits:** `aea2ac5`, `a5fb268`, `c864e2f`, `51f4ceb`, `69045f7`, `0eec543` (abelprosp)

- **Tipo:** Correção de erro
- **Situação anterior / problema:** o prazo chegava ao Task com um dia a menos.
- **O que foi feito:** `aea2ac5` passou a tratar o prazo como data pura (formato aaaa-mm-dd), em vez de "fim do dia local" convertido para o fuso UTC, que mudava a data.
- **Por quê:** o fuso horário de Brasília (UTC−3) fazia a data "voltar" um dia na conversão.

- **Tipo:** Melhoria (integração Luxus Task)
- **Situação anterior / problema:** o vai-e-volta de "vez" entre Parceiros e Task, com contrato em branco circulando, confundia os usuários.
- **O que foi feito:** `a5fb268` simplificou o fluxo: depois do envio, **o Luxus Task assume a demanda e conclui a venda**; o Parceiros apenas espelha o andamento. Foram removidos a troca de vez e o contrato em branco (cerca de mil linhas a menos), o assunto enviado passou a ser higienizado, a conclusão passou a ser automática pelo callback e foi criada uma janela de aviso (`notification-alert-modal.tsx`) para lembretes e conclusões. `c864e2f` corrigiu um erro de TypeScript que quebrava o build na Railway. `51f4ceb` limpou a tela de documentos e passou a mostrar na lista de vendas os lembretes ("cobranças") enviados pelo Task; `69045f7` resumiu o bloco do Task no detalhe da venda, fez o aviso chegar em tempo real e permitiu marcá-lo como lido; `0eec543` aplicou a mesma lógica à aba Demandas (sem vai-e-volta, com resumo e aviso em tempo real) e atualizou o Guia de uso.
- **Por quê:** a operação conduz a execução no Task; manter dois sistemas disputando a vez gerava confusão e vendas paradas.

### Versão 22 — 2026-08-27 — Notificações e integração com o Task

**Commits:** `81814bf` (abelprosp)

- **Tipo:** Melhoria
- **Situação anterior / problema:** a mesma conclusão gerava avisos repetidos, inclusive ao reconsultar vendas já concluídas.
- **O que foi feito:** o callback passou a aceitar uma opção para não notificar, a conclusão só gera aviso se ainda não houver um aviso de "venda concluída pelo Task" para aquela venda, e os administradores e o criador da venda recebem o aviso sem duplicidade. O evento antigo `notification` continua sendo emitido porque o aplicativo móvel ainda o escuta.
- **Por quê:** reduzir avisos duplicados.

### Versão 23 — 2026-08-31 — Manual de processos

**Commits:** `e5b19d0` (abelprosp)

- **Tipo:** Documentação
- **O que foi feito:** inclusão do arquivo `Luxus Parceiros.docx` (manual de processos preenchido com dados da plataforma) na raiz do repositório. A mensagem cita um ajuste na integração com o Task, mas o commit contém apenas o documento Word.
- **Por quê:** registrar formalmente os processos de uso da plataforma.

### Versão 24 — 2026-09-03 — Receita e comissões corretas e dashboard de 30 dias

**Commits:** `585adf2`, `e045457`, `8848d23` (abelprosp)

- **Tipo:** Correção de erro
- **Situação anterior / problema:** receita e comissões do dashboard não batiam, e excluir um parceiro dava erro interno.
- **O que foi feito:** `585adf2` passou a calcular receita e comissões pela data de ativação, fez o cartão de Comissões mostrar a projeção do ciclo completo e tornou a exclusão de parceiro uma remoção em cascata dos vínculos. `e045457` corrigiu o build da web na Railway (troca de espalhamento de `Set` por `Array.from`, exigido pela configuração do TypeScript do Next.js).
- **Por quê:** os números precisam bater com as ativações e a exclusão precisa funcionar.

- **Tipo:** Melhoria
- **O que foi feito:** `8848d23` alinhou o dashboard aos últimos 30 dias por padrão (com opção de mês), criou os cartões de vendas em andamento e canceladas e passou a marcar a linha como vendida quando a venda é concluída.
- **Por quê:** dar uma visão contínua do desempenho, sem "zerar" no início do mês. A regra de data mudou de novo na Versão 35.

### Versão 25 — 2026-09-09 — Anexos em vendas abertas e clientes em lote

**Commits:** `d101c8d`, `4472efe`, `2a44c9f` (abelprosp)

- **Tipo:** Novidade
- **O que foi feito:** `d101c8d` permitiu anexar documentos e o contrato assinado em vendas abertas ou reabertas, pela aba Documentos e pelo menu de ações; o contrato assinado pode ser enviado no Parceiros ou no Task.
- **Por quê:** documentos chegavam depois do cadastro e não havia onde anexá-los.

- **Tipo:** Novidade
- **Situação anterior / problema:** o parceiro não conseguia excluir clientes, e clientes de teste com vendas ligadas não podiam ser apagados.
- **O que foi feito:** `4472efe` liberou ao parceiro a edição e a exclusão de clientes, inclusive com seleção múltipla, dentro do seu escopo, e fez as permissões do token serem recalculadas pelo perfil atual; `2a44c9f` permitiu excluir o cliente junto com vendas, linhas e solicitações de teste ligadas, bloqueando apenas quando há comissão paga.
- **Por quê:** limpar cadastros de teste e duplicados sem depender do administrador.

### Versão 26 — 2026-09-15 — Envio ao Luxus Task em modo "handoff"

**Commits:** `0cd35d7`, `0c3c0fc`, `934f404` (abelprosp)

- **Tipo:** Novidade (integração Luxus Task)
- **Situação anterior / problema:** vendas que já estavam em andamento ou concluídas fora do fluxo normal não tinham como ser enviadas ao Task.
- **O que foi feito:** `0cd35d7` criou o envio em modo **handoff** (repasse): o administrador envia a venda ao Task com o modelo atual pela janela `send-sale-to-task-dialog.tsx`; o Parceiros apenas registra o envio (migration `sale_task_handoff`) e o Task assume a finalização, sem retorno. Esse comportamento "sem retorno" foi trocado na Versão 29.
- **Por quê:** levar ao Task vendas que precisavam ser tratadas pela operação.

- **Tipo:** Correção de erro (integração Luxus Task)
- **Situação anterior / problema:** o título e as observações da demanda chegavam desorganizados, e a limpeza de texto destruía e-mails (o "@" e os pontos eram removidos, deixando o endereço ilegível).
- **O que foi feito:** `0c3c0fc` padronizou o título como nome do cliente mais número da linha, abriu a demanda com a data do dia, deixou de sobrescrever o título depois de criado e colocou os dados nas observações, com o criador "Luxus Parceiros"; `934f404` passou a preservar "@" e pontuação de e-mails.
- **Por quê:** a operação precisa identificar a demanda pelo título e copiar os dados corretamente.

### Versão 27 — 2026-09-22 — Relatórios tabulares e exportação de vendas

**Commits:** `40df1c6`, `f71bdd8` (abelprosp)

- **Tipo:** Novidade
- **O que foi feito:** `40df1c6` incluiu linha, telefone e CPF/CNPJ na coluna de detalhes das vendas exportadas pelo dashboard; `f71bdd8` ativou o botão **Exportar** na lista de vendas (`sales-export-button.tsx`) e padronizou PDF, CSV e TXT com colunas alinhadas no dashboard e nas vendas (`table-export.ts`).
- **Por quê:** facilitar a identificação do cliente e a conferência fora do sistema.

### Versão 28 — 2026-09-29 — Anexos até 50 MB e períodos do dashboard

**Commits:** `a1f4dfb`, `eb71e5b`, `7fb40b1`, `3a0cbdd` (abelprosp)

- **Tipo:** Melhoria
- **Situação anterior / problema:** anexos eram limitados a JPG, PNG, WebP e PDF e a 10 MB; se o anexo falhasse, a venda ficava pela metade.
- **O que foi feito:** `a1f4dfb` removeu a lista de tipos permitidos, subiu o limite de upload para 50 MB (API, `.env.example` e `nginx.conf`) e passou a descartar o rascunho da venda quando o envio do anexo falha.
- **Por quê:** parceiros precisavam enviar documentos em outros formatos e arquivos maiores.

- **Tipo:** Melhoria
- **O que foi feito:** `eb71e5b` separou os períodos do dashboard em mês, 30 dias, 60 dias e histórico, aplicando o mesmo intervalo aos indicadores, ao gráfico e à exportação; `7fb40b1` corrigiu a tipagem que quebrava o build da API; `3a0cbdd` é um commit sem alterações de arquivo, feito para disparar novo deploy na Railway, que não tinha publicado após a falha.
- **Por quê:** comparar períodos diferentes com números consistentes.

### Versão 29 — 2026-10-01 — Conclusão automática pela demanda do Task e troca de anexos

**Commits:** `5b726da`, `66c1ea0`, `cc13232` (abelprosp)

- **Tipo:** Melhoria (integração Luxus Task)
- **Situação anterior / problema:** coexistiam vários caminhos para concluir a venda (aprovação interna, finalização forçada, handoff sem retorno), o que gerava divergência entre os sistemas.
- **O que foi feito:** `5b726da` definiu que **a venda só é concluída quando o Luxus Task conclui a demanda**. A aprovação interna e a finalização forçada criadas na Versão 19 foram desativadas (a rota de aprovação interna passou a recusar o pedido), o envio ao Task passou a ter retorno, e o Guia de uso foi atualizado.
- **Por quê:** ter uma única fonte de verdade para a conclusão da venda.

- **Tipo:** Novidade
- **O que foi feito:** `66c1ea0` permitiu trocar e acrescentar anexos da venda antes do envio ao Task; `cc13232` passou a enviar ao Task também a troca de anexo feita com a venda já em andamento.
- **Por quê:** corrigir documentos errados sem refazer a venda.

### Versão 30 — 2026-10-05 — Excel do dashboard e exclusão de anexos

**Commits:** `52df8c3` (abelprosp)

- **Tipo:** Melhoria / Novidade
- **O que foi feito:** o relatório do dashboard passou a ser uma planilha Excel com abas e colunas (biblioteca write-excel-file); foi criada a exclusão de anexos da venda, que também remove o arquivo no Task; a troca de anexo mostra carregamento; e o aviso de status do Task deixou de falhar quando um campo opcional vem vazio.
- **Por quê:** o CSV não era confortável para análise e havia anexos enviados por engano.

### Versão 31 — 2026-10-06 — Venda de eSIM e vendas já concluídas no Task

**Commits:** `54a7880`, `8749cae`, `4ff44d0`, `dff5ad9` (abelprosp)

- **Tipo:** Novidade
- **Situação anterior / problema:** o sistema só previa venda com chip físico.
- **O que foi feito:** `54a7880` criou o tipo de venda **eSIM** (migration `sale_sim_type`, valores `CHIP` e `ESIM`), com documentos obrigatórios próprios, e o aviso quando chegam anexos novos do Task; `8749cae` passou a pedir na venda eSIM o IMEI (15 dígitos), o EID (32 dígitos), o sistema do aparelho (iOS ou Android) e a foto da tela do aparelho (migration `sale_esim_device`, documento `DEVICE_SCREEN`).
- **Por quê:** a Luxus passou a vender eSIM, que exige dados do aparelho para ativação.

- **Tipo:** Correção de erro (integração Luxus Task)
- **Situação anterior / problema:** vendas cuja demanda já estava concluída no Task continuavam abertas no Parceiros.
- **O que foi feito:** `4ff44d0` passou a concluir no Parceiros a venda já concluída no Task; `dff5ad9` corrigiu o reconhecimento do status de demanda concluída que o Task devolve.
- **Por quê:** manter os dois sistemas com a mesma situação.

### Versão 32 — 2026-10-07 — Upgrade de plano, cópia de vendas históricas e filtros

**Commits:** `e3d99c0`, `b0ad00b`, `7170bf5`, `059ca2d`, `56adc8b` (abelprosp)

- **Tipo:** Novidade
- **O que foi feito:** `e3d99c0` criou o **upgrade de plano** a partir de uma venda anterior (migration `sale_upgrade`, campos `isUpgrade` e `upgradeOfSaleId`), copiando cliente e documentos.
- **Por quê:** clientes que trocam de plano não precisam ter todos os dados recadastrados.

- **Tipo:** Novidade (integração Luxus Task)
- **Situação anterior / problema:** havia vendas executadas diretamente no Task que não existiam no Parceiros.
- **O que foi feito:** `b0ad00b` criou a **cópia histórica** (`historical-sales.service.ts`, rota `POST /api/integrations/external/sales/historical`, protegida pela chave da API externa), que copia para o Parceiros uma demanda existente do Task sem reabri-la nem alterá-la, com o teste `historical-sale.test.js`; `7170bf5` passou a usar a data de abertura da demanda no Task como data da venda; `059ca2d` passou a copiar demandas ainda abertas sem marcá-las como concluídas.
- **Por quê:** completar o histórico de vendas e comissões dos parceiros.

- **Tipo:** Melhoria
- **O que foi feito:** `56adc8b` criou filtros de vendas por andamento, intervalo de datas e parceiro.

### Versão 33 — 2026-10-09 — Alias de caminhos e mover venda histórica

**Commits:** `b24ef85`, `8baa2ee` (abelprosp)

- **Tipo:** Manutenção
- **O que foi feito:** `b24ef85` removeu o `baseUrl` do `apps/api/tsconfig.json` e escreveu o alias `@/*` como caminho relativo (`./src/*`). Motivo não registrado no commit; o efeito é a mesma resolução de imports sem depender de `baseUrl`.

- **Tipo:** Novidade
- **O que foi feito:** `8baa2ee` criou a rota `POST /api/integrations/external/sales/historical/rehome`, que move uma venda histórica copiada para o parceiro dono correto.
- **Por quê:** vendas históricas podiam ter sido copiadas para o parceiro errado.

### Versão 34 — 2026-10-14 — Envio ao telefonia-2 (Luxus Connect) e escolha de cobrança

**Commits:** `0348c68`, `77987f3`, `fb32503` (abelprosp)

Este dia marca o início da integração com o **telefonia-2**, sistema de faturamento da Luxus (Luxus Connect).

- **Tipo:** Novidade (integração telefonia-2)
- **Situação anterior / problema:** vendas concluídas precisavam ser cadastradas manualmente no sistema de faturamento.
- **O que foi feito:** `0348c68` criou o módulo `telefonia-intake`, que envia a venda concluída ao telefonia-2 em fila com nova tentativa (migration `telefonia_intake`, com estado, erro, tentativas e identificador do cliente no telefonia-2). O envio nunca desfaz a conclusão da venda; sem URL ou chave configurada, o envio apenas fica aguardando. Variáveis `TELEFONIA_INTAKE_URL`, `TELEFONIA_INTAKE_API_KEY` e `TELEFONIA_INTAKE_TIMEOUT_MS`. `77987f3` passou a usar a rota de entrada publicada pelo telefonia-2 (`/v1/intake/customers`, autenticada pelo cabeçalho `X-API-Key`), ajustou o pacote enviado às regras de lá (telefone de 10 a 15 dígitos, ICCID de 19 a 22, IMEI de 15, EID de 32, até 10 anexos de no máximo 8 MB cada e 16 MB no total; dados inválidos vão para as observações em vez de bloquear) e enfileirou também as vendas já concluídas.
- **Por quê:** levar automaticamente ao faturamento as vendas cobradas pela Luxus.

- **Tipo:** Novidade
- **Situação anterior / problema:** nem toda venda é cobrada pela Luxus, e as que não são não devem ir ao faturamento.
- **O que foi feito:** `77987f3` criou o campo **cobrança pela Luxus** (`billedByLuxus`, migration `sale_billed_by_luxus`, padrão "sim" para as vendas existentes), escolhido no cadastro e na edição; só vendas com cobrança pela Luxus entram na fila. `fb32503` trocou o texto da opção para explicar que a venda "vai ou não vai para o sistema de faturamento da Luxus", sem citar o nome interno "telefonia-2".
- **Por quê:** quem cadastra precisa entender a consequência da escolha.

### Versão 35 — 2026-10-19 — Dashboard pela data da venda e importação por planilha

**Commits:** `0b16b67`, `2d45af7` (abelprosp)

- **Tipo:** Correção de erro
- **Situação anterior / problema:** vendas antigas concluídas tarde no Task apareciam no mês da conclusão, inflando o mês e não batendo com a lista de vendas.
- **O que foi feito:** `0b16b67` fez vendas realizadas, receita, comissões e gráfico do dashboard usarem a data de criação da venda (a data em que foi vendida); cancelamentos continuam pela data do cancelamento. O teste do dashboard foi ajustado.
- **Por quê:** o dashboard precisa bater com o relatório de vendas.

- **Tipo:** Novidade
- **Situação anterior / problema:** cadastrar muitas vendas uma a uma era lento, e havia vendas concluídas no Task que ainda não estavam no Parceiros.
- **O que foi feito:** `2d45af7` criou a **importação de vendas por planilha** (botão "Importar" em Vendas, `sales-import-button.tsx` e `apps/web/src/lib/sales-import.ts`; rota `POST /api/sales/import`, com validação em `sales-import.parse.ts` e gravação em `sales-import.service.ts`). Há dois tipos: "vendas novas", que entram aguardando análise e seguem o fluxo normal até o Task (administrador, parceiro e filial), e "vendas já concluídas no Luxus Task" (só administrador), que entram concluídas, com comissão, sem alterar o Task. A planilha modelo `.xlsx` traz abas de instruções, planos e, para o administrador, parceiros e lojas. Cada linha é validada isoladamente (até 300 por arquivo) e o resultado mostra o erro de cada linha. O Guia de uso foi atualizado e foi criado o arquivo `HISTORICO_DE_VERSOES.txt` na raiz.
- **Por quê:** agilizar cadastros em massa e completar o histórico de vendas.

## 5. Decisões técnicas importantes

- **Monorepo com pnpm e Turborepo:** API, web, aplicativo e pacotes compartilhados no mesmo repositório, para que tipos, enums, rótulos e permissões (`packages/types`) sejam iguais em todas as pontas. Por isso os Dockerfiles compilam `@luxus/types` e `@luxus/utils` antes da API e da web (Versão 1).
- **Prisma 6 fixado:** o Prisma 7 era baixado automaticamente no contêiner e quebrava as migrations; a versão 6 foi fixada (Versão 1). As migrations rodam a cada inicialização da API com `prisma migrate deploy`.
- **Seed opcional:** o seed de demonstração só roda com `RUN_DB_SEED=true`, para não recriar dados em produção a cada deploy (Versão 1).
- **Isolamento aplicado no backend:** o escopo por parceiro e por filial é calculado na API a partir do usuário autenticado (`partner-scope.ts` e `branch-scope.ts`), nunca a partir do que o navegador envia (Versões 1 e 3).
- **Uploads em volume persistente:** os arquivos ficam no disco da API, em volume montado em `/app/uploads` na Railway; o sistema não usa armazenamento em nuvem externo (Versão 5).
- **"Venda realizada" é só `ACTIVATED`:** começou como `APPROVED` e `ACTIVATED` (Versão 4) e passou a ser somente `ACTIVATED` quando a aprovação virou etapa intermediária antes do Task (Versão 9).
- **Integração com o Luxus Task servidor-a-servidor, com fila:** a criação de demandas e a sincronização de vendas usam fila com nova tentativa (campos de estado, tentativas e próxima tentativa) para tolerar lentidão ou indisponibilidade do Task (Versões 6, 7 e 9). Os anexos trafegam em base64 dentro do JSON, o que exigiu aumentar o limite do corpo das requisições (20 MB na Versão 12 e 50 MB na Versão 20).
- **O Luxus Task é a fonte de verdade da conclusão:** depois de várias tentativas de fluxo com "vez" alternando entre os sistemas (Versões 12 a 19), o fluxo foi simplificado (Versão 21) e, por fim, a venda só conclui quando a demanda do Task conclui (Versão 29). As saídas de emergência no Parceiros (aprovação interna e finalização forçada) foram desativadas.
- **Prazos como data pura:** prazos são enviados no formato aaaa-mm-dd, sem hora, para evitar que o fuso horário mude o dia (Versão 21).
- **Dashboard pela data da venda:** a data de referência das métricas mudou de ativação (Versão 24) para criação da venda (Versão 35), para bater com a lista de vendas.
- **Faturamento separado e não bloqueante:** o envio ao telefonia-2 nunca desfaz a conclusão da venda e só ocorre para vendas com cobrança pela Luxus (Versão 34).
- **Planilhas geradas e lidas no navegador:** write-excel-file e read-excel-file geram e leem `.xlsx` na web; a API recebe as linhas já lidas e valida cada uma (Versões 30 e 35).

## 6. Problemas recorrentes e lições aprendidas

- **Build quebrado por erro de TypeScript na Railway:** aconteceu várias vezes (`dcd2ed4`, `c864e2f`, `e045457`, `7fb40b1`). Rode `pnpm build` antes de enviar para a `main`, porque o deploy é automático e uma falha de build deixa a versão anterior no ar.
- **Commits feitos só para disparar deploy:** `de0aeba` (espaços no `nest-cli.json`) e `3a0cbdd` (commit sem arquivos). Quando a Railway não publicar após uma falha, prefira o botão de redeploy no painel a commits artificiais.
- **Arquivos perdidos no disco da Railway:** sem volume persistente, documentos somem a cada publicação (Versão 5). Confira sempre que o volume está montado em `/app/uploads` no serviço da API, e só nele.
- **Sincronização de anexos com o Task:** foi o tema mais corrigido do projeto (Versões 10 a 13, 20, 29 e 30): nomes em vez de arquivos, erro 400 por campos extras, anexos voltando à origem, sucesso falso sem RG ou CPF. Ao mexer nessa parte, rode os testes `task-integration.test.js` e teste uma venda real de ponta a ponta.
- **Avisos duplicados:** callbacks repetidos do Task geravam notificações repetidas (Versão 22). Novos eventos devem verificar se o aviso já foi emitido.
- **Fuso horário:** datas convertidas para UTC mudavam o dia do prazo (Versão 21). Trate datas sem hora como texto aaaa-mm-dd.
- **Mudanças de regra no dashboard:** a regra de data das métricas mudou duas vezes (Versões 24 e 35). Qualquer nova mudança deve atualizar o teste `dashboard-filters.test.js` e o Guia de uso.
- **Mensagens de commit vagas:** nas Versões 1 e 2 muitas mensagens não descrevem a mudança ("jmekj", "klndkjn"), o que dificulta rastrear problemas. Use mensagens descritivas.

## 7. Pendências, riscos e próximos passos sugeridos

- **README desatualizado em pontos importantes:** diz que vendas `APPROVED` e `ACTIVATED` contam nos indicadores (hoje só `ACTIVATED` conta), que os uploads aceitam só JPG, PNG, WebP e PDF (hoje qualquer tipo até 50 MB) e que o NGINX local responde em `http://localhost` na porta 80 (hoje o padrão é `127.0.0.1:8088`). Também não descreve o telefonia-2 nem a importação por planilha. Justificativa: quem chega se orienta primeiro pelo README.
- **Credenciais de demonstração publicadas no README:** o README lista e-mails e senha inicial dos usuários de demonstração do seed. Justificativa: se o seed já tiver rodado em produção, essas contas existem lá; confirme que `RUN_DB_SEED=false` em produção e que essas senhas foram trocadas ou as contas removidas.
- **Token de renovação com validade padrão de 365 dias:** definido na Versão 7 para manter a sessão. Justificativa: um token roubado vale por muito tempo; avalie um prazo menor via `JWT_REFRESH_EXPIRES_IN` ou revogação por inatividade.
- **Dependência forte do Luxus Task para concluir vendas:** desde a Versão 29 não há mais finalização forçada no Parceiros. Justificativa: se o Task ficar fora do ar por muito tempo, as vendas não concluem; vale documentar um procedimento de contingência.
- **Duas numerações de versão:** este documento (Versões 0 a 35, por dia) e o `HISTORICO_DE_VERSOES.txt` (0.1.0 a 1.12.0). Justificativa: evitar confusão; combine qual será a referência oficial e mantenha as duas sincronizadas ou aposente uma.
- **Arquivos soltos na raiz:** `Luxus Parceiros.docx` versionado (213 KB) e a pasta `__pycache__/` (não versionada) na raiz. Justificativa: documentos binários no Git não mostram diferenças; considere movê-los para `docs/` ou para um repositório de documentos.
- **Aplicativo móvel pouco acompanhado:** a última mudança em `apps/mobile` foi na Versão 19 (24/08/2026), e ele ainda escuta o evento antigo `notification`. Justificativa: funcionalidades recentes (eSIM, upgrade, importação, cobrança pela Luxus) podem não existir no aplicativo.
- **Muitas branches antigas:** dezenas de branches `agent/*`, `fix/*` e `railway/*` já mescladas. Justificativa: limpar facilita a navegação no repositório.

## 8. Glossário

| Termo | Significado |
| --- | --- |
| Parceiro | Empresa revendedora que vende linhas e planos em nome da Luxus Telefonia |
| Matriz / Filial | A matriz é o cadastro principal do parceiro; filiais são as lojas ligadas a ele, com usuários próprios (perfil `ATTENDANT`) |
| Luxus Task | Sistema interno de demandas do Grupo Luxus, onde a equipe de operação executa ativações e atendimentos |
| Demanda | Tarefa criada no Luxus Task; no Parceiros, o menu "Demandas" substituiu o antigo "Solicitações" |
| Protocolo | Identificador da venda ou da demanda usado para localizar o registro nos dois sistemas |
| Callback | Chamada que o Luxus Task faz à API do Parceiros para informar mudanças de status, respostas e anexos |
| Sincronização (sync) | Envio dos dados e anexos da venda ao Task, com estados como pendente, processando, sincronizado, nova tentativa e falha |
| Vez | Indicação de qual lado (Parceiros, loja ou Task) deve agir na venda; usada entre as Versões 12 e 21 e depois removida |
| Handoff | Repasse de uma venda ao Task para que ele assuma a finalização (Versão 26) |
| Cópia histórica | Cópia para o Parceiros de uma demanda que já existia no Task, sem alterar o Task (Versão 32) |
| telefonia-2 / Luxus Connect | Sistema de faturamento da Luxus que recebe as vendas concluídas com cobrança pela Luxus |
| Cobrança pela Luxus | Opção da venda (`billedByLuxus`) que define se ela vai para o sistema de faturamento da Luxus |
| Portabilidade | Venda em que o cliente traz o número de outra operadora (a operadora doadora) |
| Operadora doadora | Operadora de origem do número na portabilidade (Vivo, TIM, Claro, Surf ou outra) |
| ICCID | Número de série do chip (SIM card), com 19 a 22 dígitos |
| eSIM | Chip virtual, ativado no aparelho sem chip físico |
| IMEI | Identificador do aparelho celular, com 15 dígitos |
| EID | Identificador do chip embutido do aparelho, usado no eSIM, com 32 dígitos |
| Upgrade de plano | Nova venda criada a partir de uma venda anterior para trocar o plano do cliente |
| Venda realizada | Venda com status `ACTIVATED`; só ela conta em indicadores, rankings e comissões |
| Análise da venda | Etapa em que o administrador confere a venda antes de enviá-la ao Task (rascunho, aguardando análise, em análise, correção solicitada, aprovada, rejeitada, cancelada) |
| Comissão | Valor devido ao parceiro por venda realizada (previsão, aprovada, paga, cancelada) |
| CIN | Carteira de Identidade Nacional, novo formato do RG |
| UF | Unidade federativa (sigla do estado, com 2 letras) |
| SLA | Prazo de atendimento acordado para um chamado |
| Railway | Plataforma de hospedagem onde a API e a web rodam em produção |
| Seed | Script que cria dados de demonstração no banco |
| Migration | Script versionado que altera a estrutura do banco de dados |
| REDOBRAI | Empresa/equipe que mantém uma cópia do repositório (remoto `redobrai`) e contribui com o projeto |
