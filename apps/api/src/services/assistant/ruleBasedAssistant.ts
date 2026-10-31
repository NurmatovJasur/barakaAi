import type { PrismaClient } from '@prisma/client';
import {
  PRODUCT_NAMES_RU,
  UNIT_LABELS,
  productLabel,
  type AssistantReplyDto,
  type OptimizationRunDto,
} from '@smp/shared';
import { freshnessPolicy } from '../../config/env';
import { checkOffer } from '../../algorithms/offerEligibility';
import { D } from '../../utils/decimal';
import { freshnessOf } from '../../utils/freshness';
import { toOptimizerOffer } from '../supplierOffer.service';
import { offerInclude } from '../../repositories/offer.repository';
import type { OptimizerService } from '../optimizer.service';
import type { PriceIntelligenceService } from '../priceIntelligence.service';
import { computeTrustScore } from '../trustScore.service';
import type { AssistantContext, ProcurementAssistantService } from './assistant.types';

const uzs = (v: string | number) =>
  `${Math.round(Number(v)).toLocaleString('ru-RU').replace(/\s/g, ' ')} UZS`;

type Intent = 'cheapest' | 'best_supplier' | 'why_supplier' | 'reduce_cost' | 'price_up' | 'split' | 'help';

const PATTERNS: [Intent, RegExp][] = [
  ['why_supplier', /почему.*(выбрал|выбран|поставщик|supplier)|why.*(supplier|chose)/i],
  ['split', /раздел|split|несколько поставщик|сколько поставщик/i],
  ['reduce_cost', /уменьш|снизи|сэконом|дешевле.*закуп|reduce|lower.*cost|сократ/i],
  ['price_up', /подорож|вырос|рост цен|выросл|повыш|increase|went up/i],
  ['best_supplier', /лучш.*поставщик|какой поставщик|надёжн|надежн|best supplier|reliable/i],
  ['cheapest', /дешев|дешёв|где купить|cheap|lowest price|минимальн.*цен/i],
];

export function detectIntent(message: string): Intent {
  for (const [intent, re] of PATTERNS) if (re.test(message)) return intent;
  return 'help';
}

/** Finds a catalog product mentioned in the message (Russian stem or English name). */
export function matchProductName(message: string): string | null {
  const m = message.toLowerCase();
  for (const [en, ru] of Object.entries(PRODUCT_NAMES_RU)) {
    const stem = ru.toLowerCase().slice(0, Math.max(3, ru.length - 2));
    if (m.includes(stem) || m.includes(en.toLowerCase())) return en;
  }
  if (/картош/.test(m)) return 'Potatoes';
  return null;
}

export class RuleBasedAssistant implements ProcurementAssistantService {
  constructor(
    private readonly db: PrismaClient,
    private readonly optimizer: OptimizerService,
    private readonly prices: PriceIntelligenceService,
  ) {}

  async reply(message: string, ctx: AssistantContext): Promise<AssistantReplyDto> {
    const intent = detectIntent(message);
    switch (intent) {
      case 'cheapest':
        return this.cheapest(message, ctx);
      case 'best_supplier':
        return this.bestSupplier();
      case 'why_supplier':
        return this.whySupplier(message, ctx);
      case 'reduce_cost':
        return this.reduceCost(ctx);
      case 'price_up':
        return this.priceUp();
      case 'split':
        return this.split(ctx);
      default:
        return this.help();
    }
  }

  private base(intent: string, answer: string, extra: Partial<AssistantReplyDto> = {}): AssistantReplyDto {
    return { intent, answer, facts: [], links: [], dataSufficient: true, engine: 'rule-based', ...extra };
  }

  private async run(ctx: AssistantContext): Promise<OptimizationRunDto | null> {
    if (ctx.optimizationRunId) return this.optimizer.get(ctx.userId, ctx.optimizationRunId).catch(() => null);
    return this.optimizer.latest(ctx.userId);
  }

