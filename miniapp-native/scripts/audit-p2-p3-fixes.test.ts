// 全栈代码审查 P2/P3 小程序专项回归测试（SSE thinking、PK 防超时竞态与再来一局、分享多选/图题、死路由清理、meta 空保护）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { feedSse } from '../miniprogram/utils/sse';
import type { SseState } from '../miniprogram/utils/sse';

const read = (rel: string) => readFileSync(fileURLToPath(new URL('../miniprogram/' + rel, import.meta.url)), 'utf8');

describe('P2 小程序 SSE / PK / Share / Profile / Interview 修复', () => {
  it('sse.ts feedSse 正确转发 event: thinking 给 onThinking 回调', () => {
    const state: SseState<Record<string, unknown>> = { buf: '', full: '', meta: null, done: null };
    const thoughts: Array<Record<string, unknown>> = [];
    const deltas: string[] = [];
    feedSse(
      'event: meta\ndata: {"id":1}\n\nevent: thinking\ndata: {"chars":42}\n\nevent: message\ndata: {"d":"解析"}\n\n',
      state,
      {
        onThinking: (d) => thoughts.push(d),
        onDelta: (s) => deltas.push(s),
      }
    );
    expect(state.meta).toEqual({ id: 1 });
    expect(thoughts).toEqual([{ chars: 42 }]);
    expect(deltas).toEqual(['解析']);
  });

  it('pk.ts onPick 选答立即 stopTimer 并追踪 pickDelayId；透传 imgUrl 与 option_imgs；rematch 直接开新局', () => {
    const pkTs = read('pkgSocial/pk/pk.ts');
    expect(pkTs).toMatch(/onPick\([\s\S]*?this\.stopTimer\(\);[\s\S]*?this\.pickDelayId = setTimeout/);
    expect(pkTs).toContain('curImg: imgUrl');
    expect(pkTs).toContain('option_imgs');
    expect(pkTs).toMatch(/rematch\(\)\s*\{[\s\S]*?this\.createMatch\(\);/);

    const pkWxml = read('pkgSocial/pk/pk.wxml');
    expect(pkWxml).toContain('wx:if="{{curImg}}"');
    expect(pkWxml).toContain('wx:if="{{item.img}}"');
  });

  it('profile.ts 不再包含失效路由 /pages/mistakes/mistakes', () => {
    const prof = read('pages/profile/profile.ts');
    expect(prof).not.toContain('/pages/mistakes/mistakes');
    expect(prof).toContain('/pages/book/book');
  });

  it('share.ts 与 share.wxml 支持多选题确认与题图/选项图渲染', () => {
    const shareTs = read('pages/share/share.ts');
    expect(shareTs).toContain('isMulti');
    expect(shareTs).toContain('onConfirmMulti');
    expect(shareTs).toContain('imgUrl(d.question.image)');
    expect(shareTs).toContain('option_imgs');

    const shareWxml = read('pages/share/share.wxml');
    expect(shareWxml).toContain('wx:if="{{qImg}}"');
    expect(shareWxml).toContain('wx:if="{{item.img}}"');
    expect(shareWxml).toContain('bind:click="onConfirmMulti"');
  });

  it('api/social.ts streamInterview 对空 st.meta 兜底不抛 TypeError', () => {
    const social = read('api/social.ts');
    expect(social).toContain('const meta = (st.meta || {}) as InterviewMeta;');
  });
});
