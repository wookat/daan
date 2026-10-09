// R551：H5 错题本列表卡直接显示「错因」标签，与小程序 m-meta-warn 对齐；未掌握可点直达更多操作层的错因自评
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue')+read('../src/pages/book/review-ops.js');
const head = book.slice(book.indexOf('<view class="mhead">'), book.indexOf('<view class="q" :class="{ clamp: !m.open }">'));

describe('R551 列表卡错因标签', () => {
  it('H5：mhead 在「手录/模考」之后、卷码 badge 之前挂 warn 色错因标签；未掌握且非批量时可点开 itemSheet', () => {
    expect(head).toContain('<view v-if="m.error_reason && !m.mastered && !batchMode" class="rzbadge-hit" role="button"');
    expect(head).toContain('@click.stop="itemSheet(m)"><kg-tag tone="warn" icon="pen-line">{{ m.error_reason }}</kg-tag></view>');
    expect(head).toContain('<kg-tag v-else-if="m.error_reason" tone="warn">{{ m.error_reason }}</kg-tag>');
    expect(head.indexOf("m.source === 'manual'")).toBeLessThan(head.indexOf('rzbadge-hit'));
    expect(head.indexOf('rzbadge-hit')).toBeLessThan(head.indexOf('pbadge-hit'));
    expect(head.indexOf('rzbadge-hit')).toBeLessThan(head.indexOf('错 {{ m.times }} 次'));
  });
  it('点击热区与卷码 badge 同一套 40px 触达样式；更多操作层错因自评仅未掌握显示（与卡面可点条件一致）', () => {
    expect(book).toContain('.pbadge-hit, .rzbadge-hit { position: relative; z-index: 1;');
    expect(book).toContain('<view v-if="!moreSheet.m.mastered" class="reasons more-reasons">');
  });
  it('小程序既有口径不变：m-meta-warn 直显 error_reason', () => {
    const wxml = read('../../miniapp-native/miniprogram/pages/book/book.wxml');
    expect(wxml).toContain('<text wx:if="{{item.error_reason}}" class="m-meta-warn">{{item.error_reason}}</text>');
  });
  it('后端：mistakes/review_log 入库侧探针打标，本人列表不外泄 probe 字段', () => {
    const db = read('../../backend/app/db.py');
    expect(db).toContain('def save_mistake(rec: dict, probe: bool = False) -> int:');
    expect(db).toContain('("probe", "ALTER TABLE review_log ADD COLUMN probe INTEGER")');
    expect(db).toContain('d.pop("probe", None)');
    const api = read('../../backend/app/study_api.py');
    expect(api).toContain('mid = db.save_mistake(rec, probe=auth.probe_request(request))');
    expect(api).toContain('def api_review_record(mid: int, body: dict, request: Request):');
  });
});
