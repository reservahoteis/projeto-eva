'use client';

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
  Building2,
  LogOut,
  Settings,
  User,
  LayoutDashboard,
  MessageSquare,
  Phone,
  Users,
  BarChart3,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

const navigation = [
  {
    name: 'Tenants',
    href: '/super-admin/tenants',
    icon: Building2,
    badge: 12,
    badgeColor: 'bg-blue-500',
  },
  {
    name: 'Configurações SA',
    href: '/super-admin/settings',
    icon: Settings,
  },
  // Divider - Dashboard Tenant
  {
    name: 'divider',
    label: 'Dashboard Tenant',
  },
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
  },
  {
    name: 'Relatórios',
    href: '/dashboard/reports',
    icon: BarChart3,
  },
  {
    name: 'Configurações',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-64 flex-col glass-sidebar">
      {/* Logo Header - Style like ERP Angelus */}
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
          <span className="text-slate-400 text-xs">Super Admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item, index) => {
          // Render divider
          if (item.name === 'divider') {
            return (
              <div key={`divider-${index}`} className="pt-5 pb-2">
                <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {item.label}
                </p>
              </div>
            );
          }

          const Icon = item.icon!;
          const isActive = pathname === item.href;

          return (
            <Link key={item.name} href={item.href!}>
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
                {item.badge && (
                  <span className={cn(
                    'badge-count text-white',
                    item.badgeColor || 'bg-blue-500'
                  )}>
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="border-t border-white/5 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-6 hover:bg-white/5 rounded-xl transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg">
                {user ? getInitials(user.name) : 'SA'}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-white font-medium text-sm">{user?.name || 'Super Admin'}</span>
                <span className="text-slate-400 text-xs">{user?.email}</span>
              </div>
              <LogOut className="ml-auto h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-56 mb-2 rounded-ios-sm border-white/10 bg-slate-900/95 backdrop-blur-xl"
          >
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-xs text-slate-400">Super Admin</p>
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
  );
}
