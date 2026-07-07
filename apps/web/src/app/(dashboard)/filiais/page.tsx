'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Store } from 'lucide-react';
import { formatDate } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';

interface Branch {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  status: string;
  createdAt: string;
}

const emptyForm = {
  name: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
};

export default function FiliaisPage() {
  const [items, setItems] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Branch>('/branches', {
        search: search || undefined,
        limit: 50,
      });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.document || !form.email || !form.phone) {
      toast({ title: 'Preencha nome, documento, e-mail e telefone', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api('/branches', { method: 'POST', body: form });
      toast({ title: 'Filial criada', variant: 'success' });
      setDialogOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Filiais" description="Filiais do parceiro">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar filial..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova filial
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nenhuma filial"
          description="Cadastre sua primeira filial."
          action={<Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova filial</Button>}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.document}</TableCell>
                  <TableCell>{b.city ? `${b.city}${b.state ? ` - ${b.state}` : ''}` : '-'}</TableCell>
                  <TableCell>{b.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABELS[b.status] ?? b.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(b.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova filial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Documento *</Label>
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar filial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
