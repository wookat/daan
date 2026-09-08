// SSE 流式读取（对齐 frontend-uni/src/api-policy.js parseSseEvents + api.js makeUtf8Decoder/feedSse）
// 小程序无 fetch 流 / TextDecoder：用 wx.request enableChunked + onChunkReceived，增量 UTF-8 解码后按空行切事件。

import { BASE_URL, netFailMessage } from './request';

export interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

export function parseSseEvents(buf: string): { rest: string; events: SseEvent[] } {
  const parts = buf.split('\n\n');
  const rest = parts.pop() || '';
  const events: SseEvent[] = [];
  for (const ev of parts) {
    const typeM = ev.match(/^event: (\w+)/m);
    const dataM = ev.match(/^data: (.*)$/m);
    if (!dataM) continue;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataM[1]) as Record<string, unknown>;
    } catch (e) {
      continue;
    }
    events.push({ type: typeM ? typeM[1] : 'message', data });
  }
  return { rest, events };
}

// 增量 UTF-8 解码：跨 chunk 截断的多字节序列留到下一块
export function makeUtf8Decoder(): (buf: ArrayBuffer) => string {
  let pending: number[] = [];
  return function decode(arrayBuffer: ArrayBuffer): string {
    const all = pending.concat(Array.from(new Uint8Array(arrayBuffer)));
    let end = all.length;
    for (let i = all.length - 1, k = 0; i >= 0 && k < 4; i--, k++) {
      const b = all[i];
      if (b < 0x80) break;
      if (b >= 0xc0) {
        const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
        if (all.length - i < need) end = i;
        break;
      }
    }
    pending = all.slice(end);
    let s = '';
    for (let i = 0; i < end; ) {
      const b = all[i];
      if (b < 0x80) {
        s += String.fromCharCode(b);
        i += 1;
      } else if (b >= 0xf0) {
        s += String.fromCodePoint(
          ((b & 0x07) << 18) | ((all[i + 1] & 0x3f) << 12) | ((all[i + 2] & 0x3f) << 6) | (all[i + 3] & 0x3f)
        );
        i += 4;
      } else if (b >= 0xe0) {
        s += String.fromCharCode(((b & 0x0f) << 12) | ((all[i + 1] & 0x3f) << 6) | (all[i + 2] & 0x3f));
        i += 3;
      } else {
        s += String.fromCharCode(((b & 0x1f) << 6) | (all[i + 1] & 0x3f));
        i += 2;
      }
    }
    return s;
  };
}

export interface SseState<M> {
  buf: string;
  full: string;
  meta: M | null;
  done: Record<string, unknown> | null;
}

export interface SseHandlers<M> {
  onMeta?: (meta: M) => void;
  onDelta?: (full: string) => void;
  errMsg?: string;
}

// 把一段解码文本喂给状态机：meta / message{d} / done / error
export function feedSse<M>(chunkText: string, state: SseState<M>, h: SseHandlers<M>): void {
  const { rest, events } = parseSseEvents(state.buf + chunkText);
  state.buf = rest;
  for (const { type, data } of events) {
    if (type === 'meta') {
      state.meta = data as M;
      if (h.onMeta) h.onMeta(state.meta);
    } else if (type === 'done') {
      state.done = data;
    } else if (type === 'error') {
      throw new Error(String(data.message || h.errMsg || '生成失败'));
    } else if (type === 'message') {
      state.full += String(data.d || '');
      if (h.onDelta) h.onDelta(state.full);
    }
  }
}

export class StreamUnsupportedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'StreamUnsupportedError';
  }
}

export interface StreamPostOptions<M> extends SseHandlers<M> {
  path: string;
  header: Record<string, string>;
  data: WechatMiniprogram.IAnyObject | string;
  timeout?: number;
}

// 分块 POST：resolve {meta, full, done}；基础库不支持 onChunkReceived / 非 2xx 时抛 StreamUnsupportedError 供调用方降级非流式
export function streamPost<M>(opts: StreamPostOptions<M>): Promise<SseState<M>> {
  return new Promise((resolve, reject) => {
    const state: SseState<M> = { buf: '', full: '', meta: null, done: null };
    let failed = false;
    const fail = (e: Error) => {
      if (failed) return;
      failed = true;
      reject(e);
    };
    const task = wx.request({
      url: BASE_URL + opts.path,
      method: 'POST',
      header: opts.header,
      data: opts.data,
      enableChunked: true,
      timeout: opts.timeout || 180000,
      success: (res) => {
        if (failed) return;
        if (res.statusCode < 200 || res.statusCode >= 300) {
          fail(new StreamUnsupportedError('HTTP ' + res.statusCode));
          return;
        }
        if (!state.meta && !state.full) {
          fail(new StreamUnsupportedError('生成失败：无响应'));
          return;
        }
        resolve(state);
      },
      fail: (err) => fail(new StreamUnsupportedError(netFailMessage(err && err.errMsg))),
    });
    if (!task || typeof task.onChunkReceived !== 'function') {
      fail(new StreamUnsupportedError('当前基础库不支持分块读取'));
      if (task && typeof task.abort === 'function') task.abort();
      return;
    }
    const decode = makeUtf8Decoder();
    task.onChunkReceived((r) => {
      try {
        feedSse(decode(r.data), state, opts);
      } catch (e) {
        fail(e as Error);
        try {
          task.abort();
        } catch (e2) {
          /* ignore */
        }
      }
    });
  });
}
