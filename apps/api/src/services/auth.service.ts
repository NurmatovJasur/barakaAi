import type { PrismaClient } from '@prisma/client';
import type { AuthResponse, UserDto } from '@smp/shared';
import { env } from '../config/env';
import { verifyInitData } from '../integrations/telegram';
import { issueToken } from '../middleware/auth';
import { AppError, notFound, unauthorized } from '../utils/errors';

export const DEV_TELEGRAM_ID = 100000001n;

const userInclude = { business: true } as const;

export class AuthService {
  constructor(private readonly db: PrismaClient) {}

  private toDto(u: {
    id: string;
    telegramId: bigint;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    business: { id: string; name: string; district: string | null } | null;
  }): UserDto {
    return {
      id: u.id,
      telegramId: u.telegramId.toString(),
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      business: u.business && { id: u.business.id, name: u.business.name, district: u.business.district },
    };
  }

  async telegram(initData: string): Promise<AuthResponse> {
    const v = verifyInitData(initData, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_INITDATA_MAX_AGE);
    if (!v.ok) {
      if (v.reason === 'NO_TOKEN') {
        throw new AppError(503, 'TELEGRAM_NOT_CONFIGURED', 'Авторизация через Telegram не настроена на сервере');
      }
      throw unauthorized(
        v.reason === 'EXPIRED' ? 'Данные Telegram устарели, перезапустите приложение' : 'Подпись Telegram недействительна',
      );
    }
    const tg = v.user;
    const user = await this.db.user.upsert({
      where: { telegramId: BigInt(tg.id) },
      create: {
        telegramId: BigInt(tg.id),
        firstName: tg.first_name ?? null,
        lastName: tg.last_name ?? null,
        username: tg.username ?? null,
        photoUrl: tg.photo_url ?? null,
        business: { create: { name: tg.first_name ? `${tg.first_name} — бизнес` : 'Мой бизнес', district: 'Chilonzor' } },
      },
      update: {
        firstName: tg.first_name ?? null,
        lastName: tg.last_name ?? null,
        username: tg.username ?? null,
        photoUrl: tg.photo_url ?? null,
      },
      include: userInclude,
    });
    return { token: issueToken(user.id, user.telegramId), user: this.toDto(user) };
  }

  /** DEV_MODE only: logs in as the seeded demo user. */
  async dev(): Promise<AuthResponse> {
    if (!env.DEV_MODE) throw notFound('Маршрут');
    const user = await this.db.user.upsert({
      where: { telegramId: DEV_TELEGRAM_ID },
      create: {
        telegramId: DEV_TELEGRAM_ID,
        firstName: 'Demo',
        lastName: 'Owner',
        username: 'demo_shop_owner',
        isDevUser: true,
        business: { create: { name: 'Demo Shop', district: 'Chilonzor' } },
      },
      update: {},
      include: userInclude,
    });
    return { token: issueToken(user.id, user.telegramId), user: this.toDto(user) };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.db.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user) throw unauthorized('Пользователь не найден');
    return this.toDto(user);
  }
}
