'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, UserCog } from 'lucide-react';
import { UserRole } from '@luxus/types';
import { formatDate } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadMoreButton } from '@/components/ui/error-state';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/components/ui/toaster';
import { usePaginatedList } from '@/hooks/usePaginatedList';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  partnerId?: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.SUPERVISOR]: 'Supervisor',
  [UserRole.PARTNER]: 'Parceiro',
  [UserRole.ATTENDANT]: 'Filial',
};

const ASSIGNABLE_ROLES = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.PARTNER];
const NO_PARTNER = 'none';
const emptyForm = { name: '', email: '', password: '', role: UserRole.PARTNER as string, partnerId: NO_PARTNER };

export default function UsuariosPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchUsers = useCallback(
    (page: number) => getPaginated<User>('/users', { search: search || undefined, page, limit: 50 }),
    [search],
  );
  const list = usePaginatedList(fetchUsers);
  const { items, loading, reload: load } = list;

  useEffect(() => {
    getPaginated<{ id: string; name: string }>('/partners', { limit: 100, status: 'ACTIVE' })
      .then((res) => setPartners(res.data))
      .catch(() => setPartners([]));
  }, []);

  const partnerRequired = form.role === UserRole.PARTNER;

  const handleSave = async () => {
    if (partnerRequired && form.partnerId === NO_PARTNER) {
      toast({ title: 'Selecione o parceiro do usuário', variant: 'destructive' });
      return;
    }
    const partnerId = form.partnerId === NO_PARTNER ? undefined : form.partnerId;
    setSaving(true);
    try {
      if (editing) {
        await api(`/users/${editing.id}`, {
          method: 'PATCH',
          body: { name: form.name, email: form.email, role: form.role, partnerId: partnerId ?? null },
        });
      } else {
        await api('/users', {
          method: 'POST',
          body: { name: form.name, email: form.email, password: form.password, role: form.role, partnerId },
        });
      }
      toast({ title: 'Usuário salvo', variant: 'success' });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/users/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ title: 'Usuário excluído', variant: 'success' });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao excluir', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, partnerId: user.partnerId ?? NO_PARTNER });
    setDialogOpen(true);
  };

  return (
    <DashboardLayout title="Usuários" description="Gestão de usuários do sistema">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar usuários..."
            aria-label="Buscar usuários"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.error && items.length === 0 ? (
        <ErrorState message={list.error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState icon={UserCog} title="Nenhum usuário" description="Cadastre o primeiro usuário." />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
                  <TableCell><Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} aria-label={`Editar ${u.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} aria-label={`Excluir ${u.name}`}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!loading && (
        <LoadMoreButton
          hasMore={list.hasMore}
          loading={list.loadingMore}
          onClick={() => void list.loadMore()}
          shown={items.length}
          total={list.total}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input id="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input id="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="user-password">Senha</Label>
                <Input id="user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="user-role">Perfil</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Usuários de filial são criados na tela de Filiais.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-partner">Parceiro{partnerRequired ? ' *' : ''}</Label>
              <Select value={form.partnerId} onValueChange={(v) => setForm({ ...form, partnerId: v })}>
                <SelectTrigger id="user-partner"><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                <SelectContent>
                  {!partnerRequired && <SelectItem value={NO_PARTNER}>Equipe Luxus (sem parceiro)</SelectItem>}
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemType="usuário"
        itemLabel={deleteTarget?.name ?? ''}
        description="O acesso deste usuário será removido imediatamente."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </DashboardLayout>
  );
}
