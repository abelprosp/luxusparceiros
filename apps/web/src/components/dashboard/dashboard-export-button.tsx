'use client';

import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { DashboardDetails } from '@luxus/types';
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
import { exportDashboardReport, type DashboardExportFormat } from '@/lib/dashboard-export';

const FORMAT_LABELS: Record<DashboardExportFormat, string> = {
  pdf: 'PDF',
  xlsx: 'Excel (.csv)',
  txt: 'Texto (.txt)',
};

export function DashboardExportButton({
  loadDetails,
}: {
  loadDetails: () => Promise<DashboardDetails>;
}) {
  const { toast } = useToast();
  const [format, setFormat] = useState<DashboardExportFormat | null>(null);
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
      const details = await loadDetails();
      setProgress(70);
      await exportDashboardReport(details, format);
      setProgress(100);
      toast({ title: 'Relatório pronto', description: `Arquivo ${FORMAT_LABELS[format]} baixado.`, variant: 'success' });
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
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setFormat('pdf')}>
            <FileText /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFormat('xlsx')}>
            <FileSpreadsheet /> Excel (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFormat('txt')}>
            <FileText /> Texto (.txt)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(format)} onOpenChange={(open) => !open && !exporting && setFormat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar relatório</DialogTitle>
            <DialogDescription>
              {format && `Gerar o relatório no formato ${FORMAT_LABELS[format]}? O arquivo respeitará seu parceiro e sua filial.`}
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
