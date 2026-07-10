'use client';

import { useEffect, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import { SaleStatus } from '@luxus/types';
import { api, uploadFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toaster';

interface RequiredDocument {
  type: string;
  label: string;
  fulfilled: boolean;
}

interface SaleDetail {
  id: string;
  protocol: string;
  status: SaleStatus;
  notes?: string | null;
  client?: { id: string; name: string };
  requiredDocuments?: RequiredDocument[] | null;
}

interface ResubmitSaleDocumentsDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ResubmitSaleDocumentsDialog({
  saleId,
  open,
  onOpenChange,
  onSuccess,
}: ResubmitSaleDocumentsDialogProps) {
  const { toast } = useToast();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    if (!open || !saleId) {
      setSale(null);
      setFiles({});
      return;
    }

    setLoading(true);
    api<SaleDetail>(`/sales/${saleId}`)
      .then((data) => setSale(data))
      .catch((err) => {
        setSale(null);
        toast({
          title: 'Erro ao carregar venda',
          description: err instanceof Error ? err.message : 'Falha na requisição',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [open, saleId, toast]);

  const requiredDocs = sale?.requiredDocuments ?? [];
  const pendingDocs = requiredDocs.filter((doc) => !doc.fulfilled);
  const allFulfilled = requiredDocs.length > 0 && pendingDocs.length === 0;

  const handleSubmit = async () => {
    if (!sale) return;

    for (const doc of pendingDocs) {
      if (!files[doc.type]) {
        toast({
          title: 'Documentos incompletos',
          description: `Anexe o arquivo: ${doc.label}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      for (const doc of pendingDocs) {
        await uploadFile(files[doc.type], doc.type, {
          saleId: sale.id,
          clientId: sale.client?.id,
        });
        setSale((current) =>
          current
            ? {
                ...current,
                requiredDocuments: current.requiredDocuments?.map((item) =>
                  item.type === doc.type ? { ...item, fulfilled: true } : item,
                ),
              }
            : current,
        );
      }

      await api(`/sales/${sale.id}/resubmit-documents`, { method: 'POST' });

      toast({
        title: 'Documentos enviados',
        description: 'A venda foi reenviada para análise.',
        variant: 'success',
      });
      setFiles({});
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (saleId) {
        api<SaleDetail>(`/sales/${saleId}`).then(setSale).catch(() => undefined);
      }
      toast({
        title: 'Erro ao enviar documentos',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar documentos solicitados</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Carregando venda...</p>
        ) : !sale ? (
          <p className="py-6 text-sm text-muted-foreground">Venda não encontrada.</p>
        ) : sale.status !== SaleStatus.DOCUMENTS_PENDING ? (
          <p className="py-6 text-sm text-muted-foreground">
            Esta venda não está aguardando documentos.
          </p>
        ) : requiredDocs.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nenhum documento foi solicitado para esta venda.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{sale.protocol}</p>
              <p className="text-muted-foreground">{sale.client?.name ?? 'Cliente'}</p>
            </div>

            {sale.notes && (
              <div className="space-y-1">
                <Label>Mensagem do administrador</Label>
                <p className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  {sale.notes}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label>Documentos solicitados</Label>
              {requiredDocs.map((doc) => (
                <div key={doc.type} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{doc.label}</span>
                    {doc.fulfilled ? (
                      <Badge variant="success" className="gap-1">
                        <Check className="h-3 w-3" /> Enviado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </div>
                  {!doc.fulfilled && (
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFiles((prev) => ({ ...prev, [doc.type]: file }));
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {allFulfilled && (
              <p className="text-sm text-muted-foreground">
                Todos os documentos já foram enviados. Clique abaixo para reenviar a venda para análise.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || loading || !sale || sale.status !== SaleStatus.DOCUMENTS_PENDING}
          >
            <Upload className="mr-2 h-4 w-4" />
            {saving ? 'Enviando...' : allFulfilled ? 'Reenviar para análise' : 'Enviar documentos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
