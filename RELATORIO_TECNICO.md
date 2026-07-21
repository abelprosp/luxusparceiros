# Relatório técnico — Luxus Parceiros

Data da revisão: 21/07/2026

## Resultado

O projeto foi revisado no backend NestJS, frontend Next.js, aplicativo Expo, modelo Prisma e infraestrutura Docker. Foram corrigidas falhas de isolamento entre parceiros, inconsistências do fluxo de portabilidade, integrações ausentes do aplicativo móvel, fragilidades de autenticação e problemas que impediam os comandos de build/teste e a execução em contêiner.

## Regras de negócio implementadas

### Matriz, filiais, planos e operadoras

- Planos continuam vinculados ao parceiro comercial (matriz), e não individualmente às filiais.
- Todas as filiais passam a consultar os mesmos planos e operadoras derivados do parceiro ao qual pertencem.
- A API valida que a filial escolhida em uma venda pertence ao mesmo parceiro.
- Usuários atendentes permanecem restritos à própria filial.

### Isolamento entre parceiros

- Qualquer usuário vinculado a um `partnerId`, inclusive um usuário com papel `ADMIN`, fica limitado ao próprio parceiro.
- Somente administrador/supervisor sem vínculo com parceiro é tratado como administrador da plataforma.
- Consultas de parceiros, filiais, clientes, vendas, planos, operadoras, linhas, chips, estoque, financeiro, auditoria, dashboard, notificações e usuários receberam escopo de tenant no backend.
- O seletor de parceiro da nova venda não expõe concorrentes para usuários de parceiro: mostra somente a matriz e as suas filiais.
- A restrição não depende apenas da interface; a API rejeita tentativas de acesso cruzado.

### Portabilidade e documentos

- O contrato assinado deixou de bloquear o registro inicial de uma venda com portabilidade.
- Foto do chip, CPF e RG continuam obrigatórios nesse fluxo.
- Venda comum continua exigindo o contrato.
- Aprovação/ativação é bloqueada enquanto houver documento obrigatório pendente.
- A validação que exige telefone de contato diferente da linha vendida foi preservada.

### Chamados e solicitações

- Não foram unificados porque o comentário recebido registra que o método ainda precisa ser validado com o Rafa.
- Fazer essa mudança sem a definição do fluxo poderia apagar distinções de categoria, status e responsabilidades existentes.

## Segurança e consistência

- Corrigido o vazamento horizontal de dados entre parceiros.
- Administradores vinculados a parceiros não podem mais alterar catálogos globais de planos/operadoras.
- Adicionada troca de senha autenticada com revogação dos refresh tokens existentes.
- Segredos JWT deixaram de ter valores inseguros implícitos no Docker Compose.
- CORS HTTP e WebSocket agora usam origens configuradas.
- Portas internas de PostgreSQL, Redis, API e Web ficam vinculadas a `127.0.0.1` por padrão.
- O seed deixou de redefinir senhas de usuários existentes.

## Integração web/mobile

- Criadas rotas de perfil e dados bancários usadas pelo aplicativo móvel.
- Corrigido o nome do evento de atualização de venda no socket do aplicativo.
- O perfil móvel agora carrega os dados bancários existentes.
- Ajustados aviso de imagem do Next e dependência de efeito das notificações.
- Adicionadas permissões de leitura necessárias ao atendente para registrar vendas.

## Docker e deploy

- Nginx corrigido para preservar o prefixo `/api` ao encaminhar requisições.
- Rota do Socket.IO corrigida no proxy.
- Adicionados healthchecks de API e Web e dependências condicionadas à saúde dos serviços.
- A API executa `prisma migrate deploy` ao iniciar; seed é opcional e idempotente.
- Dockerfiles usam lockfile congelado e cópia correta dos módulos do workspace.
- A imagem da API define proprietário durante o `COPY`, evitando `chown` recursivo lento no Docker Desktop/Windows.
- Entrypoint normaliza CRLF para funcionar em Linux.
- Build standalone do Next é ativado somente em contêiner, mantendo o build local compatível com Windows.
- Variáveis e instruções de execução foram atualizadas em `.env.example` e `README.md`.
- `docker compose config --quiet` foi executado com sucesso.

## Diagnóstico do Docker Desktop desta máquina

- Docker Desktop 4.83.0 está instalado em modo por usuário.
- Cliente Docker 29.6.2 e Docker Compose 5.3.1 estão instalados.
- O log do Docker registra `Virtual Machine Platform not enabled`, `No virtualization available` e `DockerDesktop/Wsl/NotInstalled`.
- A virtualização do processador está habilitada no firmware.
- Foram habilitados `Microsoft-Windows-Subsystem-Linux` e `VirtualMachinePlatform` com DISM.
- Foi instalado somente o componente WSL 2.7.10 sem Ubuntu ou outra distribuição de usuário.
- A única distribuição criada é `docker-desktop`, interna e necessária ao motor do Docker.
- O caminho do CLI já consta no `PATH` do usuário; um terminal aberto antes da instalação só o reconhecerá após ser reaberto/reiniciado.
- O motor Docker 29.6.2 foi iniciado e validado.

O ambiente está em execução. Comandos de operação na raiz do projeto:

```powershell
docker compose ps
docker compose logs --tail 100 api web nginx postgres redis
docker compose down
```

## Testes executados

- `pnpm test`: 7 testes aprovados, 0 falhas.
  - administrador vinculado permanece no próprio parceiro;
  - administrador da plataforma mantém visão global;
  - parceiro não consulta outro parceiro;
  - financeiro global mantém o filtro permitido;
  - venda comum exige contrato;
  - portabilidade não exige contrato no cadastro inicial;
  - regra documental global não sofre mutação acidental.
- `pnpm lint`: aprovado em types, utils, UI, API, mobile e web.
- Build aprovado em types, utils, UI, API e Web.
- Next gerou 23 páginas estáticas de produção.
- Smoke test Web local:
  - `/` → HTTP 307 (redirecionamento esperado);
  - `/login` → HTTP 200 e marca Luxus presente;
  - `/vendas` → HTTP 200.
- Smoke test API:
  - inicialização de módulos e registro de todas as rotas aprovados;
  - migrations e seed executados no PostgreSQL do Compose;
  - healthcheck retornou HTTP 200;
  - login administrativo e login de parceiro aprovados;
  - consultas autenticadas de perfil, parceiros, vendas, filiais, planos e operadoras aprovadas;
  - acessos cruzados a filiais, vendas e clientes de outro parceiro retornaram HTTP 403.
- Filtros combinados de paginação, parceiro, status e tipo foram corrigidos em filiais, clientes, chamados, financeiro e auditoria.
- `git diff --check`: sem erros de whitespace; somente avisos informativos de conversão LF/CRLF do Git no Windows.

## Comandos de qualidade corrigidos

- O projeto declarava Jest sem instalar/configurar Jest e não possuía testes.
- Foi criada uma suíte usando o executor nativo do Node, sem dependência adicional.
- O lint da API chamava ESLint sem configuração; passou a usar a checagem estrita do TypeScript.
- A política de Controle de Aplicativo desta máquina bloqueia `turbo.exe`; os comandos raiz de build, lint e teste agora usam pnpm diretamente.

## Estado final do ambiente

- `luxus-postgres`: saudável em `127.0.0.1:5432`.
- `luxus-redis`: saudável em `127.0.0.1:6379`.
- `luxus-api`: saudável em `127.0.0.1:3001`.
- `luxus-web`: saudável em `127.0.0.1:3000`.
- `luxus-nginx`: acessível em `http://localhost`.
