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
  DialogDescription,
  DialogFooter,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { QuickReply } from '@/types';

const SHORTCUT_REGEX = /^[a-z0-9-]+$/;

interface QuickReplyFormData {
  title: string;
  shortcut: string;
  content: string;
  category: string;
  order: number;
  isActive?: boolean;
}

function QuickReplyFormDialog({
  isOpen,
  onClose,
  onSubmit,
  quickReply,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: QuickReplyFormData) => Promise<void>;
  quickReply?: QuickReply | null;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<QuickReplyFormData>({
    title: quickReply?.title || '',
    shortcut: quickReply?.shortcut || '',
    content: quickReply?.content || '',
    category: quickReply?.category || '',
    order: quickReply?.order ?? 0,
    isActive: quickReply?.isActive ?? true,
  });

  // Sync form when dialog opens/closes
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {quickReply ? 'Editar Resposta Rapida' : 'Nova Resposta Rapida'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            {quickReply
              ? 'Atualize as informacoes da resposta rapida'
              : 'Adicione uma nova resposta rapida ao sistema'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 py-2">
            {/* Titulo */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Titulo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Ex: Confirmacao de reserva, Politica de cancelamento..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                maxLength={100}
                required
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {formData.title.length}/100 caracteres
              </p>
            </div>

            {/* Atalho */}
            <div className="space-y-1.5">
              <Label htmlFor="shortcut" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Atalho <span className="text-red-500">*</span>
              </Label>
              <Input
                id="shortcut"
                placeholder="Ex: confirmacao, cancelamento, check-in"
                value={formData.shortcut}
                onChange={(e) => handleShortcutChange(e.target.value)}
                className="h-10 font-mono bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                maxLength={50}
                required
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Apenas letras minusculas, numeros e hifens
                </p>
                {formData.shortcut && (
                  <Badge className="font-mono text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25">
                    /{formData.shortcut}
                  </Badge>
                )}
              </div>
            </div>

            {/* Conteudo */}
            <div className="space-y-1.5">
              <Label htmlFor="content" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Conteudo <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="content"
                placeholder="Digite o texto completo da resposta rapida..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[120px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 resize-y"
                maxLength={4000}
                required
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {formData.content.length}/4000 caracteres
              </p>
            </div>

            {/* Categoria e Ordem lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Categoria
                </Label>
                <Input
                  id="category"
                  placeholder="Ex: Vendas"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ordem
                </Label>
                <Input
                  id="order"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                  }
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Preview</Label>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="font-mono text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25">
                    /{formData.shortcut || 'atalho'}
                  </Badge>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {formData.title || 'Titulo da resposta'}
                  </span>
                </div>
                {formData.content && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {formData.content}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isLoading
                ? 'Salvando...'
                : quickReply
                ? 'Salvar Alteracoes'
                : 'Criar Resposta Rapida'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickRepliesSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-8 w-20 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

function QuickRepliesPageContent() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [deletingQuickReply, setDeletingQuickReply] = useState<QuickReply | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 500);

  const { data: quickRepliesData, isLoading, error, refetch } = useQuery({
    queryKey: ['quick-replies', debouncedSearch],
    queryFn: () =>
      quickReplyService.list({
        search: debouncedSearch || undefined,
      }),
  });

  const quickReplies = useMemo(() => quickRepliesData?.data || [], [quickRepliesData]);

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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            Respostas Rapidas
          </h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">
            Gerencie os atalhos de respostas para atendimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            className="glass-btn"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Nova Resposta</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="glass-card glass-kpi p-6 animate-slideUp">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-2">
              TOTAL DE RESPOSTAS RAPIDAS
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {quickReplies.length}
            </p>
          </div>
          <div className="icon-box icon-box-purple">
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Card principal */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
        {/* Barra de busca */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] h-4 w-4" />
            <Input
              type="search"
              placeholder="Buscar por titulo, atalho ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-12 h-12"
            />
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <QuickRepliesSkeleton />
        ) : error ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p>Erro ao carregar respostas rapidas</p>
            <Button variant="link" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !quickReplies.length ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            {debouncedSearch ? (
              <p>Nenhuma resposta rapida encontrada para &quot;{debouncedSearch}&quot;</p>
            ) : (
              <>
                <p>Nenhuma resposta rapida cadastrada ainda</p>
                <Button
                  variant="link"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-2"
                >
                  Adicionar primeira resposta rapida
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-3">
              {quickReplies.map((qr) => (
                <div
                  key={qr.id}
                  className="p-4 rounded-ios-xs border border-[var(--glass-border)] bg-[var(--glass-bg-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Zap className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {qr.title}
                        </p>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mt-1"
                        >
                          /{qr.shortcut}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="glass-card border-[var(--glass-border)]"
                      >
                        <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingQuickReply(qr)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingQuickReply(qr)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-2">
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      {qr.content}
                    </p>
                    <div className="flex items-center justify-between">
                      {qr.category ? (
                        <Badge variant="outline" className="text-xs">
                          {qr.category}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDistanceToNow(new Date(qr.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block rounded-ios-xs overflow-hidden border border-[var(--glass-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--glass-bg-hover)]">
                    <TableHead className="text-[var(--text-secondary)]">Atalho</TableHead>
                    <TableHead className="text-[var(--text-secondary)]">Titulo</TableHead>
                    <TableHead className="text-[var(--text-secondary)]">Conteudo</TableHead>
                    <TableHead className="text-[var(--text-secondary)] hidden lg:table-cell">
                      Categoria
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-secondary)]">
                      Acoes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quickReplies.map((qr) => (
                    <TableRow
                      key={qr.id}
                      className="hover:bg-[var(--glass-bg-hover)] transition-colors"
                    >
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        >
                          /{qr.shortcut}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {qr.title}
                          </p>
                          <p className="text-sm text-[var(--text-muted)]">
                            Ordem: {qr.order}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-[var(--text-muted)] max-w-[280px] truncate">
                          {qr.content}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {qr.category ? (
                          <Badge variant="outline" className="text-xs">
                            {qr.category}
                          </Badge>
                        ) : (
                          <span className="text-sm text-[var(--text-muted)]">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="glass-card border-[var(--glass-border)]"
                          >
                            <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingQuickReply(qr)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeletingQuickReply(qr)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Info total */}
        {quickReplies.length > 0 && (
          <p className="text-sm text-[var(--text-muted)] mt-4">
            {quickReplies.length} resposta{quickReplies.length !== 1 ? 's' : ''} rapida
            {quickReplies.length !== 1 ? 's' : ''} encontrada
            {quickReplies.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Dialog de criacao/edicao */}
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

      {/* Alert de confirmacao de delete */}
      <AlertDialog
        open={!!deletingQuickReply}
        onOpenChange={(open) => !open && setDeletingQuickReply(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-2xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-slate-50">
              Confirmar Exclusao
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              Tem certeza que deseja remover a resposta rapida{' '}
              <strong className="text-slate-700 dark:text-slate-200">&quot;{deletingQuickReply?.title}&quot;</strong>? Esta acao nao pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function QuickRepliesPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <QuickRepliesPageContent />
    </ProtectedRoute>
  );
}
