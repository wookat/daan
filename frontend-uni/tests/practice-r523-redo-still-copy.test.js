// R523（R522-1）：错题重练完成页「仍错」文案与服务端语义对齐——save_mistake 命中已有错题时把 next_review 置为当前时刻
// （立即到期，错题本随即显示「今日待复习」），同屏还会出现「今日还有 N 题到期待复习」；此前文案写「明天优先再练」自相矛盾。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PRACTICE = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');
const DB = readFileSync(new URL('../../backend/app/db_review.py', import.meta.url), 'utf8');

describe('错题重练效果「仍错」文案', () => {
  it('服务端语义：重复命中的错题 next_review=time.time()（当天到期，不是明天）', () => {
    const m = DB.match(/UPDATE mistakes SET times=COALESCE\(times,1\)\+1, mastered=0, mastered_at=NULL, review_streak=0,[\s\S]{0,1500}?next_review=\?,[\s\S]{0,1500}?\(\s*time\.time\(\), rec\.get\("user_answer"\)/);
    expect(m).not.toBeNull();
  });
  it('完成页文案按「今日待复习」口径，不再说「明天」', () => {
    expect(PRACTICE).toContain('<template v-if="redoReport.still">；仍错的已重置复习，已回到今日待复习</template>');
    expect(PRACTICE).not.toContain('明天优先再练');
  });
});
