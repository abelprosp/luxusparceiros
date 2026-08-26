'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  Upload,
  UploadCloud,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  ContractFormat,
  DocumentType,
  DonorOperator,
  SaleStatus,
  SaleReviewStatus,
  SaleContractStage,
  DocumentPurpose,
  SALE_REVIEW_STATUS_LABELS,
  saleContractStageLabel,
  saleTaskUserName,
} from '@luxus/types';
import { formatCurrency, formatDate, formatDateTime, formatDocument, formatPhone } from '@luxus/utils';
import {
  api,
  checkAuthenticatedFile,
  downloadAuthenticatedUpload,
  fetchAuthenticatedFile,
  openAuthenticatedFile,
  replaceUploadedDocument,
} from '@/lib/api';
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

const TASK_STATUS_LABELS: Record<string, string> = {
  em_aberto: 'Aguardando início no Luxus Task',
  standby: 'Em espera no Luxus Task',
  em_andamento: 'Em andamento no Luxus Task',
  concluido: 'Concluída no Luxus Task',
  cancelado: 'Recusada/cancelada no Luxus Task',
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
  purpose?: DocumentPurpose;
  externalId?: string | null;
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
  reviewStatus: SaleReviewStatus;
  correctionReason?: string | null;
  taskProtocol?: string | null;
  taskStatus?: string | null;
  taskDemandId?: string | null;
  taskResponsibleName?: string | null;
  taskClientName?: string | null;
  taskDeadline?: string | null;
  taskSyncStatus?: string | null;
  taskSyncError?: string | null;
  taskIsBeingEdited?: boolean;
  taskEditorName?: string | null;
  taskEditorActivity?: string | null;
  taskEditorLastSeenAt?: string | null;
  taskLastMessage?: string | null;
  contractStage: SaleContractStage;
  contractCorrectionReason?: string | null;
  turnRequestFrom?: string | null;
  turnRequestReason?: string | null;
  turnRequestAt?: string | null;
  signedContractSyncStatus?: string | null;
  signedContractSyncError?: string | null;
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
  timeline?: Array<{ id: string; action: string; actorName?: string | null; details?: string | null; createdAt: string }>;
}

