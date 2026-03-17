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
  Trash2,
  RefreshCw,
  Tag as TagIcon,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';

// ============================================
// CONSTANTS
// ============================================

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

// ============================================
// SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow
          key={i}
          className="border-b"
          style={{ borderColor: 'var(--outline-gray-1)' }}
        >
          <TableCell className="py-2.5 pl-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-28" />
            </div>
          </TableCell>
          <TableCell className="py-2.5">
            <Skeleton className="h-5 w-16 rounded" />
          </TableCell>
          <TableCell className="py-2.5 hidden md:table-cell">
            <Skeleton className="h-4 w-20 font-mono" />
          </TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell">
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

function EmptyState({
  searching,
  query,
  onNew,
}: {
  searching: boolean;
  query: string;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--surface-gray-2)' }}
      >
        <TagIcon className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
        {searching ? 'Nenhuma tag encontrada' : 'Sem tags'}
      </p>
      <p className="text-xs mb-5" style={{ color: 'var(--ink-gray-5)' }}>
        {searching
          ? `Nenhum resultado para "${query}"`
          : 'Adicione a primeira tag para comecar'}
      </p>
      {!searching && (
        <Button
          size="sm"
          onClick={onNew}
          style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
          className="h-7 text-xs px-3 rounded hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nova Tag
        </Button>
      )}
    </div>
  );
}

