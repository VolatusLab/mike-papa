import type { CookieJar } from 'tough-cookie';

export const PORTAL_COOKIE_NAME = 'portalbnmp';

/** Read the current value of the `portalbnmp` JWT cookie from a tough-cookie jar. */
export async function extractPortalCookie(jar: CookieJar, baseUrl: string): Promise<string | null> {
  const cookies = await jar.getCookies(baseUrl);
  const portal = cookies.find((c) => c.key === PORTAL_COOKIE_NAME);
  return portal?.value ?? null;
}
