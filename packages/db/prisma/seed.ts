// Seed — idempotent. Safe to re-run.
// Creates the default tenant + 4 monitored cities (per CLAUDE.md §11 blockers,
// Peixe/Ceres/Rialma start INACTIVE until their idMunicipio are resolved from
// /api/pesquisa-pecas/orgaos/municipio).

import { PrismaClient } from '@prisma/client';
import { SEED_CITIES } from '@bnmp/shared';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_TENANT_NAME = 'Default Tenant';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('[seed] starting');

  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: DEFAULT_TENANT_NAME, active: true },
    create: { id: DEFAULT_TENANT_ID, name: DEFAULT_TENANT_NAME, active: true, plan: 'free' },
  });
  console.log(`[seed] tenant: ${tenant.id} (${tenant.name})`);

  for (const city of SEED_CITIES) {
    const ativo = city.idMunicipio > 0;
    const row = await prisma.monitoredCity.upsert({
      where: {
        tenant_city_tipo_unique: {
          tenantId: tenant.id,
          idEstado: city.idEstado,
          idMunicipio: city.idMunicipio,
          idTipoPeca: 1,
        },
      },
      update: { nome: city.nome, ativo },
      create: {
        tenantId: tenant.id,
        uf: city.uf,
        idEstado: city.idEstado,
        idMunicipio: city.idMunicipio,
        nome: city.nome,
        idTipoPeca: 1,
        ativo,
      },
    });
    console.log(
      `[seed] city: ${city.nome}/${city.uf} idMun=${city.idMunicipio} ativo=${ativo} → ${row.id}`,
    );
  }

  console.log('[seed] done');
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
