# Relatório de melhorias — 22/07/2026

## Implementado neste ciclo

- Menu lateral com aviso visível **Mais opções** e seta animada quando existem itens abaixo da área visível.
- Ordenação crescente e decrescente ao clicar nos títulos das colunas de todas as tabelas.
- Indicadores, gráficos e painéis do dashboard com acesso a detalhes.
- Endpoint protegido para detalhes do dashboard, limitado ao parceiro e à filial do usuário autenticado.
- Exportação discreta do dashboard em PDF, CSV compatível com Excel e TXT.
- Fluxo de exportação com escolha de formato, confirmação, progresso e download.
- Relatórios contendo somente vendas realizadas (`APPROVED` e `ACTIVATED`).
- Comissões canceladas deixam de compor o dashboard e o recorte por filial também é respeitado.
- Dependências de Excel vulneráveis foram descartadas; o CSV é gerado nativamente no navegador.

## Melhorias adicionais recomendadas por aba

### Dashboard

- Comparação com período anterior e metas projetadas.
- Agendamento de relatórios por e-mail para cada parceiro.
- Favoritos para salvar combinações de filtros usadas com frequência.

### Parceiros

- Indicador de saúde do parceiro, reunindo vendas, chamados, estoque e documentos pendentes.
- Linha do tempo única com alterações cadastrais, filiais, planos e usuários.
- Checklist de cadastro completo para evitar parceiro ativo com dados essenciais ausentes.

### Usuários

- Exibir último acesso, sessões ativas e histórico de bloqueios.
- Autenticação em dois fatores e encerramento remoto de sessões.
- Perfis de permissão reutilizáveis para acelerar novos cadastros.

### Solicitações

- Prazo de SLA visível, alertas de vencimento e responsável atual.
- Modelos de solicitações recorrentes com campos obrigatórios por tipo.
- Vínculo direto com venda, cliente, linha ou chamado relacionado.

### Operadoras

- Contatos operacionais, canais de escalonamento e SLA por operadora.
- Registro de indisponibilidades e incidentes que impactam ativações.
- Painel comparativo de aprovação, rejeição e tempo médio de ativação.

### Planos

- Histórico de versões de preço e comissão, preservando vendas antigas.
- Comparador lado a lado de planos e simulador de comissão.
- Vigência programada para ativar ou encerrar ofertas automaticamente.

### Estoque

- Alertas de estoque mínimo por parceiro, filial e operadora.
- Idade do estoque para identificar chips e linhas parados há muito tempo.
- Inventário por leitura de código de barras/ICCID e conciliação de divergências.

### Vendas

- Funil por etapa com taxa de aprovação, ativação e motivo de rejeição.
- Alertas de possível duplicidade por cliente, documento, linha ou ICCID.
- Fila de recuperação para vendas rejeitadas ou com documentos pendentes.
- Linha do tempo completa da venda, incluindo arquivos, decisões e responsáveis.

### Comissões

- Calendário de previsão e pagamento por parceiro.
- Conciliação em lote e comprovante associado ao pagamento.
- Fluxo de contestação com prazo, justificativa e histórico de decisão.

### Chamados

- Cronômetro de SLA por prioridade e alerta de escalonamento.
- Base de conhecimento vinculada às categorias mais recorrentes.
- Respostas prontas e vinculação com cliente, venda ou linha afetada.

### Financeiro

- Fluxo de caixa projetado e comparativo realizado versus previsto.
- Conciliação bancária e anexos de comprovantes.
- Centros de custo por parceiro, filial, campanha e operadora.

### Campanhas

- Taxa de conversão, retorno sobre investimento e custo por venda.
- Segmentação por parceiro, região, plano e operadora.
- Duplicação de campanhas e comparação de desempenho entre períodos.

### Auditoria

- Visualização lado a lado dos valores anteriores e novos.
- Alertas para ações sensíveis ou comportamento incomum.
- Política configurável de retenção e exportação dos registros.

### Clientes

- Visão 360° com vendas, linhas, solicitações, chamados e documentos.
- Detecção e mesclagem assistida de cadastros duplicados.
- Registro de consentimento e solicitações relacionadas à LGPD.

### Filiais

- Comparativo de desempenho, metas e ranking interno entre filiais.
- Contatos, horários de atendimento e responsáveis locais.
- Painel de estoque, vendas e pendências específico de cada unidade.

### Configurações

- Preferências de notificações por evento e canal.
- Formato padrão de exportação e período padrão do dashboard.
- Identidade visual de relatórios, incluindo logo e dados da empresa.

### Perfil

- Autenticação em dois fatores, dispositivos conectados e histórico de acesso.
- Preferências pessoais de tema, idioma e página inicial.

## Prioridade técnica identificada

A auditoria das dependências existentes encontrou alertas relevantes em versões antigas de Next.js, Multer, `tar` e dependências do aplicativo mobile. A exportação nova não mantém bibliotecas de Excel vulneráveis, mas recomenda-se um ciclo separado de atualização estrutural, acompanhado por testes de regressão, pois algumas correções exigem atualização de versões principais.

## Validações executadas

- Build completo dos pacotes compartilhados, API e frontend.
- Testes automatizados da API: 11 aprovados.
- Verificação TypeScript do frontend.
- Build otimizado do Next.js.
- Teste autenticado do endpoint de detalhes com administrador e parceiro.
- Verificação de saúde dos containers Docker e resposta HTTP do frontend.
