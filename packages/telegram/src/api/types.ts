// Minimal Bot API response surface. We deliberately keep this tiny —
// adding fields as actual handlers need them, rather than mirroring the
// entire Bot API.

export interface BotApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}

export interface BotUser {
  id: number;
  is_bot: boolean;
  username?: string;
  first_name: string;
}

export interface BotMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
}

export type ParseMode = 'MarkdownV2' | 'HTML' | 'Markdown';
