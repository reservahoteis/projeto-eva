'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

  const isAdmin = user?.role === UserRole.TENANT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="flex h-screen w-64 flex-col glass-sidebar">
      {/* Logo - iOS 26 Style */}
      <div className="flex h-20 items-center justify-center border-b border-black/5 px-4">
        <Image
          src="/logo.png"
          alt="Hotéis Reserva"
          width={160}
          height={50}
          className="object-contain"
          priority
        />
      </div>

      {/* Navigation - iOS 26 Style */}
      <nav className="flex-1 space-y-2 px-3 py-4">
        {navigation
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-ios-sm px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-black text-white shadow-ios'
                      : 'text-gray-600 hover:bg-black/5'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-gray-500')} />
                  {item.name}
                </div>
              </Link>
            );
          })}
      </nav>

      {/* User Menu - iOS 26 Style */}
      <div className="border-t border-black/5 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 rounded-ios-sm hover:bg-black/5 transition-all duration-200"
            >
              <Avatar className="h-9 w-9 ring-2 ring-black/10">
                <AvatarFallback className="bg-black text-white font-medium">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-sm">
                <p className="font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === UserRole.SUPER_ADMIN
                    ? 'Super Admin'
                    : user?.role === UserRole.TENANT_ADMIN
                    ? 'Administrador'
                    : 'Atendente'}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-ios-sm glass-card border-0">
            <DropdownMenuLabel className="text-gray-500 font-normal">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-black/5" />
            <DropdownMenuItem className="rounded-lg focus:bg-black/5">
              <User className="mr-2 h-4 w-4 text-gray-500" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg focus:bg-black/5">
              <Settings className="mr-2 h-4 w-4 text-gray-500" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-black/5" />
            <DropdownMenuItem onClick={logout} className="rounded-lg text-red-600 focus:bg-red-50 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
