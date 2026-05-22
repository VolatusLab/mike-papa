import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected ISO date YYYY-MM-DD');
const brDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'expected BR date DD/MM/YYYY');

/**
 * Wire format from POST /api/pesquisa-pecas/filter `content[]`.
 * Reverse-engineered from prompt-provided sample. Keep tolerant where BNMP
 * is known to omit/null fields, strict where dedupe depends on it.
 */
export const BnmpWarrantSchema = z.object({
  id: z.number().int().positive(),
  numeroPeca: z.string().min(1),
  numeroProcesso: z.string().min(1),
  nomePessoa: z.string().min(1),
  alcunha: z.string().nullable(),
  descricaoStatus: z.string().min(1),
  dataExpedicao: isoDate,
  nomeOrgao: z.string().min(1),
  descricaoPeca: z.string().min(1),
  idTipoPeca: z.number().int(),
  nomeMae: z.string().nullable(),
  nomePai: z.string().nullable(),
  descricaoSexo: z.string().min(1),
  descricaoProfissao: z.string().nullable(),
  dataNascimento: isoDate.nullable(),
  numeroPecaAnterior: z.string().nullable(),
  numeroPecaFormatado: z.string().min(1),
  dataNascimentoFormatada: brDate.nullable(),
  dataExpedicaoFormatada: brDate,
});

export type BnmpWarrant = z.infer<typeof BnmpWarrantSchema>;
