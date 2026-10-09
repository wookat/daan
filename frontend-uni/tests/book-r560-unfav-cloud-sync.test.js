// R560：错题本「收藏」tab（本机 favQuestions）取消收藏只清本地不发 DELETE /api/favs，云收藏（question_favs）残留 → 收藏夹页/其他设备仍显示（生产 bf36ec10 走查 F1）。
// 修法：收藏时本地条目记 id（题库题）；错题本取消时按 id（历史无 id 条目按题干回查云列表）removeFav，与刷题页 toggleFav 同口径。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');
const PRACTICE = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');

describe('R560 错题本取消收藏同步云端', () => {
  it('刷题页收藏写入本地条目时带题库 id（时政/内联为 null）', () => {
    expect(PRACTICE).toContain("this.favs.unshift({ t: Date.now(), id: qid || null, question,");
  });
  it('book.vue 从 api.js 引入 fetchFavs/removeFav、从 exam-fav.js 引入 cloudFavId', () => {
    expect(BOOK).toMatch(/import \{[^}]*\bfetchFavs\b[^}]*\bremoveFav\b[^}]*\} from '\.\.\/\.\.\/api\.js'/);
    expect(BOOK).toContain("import { cloudFavId } from '../../exam-fav.js';");
  });
  it('unfav 取出被删条目后调用 unfavCloud；unfavCloud 先按 id、无 id 再按题干回查云列表，命中才 removeFav', () => {
    const unfav = BOOK.slice(BOOK.indexOf('    unfav(i) {'), BOOK.indexOf('    isDue(m) {'));
    expect(unfav).toContain('const [f] = this.favs.splice(i, 1);');
    expect(unfav).toContain('this.unfavCloud(f);');
    expect(unfav).toContain("uni.showToast({ title: '已取消收藏', icon: 'none', duration: 900 });");
    expect(unfav).toContain('let qid = cloudFavId(f);');
    expect(unfav).toContain('if (!qid && f && f.question) qid = cloudFavId(f, (await fetchFavs()).items);');
    expect(unfav).toContain('if (qid) await removeFav(qid);');
    // 本地态先落盘再同步云端；云端失败不回滚本地
    expect(unfav.indexOf("uni.setStorageSync('favQuestions'")).toBeLessThan(unfav.indexOf('this.unfavCloud(f);'));
  });
});
