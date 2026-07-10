'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  ContractFormat,
  DocumentType,
  DonorOperator,
  SaleStatus,
  SALE_STATUS_LABELS,
} from '@luxus/types';
import { formatCurrency, formatDateTime, formatDocument, formatPhone } from '@luxus/utils';
import { api, fetchAuthenticatedFile, openAuthenticatedFile } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerScopedUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const DONOR_OPERATOR_LABELS: Record<DonorOperator, string> = {
  [DonorOperator.VIVO]: 'Vivo',
  [DonorOperator.TIM]: 'TIM',
  [DonorOperator.CLARO]: 'Claro',
  [DonorOperator.SURF]: 'Surf',
  [DonorOperator.OTHER]: 'Outras',
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|heic)$/i;

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
  donorOperator?: DonorOperator | null;
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
  onResubmitDocuments?: (saleId: string) => void;
}

const TAB_PANEL_CLASS = 'mt-0 h-[calc(90vh-13.5rem)] overflow-y-auto px-5 py-4 focus-visible:outline-none sm:px-6';

function isImageDocument(doc: SaleDocument): boolean {
  if (doc.mimeType?.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.test(doc.name) || IMAGE_EXTENSIONS.test(doc.url);
}

function DetailRow({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-border/50 py-2.5 text-sm last:border-0 sm:grid-cols-[140px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium break-words text-right', mono && 'break-all font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-card/50', className)}>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function DocumentPreview({
  doc,
  onOpen,
  onZoom,
  compact,
}: {
  doc: SaleDocument;
  onOpen: () => void;
  onZoom?: (url: string) => void;
  compact?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const isImage = isImageDocument(doc);

  useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);
    fetchAuthenticatedFile(doc.url)
      .then((blob) => {
        if (!blob) {
          setError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.url, isImage]);

  const label = DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {isImage ? (
        <button
          type="button"
          onClick={() => previewUrl && onZoom?.(previewUrl)}
          disabled={!previewUrl}
          className="group relative block w-full bg-muted/30"
        >
          {loading && (
            <div className={cn('flex items-center justify-center', compact ? 'h-36' : 'h-56')}>
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && error && (
            <div className={cn('flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground', compact ? 'h-36' : 'h-56')}>
              <ImageIcon className="h-10 w-10 opacity-40" />
              <span className="text-xs">Não foi possível carregar a imagem</span>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
                Tentar abrir arquivo
              </Button>
            </div>
          )}
          {!loading && previewUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={doc.name}
                className={cn('w-full object-contain', compact ? 'max-h-44' : 'max-h-72')}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" />
                  Ampliar
                </div>
              </div>
            </>
          )}
        </button>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted/20 text-muted-foreground">
          <FileText className="h-10 w-10" />
          <span className="text-sm">{doc.mimeType?.includes('pdf') ? 'Documento PDF' : 'Arquivo'}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={onOpen}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Abrir
        </Button>
      </div>
    </div>
  );
}

function ImageLightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95" role="dialog" aria-label={label}>
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">{label}</span>
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}

function statusBadgeVariant(status: SaleStatus) {
  if ([SaleStatus.APPROVED, SaleStatus.ACTIVATED].includes(status)) return 'success' as const;
  if ([SaleStatus.REJECTED, SaleStatus.CANCELLED].includes(status)) return 'destructive' as const;
  if (status === SaleStatus.DOCUMENTS_PENDING) return 'warning' as const;
  return 'outline' as const;
}

export function SaleDetailDialog({
  saleId,
  open,
  onOpenChange,
  onResubmitDocuments,
}: SaleDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartnerScoped = isPartnerScopedUser(user);
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [tab, setTab] = useState('overview');
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  const load = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const data = await api<SaleDetail>(`/sales/${saleId}`);
      setSale(data);
      const docCount = data.documents?.length ?? 0;
      setTab(docCount > 0 ? 'photos' : 'overview');
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
    if (!open) {
      setSale(null);
      setLightbox(null);
      setTab('overview');
    }
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

  const clientAddress = useMemo(() => {
    if (!sale?.client) return '';
    return [
      sale.client.address,
      sale.client.addressNumber,
      sale.client.complement,
      sale.client.neighborhood,
      sale.client.city,
      sale.client.state,
      sale.client.zipCode,
    ]
      .filter(Boolean)
      .join(', ');
  }, [sale?.client]);

  const imageDocs = sale?.documents?.filter(isImageDocument) ?? [];
  const otherDocs = sale?.documents?.filter((d) => !isImageDocument(d)) ?? [];
  const docCount = sale?.documents?.length ?? 0;

  const lineNumber = sale?.newNumber
    ? formatPhone(sale.newNumber)
    : sale?.line?.number
      ? formatPhone(sale.line.number)
      : '—';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!flex h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 space-y-3 border-b px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div className="space-y-1">
                <DialogTitle className="text-lg">Detalhes da venda</DialogTitle>
                {sale && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">{sale.protocol}</span>
                    <Badge variant={statusBadgeVariant(sale.status)}>
                      {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                    </Badge>
                  </div>
                )}
              </div>
              {sale && (
                <p className="text-xs text-muted-foreground">
                  Criada em {formatDateTime(sale.createdAt)}
                </p>
              )}
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !sale ? (
            <p className="flex-1 px-5 py-8 text-sm text-muted-foreground sm:px-6">Venda não encontrada.</p>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b px-5 py-3 sm:px-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Resumo</TabsTrigger>
                  <TabsTrigger value="photos">
                    Fotos {docCount > 0 ? `(${docCount})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="details">Dados</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className={TAB_PANEL_CLASS}>
                <div className="space-y-4 pb-4">
                  {sale.status === SaleStatus.DOCUMENTS_PENDING &&
                    sale.requiredDocuments &&
                    sale.requiredDocuments.length > 0 && (
                      <Section title="Ação necessária">
                        <div className="space-y-3 py-3">
                          <p className="text-sm text-muted-foreground">
                            A equipe solicitou novos documentos para continuar a análise desta venda.
                          </p>
                          {sale.requiredDocuments.map((doc) => (
                            <div key={doc.type} className="flex items-center justify-between gap-3 text-sm">
                              <span>{doc.label}</span>
                              <Badge variant={doc.fulfilled ? 'success' : 'warning'}>
                                {doc.fulfilled ? 'Enviado' : 'Pendente'}
                              </Badge>
                            </div>
                          ))}
                          {isPartnerScoped && onResubmitDocuments && (
                            <Button onClick={() => onResubmitDocuments(sale.id)}>
                              <Upload className="mr-2 h-4 w-4" />
                              Enviar documentos pendentes
                            </Button>
                          )}
                        </div>
                      </Section>
                    )}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard label="Valor" value={formatCurrency(Number(sale.value))} />
                    <SummaryCard label="Operadora" value={sale.operator?.name ?? '—'} />
                    <SummaryCard label="Plano" value={sale.plan?.name ?? '—'} />
                    <SummaryCard label="Linha" value={lineNumber} />
                  </div>

                  {!isPartnerScoped && sale.commissionValue != null && (
                    <SummaryCard label="Comissão" value={formatCurrency(Number(sale.commissionValue))} />
                  )}

                  {imageDocs.length > 0 && (
                    <Section title="Prévia das fotos">
                      <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-4">
                        {imageDocs.slice(0, 4).map((doc) => (
                          <DocumentPreview
                            key={doc.id}
                            doc={doc}
                            compact
                            onOpen={() => handleOpenDocument(doc)}
                            onZoom={(url) =>
                              setLightbox({
                                src: url,
                                label: DOCUMENT_TYPE_LABELS[doc.type] ?? doc.name,
                              })
                            }
                          />
                        ))}
                      </div>
                      {docCount > 4 && (
                        <Button variant="link" className="px-0" onClick={() => setTab('photos')}>
                          Ver todas as {docCount} fotos/documentos
                        </Button>
                      )}
                    </Section>
                  )}

                  {sale.client && (
                    <Section title="Cliente">
                      <DetailRow label="Nome" value={sale.client.name} />
                      <DetailRow label="CPF" value={formatDocument(sale.client.document)} />
                      <DetailRow label="Telefone" value={formatPhone(sale.client.phone)} />
                    </Section>
                  )}

                  {(sale.rejectionReason || sale.contestReason || sale.notes) && (
                    <Section title="Observações">
                      {sale.rejectionReason && (
                        <div className="my-2 rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                          <p className="font-medium">Rejeição</p>
                          <p>{sale.rejectionReason}</p>
                        </div>
                      )}
                      {sale.contestReason && (
                        <div className="my-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-400">
                          <p className="font-medium">Contestação</p>
                          <p>{sale.contestReason}</p>
                        </div>
                      )}
                      {sale.notes && (
                        <div className="my-2 rounded-md bg-muted/50 p-3 text-sm">
                          <p className="font-medium">Notas</p>
                          <p className="whitespace-pre-wrap">{sale.notes}</p>
                        </div>
                      )}
                    </Section>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="photos" className={TAB_PANEL_CLASS}>
                <div className="space-y-4 pb-4">
                  {docCount === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 opacity-30" />
                      <p className="text-sm">Nenhuma foto ou documento anexado a esta venda.</p>
                    </div>
                  ) : (
                    <>
                      {imageDocs.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground">Fotos ({imageDocs.length})</h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {imageDocs.map((doc) => (
                              <DocumentPreview
                                key={doc.id}
                                doc={doc}
                                onOpen={() => handleOpenDocument(doc)}
                                onZoom={(url) =>
                                  setLightbox({
                                    src: url,
                                    label: DOCUMENT_TYPE_LABELS[doc.type] ?? doc.name,
                                  })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {otherDocs.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground">Outros arquivos ({otherDocs.length})</h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {otherDocs.map((doc) => (
                              <DocumentPreview
                                key={doc.id}
                                doc={doc}
                                onOpen={() => handleOpenDocument(doc)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="details" className={TAB_PANEL_CLASS}>
                <div className="space-y-4 pb-4">
                  <Section title="Venda">
                    {!isPartnerScoped && <DetailRow label="Parceiro" value={sale.partner?.name} />}
                    <DetailRow label="Operadora" value={sale.operator?.name} />
                    <DetailRow label="Plano" value={sale.plan?.name} />
                    <DetailRow label="Valor" value={formatCurrency(Number(sale.value))} />
                    {!isPartnerScoped && sale.commissionValue != null && (
                      <DetailRow label="Comissão" value={formatCurrency(Number(sale.commissionValue))} />
                    )}
                    {!isPartnerScoped && <DetailRow label="Filial" value={sale.branch?.name} />}
                    {!isPartnerScoped && <DetailRow label="Campanha" value={sale.campaign?.title} />}
                    <DetailRow label="Registrada por" value={sale.createdBy?.name} />
                    {sale.approvedAt && <DetailRow label="Aprovada em" value={formatDateTime(sale.approvedAt)} />}
                    {sale.activatedAt && <DetailRow label="Ativada em" value={formatDateTime(sale.activatedAt)} />}
                  </Section>

                  <Section title="Linha">
                    <DetailRow label="Número" value={lineNumber} />
                    <DetailRow label="Chip virgem" value={sale.isVirginChip ? 'Sim' : 'Não'} />
                    {sale.isVirginChip && <DetailRow label="ICCID" value={sale.chipIccid} mono />}
                    <DetailRow label="Portabilidade" value={sale.isPortability ? 'Sim' : 'Não'} />
                    {sale.isPortability && (
                      <>
                        <DetailRow
                          label="Operadora doadora"
                          value={
                            sale.donorOperator
                              ? DONOR_OPERATOR_LABELS[sale.donorOperator]
                              : undefined
                          }
                        />
                        <DetailRow
                          label="Número a ser portado"
                          value={sale.portabilityNumber ? formatPhone(sale.portabilityNumber) : undefined}
                        />
                      </>
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
                            'my-2 flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                            doc.fulfilled
                              ? 'border-green-500/30 bg-green-500/10'
                              : 'border-amber-500/30 bg-amber-500/10',
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
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {sale?.documents && sale.documents.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => setTab('photos')}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Ver fotos
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    for (const doc of sale.documents ?? []) {
                      try {
                        await openAuthenticatedFile(doc.url, doc.name);
                      } catch {
                        // continua
                      }
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Abrir todos
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightbox && (
        <ImageLightbox src={lightbox.src} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
