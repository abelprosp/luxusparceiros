'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, User } from 'lucide-react';
import { DocumentType } from '@luxus/types';
import { formatDocument, formatPhone } from '@luxus/utils';
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

interface Client {
  id: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  name: '',
  document: '',
  rg: '',
  email: '',
  phone: '',
  address: '',
  addressNumber: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
};

export default function ClientesPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Client>('/clients', {
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
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.document || !form.phone) {
      toast({ title: 'Preencha nome, CPF e telefone', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api('/clients', {
        method: 'POST',
        body: {
          ...form,
          document: form.document.replace(/\D/g, ''),
          documentType: DocumentType.CPF,
        },
      });
      toast({ title: 'Cliente cadastrado', variant: 'success' });
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
    <DashboardLayout title="Clientes" description="Cadastro de clientes do parceiro">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou documento..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={User}
          title="Nenhum cliente"
          description="Cadastre seu primeiro cliente para começar."
          action={<Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{formatDocument(c.document)}</TableCell>
                  <TableCell>{formatPhone(c.phone)}</TableCell>
                  <TableCell>{c.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'success' : 'secondary'}>
                      {c.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
