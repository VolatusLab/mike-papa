import 'server-only';
import { parseEnv, webEnvSchema } from '@bnmp/shared';

// Single source of truth for server-side env on the web app.
// Validated at module init — process crashes early with a readable error if anything is missing.
export const env = parseEnv(webEnvSchema);
