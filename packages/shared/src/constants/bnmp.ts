// Constantes derivadas dos endpoints /api/dominio/* do BNMP.
// Atualizar via crawl no setup do worker — estes valores são bootstrap.

export const BNMP_SEXO = {
  MASCULINO: 1,
  FEMININO: 2,
} as const;

export const BNMP_TIPO_PECA = {
  MANDADO_DE_PRISAO: 1,
} as const;

export const BNMP_ESTADO = {
  TO: 27,
  GO: 9,
} as const;

// Cidades de teste — seed inicial do banco (Etapa 3).
export interface SeedCity {
  uf: keyof typeof BNMP_ESTADO;
  idEstado: number;
  nome: string;
  idMunicipio: number;
}

export const SEED_CITIES: readonly SeedCity[] = [
  { uf: 'TO', idEstado: BNMP_ESTADO.TO, nome: 'Palmeirópolis', idMunicipio: 9655 },
  // idMunicipio reais para Peixe/Ceres/Rialma devem ser preenchidos via /api/pesquisa-pecas/orgaos/municipio
  // no provisionamento. Os placeholders abaixo serão substituídos no seed real (Etapa 3).
  { uf: 'TO', idEstado: BNMP_ESTADO.TO, nome: 'Peixe', idMunicipio: 0 },
  { uf: 'GO', idEstado: BNMP_ESTADO.GO, nome: 'Ceres', idMunicipio: 0 },
  { uf: 'GO', idEstado: BNMP_ESTADO.GO, nome: 'Rialma', idMunicipio: 0 },
] as const;

export const BNMP_ENDPOINTS = {
  FILTER: '/api/pesquisa-pecas/filter',
  ESTADOS: '/api/dominio/estados',
  TIPO_DOCUMENTOS: '/api/dominio/tipo-documentos',
  TIPO_PECAS: '/api/dominio/tipo-pecas',
  SEXOS: '/api/dominio/sexos',
  ORGAOS_BY_MUNICIPIO: '/api/pesquisa-pecas/orgaos/municipio',
  PDF_RELATORIO: '/api/certidaos/relatorio', // /{id}/{tipo}
} as const;
