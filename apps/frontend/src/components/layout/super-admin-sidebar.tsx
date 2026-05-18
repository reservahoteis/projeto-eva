'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, MessageSquareCode, Settings, ChevronDown, LogOut } from 'lucide-react';

const navigation = [
  {
    name: 'Tenants',
    href: '/super-admin/tenants',
    icon: Building2,
  },
  {
    name: 'Prompt Smart Agent',
    href: '/super-admin/bot-prompts',
    icon: MessageSquareCode,
  },
  {
    name: 'Configurações SA',
    href: '/super-admin/settings',
    icon: Settings,
  },
];

function SidebarLink({
  icon: Icon,
  label,
  href,
  isCollapsed,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  href?: string;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href
    ? pathname === href || pathname.startsWith(href + '/')
    : false;

  const content = (
    <button
      onClick={onClick}
      className="flex h-[30px] w-full cursor-pointer items-center rounded transition-all duration-300 ease-in-out focus:outline-none"
      style={{
        backgroundColor: isActive ? 'var(--surface-selected)' : undefined,
        boxShadow: isActive
          ? '0px 0px 1px rgba(0,0,0,0.45), 0px 1px 2px rgba(0,0,0,0.1)'
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = '';
      }}
    >
      <div
        className="flex w-full items-center transition-all duration-300 ease-in-out"
        style={{ padding: isCollapsed ? '4px 4px 4px 3px' : '7px 8px' }}
      >
        <div className="flex items-center truncate">
          <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ink-gray-8)' }} />
          <span
            className="flex-1 flex-shrink-0 truncate text-sm transition-all duration-300 ease-in-out"
            style={{
              color: 'var(--ink-gray-8)',
              marginLeft: isCollapsed ? 0 : '8px',
              width: isCollapsed ? 0 : 'auto',
              opacity: isCollapsed ? 0 : 1,
              overflow: isCollapsed ? 'hidden' : undefined,
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </button>
  );

  if (href) {
    const wrappedInLink = <Link href={href}>{content}</Link>;
    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{wrappedInLink}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return wrappedInLink;
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function SuperAdminSidebar() {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useLocalStorage('superAdminSidebarCollapsed', false);

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="relative flex h-full flex-col justify-between transition-all duration-300 ease-in-out"
        style={{ width: isCollapsed ? '48px' : '220px' }}
      >
        {/* Brand / User dropdown */}
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-12 items-center rounded-md transition-all duration-300 ease-in-out focus:outline-none"
                style={{
                  width: isCollapsed ? 'auto' : '100%',
                  padding: isCollapsed ? '8px 0' : '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isCollapsed)
                    e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                <div className="h-8 w-8 flex-shrink-0 rounded-lg overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="Hotéis Reserva"
                    width={32}
                    height={32}
                    className="object-contain"
                    priority
                  />
                </div>
                <div
                  className="flex flex-1 flex-col text-left truncate transition-all duration-300 ease-in-out"
                  style={{
                    marginLeft: isCollapsed ? 0 : '8px',
                    width: isCollapsed ? 0 : 'auto',
                    opacity: isCollapsed ? 0 : 1,
                    overflow: isCollapsed ? 'hidden' : undefined,
                  }}
                >
                  <div
                    className="text-sm font-medium leading-none truncate"
                    style={{ color: 'var(--ink-gray-9)' }}
                  >
                    Hotéis Reserva
                  </div>
                  <div
                    className="mt-1 text-xs leading-none truncate"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Super Admin
                  </div>
                </div>
                <div
                  className="transition-all duration-300 ease-in-out"
                  style={{
                    marginLeft: isCollapsed ? 0 : '8px',
                    width: isCollapsed ? 0 : 'auto',
                    opacity: isCollapsed ? 0 : 1,
                    overflow: isCollapsed ? 'hidden' : undefined,
                  }}
                >
                  <ChevronDown className="h-4 w-4" style={{ color: 'var(--ink-gray-5)' }} />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-56">
              <div
                className="px-3 py-2"
                style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-9)' }}>
                  {user?.name || 'Super Admin'}
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                  {user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          <nav className="flex flex-col">
            {navigation.map((item) => (
              <div key={item.name} className="mx-2 my-[1.5px]">
                <SidebarLink
                  icon={item.icon}
                  label={item.name}
                  href={item.href}
                  isCollapsed={isCollapsed}
                />
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — collapse toggle */}
        <div className="m-2 flex flex-col gap-1">
          <SidebarLink
            icon={({ className, style }) => (
              <svg
                className={className}
                style={{
                  ...style,
                  transform: isCollapsed ? 'rotateY(180deg)' : undefined,
                  transition: 'transform 0.3s ease-in-out',
                }}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 2L5 8l6 6" />
              </svg>
            )}
            label={isCollapsed ? 'Expandir' : 'Recolher'}
            isCollapsed={isCollapsed}
            onClick={() => setIsCollapsed(!isCollapsed)}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