  private noRun(intent: string) {
    return this.base(
      intent,
      'Недостаточно данных: у вас ещё нет расчёта закупки. Соберите корзину и нажмите «Оптимизировать», затем повторите вопрос.',
      { dataSufficient: false, links: [{ label: 'Открыть корзину', to: '/basket' }] },
    );
  }

  private async cheapest(message: string, ctx: AssistantContext) {
    const name = matchProductName(message);
    if (!name) {
      return this.base('cheapest', 'Укажите товар, например: «Где дешевле купить рис?»', { dataSufficient: false });
    }
    const product = await this.db.product.findUnique({ where: { name } });
    if (!product) return this.base('cheapest', 'Такого товара нет в каталоге.', { dataSufficient: false });
    const user = await this.db.user.findUnique({ where: { id: ctx.userId }, include: { business: true } });
    const district = user?.business?.district ?? null;
    const offers = await this.db.supplierOffer.findMany({ where: { productId: product.id }, include: offerInclude });
    const now = new Date();
    const usable = offers
      .filter(
        (o) =>
          !checkOffer(toOptimizerOffer(o), {
            now,
            freshness: freshnessPolicy,
            deliveryDistrict: district,
            requiredUnit: product.unit,
            currency: 'UZS',
          }),
      )
      .sort((a, b) => D(a.price).comparedTo(D(b.price)));
    const excludedCount = offers.length - usable.length;
    const label = productLabel(name);
    const unit = UNIT_LABELS[product.unit];
    if (usable.length === 0) {
      return this.base('cheapest', `Сейчас нет актуальных предложений «${label}» с доставкой в ваш район.`, {
        dataSufficient: false,
        links: [{ label: label, to: `/products/${product.id}` }],
      });
    }
    const best = usable[0];
    const facts = usable.slice(0, 4).map((o) => ({
      label: o.supplier.companyName,
      value: `${uzs(o.price.toString())}/${unit}, мин. заказ ${D(o.minOrderQuantity).toString()} ${unit}, доставка ${uzs(o.deliveryCost.toString())}`,
    }));
    return this.base(
      'cheapest',
      `Среди актуальных предложений с доставкой в ${district ?? 'ваш район'} самая низкая цена на «${label}» у ${best.supplier.companyName}: ${uzs(best.price.toString())}/${unit} ` +
        `(обновлено ${freshnessOf(best.lastUpdated, now, freshnessPolicy) === 'FRESH' ? 'менее суток назад' : 'более суток назад'}). ` +
        `Учтите доставку ${uzs(best.deliveryCost.toString())} и минимальный заказ — итоговая выгода зависит от всей корзины, ` +
        `её считает оптимизатор.` +
        (excludedCount ? ` Не учтено предложений: ${excludedCount} (устаревшие, без доставки в район или нет в наличии).` : '') +
        ' Цены демонстрационные.',
      { facts, links: [{ label: `Предложения: ${label}`, to: `/products/${product.id}` }] },
    );
  }

  private async bestSupplier() {
    const suppliers = await this.db.supplier.findMany({
      where: { isActive: true },
      include: { metrics: true, reviews: { select: { rating: true } }, offers: { select: { lastUpdated: true } } },
    });
    const now = new Date();
    const scored = suppliers.map((s) => ({
      s,
      t: computeTrustScore({
        metrics: s.metrics,
        ratings: s.reviews.map((r) => r.rating),
        offerFreshness: s.offers.map((o) => freshnessOf(o.lastUpdated, now, freshnessPolicy)),
      }),
    }));
    const ok = scored.filter((x) => x.t.status === 'OK').sort((a, b) => b.t.score! - a.t.score!);
    const insufficient = scored.filter((x) => x.t.status !== 'OK').map((x) => x.s.companyName);
    if (ok.length === 0) {
      return this.base('best_supplier', 'Недостаточно данных для оценки надёжности поставщиков.', { dataSufficient: false });
    }
    const top = ok[0];
    return this.base(
      'best_supplier',
      `По Trust Score лидирует ${top.s.companyName}: ${top.t.score}/100 ` +
        `(своевременность доставки ${top.t.components.deliveryReliability}%, точность цен ${top.t.components.priceAccuracy}%). ` +
        (insufficient.length ? `Недостаточно данных для оценки: ${insufficient.join(', ')}. ` : '') +
        'Показатели демонстрационные, поставщики не верифицированы. «Лучший» для конкретной корзины определяет оптимизатор по цене и доставке.',
      {
        facts: ok.map((x) => ({ label: x.s.companyName, value: `Trust Score ${x.t.score}` })),
        links: [{ label: top.s.companyName, to: `/suppliers/${top.s.id}` }],
      },
    );
  }

