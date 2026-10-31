/**
 * Telegram bot: greets the user and opens the Mini App.
 * The bot token stays on the server — the Mini App receives only signed initData from Telegram.
 */
import { Bot, InlineKeyboard } from 'grammy';

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
if (!webAppUrl || !webAppUrl.startsWith('https://')) {
  throw new Error('WEB_APP_URL must be a public https:// URL (Telegram requires HTTPS for Mini Apps)');
}

const bot = new Bot(token);
const openButton = () => new InlineKeyboard().webApp('Open Smart Market Prices', webAppUrl);

bot.command('start', async (ctx) => {
  const name = ctx.from?.first_name ?? '';
  await ctx.reply(
    `Здравствуйте${name ? `, ${name}` : ''}! 👋\n\n` +
      'Smart Market Prices помогает закупать товары для магазина или кафе выгоднее: ' +
      'сравнивает предложения поставщиков и распределяет закупку с учётом цен, минимальных объёмов и доставки.\n\n' +
      '⚠️ Сейчас в приложении демонстрационные данные.',
    { reply_markup: openButton() },
  );
});

bot.command('help', (ctx) =>
  ctx.reply('Нажмите кнопку ниже, чтобы открыть приложение.', { reply_markup: openButton() }),
);

bot.on('message', (ctx) => ctx.reply('Откройте приложение кнопкой ниже.', { reply_markup: openButton() }));

bot.catch((err) => console.error('Bot error:', err.error));

await bot.api.setChatMenuButton({
  menu_button: { type: 'web_app', text: 'Открыть', web_app: { url: webAppUrl } },
});
await bot.api.setMyCommands([
  { command: 'start', description: 'Открыть Smart Market Prices' },
  { command: 'help', description: 'Помощь' },
]);

console.log(`Bot started. Mini App URL: ${webAppUrl}`);
bot.start();
