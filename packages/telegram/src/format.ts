// Telegram Markdown V2 escaping + alert message templates.
// Reference: https://core.telegram.org/bots/api#markdownv2-style

// All MD-V2 metacharacters per the spec — must escape with `\` to render literally.
const MDV2_SPECIAL = /([\\_*[\]()~`>#+\-=|{}.!])/g;

/** Escape any string for safe insertion into a MarkdownV2-parsed message. */
export function escapeMdV2(value: string): string {
  return value.replace(MDV2_SPECIAL, '\\$1');
}

export type AlertKind = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'REVOKED' | 'REPUBLISHED';

export interface AlertWarrantView {
  bnmpId: number | bigint;
  numeroPeca: string;
  numeroPecaFormatado: string;
  numeroProcesso: string;
  nomePessoa: string;
  alcunha: string | null;
  descricaoStatus: string;
  descricaoPeca: string;
  dataExpedicao: Date;
  nomeOrgao: string;
  nomeMae: string | null;
  nomePai: string | null;
  dataNascimento: Date | null;
  descricaoSexo: string;
}

export interface FormatAlertInput {
  warrant: AlertWarrantView;
  kind: AlertKind;
  /** Optional diff payload from WarrantHistory.diff. Format: { field: { from, to } } */
  diff?: Record<string, { from: unknown; to: unknown }>;
}

const KIND_HEADER: Record<AlertKind, string> = {
  CREATED: '🚨 *Novo mandado*',
  REPUBLISHED: '♻️ *Mandado republicado*',
  STATUS_CHANGED: '⚠️ *Mandado alterado — status*',
  UPDATED: '⚠️ *Mandado alterado*',
  REVOKED: '✅ *Mandado revogado*',
};

function brDate(d: Date | null): string {
  if (!d) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function line(label: string, value: string | null | undefined): string {
  const v = value && value.trim() ? value : '—';
  return `*${escapeMdV2(label)}:* ${escapeMdV2(v)}`;
}

function formatDiffSection(diff: Record<string, { from: unknown; to: unknown }>): string {
  const entries = Object.entries(diff);
  if (entries.length === 0) return '';
  const rows = entries.map(([field, change]) => {
    const from = change.from == null ? '—' : String(change.from);
    const to = change.to == null ? '—' : String(change.to);
    return `• ${escapeMdV2(field)}: ~${escapeMdV2(from)}~ → *${escapeMdV2(to)}*`;
  });
  return ['', '*Alterações:*', ...rows].join('\n');
}

/**
 * Render a MarkdownV2 message ready to send via Bot API sendMessage.
 * Always pre-escaped; do NOT call escapeMdV2 on the return value.
 */
export function formatAlertMessage(input: FormatAlertInput): string {
  const { warrant, kind, diff } = input;
  const head = KIND_HEADER[kind];

  const parts: string[] = [
    head,
    '',
    line('Pessoa', warrant.nomePessoa),
    line('Status', warrant.descricaoStatus),
    line('Tipo', warrant.descricaoPeca),
    line('Data expedição', brDate(warrant.dataExpedicao)),
    line('Órgão', warrant.nomeOrgao),
    '',
    line('Processo', warrant.numeroProcesso),
    line('Peça', warrant.numeroPecaFormatado),
  ];

  if (warrant.alcunha || warrant.nomeMae || warrant.nomePai || warrant.dataNascimento) {
    parts.push('', '*Pessoa:*');
    if (warrant.alcunha) parts.push(`• Alcunha: ${escapeMdV2(warrant.alcunha)}`);
    if (warrant.nomeMae) parts.push(`• Mãe: ${escapeMdV2(warrant.nomeMae)}`);
    if (warrant.nomePai) parts.push(`• Pai: ${escapeMdV2(warrant.nomePai)}`);
    if (warrant.dataNascimento) {
      parts.push(`• Nascimento: ${escapeMdV2(brDate(warrant.dataNascimento))}`);
    }
  }

  if (diff && Object.keys(diff).length > 0) {
    parts.push(formatDiffSection(diff));
  }

  parts.push('', `ID BNMP: \`${escapeMdV2(String(warrant.bnmpId))}\``);

  return parts.join('\n');
}