  private async whySupplier(message: string, ctx: AssistantContext) {
    const run = await this.run(ctx);
    if (!run) return this.noRun('why_supplier');
    const rec = run.scenarios.find((s) => s.kind === run.recommended);
    if (!rec) {
      return this.base('why_supplier', 'В последнем расчёте не найдено допустимого плана, поэтому поставщик не выбран.', {
        dataSufficient: false,
      });
    }
    const letter = message.match(/supplier\s*([a-e])\b|поставщик\w*\s*([a-e])\b/i);
    const asked = letter ? `Supplier ${(letter[1] ?? letter[2]).toUpperCase()}` : null;
    const groups = asked ? rec.suppliers.filter((g) => g.supplierName === asked) : rec.suppliers;
    if (asked && groups.length === 0) {
      return this.base(
        'why_supplier',
        `${asked} не входит в рекомендованный план. Его предложения либо дороже с учётом доставки, либо не проходят ограничения (минимальный заказ, остаток, зона доставки, актуальность цены).`,
        { facts: run.warnings.filter((w) => w.message.includes(asked)).map((w) => ({ label: 'Ограничение', value: w.message })) },
      );
    }
    const facts = groups.flatMap((g) =>
      g.allocations.map((a) => ({
        label: `${g.supplierName}: ${a.productName}`,
        value: `${a.quantity} ${UNIT_LABELS[a.unit]} × ${uzs(a.unitPrice)} = ${uzs(a.totalPrice)}`,
      })),
    );
    return this.base(
      'why_supplier',
      `${groups.map((g) => g.supplierName).join(', ')} выбран(ы), потому что при соблюдении минимальных объёмов, остатков и зон доставки ` +
        `это даёт минимальную итоговую стоимость ${uzs(rec.totalCost!)} с учётом доставки (${uzs(rec.deliveryCost!)}, один раз на поставщика). ` +
        run.explanation.slice(1, 2).join(' '),
      { facts, links: [{ label: 'Открыть расчёт', to: `/optimizer/${run.id}` }] },
    );
  }

  private async reduceCost(ctx: AssistantContext) {
    const run = await this.run(ctx);
    if (!run) return this.noRun('reduce_cost');
    const rec = run.scenarios.find((s) => s.kind === run.recommended);
    if (!rec) return this.base('reduce_cost', 'Последний расчёт не дал допустимого плана — сначала уменьшите количества или уберите недоступные товары.', { dataSufficient: false });
    const tips: string[] = [];
    const deliveryShare = Number(rec.deliveryCost) / Number(rec.totalCost);
    if (deliveryShare > 0.05) {
      tips.push(`Доставка составляет ${Math.round(deliveryShare * 100)}% суммы — объединение закупок за несколько дней снизит её долю.`);
    }
    const excluded = run.warnings.filter((w) => w.code.startsWith('OFFER_EXCLUDED_'));
    if (excluded.length) tips.push(`${excluded.length} предложений исключены (устаревшие цены, зоны доставки). Попросите поставщиков обновить цены — это расширит выбор.`);
    const moq = run.warnings.filter((w) => w.code === 'INSUFFICIENT_QUANTITY');
    if (moq.length) tips.push('Часть товаров ограничена остатками — проверьте количества.');
    tips.push('Крупные оптовики с высоким минимальным заказом дают более низкую цену: увеличение партии может снизить цену за единицу.');
    return this.base(
      'reduce_cost',
      `Текущий оптимальный план: ${uzs(rec.totalCost!)}. Что может помочь:\n• ${tips.join('\n• ')}`,
      {
        facts: run.scenarios
          .filter((s) => s.feasible)
          .map((s) => ({ label: s.title, value: uzs(s.totalCost!) })),
        links: [{ label: 'Открыть расчёт', to: `/optimizer/${run.id}` }],
      },
    );
  }

