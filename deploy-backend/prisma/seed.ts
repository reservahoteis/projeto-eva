import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Criar Super Admin (se não existir)
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@seucrm.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'change_me_in_production';

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

    await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        tenantId: null, // Super Admin não pertence a nenhum tenant
      },
    });

    console.log('✅ Super Admin criado:');
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Senha: ${superAdminPassword}`);
    console.log('   ⚠️  TROQUE A SENHA EM PRODUÇÃO!');
  } else {
    console.log('ℹ️  Super Admin já existe');
  }

  // 2. Criar Tenant de demonstração (opcional)
  const demoTenantSlug = 'demo-hotel';

  const existingDemoTenant = await prisma.tenant.findUnique({
    where: { slug: demoTenantSlug },
  });

  if (!existingDemoTenant) {
    const demoTenant = await prisma.tenant.create({
      data: {
        name: 'Hotel Demo',
        slug: demoTenantSlug,
        email: 'demo@hotel.com',
        status: 'TRIAL',
        plan: 'BASIC',
        maxAttendants: 10,
        maxMessages: 10000,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
      },
    });

    // Criar admin do tenant demo
    const demoAdminPassword = await bcrypt.hash('demo123', 12);

    await prisma.user.create({
      data: {
        email: 'admin@demo.hotel',
        password: demoAdminPassword,
        name: 'Admin Hotel Demo',
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        tenantId: demoTenant.id,
      },
    });

    // Criar alguns atendentes
    await prisma.user.createMany({
      data: [
        {
          email: 'atendente1@demo.hotel',
          password: demoAdminPassword,
          name: 'João Atendente',
          role: 'ATTENDANT',
          status: 'ACTIVE',
          tenantId: demoTenant.id,
        },
        {
          email: 'atendente2@demo.hotel',
          password: demoAdminPassword,
          name: 'Maria Atendente',
          role: 'ATTENDANT',
          status: 'ACTIVE',
          tenantId: demoTenant.id,
        },
      ],
    });

    // Criar algumas tags padrão
    await prisma.tag.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          name: 'VIP',
          color: '#FFD700',
        },
        {
          tenantId: demoTenant.id,
          name: 'Urgente',
          color: '#FF0000',
        },
        {
          tenantId: demoTenant.id,
          name: 'Check-in Hoje',
          color: '#00FF00',
        },
        {
          tenantId: demoTenant.id,
          name: 'Reclamação',
          color: '#FF6B6B',
        },
      ],
    });

    console.log('✅ Tenant Demo criado:');
    console.log(`   Slug: ${demoTenantSlug}`);
    console.log(`   URL: http://${demoTenantSlug}.localhost:3000`);
    console.log(`   Admin: admin@demo.hotel / demo123`);
    console.log(`   Atendentes: atendente1@demo.hotel / demo123`);
  } else {
    console.log('ℹ️  Tenant Demo já existe');
  }

  console.log('🎉 Seed concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
