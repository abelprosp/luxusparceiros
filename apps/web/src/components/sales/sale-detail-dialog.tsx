'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Download, ExternalLink, FileText, X } from 'lucide-react';
import {
  ContractFormat,
  DocumentType,
  SaleStatus,
  SALE_STATUS_LABELS,
} from '@luxus/types';
import { formatCurrency, formatDate, formatDateTime, formatDocument, formatPhone } from '@luxus/utils';
import { api, fetchAuthenticatedFile, openAuthenticatedFile } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  [DocumentType.CPF]: 'CPF',
  [DocumentType.CNPJ]: 'CNPJ',
  [DocumentType.RG]: 'RG',
  [DocumentType.SELFIE]: 'Selfie',
  [DocumentType.CONTRACT]: 'Contrato',
  [DocumentType.SIGNATURE]: 'Assinatura',
  [DocumentType.LINE_PHOTO]: 'Foto da linha',
  [DocumentType.CHIP_PHOTO]: 'Foto do chip',
  [DocumentType.OTHER]: 'Outro',
};

const CONTRACT_FORMAT_LABELS: Record<ContractFormat, string> = {
  [ContractFormat.PRINT]: 'Impressão',
  [ContractFormat.ZAPSIGN]: 'ZapSign',
};

interface SaleDocument {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface RequiredDocument {
  type: string;
  label: string;
  fulfilled: boolean;
}

interface SaleDetail {
  id: string;
  protocol: string;
  status: SaleStatus;
  value: number;
  commissionValue?: number;
  commissionRate?: number;
  newNumber?: string | null;
  chipIccid?: string | null;
  isVirginChip: boolean;
  isPortability: boolean;
  portabilityNumber?: string | null;
  contractFormat?: ContractFormat | null;
  rejectionReason?: string | null;
  contestReason?: string | null;
  notes?: string | null;
  requiredDocuments?: RequiredDocument[] | null;
  approvedAt?: string | null;
  activatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  partner?: { id: string; name: string };
  branch?: { id: string; name: string } | null;
  campaign?: { id: string; title: string } | null;
  operator?: { id: string; name: string };
  plan?: { id: string; name: string; price?: number };
  client?: {
    id: string;
    name: string;
    document: string;
    rg?: string | null;
    email?: string | null;
    phone: string;
    address?: string | null;
    addressNumber?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  line?: { id: string; number: string } | null;
  createdBy?: { id: string; name: string };
  commission?: { id: string; amount: number; status: string } | null;
  documents?: SaleDocument[];
}

interface SaleDetailDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function DocumentPreview({ doc, onOpen }: { doc: SaleDocument; onOpen: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = doc.mimeType.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    fetchAuthenticatedFile(doc.url)
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => setPreviewUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.url, isImage]);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}
          </p>
          <p className="text-xs text-muted-foreground">{doc.name}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(doc.createdAt)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onOpen}>
          <ExternalLink className="mr-1 h-3 w-3" />
          Abrir
        </Button>
      </div>
      {isImage && previewUrl && (
        <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={doc.name} className="max-h-40 w-full object-contain bg-muted/30" />
        </button>
      )}
      {!isImage && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-6 text-sm text-muted-foreground">
          <FileText className="h-5 w-5" />
          Arquivo {doc.mimeType.includes('pdf') ? 'PDF' : doc.mimeType}
        </div>
      )}
    </div>
  );
}

function statusBadgeVariant(status: SaleStatus) {
  if ([SaleStatus.APPROVED, SaleStatus.ACTIVATED].includes(status)) return 'success' as const;
  if ([SaleStatus.REJECTED, SaleStatus.CANCELLED].includes(status)) return 'destructive' as const;
  if (status === SaleStatus.DOCUMENTS_PENDING) return 'warning' as const;
  return 'outline' as const;
}

