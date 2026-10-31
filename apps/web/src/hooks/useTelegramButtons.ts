import { useEffect, useRef } from 'react';
import { getWebApp } from '../lib/telegram';

export interface MainButtonOptions {
  text: string;
  onClick: () => void;
  visible?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Drives Telegram MainButton. Returns true when the native button is used,
 * so the page can render its own fallback button in a regular browser (DEV_MODE).
 */
export function useMainButton({ text, onClick, visible = true, disabled, loading }: MainButtonOptions): boolean {
  const wa = getWebApp();
  const cb = useRef(onClick);
  cb.current = onClick;

  useEffect(() => {
    if (!wa) return;
    const handler = () => cb.current();
    const mb = wa.MainButton;
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
      mb.hideProgress();
    };
  }, [wa]);

  useEffect(() => {
    if (!wa) return;
    const mb = wa.MainButton;
    mb.setText(text);
    mb.setParams({ color: '#1e3a8a', text_color: '#ffffff' });
    if (visible) mb.show();
    else mb.hide();
    if (disabled) mb.disable();
    else mb.enable();
    if (loading) mb.showProgress(false);
    else mb.hideProgress();
  }, [wa, text, visible, disabled, loading]);

  return wa !== null;
}

/** Shows Telegram BackButton while `visible` and calls onBack on press. */
export function useBackButton(visible: boolean, onBack: () => void) {
  const wa = getWebApp();
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    if (!wa) return;
    const handler = () => cb.current();
    wa.BackButton.onClick(handler);
    return () => wa.BackButton.offClick(handler);
  }, [wa]);
  useEffect(() => {
    if (!wa) return;
    if (visible) wa.BackButton.show();
    else wa.BackButton.hide();
  }, [wa, visible]);
}
