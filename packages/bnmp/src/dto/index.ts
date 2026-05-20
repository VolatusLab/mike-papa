// DTOs cruas (formato wire do BNMP). Validados via zod em runtime no parsers/.
// Não exportar essas interfaces para fora do pacote — consumidores recebem domain types.

import type { IsoDate } from '../types/index.js';

export interface BnmpWarrantDto {
  id: number;
  numeroPeca: string;
  numeroProcesso: string;
  nomePessoa: string;
  alcunha: string | null;
  descricaoStatus: string;
  dataExpedicao: IsoDate;
  nomeOrgao: string;
  descricaoPeca: string;
  idTipoPeca: number;
  nomeMae: string | null;
  nomePai: string | null;
  descricaoSexo: string;
  descricaoProfissao: string | null;
  dataNascimento: IsoDate | null;
  numeroPecaAnterior: string | null;
  numeroPecaFormatado: string;
  dataNascimentoFormatada: string | null;
  dataExpedicaoFormatada: string;
}
