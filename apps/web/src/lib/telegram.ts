/** Thin, typed wrapper around window.Telegram.WebApp. Every call is a no-op outside Telegram. */

interface TgButton {
  setText(text: string): TgButton;
  show(): TgButton;
  hide(): TgButton;
  enable(): TgButton;
  disable(): TgButton;
  showProgress(leaveActive?: boolean): TgButton;
  hideProgress(): TgButton;
  onClick(cb: () => void): TgButton;
  offClick(cb: () => void): TgButton;
  setParams(p: { color?: string; text_color?: string }): TgButton;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; username?: string } };
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string | undefined>;
  viewportStableHeight: number;
  isExpanded: boolean;
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  MainButton: TgButton;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function getWebApp(): TgWebApp | null {
  const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  // telegram-web-app.js defines WebApp everywhere; initData is only present inside Telegram.
  return wa && wa.initData ? wa : null;
}

export const isTelegram = () => getWebApp() !== null;

/** initData for server-side verification. Never trust initDataUnsafe for auth. */
export const getInitData = () => getWebApp()?.initData ?? '';

/** initDataUnsafe — UI hints only (e.g. greeting). */
export const getUnsafeUser = () => getWebApp()?.initDataUnsafe.user ?? null;

function applyTheme(wa: TgWebApp) {
  const root = document.documentElement;
  root.dataset.theme = wa.colorScheme;
  const p = wa.themeParams;
  // Use Telegram colors for page background/surfaces; keep our brand primary for actions.
  if (p.secondary_bg_color) root.style.setProperty('--c-bg', p.secondary_bg_color);
  if (p.bg_color) root.style.setProperty('--c-surface', p.bg_color);
  if (p.text_color) root.style.setProperty('--c-text', p.text_color);
  if (p.hint_color) root.style.setProperty('--c-muted', p.hint_color);
  if (p.section_separator_color) root.style.setProperty('--c-border', p.section_separator_color);
}

function applyViewport(wa: TgWebApp) {
  if (wa.viewportStableHeight) {
    document.documentElement.style.setProperty('--app-height', `${wa.viewportStableHeight}px`);
  }
}

export function initTelegram() {
  const wa = getWebApp();
  if (!wa) {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    return;
  }
  wa.ready();
  wa.expand();
  wa.disableVerticalSwipes?.();
  applyTheme(wa);
  applyViewport(wa);
  wa.onEvent('themeChanged', () => applyTheme(wa));
  wa.onEvent('viewportChanged', () => applyViewport(wa));
}

export const haptic = {
  impact: (s: 'light' | 'medium' | 'heavy' = 'light') => getWebApp()?.HapticFeedback.impactOccurred(s),
  success: () => getWebApp()?.HapticFeedback.notificationOccurred('success'),
  error: () => getWebApp()?.HapticFeedback.notificationOccurred('error'),
  warning: () => getWebApp()?.HapticFeedback.notificationOccurred('warning'),
  select: () => getWebApp()?.HapticFeedback.selectionChanged(),
};

export function openExternal(url: string) {
  const wa = getWebApp();
  if (wa && url.startsWith('https://t.me/')) wa.openTelegramLink(url);
  else if (wa && url.startsWith('http')) wa.openLink(url);
  else window.location.href = url;
}
