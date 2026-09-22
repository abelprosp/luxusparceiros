'use client';

import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toaster';
import { exportSalesReport, type SaleExportRow } from '@/lib/sales-export';
import type { TableExportFormat } from '@/lib/table-export';

const FORMAT_LABELS: Record<TableExportFormat, string> = {
  pdf: 'PDF',
  xlsx: 'Excel (.csv)',
  txt: 'Texto (.txt)',
};

export function SalesExportButton({
  loadSales,
  includePartnerColumns = true,
}: {
  loadSales: () => Promise<SaleExportRow[]>;
  includePartnerColumns?: boolean;
}) {
  const { toast } = useToast();
  const [format, setFormat] = useState<TableExportFormat | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!exporting) return;
    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(92, current + Math.max(2, Math.round((92 - current) / 5))));
    }, 180);
    return () => window.clearInterval(interval);
  }, [exporting]);

  const confirmExport = async () => {
    if (!format) return;
    setExporting(true);
    setProgress(8);
    try {
      const sales = await loadSales();
      if (!sales.length) {
        toast({
          title: 'Nada para exportar',
          description: 'Não há vendas com os filtros atuais.',
          variant: 'destructive',
        });
        setExporting(false);
        setProgress(0);
        return;
      }
      setProgress(70);
      await exportSalesReport(sales, format, { includePartnerColumns });
      setProgress(100);
      toast({
        title: 'Exportação pronta',
        description: `Arquivo ${FORMAT_LABELS[format]} baixado (${sales.length} venda(s)).`,
        variant: 'success',
      });
      window.setTimeout(() => {
        setFormat(null);
        setExporting(false);
        setProgress(0);
      }, 500);
    } catch (error) {
      setExporting(false);
      setProgress(0);
      toast({
        title: 'Não foi possível exportar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" type="button">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setFormat('pdf')}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFormat('xlsx')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFormat('txt')}>
            <FileText className="mr-2 h-4 w-4" /> Texto (.txt)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(format)} onOpenChange={(open) => !open && !exporting && setFormat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar vendas</DialogTitle>
            <DialogDescription>
              {format && `Gerar ${FORMAT_LABELS[format]} com os filtros atuais da listagem?`}
            </DialogDescription>
          </DialogHeader>
          {exporting && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-sm">
                <span>Preparando arquivo...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" disabled={exporting} onClick={() => setFormat(null)}>Cancelar</Button>
            <Button disabled={exporting} onClick={confirmExport}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? 'Gerando' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
