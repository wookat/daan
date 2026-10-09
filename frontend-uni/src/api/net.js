// fetch 流网络层 + SSE 事件流喂给器 + 增量 UTF-8 解码——export/ai 域共用（全平台可导入，仅 H5 路径实际调用 fetch）。
import { netFailMessage, parseSseEvents } from '../api-policy';

export async function fetchNet(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw new Error(netFailMessage(''));
  }
}

export async function readNet(reader) {
  try {
    return await reader.read();
  } catch (e) {
    throw new Error(netFailMessage(''));
  }
}

// SSE 文本 → 事件回调；解析见 api-policy.parseSseEvents。
export function feedSse(chunkText, state, onMeta, onDelta, onThinking) {
  const { rest, events } = parseSseEvents(state.buf + chunkText);
  state.buf = rest;
  for (const { type, data } of events) {
    if (type === 'meta') { state.meta = data; onMeta && onMeta(data); }
    else if (type === 'thinking') { onThinking && onThinking(data); }
    else if (type === 'done') { state.done = data; }
    else if (type === 'error') throw new Error(data.message || state.errMsg || '生成失败');
    else if (type === 'message') { state.full += data.d; onDelta && onDelta(state.full); }
  }
}

// 增量 UTF-8 解码（小程序无 TextDecoder，需处理跨 chunk 的多字节截断）
export function makeUtf8Decoder() {
  let pending = [];
  return function decode(arrayBuffer) {
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
      if (b < 0x80) { s += String.fromCharCode(b); i += 1; }
      else if (b >= 0xf0) {
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
