'use client';

import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  FileSpreadsheet,
  FileText,
  Headphones,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react';
import { UserRole } from '@luxus/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface GuideSection {
  title: string;
  description: string;
  icon: typeof BookOpen;
  steps: string[];
}

const commonSections: GuideSection[] = [
  {
    title: 'Menu e navegação',
    description: 'Encontre cada área sem perder o ponto em que estava.',
    icon: BookOpen,
    steps: [
      'Use a seta no alto do menu para alternar entre ícones e nomes.',
      'No celular, abra o menu pelo botão no cabeçalho.',
      'O sistema mantém a posição do menu ao trocar de página.',
    ],
  },
  {
    title: 'Notificações',
    description: 'O sino concentra novidades que exigem atenção.',
    icon: Bell,
    steps: [
      'O número azul mostra quantas notificações ainda não foram lidas.',
      'Clique em uma notificação para abrir diretamente o chamado, demanda ou venda.',
      'Use “Marcar todas” quando terminar a conferência.',
    ],
  },
  {
    title: 'Segurança e acesso',
    description: 'Cada perfil enxerga somente as informações permitidas.',
    icon: ShieldCheck,
    steps: [
      'Parceiros e atendentes ficam restritos à própria empresa e às filiais autorizadas.',
      'Nunca compartilhe sua senha; cada pessoa deve usar seu próprio usuário.',
      'Para encerrar o acesso neste dispositivo, use a opção Sair.',
    ],
  },
];

const billingStep =
  'Em toda venda nova, marque a Cobrança: “feita pela Luxus” manda a venda concluída para o sistema de faturamento da Luxus; “não feita pela Luxus” não manda.';

const dashboardStep =
  'No Dashboard, a venda conta no mês em que foi feita (data da venda), mesmo que o Luxus Task conclua depois. Cancelamentos contam pela data do cancelamento.';

const importNewSteps = [
  'Em Vendas, clique em “Importar” e escolha “Vendas novas (vão para aprovação)”.',
  'Clique em “Baixar planilha”: ela traz a aba Vendas, as instruções de cada coluna e a lista de planos.',
  'Preencha uma venda por linha a partir da linha 2, sem mudar os títulos. Colunas com * são obrigatórias, inclusive “Cobrança pela Luxus” (Sim ou Não).',
  'Envie o arquivo e clique em “Importar”. Cada venda entra direto em análise; o administrador pode pedir as fotos (chip, CPF, RG), que a planilha não leva.',
  'Se alguma linha der erro, o sistema mostra o número da linha e o motivo. Corrija só essas linhas, apague as que já entraram e envie de novo.',
];

const adminSections: GuideSection[] = [
  {
    title: 'Análise e envio de vendas',
    description: 'Do rascunho do parceiro até a conclusão no Luxus Task.',
    icon: ShoppingCart,
    steps: [
      'Vendas enviadas pelos parceiros (ou importadas por planilha) aparecem como Aguardando análise.',
      'Confira cliente, plano, linha, formato do contrato e anexos. Se faltar algo, peça correção ou documentos.',
      'Ao aprovar, escolha cliente, responsável e prazo: a venda segue para o Luxus Task.',
      'A venda só fica concluída quando a demanda for concluída no Luxus Task.',
      billingStep,
    ],
  },
  {
    title: 'Importar vendas por planilha',
    description: 'Cadastre muitas vendas de uma vez com a planilha padrão.',
    icon: FileSpreadsheet,
    steps: [
      'Em Vendas, clique em “Importar” e escolha o tipo: “Vendas novas (vão para aprovação)” ou “Vendas já concluídas no Luxus Task”.',
      'Baixe a planilha do tipo escolhido. Ela traz instruções e as listas de planos, parceiros e lojas, para escrever os nomes iguais ao cadastro.',
      'Vendas novas: entram em análise e seguem o fluxo normal até o Luxus Task.',
      'Vendas concluídas: informe o protocolo do Luxus Task e a data da venda. Entram como concluídas, com comissão, e nada é alterado no Luxus Task. Um protocolo só pode ser importado uma vez.',
      'Linhas com erro não impedem as outras. O resultado mostra a linha e o motivo de cada erro.',
    ],
  },
  {
    title: 'Dashboard e relatórios',
    description: 'Números de vendas, comissão e projeção.',
    icon: BarChart3,
    steps: [
      dashboardStep,
      'Use os filtros de período, parceiro e loja antes de exportar o relatório em Excel.',
      'Comissão e projeção seguem a mesma data da venda usada na contagem.',
    ],
  },
  {
    title: 'Parceiros, filiais e usuários',
    description: 'Administre a estrutura comercial em cascata.',
    icon: Users,
    steps: [
      'Cadastre o parceiro e depois inclua suas filiais e usuários.',
      'Planos e operadoras configurados para a matriz valem também para suas filiais.',
      'Revise o perfil e as permissões antes de liberar um novo acesso.',
    ],
  },
  {
    title: 'Chamados dos parceiros',
    description: 'Receba, acompanhe e responda pedidos de suporte.',
    icon: Headphones,
    steps: [
      'Em Demandas, clique em “Ver solicitações de parceiros”.',
      'Ao abrir um chamado novo, ele passa para Em andamento e o parceiro é avisado.',
      'Registre respostas e atualize o status até Resolvido ou Cancelado.',
    ],
  },
  {
    title: 'Demandas e Luxus Task',
    description: 'Encaminhe ao time responsável somente quando necessário.',
    icon: FileText,
    steps: [
      'Crie a demanda, selecione parceiro, cliente, responsável e prazo.',
      'Depois do envio, o andamento fica 100% no Luxus Task.',
      'O Parceiros só espelha status, anexos e avisos. Concluir no Task fecha a demanda aqui.',
    ],
  },
];

