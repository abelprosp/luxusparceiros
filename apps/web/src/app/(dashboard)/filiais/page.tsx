'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Store, Pencil, Trash2, Ban } from 'lucide-react';
import { formatDate } from '@luxus/utils';
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
import { useToast } from '@/components/ui/toaster';

interface BranchUser {
  id: string;
  email: string;
  isActive: boolean;
}

interface Branch {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  status: string;
  createdAt: string;
  parentPartner?: { id: string; name: string };
  users?: BranchUser[];
  _count?: { sales: number; clients: number };
}

const emptyForm = {
  name: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  login: '',
  password: '',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
};

function getBranchLogin(branch: Branch): string {
  return branch.users?.[0]?.email ?? '-';
}

export default function FiliaisPage() {
  const [items, setItems] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({
      name: branch.name,
      document: branch.document,
      email: branch.email,
      phone: branch.phone,
      address: branch.address ?? '',
      city: branch.city ?? '',
      state: branch.state ?? '',
      login: branch.users?.[0]?.email ?? '',
      password: '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.document || !form.email || !form.phone) {
      toast({ title: 'Preencha nome, documento, e-mail e telefone', variant: 'destructive' });
      return;
    }
    if (!editing && (!form.login || !form.password)) {
      toast({ title: 'Informe login e senha de acesso da filial', variant: 'destructive' });
      return;
    }
    if (form.password && form.password.length < 6) {
      toast({ title: 'A senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }

    const payload: Record<string, string> = {
      name: form.name,
      document: form.document,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      state: form.state,
    };
    if (form.login) payload.login = form.login;
    if (form.password) payload.password = form.password;

    setSaving(true);
    try {
      if (editing) {
        await api(`/branches/${editing.id}`, { method: 'PATCH', body: payload });
        toast({ title: 'Filial atualizada', variant: 'success' });
      } else {
        await api('/branches', { method: 'POST', body: payload });
        toast({ title: 'Filial criada', variant: 'success' });
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

  const handleDeactivate = async (branch: Branch) => {
    if (branch.status === 'INACTIVE') return;
    setSaving(true);
    try {
      await api(`/branches/${branch.id}`, { method: 'PATCH', body: { status: 'INACTIVE' } });
      toast({ title: 'Filial desativada', variant: 'success' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (branch: Branch) => {
    const hasLinks = (branch._count?.sales ?? 0) > 0 || (branch._count?.clients ?? 0) > 0;
    if (hasLinks) {
      toast({
        title: 'Não é possível excluir',
        description: 'Esta filial possui vendas ou clientes vinculados. Desative-a em vez de excluir.',
        variant: 'destructive',
      });
      return;
    }
    setDeleting(branch);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api(`/branches/${deleting.id}`, { method: 'DELETE' });
      toast({ title: 'Filial excluída', variant: 'success' });
      setDeleteDialogOpen(false);
      setDeleting(null);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao excluir', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Filiais" description="Filiais vinculadas ao parceiro mestre">
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
        <Button onClick={openCreate}>
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
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova filial</Button>}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.document}</TableCell>
                  <TableCell>{b.city ? `${b.city}${b.state ? ` - ${b.state}` : ''}` : '-'}</TableCell>
                  <TableCell>{getBranchLogin(b)}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'ACTIVE' ? 'success' : 'outline'}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(b.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(b)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {b.status === 'ACTIVE' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeactivate(b)}
                          disabled={saving}
                          title="Desativar"
                        >
                          <Ban className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDelete(b)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setEditing(null); setForm(emptyForm); } setDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar filial' : 'Nova filial'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados da filial vinculada ao parceiro mestre. Deixe a senha em branco para mantê-la.'
                : 'A filial ficará vinculada ao seu parceiro e terá login próprio para acessar o sistema.'}
            </DialogDescription>
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
              <Label>E-mail de contato *</Label>
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

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Acesso da filial</p>
              <div className="space-y-2">
                <Label>Login (e-mail) *</Label>
                <Input
                  type="email"
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  placeholder="acesso@filial.com.br"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>{editing ? 'Nova senha' : 'Senha *'}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar filial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir filial</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.name}</strong>? O login de acesso também será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
