'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { quickReplyService } from '@/services/quick-reply.service';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { QuickReply } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const SHORTCUT_REGEX = /^[a-z0-9-]+$/;

// ============================================
// TYPES
// ============================================

interface QuickReplyFormData {
  title: string;
  shortcut: string;
  content: string;
  category: string;
  order: number;
  isActive?: boolean;
}

// ============================================
// SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 pl-4">
            <Skeleton className="h-5 w-20 rounded" />
          </TableCell>
          <TableCell className="py-2.5">
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell className="py-2.5">
            <Skeleton className="h-4 w-64" />
          </TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell">
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell className="py-2.5 hidden xl:table-cell">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="py-2.5 pr-4">
            <Skeleton className="h-6 w-6 rounded ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  searching: boolean;
  query: string;
  onNew: () => void;
}

function EmptyState({ searching, query, onNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--surface-gray-2)' }}
      >
        <Zap className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
        {searching ? 'Nenhuma resposta encontrada' : 'Sem respostas rapidas'}
      </p>
      <p className="text-xs mb-5" style={{ color: 'var(--ink-gray-5)' }}>
        {searching
          ? `Nenhum resultado para "${query}"`
          : 'Adicione a primeira resposta rapida para comecar'}
      </p>
      {!searching && (
        <Button
          size="sm"
          onClick={onNew}
          style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
          className="h-7 text-xs px-3 rounded hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nova Resposta
        </Button>
      )}
    </div>
  );
}

// ============================================
// SHORTCUT BADGE
// ============================================

function ShortcutBadge({ shortcut }: { shortcut: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ backgroundColor: '#E4FAEB', color: '#278F5E' }}
    >
      /{shortcut}
    </span>
  );
}

// ============================================
// FORM DIALOG
// ============================================

interface QuickReplyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: QuickReplyFormData) => Promise<void>;
  quickReply?: QuickReply | null;
  isLoading: boolean;
}