const partnerSections: GuideSection[] = [
  {
    title: 'Lojas e equipe',
    description: 'Trabalhe apenas com a sua empresa e suas filiais.',
    icon: Store,
    steps: [
      'Consulte suas filiais e os dados disponíveis para o seu perfil.',
      'Usuários de uma filial não visualizam lojas de concorrentes.',
      'Peça ao administrador do parceiro para ajustar acessos da equipe.',
    ],
  },
  {
    title: 'Vendas',
    description: 'Cadastre e acompanhe cada venda até a conclusão.',
    icon: ShoppingCart,
    steps: [
      'Preencha cliente, plano, linha, formato do contrato e documentos e envie para análise.',
      billingStep,
      'Depois que o administrador encaminhar ao Luxus Task, acompanhe só o status.',
      'A venda aparece como concluída quando a demanda for concluída no Luxus Task.',
      dashboardStep,
    ],
  },
  {
    title: 'Importar vendas por planilha',
    description: 'Cadastre várias vendas de uma vez.',
    icon: FileSpreadsheet,
    steps: importNewSteps,
  },
  {
    title: 'Abrir e acompanhar chamado',
    description: 'Fale com o administrador sem perder o histórico.',
    icon: CircleHelp,
    steps: [
      'Em Demandas, clique no botão destacado “Abrir chamado”.',
      'Descreva o assunto e acompanhe protocolo, respostas e status.',
      'Quando o atendimento visualizar ou atualizar o chamado, o sino avisará.',
    ],
  },
];

const attendantSections: GuideSection[] = [
  {
    title: 'Rotina de atendimento',
    description: 'Acesse somente a operação autorizada para sua filial.',
    icon: CheckCircle2,
    steps: [
      'Consulte clientes e registre vendas usando os dados corretos.',
      'Confira documentos e informações antes de concluir o cadastro.',
      billingStep,
      'Use o sino para acompanhar retornos que dependem de ação.',
    ],
  },
  {
    title: 'Importar vendas por planilha',
    description: 'Cadastre várias vendas de uma vez.',
    icon: FileSpreadsheet,
    steps: importNewSteps,
  },
];

const financialSections: GuideSection[] = [
  {
    title: 'Rotina financeira',
    description: 'Acompanhe valores sem acessar operações comerciais indevidas.',
    icon: CheckCircle2,
    steps: [
      'Consulte comissões e informações financeiras liberadas ao seu perfil.',
      'Use os filtros antes de conferir ou exportar um período.',
      'Em caso de divergência, registre o protocolo e encaminhe ao administrador.',
    ],
  },
];

export default function GuiaDeUsoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;
  const isPartner = user?.role === UserRole.PARTNER;
  const roleLabel = isAdmin
    ? 'Administrador'
    : isPartner
      ? 'Parceiro'
      : user?.role === UserRole.ATTENDANT
        ? 'Atendente'
        : 'Financeiro';
  const specificSections = isAdmin
    ? adminSections
    : isPartner
      ? partnerSections
      : user?.role === UserRole.FINANCIAL
        ? financialSections
        : attendantSections;

  return (
    <DashboardLayout
      title="Guia de uso"
      description={`Orientações do sistema para o perfil ${roleLabel}`}
    >
      <div className="mb-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Olá, {user?.name ?? 'usuário'}!</h2>
            <p className="text-sm text-muted-foreground">
              Este conteúdo mostra apenas os recursos e procedimentos adequados ao seu acesso.
            </p>
          </div>
          <Badge variant="secondary">{roleLabel}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[...specificSections, ...commonSections].map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {section.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-relaxed">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
