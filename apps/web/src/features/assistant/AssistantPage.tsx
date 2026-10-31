import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bot, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AssistantReplyDto } from '@smp/shared';
import { api, errorMessage } from '../../services/api';

interface Msg {
  role: 'user' | 'bot';
  text: string;
  reply?: AssistantReplyDto;
  error?: boolean;
}

const SUGGESTIONS = [
  'Где дешевле купить рис?',
  'Какой поставщик лучше?',
  'Стоит ли разделить заказ?',
  'Как уменьшить стоимость закупки?',
  'Какие товары подорожали?',
  'Почему выбран Supplier B?',
];

export function AssistantPage() {
  const [params] = useSearchParams();
  const runId = params.get('run') ?? undefined;
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'bot',
      text:
        'Я помогаю анализировать закупки. Отвечаю только на основе данных каталога, предложений и ваших расчётов. ' +
        'Работаю по правилам (rule-based), без генеративной модели.',
    },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (m: string) => api.assistant.chat(m, runId),
    onSuccess: (reply) => setMessages((m) => [...m, { role: 'bot', text: reply.answer, reply }]),
    onError: (e) => setMessages((m) => [...m, { role: 'bot', text: errorMessage(e), error: true }]),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, chat.isPending]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || chat.isPending) return;
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setInput('');
    chat.mutate(t);
  };

  return (
    <div className="flex min-h-[calc(var(--app-height)-200px)] flex-col">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary text-white">
          <Bot className="size-5" />
        </div>
        <div>
          <h1 className="font-semibold leading-tight">Помощник по закупкам</h1>
          <p className="text-xs text-muted">Rule-based · ответы из данных системы</p>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={clsx(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line',
                m.role === 'user' ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-line bg-surface',
                m.error && 'border-danger text-danger',
              )}
            >
              {m.text}
              {m.reply && m.reply.facts.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
                  {m.reply.facts.map((f, j) => (
                    <div key={j} className="flex justify-between gap-3">
                      <span className="text-muted">{f.label}</span>
                      <span className="tabular text-right">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.reply && m.reply.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.reply.links.map((l) => (
                    <Link key={l.to} to={l.to} className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
                      {l.label} →
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {chat.isPending && (
          <div className="flex">
            <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-sm text-muted">Анализирую данные…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="scrollbar-none -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Задайте вопрос о закупке"
          aria-label="Вопрос помощнику"
          className="h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
        />
        <button type="submit" aria-label="Отправить" disabled={!input.trim() || chat.isPending} className="flex size-11 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50">
          <Send className="size-5" />
        </button>
      </form>
    </div>
  );
}