function QuickReplyFormDialog({
  isOpen,
  onClose,
  onSubmit,
  quickReply,
  isLoading,
}: QuickReplyFormDialogProps) {
  const [formData, setFormData] = useState<QuickReplyFormData>({
    title: quickReply?.title || '',
    shortcut: quickReply?.shortcut || '',
    content: quickReply?.content || '',
    category: quickReply?.category || '',
    order: quickReply?.order ?? 0,
    isActive: quickReply?.isActive ?? true,
  });

  useEffect(() => {
    if (isOpen && quickReply) {
      setFormData({
        title: quickReply.title,
        shortcut: quickReply.shortcut,
        content: quickReply.content,
        category: quickReply.category || '',
        order: quickReply.order ?? 0,
        isActive: quickReply.isActive,
      });
    } else if (isOpen) {
      setFormData({
        title: '',
        shortcut: '',
        content: '',
        category: '',
        order: 0,
        isActive: true,
      });
    }
  }, [isOpen, quickReply]);

  const handleShortcutChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, shortcut: sanitized });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Titulo e obrigatorio');
      return;
    }

    if (!formData.shortcut.trim()) {
      toast.error('Atalho e obrigatorio');
      return;
    }

    if (!SHORTCUT_REGEX.test(formData.shortcut)) {
      toast.error('Atalho deve conter apenas letras minusculas, numeros e hifens');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Conteudo e obrigatorio');
      return;
    }

    await onSubmit(formData);
  };

  const inputStyle = {
    borderColor: 'var(--outline-gray-2)',
    backgroundColor: 'var(--surface-white)',
    color: 'var(--ink-gray-8)',
  };
  const labelStyle = { color: 'var(--ink-gray-6)' };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md rounded-xl border shadow-lg"
        style={{
          backgroundColor: 'var(--surface-white)',
          borderColor: 'var(--outline-gray-2)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            {quickReply ? 'Editar Resposta Rapida' : 'Nova Resposta Rapida'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {/* Titulo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Titulo <span style={{ color: 'var(--ink-red-3)' }}>*</span>
            </Label>
            <Input
              placeholder="Ex: Confirmacao de reserva, Politica de cancelamento..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-8 text-sm rounded border"
              style={inputStyle}
              maxLength={100}
              autoFocus
              required
            />
            <p className="text-[11px]" style={{ color: 'var(--ink-gray-4)' }}>
              {formData.title.length}/100 caracteres
            </p>
          </div>

          {/* Atalho */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Atalho <span style={{ color: 'var(--ink-red-3)' }}>*</span>
            </Label>
            <Input
              placeholder="Ex: confirmacao, cancelamento, check-in"
              value={formData.shortcut}
              onChange={(e) => handleShortcutChange(e.target.value)}
              className="h-8 text-sm rounded border font-mono"
              style={inputStyle}
              maxLength={50}
              required
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: 'var(--ink-gray-4)' }}>
                Apenas letras minusculas, numeros e hifens
              </p>
              {formData.shortcut && (
                <ShortcutBadge shortcut={formData.shortcut} />
              )}
            </div>
          </div>

          {/* Conteudo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Conteudo <span style={{ color: 'var(--ink-red-3)' }}>*</span>
            </Label>
            <Textarea
              placeholder="Digite o texto completo da resposta rapida..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="min-h-[100px] text-sm rounded border resize-y"
              style={inputStyle}
              maxLength={4000}
              required
            />
            <p className="text-[11px]" style={{ color: 'var(--ink-gray-4)' }}>
              {formData.content.length}/4000 caracteres
            </p>
          </div>

          {/* Categoria e Ordem */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={labelStyle}>
                Categoria
              </Label>
              <Input
                placeholder="Ex: Vendas"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="h-8 text-sm rounded border"
                style={inputStyle}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={labelStyle}>
                Ordem
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
                className="h-8 text-sm rounded border"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Preview
            </Label>
            <div
              className="p-3 rounded-lg border space-y-1.5"
              style={{
                borderColor: 'var(--outline-gray-2)',
                backgroundColor: 'var(--surface-gray-1)',
              }}
            >
              <div className="flex items-center gap-2">
                <ShortcutBadge shortcut={formData.shortcut || 'atalho'} />
                <span className="text-xs font-medium truncate" style={{ color: 'var(--ink-gray-7)' }}>
                  {formData.title || 'Titulo da resposta'}
                </span>
              </div>
              {formData.content && (
                <p className="text-[11px] line-clamp-2" style={{ color: 'var(--ink-gray-5)' }}>
                  {formData.content}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-2 pt-2 border-t"
            style={{ borderColor: 'var(--outline-gray-1)' }}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="h-8 px-3 text-sm rounded border"
              style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-7)' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="h-8 px-3 text-sm rounded text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--surface-gray-7)' }}
            >
              {isLoading
                ? 'Salvando...'
                : quickReply
                ? 'Salvar Alteracoes'
                : 'Criar Resposta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE CONTENT
// ============================================

function QuickRepliesPageContent() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [deletingQuickReply, setDeletingQuickReply] = useState<QuickReply | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 350);

  // ============================================
  // QUERY
  // ============================================

  const { data: quickRepliesData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['quick-replies', debouncedSearch],
    queryFn: () =>
      quickReplyService.list({
        search: debouncedSearch || undefined,
      }),
  });

  const quickReplies = useMemo(() => quickRepliesData?.data || [], [quickRepliesData]);

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof quickReplyService.create>[0]) =>
      quickReplyService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      setIsCreateOpen(false);
      toast.success('Resposta rapida criada com sucesso!');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const message = error.response?.data?.message || 'Erro ao criar resposta rapida';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof quickReplyService.update>[1] }) =>
      quickReplyService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      setEditingQuickReply(null);
      toast.success('Resposta rapida atualizada com sucesso!');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const message = error.response?.data?.message || 'Erro ao atualizar resposta rapida';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quickReplyService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      setDeletingQuickReply(null);
      toast.success('Resposta rapida removida com sucesso!');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const message = error.response?.data?.message || 'Erro ao remover resposta rapida';
      toast.error(message);
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreate = async (data: QuickReplyFormData) => {
    await createMutation.mutateAsync({
      title: data.title,
      shortcut: data.shortcut,
      content: data.content,
      category: data.category || undefined,
      order: data.order,
    });
  };

  const handleUpdate = async (data: QuickReplyFormData) => {
    if (!editingQuickReply) return;
    await updateMutation.mutateAsync({
      id: editingQuickReply.id,
      data: {
        title: data.title,
        shortcut: data.shortcut,
        content: data.content,
        category: data.category || undefined,
        order: data.order,
        isActive: data.isActive,
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingQuickReply) return;
    await deleteMutation.mutateAsync(deletingQuickReply.id);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full">
      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Respostas Rapidas
          </h1>
          {!isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {quickReplies.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
            className="h-7 text-xs px-3 rounded hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Resposta
          </Button>
        </div>
      </div>

      {/* ---- Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        <div className="relative max-w-xs w-full">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar por titulo, atalho ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-7 text-xs border rounded"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow
              className="border-b"
              style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
            >
              <TableHead
                className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Atalho
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Titulo
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Conteudo
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Categoria
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden xl:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Criado
              </TableHead>
              <TableHead className="py-2 pr-4 w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-20 text-center">
                  <p className="text-sm mb-2" style={{ color: 'var(--ink-gray-5)' }}>
                    Erro ao carregar respostas rapidas.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => refetch()}
                    style={{ color: 'var(--ink-blue-3)' }}
                  >
                    Tentar novamente
                  </Button>
                </TableCell>
              </TableRow>
            ) : quickReplies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    searching={!!debouncedSearch}
                    query={debouncedSearch}
                    onNew={() => setIsCreateOpen(true)}
                  />
                </TableCell>
              </TableRow>
            ) : (
              quickReplies.map((qr) => (
                <TableRow
                  key={qr.id}
                  className="border-b cursor-default transition-colors group"
                  style={{ borderColor: 'var(--outline-gray-1)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  {/* Atalho */}
                  <TableCell className="py-2.5 pl-4">
                    <ShortcutBadge shortcut={qr.shortcut} />
                  </TableCell>

                  {/* Titulo */}
                  <TableCell className="py-2.5">
                    <div>
                      <span
                        className="text-sm font-medium truncate max-w-[180px] block"
                        style={{ color: 'var(--ink-gray-8)' }}
                      >
                        {qr.title}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--ink-gray-4)' }}>
                        Ordem: {qr.order}
                      </span>
                    </div>
                  </TableCell>

                  {/* Conteudo */}
                  <TableCell className="py-2.5">
                    <span
                      className="text-sm truncate max-w-[280px] block"
                      style={{ color: 'var(--ink-gray-5)' }}
                    >
                      {qr.content}
                    </span>
                  </TableCell>

                  {/* Categoria */}
                  <TableCell className="py-2.5 hidden lg:table-cell">
                    {qr.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{
                          backgroundColor: 'var(--surface-gray-2)',
                          color: 'var(--ink-gray-6)',
                        }}
                      >
                        {qr.category}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
                    )}
                  </TableCell>

                  {/* Criado */}
                  <TableCell className="py-2.5 hidden xl:table-cell">
                    <span className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
                      {qr.createdAt
                        ? formatDistanceToNow(new Date(qr.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : '—'}
                    </span>
                  </TableCell>

                  {/* Acoes */}
                  <TableCell className="py-2.5 pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Acoes"
                        >
                          <MoreHorizontal
                            className="h-4 w-4"
                            style={{ color: 'var(--ink-gray-5)' }}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-40 rounded-lg border shadow-md"
                        style={{
                          backgroundColor: 'var(--surface-white)',
                          borderColor: 'var(--outline-gray-2)',
                        }}
                      >
                        <DropdownMenuItem
                          className="text-sm cursor-pointer"
                          style={{ color: 'var(--ink-gray-7)' }}
                          onClick={() => setEditingQuickReply(qr)}
                        >
                          <Edit className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-sm cursor-pointer"
                          style={{ color: 'var(--ink-red-3)' }}
                          onClick={() => setDeletingQuickReply(qr)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---- Create / Edit Dialog ---- */}
      <QuickReplyFormDialog
        isOpen={isCreateOpen || !!editingQuickReply}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingQuickReply(null);
        }}
        onSubmit={editingQuickReply ? handleUpdate : handleCreate}
        quickReply={editingQuickReply}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* ---- Delete Confirm ---- */}
      <AlertDialog
        open={!!deletingQuickReply}
        onOpenChange={(open) => !open && setDeletingQuickReply(null)}
      >
        <AlertDialogContent
          className="rounded-xl border shadow-lg max-w-sm"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-sm font-semibold"
              style={{ color: 'var(--ink-gray-9)' }}
            >
              Remover resposta rapida
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja remover{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>
                &quot;{deletingQuickReply?.title}&quot;
              </strong>
              ? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-sm h-8 px-3 rounded border"
              style={{
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
                backgroundColor: 'var(--surface-white)',
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="text-sm h-8 px-3 rounded text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--ink-red-3)' }}
            >
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function QuickRepliesPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD, UserRole.SALES]}>
      <QuickRepliesPageContent />
    </ProtectedRoute>
  );
}
