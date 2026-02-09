'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  User,
  Phone,
  BarChart3,
  Menu,
  Building2,
  ScrollText,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { UserRole } from '@/types';
import type { LucideIcon } from 'lucide-react';

type NavigationItem =
  | { name: string; href: string; icon: LucideIcon; badge?: number; adminOnly?: boolean; hiddenForSales?: boolean }
  | { name: 'divider'; label: string };

const tenantNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Conversas', href: '/dashboard/conversations', icon: MessageSquare, badge: 3 }, // SALES pode ver - só aparece oportunidades
  { name: 'Contatos', href: '/dashboard/contacts', icon: Phone, adminOnly: true }, // HEAD não pode ver
  { name: 'Usuários', href: '/dashboard/users', icon: Users, adminOnly: true },
  { name: 'Tags', href: '/dashboard/tags', icon: Tag, adminOnly: true },
  { name: 'Escalações', href: '/dashboard/escalations', icon: AlertTriangle, adminOnly: true },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3, adminOnly: true },
  { name: 'Logs', href: '/dashboard/logs', icon: ScrollText, adminOnly: true },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings, adminOnly: true },
];

const superAdminNavigation: NavigationItem[] = [
  { name: 'Tenants', href: '/super-admin/tenants', icon: Building2 },
  { name: 'Configurações SA', href: '/super-admin/settings', icon: Settings },
  { name: 'divider', label: 'Dashboard Tenant' },
  ...tenantNavigation,
];

interface MobileHeaderProps {
  variant?: 'tenant' | 'super-admin';
}

export function MobileHeader({ variant = 'tenant' }: MobileHeaderProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // HEAD não é admin - só pode ver Dashboard e Conversas
  // SALES pode ver Dashboard e Conversas (apenas oportunidades)
  const isAdmin = user?.role === UserRole.TENANT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const navigation = variant === 'super-admin' ? superAdminNavigation : tenantNavigation;

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 glass-sidebar border-b border-white/5">
      <div className="flex items-center justify-between h-full px-4">
        {/* Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 glass-sidebar border-r-0">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
              <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-lg overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Hotéis Reserva"
                  width={36}
                  height={36}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-semibold text-sm">Hotéis Reserva</span>
                <span className="text-slate-400 text-xs">
                  {variant === 'super-admin' ? 'Super Admin' : 'Sistema de Atendimento'}
                </span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navigation
                .filter((item) => {
                  if (item.name === 'divider') return true;
                  if ('adminOnly' in item && item.adminOnly && !isAdmin) return false;
                  return true;
                })
                .map((item, index) => {
                  // Type guard for divider items
                  if (item.name === 'divider' && 'label' in item) {
                    return (
                      <div key={`divider-${index}`} className="pt-5 pb-2">
                        <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          {item.label}
                        </p>
                      </div>
                    );
                  }

                  // Type guard for regular navigation items
                  if (!('href' in item)) return null;

                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href!}
                      onClick={() => setIsOpen(false)}
                    >
                      <div
                        className={cn(
                          'sidebar-item group',
                          isActive && 'active'
                        )}
                      >
                        <Icon className={cn(
                          'h-5 w-5 transition-colors',
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                        )} />
                        <span className={cn(
                          'flex-1 text-sm font-medium transition-colors',
                          isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                        )}>
                          {item.name}
                        </span>
                        {'badge' in item && item.badge && (
                          <span className="badge-count text-white bg-rose-500">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
            </nav>

            {/* User */}
            <div className="border-t border-white/5 p-3">
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg">
                  {user ? getInitials(user.name) : 'U'}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm truncate">{user?.name}</p>
                  <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-2"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo Center */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow overflow-hidden">
            <Image
              src="/logo.png"
              alt="Hotéis Reserva"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="text-white font-semibold text-sm">Hotéis Reserva</span>
        </div>

        {/* User Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-white/10">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold text-xs shadow">
                {user ? getInitials(user.name) : 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-ios-sm border-white/10 bg-slate-900/95 backdrop-blur-xl"
          >
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <DropdownMenuItem className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 focus:bg-white/5 focus:text-white cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem
              onClick={logout}
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
