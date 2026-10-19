'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import type { PaginatedResponse } from '@luxus/types';
import { api, getPaginated } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isAdminUser, isPartnerScopedUser } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toaster';
import {
  MODE_LABELS,
  SALES_IMPORT_MAX_ROWS,
  downloadSalesTemplate,
  readSalesFile,
  type SalesImportMode,
  type SalesImportResult,
} from '@/lib/sales-import';

interface NamedItem { id: string; name: string }
interface PlanItem extends NamedItem { price: number | string; operatorId: string; operator?: { name: string } }
interface PartnerItem extends NamedItem { document: string }
interface BranchItem extends NamedItem { parentPartnerId: string }

async function fetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result: PaginatedResponse<T> = await getPaginated<T>(path, { page, limit: 100 });
    items.push(...result.data);
    if (page >= (result.meta?.totalPages ?? 1)) break;
  }
  return items;
}

const MODE_TEXT: Record<SalesImportMode, string> = {
  new: 'Cada linha vira uma venda que vai para a análise do administrador e, depois de aprovada, segue para o Luxus Task. Anexos (chip, CPF, RG) podem ser pedidos na análise.',
  concluded: 'Para vendas que já foram concluídas no Luxus Task. Entram como concluídas, ligadas ao protocolo do Task, com comissão e no dashboard pela data da venda. Nada é enviado ao Luxus Task.',
};

export function SalesImportButton({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = isAdminUser(user);
  const showPartnerColumn = !isPartnerScopedUser(user);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SalesImportMode>('new');
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState<SalesImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setRows([]);
    setFileError('');
    setResult(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const changeMode = (next: SalesImportMode) => {
    setMode(next);
    reset();
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const [operators, plans, partners, branches] = await Promise.all([
        fetchAll<NamedItem>('/operators'),
        fetchAll<PlanItem>(isPartnerScopedUser(user) ? '/plans/available' : '/plans'),
        showPartnerColumn ? fetchAll<PartnerItem>('/partners') : Promise.resolve([] as PartnerItem[]),
        showPartnerColumn ? fetchAll<BranchItem>('/branches') : Promise.resolve([] as BranchItem[]),
      ]);
      const operatorName = new Map(operators.map((operator) => [operator.id, operator.name]));
      await downloadSalesTemplate(mode, showPartnerColumn, {
        plans: plans
          .map((plan) => ({
            operator: plan.operator?.name ?? operatorName.get(plan.operatorId) ?? '',
            plan: plan.name,
            price: Number(plan.price) || 0,
          }))
          .sort((a, b) => a.operator.localeCompare(b.operator) || a.plan.localeCompare(b.plan)),
        partners: partners
          .map((partner) => ({
            name: partner.name,
            document: partner.document,
            branches: branches.filter((branch) => branch.parentPartnerId === partner.id).map((branch) => branch.name),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    } catch (error) {
      toast({
        title: 'Não foi possível gerar a planilha',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const pickFile = async (picked: File | null) => {
    reset();
    if (!picked) return;
    setFile(picked);
    try {
      const parsed = await readSalesFile(picked, mode, showPartnerColumn);
      if (parsed.missingColumns.length) {
        setFileError(`Faltam colunas da planilha padrão: ${parsed.missingColumns.join(', ')}. Baixe a planilha padrão deste tipo de importação.`);
      } else if (!parsed.rows.length) {
        setFileError('Nenhuma venda preenchida na aba "Vendas".');
      } else if (parsed.rows.length > SALES_IMPORT_MAX_ROWS) {
        setFileError(`A planilha tem ${parsed.rows.length} vendas. Importe no máximo ${SALES_IMPORT_MAX_ROWS} por arquivo.`);
      }
      setRows(parsed.rows);
    } catch {
      setFileError('Não foi possível ler o arquivo. Envie a planilha padrão em .xlsx.');
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const response = await api<SalesImportResult>('/sales/import', {
        method: 'POST',
        body: { mode, rows },
      });
      setResult(response);
      if (response.created) onSuccess();
      toast({
        title: response.failed ? 'Importação concluída com pendências' : 'Importação concluída',
        description: `${response.created} venda(s) importada(s)${response.failed ? `, ${response.failed} com erro` : ''}.`,
        variant: response.failed ? 'destructive' : 'success',
      });
    } catch (error) {
      toast({
        title: 'Não foi possível importar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const modes: SalesImportMode[] = isAdmin ? ['new', 'concluded'] : ['new'];
  const failures = result?.results.filter((item) => !item.ok) ?? [];

  return (
    <>
      <Button variant="outline" type="button" onClick={() => { reset(); setOpen(true); }}>
        <Upload className="mr-2 h-4 w-4" />
        Importar
      </Button>

      <Dialog open={open} onOpenChange={(next) => !importing && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar vendas por planilha</DialogTitle>
            <DialogDescription>
              Baixe a planilha padrão, preencha uma venda por linha e envie o arquivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className={cn('grid gap-2', modes.length > 1 && 'sm:grid-cols-2')}>
              {modes.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={importing}
                  onClick={() => changeMode(item)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    mode === item ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
                  )}
                >
                  <p className="text-sm font-medium">{MODE_LABELS[item]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{MODE_TEXT[item]}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
              <div className="flex-1 text-sm">
                <p className="font-medium">1. Baixe a planilha padrão</p>
                <p className="text-xs text-muted-foreground">
                  Vem com as instruções de cada coluna e a lista de planos{showPartnerColumn ? ', parceiros e lojas' : ''}.
                </p>
              </div>
              <Button type="button" variant="secondary" disabled={downloading} onClick={downloadTemplate}>
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Baixar planilha
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">2. Envie a planilha preenchida</p>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => void pickFile(event.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {file ? 'Trocar arquivo' : 'Escolher arquivo .xlsx'}
              </Button>
              {file && !fileError && (
                <p className="text-sm text-muted-foreground">
                  {file.name}: {rows.length} venda(s) encontrada(s).
                </p>
              )}
              {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            </div>

            {result && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> {result.created} importada(s)
                  </span>
                  <span className={cn('flex items-center gap-1', result.failed ? 'text-destructive' : 'text-muted-foreground')}>
                    <XCircle className="h-4 w-4" /> {result.failed} com erro
                  </span>
                </div>
                {failures.length > 0 && (
                  <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
                    {failures.map((item) => (
                      <p key={item.row} className="rounded bg-destructive/5 px-2 py-1">
                        <span className="font-medium">Linha {item.row}{item.client ? ` (${item.client})` : ''}:</span>{' '}
                        {item.error}
                      </p>
                    ))}
                    <p className="pt-1 text-muted-foreground">
                      Corrija só essas linhas na planilha (apague as que já entraram) e envie de novo.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={importing} onClick={() => setOpen(false)}>Fechar</Button>
            <Button disabled={importing || !rows.length || Boolean(fileError) || Boolean(result)} onClick={runImport}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {importing ? 'Importando' : `Importar ${rows.length || ''} venda(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
