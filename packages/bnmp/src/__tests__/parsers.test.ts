import { describe, expect, it } from 'vitest';
import { BnmpResponseInvalid } from '@bnmp/shared';
import { BnmpWarrantSchema, pagedSchema, parseBnmpResponse } from '../parsers/index.js';

const SAMPLE = {
  id: 204077075,
  numeroPeca: '0000904482023827273001000207',
  numeroProcesso: '00009044820238272730',
  nomePessoa: 'ROBERTO RODRIGUES DE ARAUJO',
  alcunha: 'Não Informado',
  descricaoStatus: 'Pendente de Cumprimento',
  dataExpedicao: '2025-11-25',
  nomeOrgao: 'JUIZO UNICO - PALMEIROPOLIS',
  descricaoPeca: 'Mandado de Prisão',
  idTipoPeca: 1,
  nomeMae: 'ALVINA FRANCISCA DE ARAUJO',
  nomePai: 'ADERSON RODRIGUES DE ARAUJO',
  descricaoSexo: 'Masculino',
  descricaoProfissao: null,
  dataNascimento: '1980-12-21',
  numeroPecaAnterior: null,
  numeroPecaFormatado: '0000904-48.2023.8.27.2730.01.0002-07',
  dataNascimentoFormatada: '21/12/1980',
  dataExpedicaoFormatada: '25/11/2025',
};

describe('BnmpWarrantSchema', () => {
  it('accepts the canonical wire sample', () => {
    const parsed = BnmpWarrantSchema.parse(SAMPLE);
    expect(parsed.id).toBe(204077075);
    expect(parsed.descricaoStatus).toBe('Pendente de Cumprimento');
  });

  it('rejects ISO date with wrong format', () => {
    const r = BnmpWarrantSchema.safeParse({ ...SAMPLE, dataExpedicao: '25/11/2025' });
    expect(r.success).toBe(false);
  });

  it('rejects BR date with wrong format', () => {
    const r = BnmpWarrantSchema.safeParse({ ...SAMPLE, dataExpedicaoFormatada: '2025-11-25' });
    expect(r.success).toBe(false);
  });

  it('accepts null optional fields', () => {
    const r = BnmpWarrantSchema.parse({
      ...SAMPLE,
      alcunha: null,
      nomeMae: null,
      nomePai: null,
      descricaoProfissao: null,
      dataNascimento: null,
      numeroPecaAnterior: null,
      dataNascimentoFormatada: null,
    });
    expect(r.id).toBe(SAMPLE.id);
  });
});

describe('pagedSchema', () => {
  it('parses a 1-item page', () => {
    const schema = pagedSchema(BnmpWarrantSchema);
    const result = schema.parse({
      content: [SAMPLE],
      last: false,
      totalElements: 19,
      totalPages: 2,
      size: 10,
      number: 0,
    });
    expect(result.content).toHaveLength(1);
    expect(result.last).toBe(false);
  });
});

describe('parseBnmpResponse', () => {
  it('throws BnmpResponseInvalid with zod issues attached', () => {
    const schema = pagedSchema(BnmpWarrantSchema);
    let caught: unknown;
    try {
      parseBnmpResponse(schema, { not: 'a paged response' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BnmpResponseInvalid);
    if (caught instanceof BnmpResponseInvalid) {
      expect(caught.code).toBe('BNMP_RESPONSE_INVALID');
      expect(Array.isArray((caught.context as { issues?: unknown[] })?.issues)).toBe(true);
    }
  });
});
