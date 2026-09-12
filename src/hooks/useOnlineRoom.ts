import { useEffect, useRef, useState, useCallback } from 'react';
import type { OnlineRoom, OnlineSettings, ServerMsg, ClientMsg } from '../lib/online/types';
import type { GameSnapshot } from '../lib/poker/game';

export type OnlineStatus = 'offline' | 'connecting' | 'lobby' | 'playing';

export function useOnlineRoom(opts: { onSettle?: (delta: number) => void; enabled?: boolean } = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const codeRef = useRef<string | null>(null);
  const onSettleRef = useRef(opts.onSettle);
  onSettleRef.current = opts.onSettle;
  const enabled = opts.enabled ?? true;
  const pendingRef = useRef<ClientMsg | null>(null);
  const profileRef = useRef<{ name: string; avatarId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftRef = useRef(true);

  const [status, setStatus] = useState<OnlineStatus>('offline');
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [you, setYou] = useState(0);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [winner, setWinner] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ delta: number; reason: string } | null>(null);
  const [chatLog, setChatLog] = useState<{ from: string; text: string; ts: number }[]>([]);

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const connect = useCallback(
    (pending?: ClientMsg) => {
      if (pending) pendingRef.current = pending;
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      const host = window.location.hostname || 'localhost';
      const next = new WebSocket(`ws://${host}:8088`);
      wsRef.current = next;
      setStatus('connecting');

      next.onopen = () => {
        clearTimer();
        setError(null);
        if (codeRef.current) {
          // reconnecting into an existing room
          const profile = profileRef.current ?? { name: 'Guest', avatarId: 'lynx-gold' };
          next.send(JSON.stringify({ t: 'join', code: codeRef.current, name: profile.name, avatarId: profile.avatarId }));
        } else if (pendingRef.current) {
          next.send(JSON.stringify(pendingRef.current));
          pendingRef.current = null;
        }
      };
      next.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.t) {
          case 'hello':
            codeRef.current = msg.code;
            setCode(msg.code);
            break;
          case 'room':
            setRoom(msg.room);
            setStatus(msg.room.started ? 'playing' : 'lobby');
            break;
          case 'snap':
            setYou(msg.you);
            setSnap(msg.snap);
            setWinner(msg.winner);
            setError(null);
            setStatus('playing');
            break;
          case 'chat':
            setChatLog((prev) => [...prev.slice(-60), { from: msg.from, text: msg.text, ts: msg.ts }]);
            break;
          case 'settle':
            onSettleRef.current?.(msg.delta);
            setResult((r) => (r ? { ...r, delta: r.delta + msg.delta } : { delta: msg.delta, reason: '' }));
            break;
          case 'roomEnd':
            setResult((r) => (r ? { ...r, reason: msg.reason } : { delta: 0, reason: msg.reason }));
            setStatus('offline');
            setSnap(null);
            codeRef.current = null;
            setCode(null);
            break;
          case 'err':
            setError(msg.message);
            break;
        }
      };
      next.onclose = () => {
        wsRef.current = null;
        setStatus((s) => (s === 'offline' ? s : 'offline'));
        if (enabled && !leftRef.current && (codeRef.current || pendingRef.current)) {
          clearTimer();
          timerRef.current = setTimeout(() => connect(), 1500);
        }
      };
      next.onerror = () => setError('Cannot reach the LAN poker server. Is npm run server running?');
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      leftRef.current = true;
      send({ t: 'leave' });
      wsRef.current?.close();
      wsRef.current = null;
      clearTimer();
    };
  }, [enabled, connect, send]);

  const ensureWs = useCallback(
    (pending?: ClientMsg) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return true;
      connect(pending);
      return false;
    },
    [connect],
  );

  const create = (name: string, avatarId: string, settings: OnlineSettings) => {
    const profile = { name, avatarId };
    profileRef.current = profile;
    leftRef.current = false;
    setResult(null);
    setChatLog([]);
    const msg: ClientMsg = { t: 'create', name, avatarId, settings };
    if (ensureWs(msg)) {
      wsRef.current!.send(JSON.stringify(msg));
      pendingRef.current = null;
    }
  };

  const join = (code2: string, name: string, avatarId: string) => {
    const profile = { name, avatarId };
    profileRef.current = profile;
    leftRef.current = false;
    const normalized = code2.trim().toUpperCase();
    codeRef.current = normalized;
    setResult(null);
    setChatLog([]);
    const msg: ClientMsg = { t: 'join', code: normalized, name, avatarId };
    if (ensureWs(msg)) {
      wsRef.current!.send(JSON.stringify(msg));
      pendingRef.current = null;
    }
  };

  const start = () => send({ t: 'start' });
  const act = (kind: 'fold' | 'check' | 'call' | 'raise' | 'allin', amount?: number) => send({ t: 'action', kind, amount });
  const chat = (text: string) => send({ t: 'chat', text });
  const leave = () => {
    leftRef.current = true;
    send({ t: 'leave' });
    codeRef.current = null;
    setCode(null);
    setRoom(null);
    setSnap(null);
    setResult(null);
    setChatLog([]);
    setError(null);
    setStatus('offline');
  };
  const clearResult = () => setResult(null);

  return { status, code, room, you, snap, winner, error, result, chatLog, create, join, start, act, chat, leave, clearResult };
}