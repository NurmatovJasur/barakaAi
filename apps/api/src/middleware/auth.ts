import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

interface TokenPayload {
  sub: string;
  tg: string;
}

export function issueToken(userId: string, telegramId: bigint | string): string {
  return jwt.sign({ tg: telegramId.toString() }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/** Authentication: requires a valid Bearer JWT issued by /api/auth/*. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload &
      TokenPayload;
    if (!payload.sub) return next(unauthorized('Недействительный токен'));
    req.auth = { userId: payload.sub, telegramId: payload.tg };
    next();
  } catch {
    next(unauthorized('Сессия истекла, войдите снова'));
  }
}