interface SaleDetailDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResubmitDocuments?: (saleId: string) => void;
  onEdit?: (saleId: string) => void;
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
  onDownload,
  onReplace,
  onZoom,
  compact,
}: {
  doc: SaleDocument;
  onOpen: () => void;
  onDownload: () => void;
  onReplace: (file: File) => Promise<void>;
  onZoom?: (url: string) => void;
  compact?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isImage = isImageDocument(doc);

  useEffect(() => {
    if (!isImage) {
      setLoading(true);
      setError(false);
      checkAuthenticatedFile(doc.url)
        .then((available) => setError(!available))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
      return;
    }
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
  const handleReplacement = async (file?: File) => {
    if (!file) return;
    setReplacing(true);
    try {
      await onReplace(file);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setReplacing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(event) => void handleReplacement(event.target.files?.[0])}
      />
      {isImage ? (
        <div
          role="button"
          tabIndex={previewUrl ? 0 : -1}
          onClick={() => previewUrl && onZoom?.(previewUrl)}
          onKeyDown={(event) => {
            if (previewUrl && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onZoom?.(previewUrl);
            }
          }}
          aria-disabled={!previewUrl}
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
              <Button
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
                disabled={replacing}
              >
                {replacing ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="mr-1 h-3.5 w-3.5" />
                )}
                Reanexar arquivo
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
        </div>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted/20 px-4 text-center text-muted-foreground">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : error ? (
            <>
              <FileText className="h-10 w-10 opacity-40" />
              <span className="text-sm">Arquivo indisponível</span>
              <Button size="sm" onClick={() => inputRef.current?.click()} disabled={replacing}>
                {replacing ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="mr-1 h-3.5 w-3.5" />
                )}
                Reanexar arquivo
              </Button>
            </>
          ) : (
            <>
              <FileText className="h-10 w-10" />
              <span className="text-sm">{doc.mimeType?.includes('pdf') ? 'Documento PDF' : 'Arquivo'}</span>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Origem: {doc.externalId?.startsWith('task:') ? 'Luxus Task' : 'Luxus Parceiros'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="outline" onClick={onOpen} disabled={error}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Abrir
          </Button>
          <Button size="sm" variant="outline" onClick={onDownload} disabled={error}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Baixar
          </Button>
        </div>
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
  onEdit,
}: SaleDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartnerScoped = isPartnerScopedUser(user);
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [tab, setTab] = useState('overview');
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const canEditSale = Boolean(
    sale
    && sale.contractStage !== SaleContractStage.COMPLETED
    && ![SaleStatus.ACTIVATED, SaleStatus.CANCELLED, SaleStatus.REJECTED].includes(sale.status)
    && ![SaleReviewStatus.REJECTED, SaleReviewStatus.CANCELLED].includes(sale.reviewStatus)
    && onEdit,
  );

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

  useEffect(() => {
    if (!open || !saleId || !sale?.taskProtocol) return;
    let stopped = false;
    let running = false;
    const refresh = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const updated = await api<SaleDetail>(`/sales/${saleId}/refresh-task-status`, { method: 'POST' });
        if (!stopped) setSale(updated);
      } catch {
        // O polling é auxiliar; erros transitórios já aparecem no estado de sincronização.
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [open, saleId, sale?.taskProtocol]);

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

  const handleDownloadDocument = async (doc: SaleDocument) => {
    try {
      await downloadAuthenticatedUpload(doc.url, doc.name);
    } catch (err) {
      toast({
        title: 'Erro ao baixar arquivo',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    }
  };

  const handleReplaceDocument = async (doc: SaleDocument, file: File) => {
    try {
      await replaceUploadedDocument(doc.id, file);
      toast({
        title: 'Arquivo reanexado',
        description: 'O documento foi recuperado e já está disponível.',
        variant: 'success',
      });
      await load();
    } catch (err) {
      toast({
        title: 'Erro ao reanexar arquivo',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const runWorkflowAction = async (path: string, body?: unknown) => {
    if (!sale) return;
    setWorkflowBusy(true);
    try {
      const result = await api<{ message?: string; synced?: boolean }>(`/sales/${sale.id}/${path}`, {
        method: 'POST',
        body,
      });
      const syncMessage = path === 'retry-task-sync'
        ? (result?.message || 'Dados e anexos sincronizados com o Luxus Task. Atualize a demanda no Task para ver as mudanças.')
        : 'O fluxo da venda foi atualizado com sucesso.';
      toast({
        title: path === 'retry-task-sync' ? 'Sincronização concluída' : 'Etapa atualizada',
        description: syncMessage,
        variant: 'success',
      });
      await load();
    } catch (err) {
      toast({
        title: path === 'retry-task-sync' ? 'Falha na sincronização' : 'Não foi possível continuar',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
      await load().catch(() => undefined);
    } finally {
      setWorkflowBusy(false);
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
  const blankContract = sale?.documents
    ?.filter((document) => document.purpose === DocumentPurpose.BLANK_CONTRACT)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const signedContract = sale?.documents
    ?.filter((document) => document.purpose === DocumentPurpose.SIGNED_CONTRACT)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  /** Contrato assinado é tratado no Luxus Task — parceiros não anexam por aqui. */
  const neverSentToTask = Boolean(
    sale
    && !sale.taskDemandId
    && (sale.taskSyncStatus ?? 'NOT_READY') === 'NOT_READY'
    && !sale.taskProtocol,
  );

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
                      {sale.reviewStatus === SaleReviewStatus.APPROVED
                        ? (
                          sale.contractStage === SaleContractStage.COMPLETED && !sale.taskDemandId
                            ? 'Concluída no Luxus Parceiros'
                            : saleContractStageLabel(sale.contractStage, saleTaskUserName(sale))
                        )
                        : SALE_REVIEW_STATUS_LABELS[sale.reviewStatus] ?? sale.reviewStatus}
                    </Badge>
                    {sale.taskIsBeingEdited && <Badge variant="success">Em atendimento agora</Badge>}
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
                    Documentos {docCount > 0 ? `(${docCount})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="details">Dados</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className={TAB_PANEL_CLASS}>
                <div className="space-y-4 pb-4">
                  <Section title="Luxus Task" className="border-primary/40 bg-primary/5">
                    <DetailRow
                      label="Formato do contrato"
                      value={sale.contractFormat ? CONTRACT_FORMAT_LABELS[sale.contractFormat] : 'Não informado'}
                    />
                    <DetailRow label="Status" value={saleContractStageLabel(sale.contractStage, saleTaskUserName(sale))} />
                    {sale.taskDemandId || sale.taskProtocol ? (
                      <div className="my-3 rounded-md border border-primary/20 bg-background/60 p-3 text-sm text-muted-foreground">
                        Após o envio ao Luxus Task, a demanda fica sob responsabilidade do Task.
                        Parceiros e administradores apenas acompanham o andamento; a conclusão da venda chega pelo Task.
                      </div>
                    ) : (
                      <div className="my-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Esta venda ainda não foi enviada ao Luxus Task. Após a aprovação e o sync, o Task assume o fluxo completo.
                      </div>
                    )}
                    {sale.contractCorrectionReason && (
                      <div className="my-3 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                        <p className="font-semibold">Aviso do Task</p>
                        <p>{sale.contractCorrectionReason}</p>
                      </div>
                    )}
                    <div className="my-3">
                      <Button size="sm" variant="outline" onClick={() => setTab('photos')}>
                        <FileText className="mr-2 h-4 w-4" />
                        Abrir documentos
                      </Button>
                    </div>
                    {sale.correctionReason && (
                      <div className="my-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600">
                        <p className="font-semibold">Correção solicitada</p>
                        <p>{sale.correctionReason}</p>
                      </div>
                    )}
                  </Section>

                  {(sale.taskProtocol || sale.taskSyncStatus === 'PENDING' || sale.taskSyncError) && (
                    <Section title="Integração com o Luxus Task">
                      <DetailRow label="Envio" value={sale.taskSyncStatus === 'SYNCED' ? 'Sincronizado' : sale.taskSyncStatus === 'PENDING' || sale.taskSyncStatus === 'PROCESSING' ? 'Processando em segundo plano' : sale.taskSyncStatus} />
                      <DetailRow label="Protocolo" value={sale.taskProtocol} mono />
                      <DetailRow label="Status Task" value={sale.taskStatus ? TASK_STATUS_LABELS[sale.taskStatus] ?? sale.taskStatus : undefined} />
                      <DetailRow label="Responsável" value={sale.taskResponsibleName} />
                      <DetailRow label="Último retorno" value={sale.taskLastMessage} />
                      <DetailRow label="Atendimento agora" value={sale.taskIsBeingEdited
                        ? `${sale.taskEditorName || sale.taskResponsibleName || 'Responsável'} está editando esta demanda`
                        : 'Nenhum responsável está editando esta demanda neste momento'} />
                      {sale.taskIsBeingEdited && <DetailRow label="Atividade" value={sale.taskEditorActivity} />}
                      {!sale.taskIsBeingEdited && sale.taskEditorLastSeenAt && <DetailRow label="Última presença" value={formatDateTime(sale.taskEditorLastSeenAt)} />}
                      <DetailRow label="Cliente Task" value={sale.taskClientName} />
                      <DetailRow
                        label="Prazo"
                        value={sale.taskDeadline ? formatDate(sale.taskDeadline) : undefined}
                      />
                      {sale.taskSyncError && (
                        <div className="my-3 space-y-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                          <p>{sale.taskSyncError}</p>
                          <div className="flex flex-wrap gap-2">
                            {canEditSale && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={workflowBusy}
                                onClick={() => {
                                  onOpenChange(false);
                                  onEdit?.(sale.id);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar dados e CPF
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={workflowBusy}
                              onClick={() => void runWorkflowAction('retry-task-sync')}
                            >
                              Sincronizar arquivos
                            </Button>
                          </div>
                        </div>
                      )}
                      {!sale.taskSyncError && sale.taskProtocol && (
                        <div className="my-3 space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3">
                          <p className="text-sm text-muted-foreground">
                            Após a aprovação, o sistema reenvia os anexos automaticamente.
                            Se algum arquivo não aparecer no Luxus Task, sincronize os arquivos aqui.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={workflowBusy}
                            onClick={() => void runWorkflowAction('retry-task-sync')}
                          >
                            {workflowBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sincronizar arquivos
                          </Button>
                        </div>
                      )}
                    </Section>
                  )}
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

                  {(sale.documents?.filter((d) => !d.externalId?.startsWith('task:')).length ?? 0) > 0 && (
                    <Section title="Prévia dos documentos">
                      <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-4">
                        {(sale.documents ?? [])
                          .filter((d) => !d.externalId?.startsWith('task:'))
                          .slice(0, 6)
                          .map((doc) => (
                          <DocumentPreview
                            key={doc.id}
                            doc={doc}
                            compact
                            onOpen={() => handleOpenDocument(doc)}
                            onDownload={() => handleDownloadDocument(doc)}
                            onReplace={(file) => handleReplaceDocument(doc, file)}
                            onZoom={(url) =>
                              setLightbox({
                                src: url,
                                label: DOCUMENT_TYPE_LABELS[doc.type] ?? doc.name,
                              })
                            }
                          />
                        ))}
                      </div>
                      {docCount > 6 && (
                        <Button variant="link" className="px-0" onClick={() => setTab('photos')}>
                          Ver todos os {docCount} documentos
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

                  {sale.timeline && sale.timeline.length > 0 && (
                    <Section title="Histórico da venda">
                      <div className="divide-y">
                        {sale.timeline.map((entry) => (
                          <div key={entry.id} className="py-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium">{entry.action}</p>
                              <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
                            </div>
                            {entry.actorName && <p className="text-xs text-muted-foreground">Por {entry.actorName}</p>}
                            {entry.details && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{entry.details}</p>}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="photos" className={TAB_PANEL_CLASS}>
                <div className="space-y-4 pb-4">
                  {(sale.taskProtocol || sale.taskSyncError) && (
                    <div className="space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3">
                      <p className="text-sm font-medium">Sincronizar documentos com o Luxus Task</p>
                      <p className="text-xs text-muted-foreground">
                        Sincroniza a venda e os anexos desta aba com a demanda correspondente no Luxus Task.
                      </p>
                      {sale.taskSyncError && (
                        <p className="text-sm text-red-500">{sale.taskSyncError}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {canEditSale && sale.taskSyncError && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={workflowBusy}
                            onClick={() => {
                              onOpenChange(false);
                              onEdit?.(sale.id);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar dados e CPF
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workflowBusy}
                          onClick={() => void runWorkflowAction('retry-task-sync')}
                        >
                          {workflowBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                          Sincronizar arquivos
                        </Button>
                      </div>
                    </div>
                  )}
                  <Section title="Luxus Task" className="border-primary/40 bg-primary/5">
                    <DetailRow label="Status" value={saleContractStageLabel(sale.contractStage, saleTaskUserName(sale))} />
                    <div className="my-3 rounded-md border border-primary/20 bg-background/60 p-3 text-sm text-muted-foreground">
                      {sale.taskDemandId || sale.taskProtocol
                        ? 'O Luxus Task é o dono desta demanda. Aqui você acompanha o status e baixa anexos sincronizados; a conclusão da venda vem do Task.'
                        : 'Enquanto a venda não for enviada ao Task, o administrador pode finalizar apenas no Luxus Parceiros. Depois do envio, o Task assume tudo.'}
                    </div>
                    <div className="flex flex-wrap gap-2 py-3">
                      {!isPartnerScoped
                        && neverSentToTask
                        && sale.contractStage !== SaleContractStage.COMPLETED
                        && ![SaleStatus.ACTIVATED, SaleStatus.CANCELLED, SaleStatus.REJECTED].includes(sale.status)
                        && ![SaleReviewStatus.REJECTED, SaleReviewStatus.CANCELLED, SaleReviewStatus.DRAFT].includes(sale.reviewStatus) && (
                        <Button
                          variant="secondary"
                          disabled={workflowBusy}
                          onClick={() => {
                            const reason = window.prompt(
                              'Finalizar esta venda agora no Luxus Parceiros?\n\nSó é permitido se a venda nunca foi enviada ao Luxus Task.\n\nMotivo opcional:',
                            );
                            if (reason === null) return;
                            void runWorkflowAction('force-finalize', { reason: reason.trim() || undefined });
                          }}
                        >
                          {workflowBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Finalizar no Luxus Parceiros
                        </Button>
                      )}
                      {!isPartnerScoped
                        && (
                          sale.contractStage === SaleContractStage.COMPLETED
                          || sale.status === SaleStatus.ACTIVATED
                        ) && (
                        <Button
                          variant="outline"
                          disabled={workflowBusy}
                          onClick={() => {
                            const reason = window.prompt(
                              'Reabrir esta venda concluída para correção?\n\nDescreva o erro encontrado:',
                            );
                            if (reason === null) return;
                            if (!reason.trim()) {
                              toast({ title: 'Informe o motivo da reabertura', variant: 'destructive' });
                              return;
                            }
                            void runWorkflowAction('reopen', { reason: reason.trim() });
                          }}
                        >
                          {workflowBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Reabrir venda
                        </Button>
                      )}
                    </div>

                    {(blankContract || signedContract) && (
                      <div className="mt-2 space-y-3 rounded-md border border-dashed border-primary/40 bg-background/60 p-3">
                        <p className="text-sm font-medium">Anexos sincronizados do Task</p>
                        <p className="text-xs text-muted-foreground">
                          Contratos e assinaturas são tratados no Luxus Task. Aqui você só baixa os arquivos já sincronizados.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {blankContract && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={workflowBusy}
                              onClick={() => void downloadAuthenticatedUpload(blankContract.url, blankContract.name)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Baixar contrato
                            </Button>
                          )}
                          {signedContract && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={workflowBusy}
                              onClick={() => void downloadAuthenticatedUpload(signedContract.url, signedContract.name)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Baixar contrato assinado
                            </Button>
                          )}
                        </div>
                        {signedContract && (
                          <p className="text-xs text-muted-foreground">
                            Último contrato assinado: <span className="font-medium text-foreground">{signedContract.name}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </Section>

                  {docCount === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 opacity-30" />
                      <p className="text-sm">Nenhuma foto ou documento anexado a esta venda.</p>
                    </div>
                  ) : (
                    <>
                      {imageDocs.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground">Imagens ({imageDocs.length})</h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {imageDocs.map((doc) => (
                              <DocumentPreview
                                key={doc.id}
                                doc={doc}
                                onOpen={() => handleOpenDocument(doc)}
                                onDownload={() => handleDownloadDocument(doc)}
                                onReplace={(file) => handleReplaceDocument(doc, file)}
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
                          <h4 className="text-sm font-medium text-muted-foreground">Contratos e outros arquivos ({otherDocs.length})</h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {otherDocs.map((doc) => (
                              <DocumentPreview
                                key={doc.id}
                                doc={doc}
                                onOpen={() => handleOpenDocument(doc)}
                                onDownload={() => handleDownloadDocument(doc)}
                                onReplace={(file) => handleReplaceDocument(doc, file)}
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
                    <DetailRow label="Loja" value={sale.branch?.name ?? 'Matriz'} />
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
            {canEditSale && sale && (
              <Button
                variant="secondary"
                onClick={() => {
                  onOpenChange(false);
                  onEdit?.(sale.id);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar venda
              </Button>
            )}
            {sale?.documents && sale.documents.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => setTab('photos')}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Ver documentos
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    for (const doc of sale.documents ?? []) {
                      try {
                        await downloadAuthenticatedUpload(doc.url, doc.name);
                      } catch {
                        // continua
                      }
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar todos
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
