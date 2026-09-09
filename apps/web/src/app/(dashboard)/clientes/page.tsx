'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, User, Pencil, Trash2 } from 'lucide-react';
import { DocumentType, PERMISSIONS } from '@luxus/types';
import { formatDocument, formatPhone } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileListCard, ResponsiveDataView } from '@/components/ui/mobile-list-card';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/components/ui/toaster';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/rbac';

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
  const { user } = useAuth();
  const canWrite = hasPermission(user, PERMISSIONS.CLIENTS_WRITE);
  const canDelete = hasPermission(user, PERMISSIONS.CLIENTS_DELETE);
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const selectedLabel = useMemo(() => {
    if (selectedIds.length === 1) {
      return items.find((item) => item.id === selectedIds[0])?.name ?? '1 cliente';
    }
    return `${selectedIds.length} clientes`;
  }, [items, selectedIds]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Client>('/clients', {
        search: search || undefined,
        limit: 50,
      });
      setItems(res.data);
      setSelectedIds((current) => current.filter((id) => res.data.some((item) => item.id === id)));
    } catch {
      setItems([]);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((item) => item.id) : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((current) => (
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((itemId) => itemId !== id)
    ));
  };

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

  const confirmDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/clients/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ title: 'Cliente excluído', variant: 'success' });
      setDeleteTarget(null);
      setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
      await load();
    } catch (err) {
      toast({
        title: 'Não foi possível excluir',
        description: err instanceof Error ? err.message : 'Falha na exclusão',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const result = await api<{ deleted: string[]; failed: Array<{ id: string; reason: string }> }>(
        '/clients/bulk-delete',
        { method: 'POST', body: { ids: selectedIds } },
      );
      const deletedCount = result.deleted?.length ?? 0;
      const failedCount = result.failed?.length ?? 0;
      if (deletedCount > 0) {
        toast({
          title: `${deletedCount} cliente(s) excluído(s)`,
          description: failedCount > 0
            ? `${failedCount} não puderam ser excluídos (ex.: com venda vinculada).`
            : undefined,
          variant: failedCount > 0 ? 'default' : 'success',
        });
      } else {
        toast({
          title: 'Nenhum cliente excluído',
          description: result.failed?.[0]?.reason ?? 'Verifique se os clientes têm vendas vinculadas.',
          variant: 'destructive',
        });
      }
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      await load();
    } catch (err) {
      toast({
        title: 'Não foi possível excluir',
        description: err instanceof Error ? err.message : 'Falha na exclusão',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
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
        <div className="flex flex-wrap gap-2">
          {canDelete && selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir selecionados ({selectedIds.length})
            </Button>
          )}
          {canWrite && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo cliente
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={User}
          title="Nenhum cliente"
          description="Cadastre seu primeiro cliente para começar."
          action={canWrite ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button> : undefined}
        />
      ) : (
        <ResponsiveDataView
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  {canDelete && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => toggleAll(checked === true)}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                  )}
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
                  <TableRow key={c.id} data-state={selectedIds.includes(c.id) ? 'selected' : undefined}>
                    {canDelete && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(c.id)}
                          onCheckedChange={(checked) => toggleOne(c.id, checked === true)}
                          aria-label={`Selecionar ${c.name}`}
                        />
                      </TableCell>
                    )}
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
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(c)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
                <div className="flex items-center gap-2">
                  {canDelete && (
                    <Checkbox
                      checked={selectedIds.includes(c.id)}
                      onCheckedChange={(checked) => toggleOne(c.id, checked === true)}
                      aria-label={`Selecionar ${c.name}`}
                    />
                  )}
                  <Badge variant={c.isActive ? 'success' : 'secondary'}>
                    {c.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              }
              actions={
                <div className="flex items-center gap-1">
                  {canWrite && (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(c)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

      <DeleteConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemType="cliente"
        itemLabel={deleteTarget?.name ?? ''}
        description="Também remove vendas de teste vinculadas (exceto se a comissão já estiver paga). Linhas e solicitações só desvinculam o cliente."
        deleting={deleting}
        onConfirm={() => void confirmDeleteOne()}
      />

      <DeleteConfirmationDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        itemType="clientes"
        itemLabel={selectedLabel}
        description="Também remove vendas de teste vinculadas (exceto comissão já paga). Clientes com comissão paga serão mantidos."
        deleting={deleting}
        onConfirm={() => void confirmBulkDelete()}
      />
    </DashboardLayout>
  );
}