export function SaleDetailDialog({ saleId, open, onOpenChange }: SaleDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<SaleDetail | null>(null);

  const load = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const data = await api<SaleDetail>(`/sales/${saleId}`);
      setSale(data);
    } catch (err) {
      setSale(null);
      toast({
        title: 'Erro ao carregar venda',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [saleId, toast]);

  useEffect(() => {
    if (open && saleId) load();
    if (!open) setSale(null);
  }, [open, saleId, load]);

  const handleOpenDocument = async (doc: SaleDocument) => {
    try {
      await openAuthenticatedFile(doc.url, doc.name);
    } catch (err) {
      toast({
        title: 'Erro ao abrir arquivo',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    }
  };

  const clientAddress = sale?.client
    ? [
        sale.client.address,
        sale.client.addressNumber,
        sale.client.complement,
        sale.client.neighborhood,
        sale.client.city,
        sale.client.state,
        sale.client.zipCode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes da venda</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !sale ? (
          <p className="py-6 text-sm text-muted-foreground">Venda não encontrada.</p>
        ) : (
          <ScrollArea className="max-h-[calc(92vh-8rem)] pr-4">
            <div className="space-y-4 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{sale.protocol}</span>
                <Badge variant={statusBadgeVariant(sale.status)}>
                  {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Criada em {formatDateTime(sale.createdAt)}
                </span>
              </div>

              {(sale.rejectionReason || sale.contestReason || sale.notes) && (
                <Section title="Observações">
                  {sale.rejectionReason && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-100">
                      <p className="font-medium">Motivo da rejeição</p>
                      <p>{sale.rejectionReason}</p>
                    </div>
                  )}
                  {sale.contestReason && (
                    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      <p className="font-medium">Motivo da contestação</p>
                      <p>{sale.contestReason}</p>
                    </div>
                  )}
                  {sale.notes && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      <p className="font-medium">Notas</p>
                      <p className="whitespace-pre-wrap">{sale.notes}</p>
                    </div>
                  )}
                </Section>
              )}

              <Section title="Venda">
                {!isPartner && <DetailRow label="Parceiro" value={sale.partner?.name} />}
                <DetailRow label="Operadora" value={sale.operator?.name} />
                <DetailRow label="Plano" value={sale.plan?.name} />
                <DetailRow label="Valor" value={formatCurrency(Number(sale.value))} />
                {!isPartner && sale.commissionValue != null && (
                  <DetailRow label="Comissão" value={formatCurrency(Number(sale.commissionValue))} />
                )}
                {!isPartner && <DetailRow label="Filial" value={sale.branch?.name} />}
                {!isPartner && <DetailRow label="Campanha" value={sale.campaign?.title} />}
                <DetailRow label="Registrada por" value={sale.createdBy?.name} />
                {sale.approvedAt && <DetailRow label="Aprovada em" value={formatDateTime(sale.approvedAt)} />}
                {sale.activatedAt && <DetailRow label="Ativada em" value={formatDateTime(sale.activatedAt)} />}
              </Section>

              <Section title="Linha">
                <DetailRow label="Número" value={sale.newNumber ? formatPhone(sale.newNumber) : sale.line?.number ? formatPhone(sale.line.number) : undefined} />
                <DetailRow label="Chip virgem" value={sale.isVirginChip ? 'Sim' : 'Não'} />
                {sale.isVirginChip && <DetailRow label="ICCID" value={sale.chipIccid} />}
                <DetailRow label="Portabilidade" value={sale.isPortability ? 'Sim' : 'Não'} />
                {sale.isPortability && (
                  <DetailRow
                    label="Número portado"
                    value={sale.portabilityNumber ? formatPhone(sale.portabilityNumber) : undefined}
                  />
                )}
                {sale.contractFormat && (
                  <DetailRow
                    label="Contrato"
                    value={CONTRACT_FORMAT_LABELS[sale.contractFormat] ?? sale.contractFormat}
                  />
                )}
              </Section>

              {sale.client && (
                <Section title="Cliente">
                  <DetailRow label="Nome" value={sale.client.name} />
                  <DetailRow label="CPF" value={formatDocument(sale.client.document)} />
                  <DetailRow label="RG" value={sale.client.rg} />
                  <DetailRow label="E-mail" value={sale.client.email} />
                  <DetailRow label="Telefone" value={formatPhone(sale.client.phone)} />
                  <DetailRow label="Endereço" value={clientAddress} />
                </Section>
              )}

              {sale.requiredDocuments && sale.requiredDocuments.length > 0 && (
                <Section title="Documentos solicitados">
                  {sale.requiredDocuments.map((doc) => (
                    <div
                      key={doc.type}
                      className={cn(
                        'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                        doc.fulfilled ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
                      )}
                    >
                      <span>{doc.label}</span>
                      {doc.fulfilled ? (
                        <Badge variant="success" className="gap-1">
                          <Check className="h-3 w-3" /> Enviado
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <X className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              <Section title={`Documentos anexados (${sale.documents?.length ?? 0})`}>
                {sale.documents && sale.documents.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sale.documents.map((doc) => (
                      <DocumentPreview
                        key={doc.id}
                        doc={doc}
                        onOpen={() => handleOpenDocument(doc)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
                )}
              </Section>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {sale?.documents && sale.documents.length > 0 && (
            <Button
              variant="secondary"
              onClick={async () => {
                for (const doc of sale.documents ?? []) {
                  try {
                    await openAuthenticatedFile(doc.url, doc.name);
                  } catch {
                    // continua nos próximos
                  }
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Abrir todos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
