// 比赛场次由后端按东八区排（mock_event.TZ），展示也固定东八区，与设备时区/夏令时无关。
const CST_OFFSET_SEC = 8 * 3600;

const pad = (n) => String(n).padStart(2, '0');

/** Unix 秒 → 东八区年月日时分（用 UTC getter 读平移后的时间，不经设备时区）。 */
export function cstParts(sec) {
  const d = new Date((sec + CST_OFFSET_SEC) * 1000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

/** 「9月12日 09:00 - 24:00」；截止落在次日 0 点显示 24:00。 */
export function fmtWindow(openSec, closeSec) {
  const o = cstParts(openSec);
  const c = cstParts(closeSec);
  const end = c.h === 0 && c.mi === 0 ? '24:00' : `${pad(c.h)}:${pad(c.mi)}`;
  return `${o.mo}月${o.d}日 ${pad(o.h)}:${pad(o.mi)} - ${end}`;
}

/** 「2026-09-05」。往期只给 close_at（次日 0 点），传 closeSec - 1 取比赛当天。 */
export function fmtDay(sec) {
  const p = cstParts(sec);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** 「9月12日 09:00」（周报「下一场」）。 */
export function fmtDayHour(sec) {
  const p = cstParts(sec);
  return `${p.mo}月${p.d}日 ${pad(p.h)}:00`;
}
