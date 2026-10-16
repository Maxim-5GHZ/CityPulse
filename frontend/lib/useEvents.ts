// Подписка на SSE-ленту бэкенда (GET /backend/events/stream?token=JWT).
// EventSource не умеет Authorization-header — токен идёт в query (tradeoff,
// зафиксирован в EventsController). Автореконнект с backoff, heartbeat ping игнорим.
'use client';

import { useEffect, useRef, useState } from 'react';

export interface LiveEvent {
  kind: string;
  text: string;
  at: number;
}

export function useEvents(token: string | null) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }
    let es: EventSource | null = null;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const push = (kind: string, text: string) =>
      setEvents((prev) => [{ kind, text, at: Date.now() }, ...prev].slice(0, 20));

    const connect = () => {
      if (closed) return;
      es = new EventSource(`/backend/events/stream?token=${encodeURIComponent(token)}`);
      es.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };
      es.addEventListener('message', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data) as { text?: string; from?: string };
          push('message', d.text ?? String((e as MessageEvent).data));
        } catch {
          push('message', String((e as MessageEvent).data));
        }
      });
      es.addEventListener('connected', () => setConnected(true));
      es.onerror = () => {
        setConnected(false);
        es?.close();
        // backoff до 10с
        const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
        retryRef.current += 1;
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      es?.close();
      setConnected(false);
    };
  }, [token]);

  return { events, connected };
}
