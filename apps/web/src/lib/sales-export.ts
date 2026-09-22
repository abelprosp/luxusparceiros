import {
  SALE_REVIEW_STATUS_LABELS,
  SALE_STATUS_LABELS,
  SaleContractStage,
  SaleReviewStatus,
  SaleStatus,
  saleContractStageLabel,
  saleTaskUserName,
} from '@luxus/types';
import { formatCurrency, formatDate } from '@luxus/utils';
import { exportTablesReport, type TableExportFormat } from '@/lib/table-export';

export type SaleExportRow = {
  protocol: string;
  status: SaleStatus;
  reviewStatus: SaleReviewStatus;
  contractStage: SaleContractStage;
  taskProtocol?: string;
  taskDemandId?: string;
  taskSyncError?: string | null;
  taskSyncStatus?: string;
  taskEditorName?: string;
  taskResponsibleName?: string;
  value: number;
  partner?: { name: string };
  client?: { name: string };
  plan?: { name: string };
  campaign?: { title: string };
  branch?: { name: string };
  createdAt: string;
};

function workflowLabel(sale: SaleExportRow): string {
  const taskName = saleTaskUserName(sale);
  if (sale.reviewStatus === SaleReviewStatus.APPROVED) {
    if (sale.contractStage === SaleContractStage.COMPLETED && !sale.taskDemandId) {
      return 'Concluída no Luxus Parceiros';
    }
    return saleContractStageLabel(sale.contractStage, taskName);
  }
  return SALE_REVIEW_STATUS_LABELS[sale.reviewStatus] ?? sale.reviewStatus;
}

function syncNote(sale: SaleExportRow): string {
  if (sale.taskSyncError || sale.taskSyncStatus === 'RETRY') {
    return 'Sync com falha';
  }
  return '';
}

export async function exportSalesReport(
  sales: SaleExportRow[],
  format: TableExportFormat,
  options?: { includePartnerColumns?: boolean },
) {
  const includePartner = options?.includePartnerColumns !== false;
  const headers = [
    'Protocolo',
    ...(includePartner ? ['Parceiro'] : []),
    'Loja',
    'Cliente',
    'Plano',
    ...(includePartner ? ['Campanha'] : []),
    'Valor',
    'Fluxo',
    'Status venda',
    'Protocolo Task',
    'Sync',
    'Data',
  ];

  const rows = sales.map((sale) => {
    const cells = [
      sale.protocol,
      ...(includePartner ? [sale.partner?.name ?? ''] : []),
      sale.branch?.name ?? 'Matriz',
      sale.client?.name ?? '',
      sale.plan?.name ?? '',
      ...(includePartner ? [sale.campaign?.title ?? ''] : []),
      formatCurrency(Number(sale.value)),
      workflowLabel(sale),
      SALE_STATUS_LABELS[sale.status] ?? sale.status,
      sale.taskProtocol ?? '',
      syncNote(sale),
      formatDate(sale.createdAt),
    ];
    return cells;
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  await exportTablesReport({
    filename: `vendas-${timestamp}`,
    title: 'Relatório de vendas',
    subtitle: `${sales.length} registro(s) • exportado em ${new Date().toLocaleString('pt-BR')}`,
    sections: [{ title: 'Vendas', headers, rows }],
    format,
  });
}
