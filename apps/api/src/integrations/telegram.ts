import crypto from 'node:crypto';

export interface TelegramInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export type InitDataVerification =
  | { ok: true; user: TelegramInitUser; authDate: Date }
  | { ok: false; reason: 'NO_TOKEN' | 'NO_HASH' | 'BAD_HASH' | 'EXPIRED' | 'NO_USER' };

/**
 * Verifies Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
 * hash       = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  now = new Date(),
): InitDataVerification {
  if (!botToken) return { ok: false, reason: 'NO_TOKEN' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: 'NO_HASH' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'BAD_HASH' };
  }

  const authDate = new Date(Number(params.get('auth_date') ?? 0) * 1000);
  const age = (now.getTime() - authDate.getTime()) / 1000;
  if (!Number.isFinite(age) || age > maxAgeSeconds || age < -60) return { ok: false, reason: 'EXPIRED' };

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TelegramInitUser | null;
    if (!user || typeof user.id !== 'number') return { ok: false, reason: 'NO_USER' };
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: 'NO_USER' };
  }
}

/** Test helper: builds signed initData exactly like Telegram does. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
