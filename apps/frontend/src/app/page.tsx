import { redirect } from 'next/navigation';

/**
 * Root page - redireciona baseado no subdomain
 * - super-admin.* -> /super-admin
 * - tenant.* -> /dashboard
 * - www.* ou root -> Landing page (futuro)
 */
export default function HomePage() {
  // 🚀 MODO DEMO - Redireciona direto para o dashboard
  redirect('/dashboard');
}
