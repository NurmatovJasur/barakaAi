import type { ZodTypeAny, z } from 'zod';
import type { Paginated } from '@smp/shared';
import { AppError, badRequest, unauthorized } from './errors';
import type { Request } from 'express';

/** Validates input against a Zod schema, throwing a 400 with field details on failure. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const flat = r.error.flatten();
    const first = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', first?.message ?? 'Некорректные данные', flat);
  }
  return r.data;
}

export function uuidParam(req: Request, name = 'id'): string {
  const v = req.params[name];
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v)) throw badRequest(`Некорректный ${name}`);
  return v;
}

export function userId(req: Request): string {
  if (!req.auth) throw unauthorized();
  return req.auth.userId;
}

export function paginated<T>(items: T[], page: number, pageSize: number, total: number): Paginated<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
