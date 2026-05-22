import { describe, expect, it } from 'vitest';
import { escapeMdV2, formatAlertMessage, type AlertWarrantView } from '../format.js';

const SAMPLE: AlertWarrantView = {
  bnmpId: 204077075,
  numeroPeca: '0000904482023827273001000207',
  numeroPecaFormatado: '0000904-48.2023.8.27.2730.01.0002-07',
  numeroProcesso: '00009044820238272730',
  nomePessoa: 'ROBERTO RODRIGUES DE ARAUJO',
  alcunha: null,
  descricaoStatus: 'Pendente de Cumprimento',
  descricaoPeca: 'Mandado de Prisão',
  dataExpedicao: new Date('2025-11-25T00:00:00.000Z'),
  nomeOrgao: 'JUIZO UNICO - PALMEIROPOLIS',
  nomeMae: 'ALVINA FRANCISCA DE ARAUJO',
  nomePai: 'ADERSON RODRIGUES DE ARAUJO',
  dataNascimento: new Date('1980-12-21T00:00:00.000Z'),
  descricaoSexo: 'Masculino',
};

describe('escapeMdV2', () => {
  it('escapes all MD-V2 metacharacters', () => {
    expect(escapeMdV2('a.b')).toBe('a\\.b');
    expect(escapeMdV2('(test)')).toBe('\\(test\\)');
    expect(escapeMdV2('a*b_c[d]')).toBe('a\\*b\\_c\\[d\\]');
    expect(escapeMdV2('hash#')).toBe('hash\\#');
    expect(escapeMdV2('a-b+c=d')).toBe('a\\-b\\+c\\=d');
  });

  it('escapes backslash itself', () => {
    expect(escapeMdV2('a\\b')).toBe('a\\\\b');
  });

  it('leaves safe chars alone', () => {
    expect(escapeMdV2('hello world')).toBe('hello world');
    expect(escapeMdV2('ABC 123')).toBe('ABC 123');
  });
});

describe('formatAlertMessage', () => {
  it('CREATED includes 🚨 header and core fields', () => {
    const msg = formatAlertMessage({ warrant: SAMPLE, kind: 'CREATED' });
    expect(msg).toMatch(/🚨/);
    expect(msg).toMatch(/Novo mandado/);
    expect(msg).toContain('ROBERTO RODRIGUES DE ARAUJO');
    // dot in date must be escaped: 25\/11\/2025 → escapeMdV2 escapes `.` not `/`
    expect(msg).toContain('25/11/2025');
    // BNMP id in inline code
    expect(msg).toContain('`204077075`');
    // numeroPecaFormatado has dots, hyphens — must appear escaped
    expect(msg).toContain('0000904\\-48\\.2023\\.8\\.27\\.2730\\.01\\.0002\\-07');
  });

  it('REVOKED uses ✅ header', () => {
    const msg = formatAlertMessage({ warrant: SAMPLE, kind: 'REVOKED' });
    expect(msg).toMatch(/✅/);
    expect(msg).toMatch(/revogado/i);
  });

  it('STATUS_CHANGED uses ⚠️ header', () => {
    const msg = formatAlertMessage({ warrant: SAMPLE, kind: 'STATUS_CHANGED' });
    expect(msg).toMatch(/⚠️/);
    expect(msg).toMatch(/status/i);
  });

  it('renders diff section when provided', () => {
    const msg = formatAlertMessage({
      warrant: SAMPLE,
      kind: 'STATUS_CHANGED',
      diff: { descricaoStatus: { from: 'Pendente', to: 'Cumprido' } },
    });
    expect(msg).toContain('*Alterações:*');
    expect(msg).toMatch(/~Pendente~/);
    expect(msg).toMatch(/\*Cumprido\*/);
  });

  it('handles null filiação gracefully', () => {
    const minimal: AlertWarrantView = {
      ...SAMPLE,
      alcunha: null,
      nomeMae: null,
      nomePai: null,
      dataNascimento: null,
    };
    const msg = formatAlertMessage({ warrant: minimal, kind: 'CREATED' });
    expect(msg).not.toMatch(/Mãe:/);
    expect(msg).not.toMatch(/Pai:/);
    expect(msg).not.toMatch(/Alcunha:/);
  });
});