// ============================================
// TAG FORM DIALOG
// ============================================

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
      setFormData({ name: tag.name, color: tag.color, description: '' });
    } else {
      setFormData({ name: '', color: DEFAULT_COLOR, description: '' });
    }
  }, [tag, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Nome da tag e obrigatorio');
      return;
    }

    if (!tagService.isValidHexColor(formData.color)) {
      toast.error('Cor invalida. Use formato hexadecimal (#000000)');
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
            {tag ? 'Editar Tag' : 'Nova Tag'}
          </DialogTitle>
          <DialogDescription className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
            {tag ? 'Atualize as informacoes da tag' : 'Adicione uma nova tag ao sistema'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Nome *
            </Label>
            <Input
              id="name"
              placeholder="Ex: VIP, Urgente, Reserva Confirmada..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-8 text-sm rounded border"
              style={inputStyle}
              maxLength={50}
              required
              autoFocus
            />
            <p className="text-[11px]" style={{ color: 'var(--ink-gray-4)' }}>
              {formData.name.length}/50 caracteres
            </p>
          </div>

          {/* Color Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Cor
            </Label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: preset.value })}
                  className="relative h-7 w-full rounded border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: preset.value,
                    borderColor:
                      formData.color === preset.value
                        ? 'var(--ink-gray-9)'
                        : 'transparent',
                  }}
                  title={preset.name}
                >
                  {formData.color === preset.value && (
                    <Check
                      className="absolute inset-0 m-auto h-3.5 w-3.5"
                      style={{ color: tagService.getContrastColor(preset.value) }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Custom hex input */}
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="text"
                placeholder="#000000"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-8 text-sm rounded border font-mono"
                style={inputStyle}
                maxLength={7}
              />
              <div
                className="h-8 w-10 rounded border flex-shrink-0"
                style={{
                  backgroundColor: formData.color,
                  borderColor: 'var(--outline-gray-2)',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Descricao (opcional)
            </Label>
            <Textarea
              id="description"
              placeholder="Descreva o proposito desta tag..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="text-sm rounded border min-h-[72px] resize-none"
              style={inputStyle}
              maxLength={200}
            />
            <p className="text-[11px]" style={{ color: 'var(--ink-gray-4)' }}>
              {formData.description.length}/200 caracteres
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={labelStyle}>
              Preview
            </Label>
            <div
              className="px-3 py-2.5 rounded border"
              style={{
                backgroundColor: 'var(--surface-gray-1)',
                borderColor: 'var(--outline-gray-1)',
              }}
            >
              <Badge
                className="text-xs font-medium"
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

          <DialogFooter className="gap-2 pt-1">
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
              style={{ backgroundColor: 'var(--surface-gray-7)' }}
              className="h-8 px-3 text-sm rounded text-white hover:opacity-90"
            >
              {isLoading ? 'Salvando...' : tag ? 'Salvar Alteracoes' : 'Criar Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE CONTENT
// ============================================

function TagsPageContent() {
  const queryClient = useQueryClient();
  const socket = useSocketContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 350);

  // ============================================
  // QUERY
  // ============================================

  const { data: tagsData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['tags', debouncedSearch],
    queryFn: () => tagService.list({ search: debouncedSearch || undefined }),
  });

  const tags = useMemo(() => tagsData?.data || [], [tagsData]);

  // ============================================
  // MUTATIONS
  // ============================================

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tagService.update(id, data),
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

  // ============================================
  // SOCKET LISTENERS
  // ============================================

  useEffect(() => {
    if (!socket) return;

    const handleTagCreated = ({ tag }: { tag: Tag }) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.info(`Nova tag criada: ${tag.name}`);
    };

    const handleTagUpdated = ({ tag }: { tag: Tag }) => {
      queryClient.setQueryData(['tags', debouncedSearch], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: oldData.data.map((t: Tag) => (t.id === tag.id ? tag : t)),
        };
      });
    };

    const handleTagDeleted = ({ tagId }: { tagId: string }) => {
      queryClient.setQueryData(['tags', debouncedSearch], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: oldData.data.filter((t: Tag) => t.id !== tagId),
        };
      });
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

  // ============================================
  // HANDLERS
  // ============================================

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
            Tags
          </h1>
          {!isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--surface-gray-2)',
                color: 'var(--ink-gray-5)',
              }}
            >
              {tags.length}
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
            Nova Tag
          </Button>
        </div>
      </div>

      {/* ---- Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0"
        style={{
          borderColor: 'var(--outline-gray-1)',
          backgroundColor: 'var(--surface-gray-1)',
        }}
      >
        <div className="relative max-w-xs w-full">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar por nome da tag..."
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
              style={{
                borderColor: 'var(--outline-gray-1)',
                backgroundColor: 'var(--surface-gray-1)',
              }}
            >
              <TableHead
                className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Tag
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Preview
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden md:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Cor
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Criada em
              </TableHead>
              <TableHead className="py-2 pr-4 w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <p className="text-sm mb-2" style={{ color: 'var(--ink-gray-5)' }}>
                    Erro ao carregar tags.
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
            ) : tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    searching={!!debouncedSearch}
                    query={debouncedSearch}
                    onNew={() => setIsCreateOpen(true)}
                  />
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow
                  key={tag.id}
                  className="border-b transition-colors group"
                  style={{ borderColor: 'var(--outline-gray-1)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  {/* Tag name + color dot */}
                  <TableCell className="py-2.5 pl-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      >
                        <TagIcon
                          className="h-3 w-3"
                          style={{ color: tagService.getContrastColor(tag.color) }}
                        />
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--ink-gray-8)' }}
                      >
                        {tag.name}
                      </span>
                    </div>
                  </TableCell>

                  {/* Preview badge */}
                  <TableCell className="py-2.5">
                    <Badge
                      className="text-xs font-medium"
                      style={{
                        backgroundColor: tag.color,
                        color: tagService.getContrastColor(tag.color),
                      }}
                    >
                      <TagIcon className="mr-1 h-3 w-3" />
                      {tag.name}
                    </Badge>
                  </TableCell>

                  {/* Hex color */}
                  <TableCell className="py-2.5 hidden md:table-cell">
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--ink-gray-6)' }}
                    >
                      {tag.color}
                    </span>
                  </TableCell>

                  {/* Created at */}
                  <TableCell className="py-2.5 hidden lg:table-cell">
                    <span className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
                      {tag.createdAt
                        ? formatDistanceToNow(new Date(tag.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : '—'}
                    </span>
                  </TableCell>

                  {/* Actions */}
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
                        className="w-36 rounded-lg border shadow-md"
                        style={{
                          backgroundColor: 'var(--surface-white)',
                          borderColor: 'var(--outline-gray-2)',
                        }}
                      >
                        <DropdownMenuItem
                          className="text-sm cursor-pointer"
                          style={{ color: 'var(--ink-gray-7)' }}
                          onClick={() => setEditingTag(tag)}
                        >
                          <Edit className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator
                          style={{ backgroundColor: 'var(--outline-gray-1)' }}
                        />
                        <DropdownMenuItem
                          className="text-sm cursor-pointer"
                          style={{ color: 'var(--ink-red-3)' }}
                          onClick={() => setDeletingTag(tag)}
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

      {/* ---- Tag Form Dialog (create / edit) ---- */}
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

      {/* ---- Delete Confirm ---- */}
      <AlertDialog
        open={!!deletingTag}
        onOpenChange={(open) => !open && setDeletingTag(null)}
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
              Remover tag
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja remover a tag{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>{deletingTag?.name}</strong>? Esta
              acao nao pode ser desfeita.
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

export default function TagsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <TagsPageContent />
    </ProtectedRoute>
  );
}