  private async priceUp() {
    const changes = (await this.prices.periodChanges(7)).filter((c) => c.changePercent >= 3);
    if (changes.length === 0) {
      return this.base('price_up', 'За последние 7 дней заметного роста цен (≥ 3%) не зафиксировано.');
    }
    changes.sort((a, b) => b.changePercent - a.changePercent);
    return this.base(
      'price_up',
      `За 7 дней подорожали ${changes.length} предложений. Сильнее всего: ${changes
        .slice(0, 3)
        .map((c) => `${c.productName} у ${c.supplierName} (+${c.changePercent}%)`)
        .join(', ')}. Данные демонстрационные.`,
      {
        facts: changes.slice(0, 8).map((c) => ({
          label: `${c.productName} — ${c.supplierName}`,
          value: `${uzs(c.from.toString())} → ${uzs(c.to.toString())} (+${c.changePercent}%)`,
        })),
        links: [{ label: 'Аналитика цен', to: '/analytics' }],
      },
    );
  }

  private async split(ctx: AssistantContext) {
    const run = await this.run(ctx);
    if (!run) return this.noRun('split');
    const single = run.scenarios.find((s) => s.kind === 'SINGLE')!;
    const multi = run.scenarios.find((s) => s.kind === 'MULTI')!;
    if (!multi.feasible) return this.base('split', 'Допустимого плана нет ни с одним, ни с несколькими поставщиками.', { dataSufficient: false });
    if (!single.feasible) {
      return this.base(
        'split',
        `Да — ни один поставщик не может выполнить весь заказ, разделение необходимо. Минимальная стоимость: ${uzs(multi.totalCost!)} у ${multi.supplierCount} поставщиков.`,
        { links: [{ label: 'Открыть расчёт', to: `/optimizer/${run.id}` }] },
      );
    }
    const diff = Number(single.totalCost) - Number(multi.totalCost);
    return this.base(
      'split',
      diff > 0
        ? `Разделение выгодно: ${uzs(multi.totalCost!)} у ${multi.supplierCount} поставщиков против ${uzs(single.totalCost!)} у одного — расчётная экономия ${uzs(diff)} с учётом всех доставок. Цена — больше логистики.`
        : `Разделять не стоит: один поставщик (${uzs(single.totalCost!)}) не дороже варианта с несколькими с учётом доставки.`,
      {
        facts: run.scenarios.filter((s) => s.feasible).map((s) => ({ label: s.title, value: `${uzs(s.totalCost!)} · поставщиков: ${s.supplierCount}` })),
        links: [{ label: 'Открыть расчёт', to: `/optimizer/${run.id}` }],
      },
    );
  }

  private help() {
    return this.base(
      'help',
      'Я отвечаю на вопросы по данным каталога и вашим расчётам. Примеры:\n' +
        '• Где дешевле купить рис?\n• Какой поставщик лучше?\n• Почему выбран Supplier B?\n' +
        '• Как уменьшить стоимость закупки?\n• Какие товары подорожали?\n• Стоит ли разделить заказ?',
      { dataSufficient: false },
    );
  }
}
