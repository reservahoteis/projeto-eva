'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { tagService } from '@/services/tag.service';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { UserRole } from '@/types';
import { useSocketContext } from '@/contexts/socket-context';
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
  Tag as TagIcon,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tag } from '@/types';

// Presets de cores para tags
const DEFAULT_COLOR = '#3b82f6';
const COLOR_PRESETS = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Roxo', value: '#a855f7' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Ciano', value: '#06b6d4' },
];

interface TagFormData {
  name: string;
  color: string;
  description: string;
}

function TagFormDialog({
  isOpen,
  onClose,
  onSubmit,
  tag,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TagFormData) => Promise<void>;
  tag?: Tag | null;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<TagFormData>({
    name: tag?.name || '',
    color: tag?.color || DEFAULT_COLOR,
    description: '',
  });

  useEffect(() => {
    if (tag) {
      setFormData({
        name: tag.name,
        color: tag.color,
        description: '',
      });
    } else {
      setFormData({
        name: '',
        color: DEFAULT_COLOR,
        description: '',
      });
    }
  }, [tag, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }

    if (!tagService.isValidHexColor(formData.color)) {
      toast.error('Cor inválida. Use formato hexadecimal (#000000)');
      return;
    }

    await onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg glass-card">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            {tag ? 'Editar Tag' : 'Nova Tag'}
          </DialogTitle>
          <DialogDescription className="text-[var(--text-muted)]">
            {tag ? 'Atualize as informações da tag' : 'Adicione uma nova tag ao sistema'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[var(--text-secondary)]">
                Nome *
              </Label>
              <Input
                id="name"
                placeholder="Ex: VIP, Urgente, Reserva Confirmada..."
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="glass-input"
                maxLength={50}
                required
              />
              <p className="text-xs text-[var(--text-muted)]">
                {formData.name.length}/50 caracteres
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)]">Cor</Label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: preset.value })
                    }
                    className="relative h-12 rounded-ios-xs border-2 transition-all hover:scale-105"
                    style={{
                      backgroundColor: preset.value,
                      borderColor:
                        formData.color === preset.value
                          ? 'var(--text-primary)'
                          : 'transparent',
                    }}
                    title={preset.name}
                  >
                    {formData.color === preset.value && (
                      <Check
                        className="absolute inset-0 m-auto h-5 w-5"
                        style={{
                          color: tagService.getContrastColor(preset.value),
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-2 mt-3">
                <Input
                  type="text"
                  placeholder="#000000"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="glass-input font-mono"
                  maxLength={7}
                />
                <div
                  className="h-10 w-16 rounded-ios-xs border border-[var(--glass-border)] flex-shrink-0"
                  style={{ backgroundColor: formData.color }}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-[var(--text-secondary)]">
                Descrição (opcional)
              </Label>
              <Textarea
                id="description"
                placeholder="Descreva o propósito desta tag..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="glass-input min-h-[80px]"
                maxLength={200}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {formData.description.length}/200 caracteres
              </p>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)]">Preview</Label>
              <div className="p-4 rounded-ios-xs border border-[var(--glass-border)] bg-[var(--glass-bg-hover)]">
                <Badge
                  className="font-medium"
                  style={{
                    backgroundColor: formData.color,
                    color: tagService.getContrastColor(formData.color),
                  }}
                >
                  <TagIcon className="mr-1 h-3 w-3" />
                  {formData.name || 'Nome da tag'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="glass-btn"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              {isLoading ? 'Salvando...' : tag ? 'Salvar Alterações' : 'Criar Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TagsPageContent() {
  const queryClient = useQueryClient();
  const socket = useSocketContext();

  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  // Debounce da busca
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Query para listar tags (backend retorna array completo)
  const { data: tagsData, isLoading, error, refetch } = useQuery({
    queryKey: ['tags', debouncedSearch],
    queryFn: () =>
      tagService.list({
        search: debouncedSearch || undefined,
      }),
  });

  // Tags filtradas para exibicao
  const tags = useMemo(() => tagsData?.data || [], [tagsData]);

  // Mutation para criar tag
  const createMutation = useMutation({
    mutationFn: tagService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setIsCreateOpen(false);
      toast.success('Tag criada com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao criar tag';
      toast.error(message);
    },
  });

  // Mutation para atualizar tag
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      tagService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditingTag(null);
      toast.success('Tag atualizada com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar tag';
      toast.error(message);
    },
  });

  // Mutation para deletar tag
  const deleteMutation = useMutation({
    mutationFn: tagService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setDeletingTag(null);
      toast.success('Tag removida com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao remover tag';
      toast.error(message);
    },
  });

  // Socket.io listeners
  useEffect(() => {
    if (!socket) return;

    const handleTagCreated = ({ tag }: { tag: Tag }) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.info(`Nova tag criada: ${tag.name}`);
    };

    const handleTagUpdated = ({ tag }: { tag: Tag }) => {
      queryClient.setQueryData(
        ['tags', debouncedSearch],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((t: Tag) =>
              t.id === tag.id ? tag : t
            ),
          };
        }
      );
    };

    const handleTagDeleted = ({ tagId }: { tagId: string }) => {
      queryClient.setQueryData(
        ['tags', debouncedSearch],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.filter((t: Tag) => t.id !== tagId),
          };
        }
      );
    };

    socket.on('tag:created', handleTagCreated);
    socket.on('tag:updated', handleTagUpdated);
    socket.on('tag:deleted', handleTagDeleted);

    return () => {
      socket.off('tag:created', handleTagCreated);
      socket.off('tag:updated', handleTagUpdated);
      socket.off('tag:deleted', handleTagDeleted);
    };
  }, [socket, queryClient, debouncedSearch]);

  // Handlers
  const handleCreateTag = async (data: TagFormData) => {
    await createMutation.mutateAsync({
      name: data.name,
      color: data.color,
      description: data.description || undefined,
    });
  };

  const handleUpdateTag = async (data: TagFormData) => {
    if (!editingTag) return;

    await updateMutation.mutateAsync({
      id: editingTag.id,
      data: {
        name: data.name,
        color: data.color,
        description: data.description || undefined,
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTag) return;
    await deleteMutation.mutateAsync(deletingTag.id);
  };

  // Componente de Skeleton para loading
  const TagsSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );

  // Renderização
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Tags</h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">
            Gerencie as tags de conversas
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
            <span className="hidden sm:inline">Nova Tag</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="glass-card glass-kpi p-6 animate-slideUp">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-2">
              TOTAL DE TAGS
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {tags.length}
            </p>
          </div>
          <div className="icon-box icon-box-purple">
            <TagIcon className="w-6 h-6 text-white" />
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
              placeholder="Buscar por nome da tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-12 h-12"
            />
          </div>
        </div>

        {/* Lista de tags */}
        {isLoading ? (
          <TagsSkeleton />
        ) : error ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p>Erro ao carregar tags</p>
            <Button variant="link" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !tags.length ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            {debouncedSearch ? (
              <p>Nenhuma tag encontrada para &quot;{debouncedSearch}&quot;</p>
            ) : (
              <>
                <p>Nenhuma tag cadastrada ainda</p>
                <Button
                  variant="link"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-2"
                >
                  Adicionar primeira tag
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-4 rounded-ios-xs border border-[var(--glass-border)] bg-[var(--glass-bg-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      >
                        <TagIcon
                          className="h-5 w-5"
                          style={{ color: tagService.getContrastColor(tag.color) }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {tag.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">
                          {tag.color}
                        </p>
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
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingTag(tag)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingTag(tag)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--glass-border)]">
                    <Badge
                      className="font-medium"
                      style={{
                        backgroundColor: tag.color,
                        color: tagService.getContrastColor(tag.color),
                      }}
                    >
                      <TagIcon className="mr-1 h-3 w-3" />
                      {tag.name}
                    </Badge>
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatDistanceToNow(new Date(tag.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block rounded-ios-xs overflow-hidden border border-[var(--glass-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--glass-bg-hover)]">
                    <TableHead className="text-[var(--text-secondary)]">Tag</TableHead>
                    <TableHead className="text-[var(--text-secondary)]">Nome</TableHead>
                    <TableHead className="text-[var(--text-secondary)]">Cor</TableHead>
                    <TableHead className="text-[var(--text-secondary)] hidden lg:table-cell">
                      Criada em
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-secondary)]">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow
                      key={tag.id}
                      className="hover:bg-[var(--glass-bg-hover)] transition-colors"
                    >
                      <TableCell>
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: tag.color }}
                        >
                          <TagIcon
                            className="h-5 w-5"
                            style={{ color: tagService.getContrastColor(tag.color) }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {tag.name}
                          </p>
                          <p className="text-sm text-[var(--text-muted)]">
                            ID: {tag.id.slice(0, 8)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="font-mono text-xs font-medium"
                          style={{
                            backgroundColor: tag.color,
                            color: tagService.getContrastColor(tag.color),
                          }}
                        >
                          {tag.color}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-[var(--text-muted)]">
                          {formatDistanceToNow(new Date(tag.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
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
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingTag(tag)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeletingTag(tag)}
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
        {tags.length > 0 && (
          <p className="text-sm text-[var(--text-muted)] mt-4">
            {tags.length} tag{tags.length !== 1 ? 's' : ''} encontrada{tags.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Dialog de criação/edição */}
      <TagFormDialog
        isOpen={isCreateOpen || !!editingTag}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingTag(null);
        }}
        onSubmit={editingTag ? handleUpdateTag : handleCreateTag}
        tag={editingTag}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Alert de confirmação de delete */}
      <AlertDialog
        open={!!deletingTag}
        onOpenChange={(open) => !open && setDeletingTag(null)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--text-primary)]">
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Tem certeza que deseja remover a tag{' '}
              <strong>{deletingTag?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-btn">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Apenas TENANT_ADMIN e SUPER_ADMIN podem acessar esta página
export default function TagsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <TagsPageContent />
    </ProtectedRoute>
  );
}
