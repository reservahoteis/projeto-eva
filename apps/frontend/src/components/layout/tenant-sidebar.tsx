'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  User,
  Phone,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { UserRole } from '@/types';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Conversas',
    href: '/dashboard/conversations',
    icon: MessageSquare,
    badge: 3,
    badgeColor: 'bg-rose-500',
  },
  {
    name: 'Contatos',
    href: '/dashboard/contacts',
    icon: Phone,
  },
  {
    name: 'Usuários',
    href: '/dashboard/users',
    icon: Users,
    adminOnly: true,
  },
  {
    name: 'Relatórios',
    href: '/dashboard/reports',
    icon: BarChart3,
    adminOnly: true,
  },
  {
    name: 'Configurações',
    href: '/dashboard/settings',
    icon: Settings,
    adminOnly: true,
  },
];

export function TenantSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isAdmin = user?.role === UserRole.TENANT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        "flex h-screen flex-col glass-sidebar transition-all duration-300 ease-in-out relative z-50",
        isCollapsed ? "w-20" : "w-64"
      )}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-7 w-6 h-6 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all z-50 shadow-lg"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Logo Header */}
        <div className={cn(
          "flex items-center gap-3 px-5 py-5 border-b border-white/5",
          isCollapsed && "justify-center px-3"
        )}>
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Hotéis Reserva"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-white font-semibold text-sm whitespace-nowrap">Hotéis Reserva</span>
              <span className="text-slate-400 text-xs whitespace-nowrap">Sistema de Atendimento</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              const linkContent = (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      'sidebar-item group relative',
                      isActive && 'active',
                      isCollapsed && 'justify-center px-3'
                    )}
                  >
                    <Icon className={cn(
                      'h-5 w-5 transition-colors flex-shrink-0',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    )} />
                    {!isCollapsed && (
                      <>
                        <span className={cn(
                          'flex-1 text-sm font-medium transition-colors whitespace-nowrap',
                          isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                        )}>
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className={cn(
                            'badge-count text-white',
                            item.badgeColor || 'bg-blue-500'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {isCollapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                    )}
                  </div>
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                      <p>{item.name}</p>
                      {item.badge && (
                        <span className="ml-2 text-xs text-rose-400">({item.badge})</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
        </nav>

        {/* User Menu */}
        <div className="border-t border-white/5 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 px-3 py-6 hover:bg-white/5 rounded-xl transition-all",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg flex-shrink-0">
                  {user ? getInitials(user.name) : 'U'}
                </div>
                {!isCollapsed && (
                  <>
                    <div className="flex flex-col items-start text-left overflow-hidden">
                      <span className="text-white font-medium text-sm truncate max-w-[120px]">{user?.name}</span>
                      <span className="text-slate-400 text-xs">
                        {user?.role === UserRole.SUPER_ADMIN
                          ? 'Super Admin'
                          : user?.role === UserRole.TENANT_ADMIN
                          ? 'Administrador'
                          : 'Atendente'}
                      </span>
                    </div>
                    <LogOut className="ml-auto h-4 w-4 text-slate-400 flex-shrink-0" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isCollapsed ? "center" : "end"}
              side="top"
              className="w-56 mb-2 rounded-ios-sm border-white/10 bg-slate-900/95 backdrop-blur-xl"
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
      </div>
    </TooltipProvider>
  );
}
