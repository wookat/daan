// 读屏通报决策纯函数：不依赖 DOM/uni 运行时，vitest 直接回归。

// toast 可见且文案非空、与上一次可见文案不同才通报；隐藏或空文案不通报。
export function toastAnnounceText(visible, text, last) {
  if (!visible) return ''
  const t = String(text || '').trim()
  if (!t || t === last) return ''
  return t
}

// 判分通报文案：与 practice 判分横幅语义一致。
export function pickAnnounceText(correct, answer, streak) {
  if (correct) return '回答正确' + (streak >= 3 ? '，连对 ' + streak + ' 题' : '')
  return '回答错误，正确答案 ' + answer
}
