'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, User, Pencil } from 'lucide-react';
import { DocumentType } from '@luxus/types';
import { formatDocument, formatPhone } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileListCard, ResponsiveDataView } from '@/components/ui/mobile-list-card';
import { useToast } from '@/components/ui/toaster';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Client {
  id: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
  rg?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
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
  notes: '',
  isActive: 'true',
};

export default function ClientesPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = async (client: Client) => {
    setSaving(true);
    try {
      const full = await api<Client>(`/clients/${client.id}`);
      setEditing(full);
      setForm({
        name: full.name,
        document: full.document,
        rg: full.rg ?? '',
        email: full.email ?? '',
        phone: full.phone,
        address: full.address ?? '',
        addressNumber: full.addressNumber ?? '',
        complement: full.complement ?? '',
        neighborhood: full.neighborhood ?? '',
        city: full.city ?? '',
        state: full.state ?? '',
        zipCode: full.zipCode ?? '',
        notes: full.notes ?? '',
        isActive: full.isActive ? 'true' : 'false',
      });
      setDialogOpen(true);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao carregar cliente', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.document || !form.phone) {
      toast({ title: 'Preencha nome, CPF e telefone', variant: 'destructive' });
      return;
    }

    const payload = {
      name: form.name,
      document: form.document.replace(/\D/g, ''),
      documentType: DocumentType.CPF,
      rg: form.rg || undefined,
      email: form.email || undefined,
      phone: form.phone,
      address: form.address || undefined,
      addressNumber: form.addressNumber || undefined,
      complement: form.complement || undefined,
      neighborhood: form.neighborhood || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      zipCode: form.zipCode || undefined,
      notes: form.notes || undefined,
      ...(editing && { isActive: form.isActive === 'true' }),
    };

    setSaving(true);
    try {
      if (editing) {
        await api(`/clients/${editing.id}`, { method: 'PATCH', body: payload });
        toast({ title: 'Cliente atualizado', variant: 'success' });
      } else {
        await api('/clients', { method: 'POST', body: payload });
        toast({ title: 'Cliente cadastrado', variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
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
        <Button onClick={openCreate}>
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
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>}
        />
      ) : (
        <ResponsiveDataView
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          mobile={items.map((c) => (
            <MobileListCard
              key={c.id}
              title={c.name}
              subtitle={formatDocument(c.document)}
              meta={`${formatPhone(c.phone)}${c.email ? ` · ${c.email}` : ''}`}
              badges={
                <Badge variant={c.isActive ? 'success' : 'secondary'}>
                  {c.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              }
              actions={
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          ))}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setEditing(null); setForm(emptyForm); } setDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados do cliente.' : 'Preencha os dados para cadastrar um novo cliente.'}
            </DialogDescription>
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
              <Label>Número</Label>
              <Input value={form.addressNumber} onChange={(e) => setForm({ ...form, addressNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editing && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Status</Label>
                <Select value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
