// 读屏动态通报：uni-h5 无任何 aria-live，toast 与判分横幅对读屏完全静默。
// 常驻 polite live region + MutationObserver 镜像 uni-toast 文案；announce() 供页面显式通报。
import { toastAnnounceText } from './live-policy.js'

let region = null
let lastToast = ''

export function announce(msg) {
  if (!region || !msg) return
  region.textContent = ''
  requestAnimationFrame(() => {
    if (region) region.textContent = String(msg)
  })
}

function toastVisible(el) {
  return el.style.display !== 'none'
}

function watchToast(el) {
  const report = () => {
    const out = toastAnnounceText(toastVisible(el), el.textContent, lastToast)
    lastToast = toastVisible(el) ? (el.textContent || '').trim() : ''
    if (out) announce(out)
  }
  new MutationObserver(report).observe(el, {
    attributes: true,
    attributeFilter: ['style'],
    childList: true,
    characterData: true,
    subtree: true,
  })
  report()
}

export function initA11yLive() {
  if (region || typeof document === 'undefined') return
  region = document.createElement('div')
  region.setAttribute('role', 'status')
  region.setAttribute('aria-live', 'polite')
  region.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;'
  const attach = () => {
    document.body.appendChild(region)
    document.querySelectorAll('uni-toast').forEach(watchToast)
    new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return
          if (n.tagName === 'UNI-TOAST') watchToast(n)
          else if (n.querySelectorAll) n.querySelectorAll('uni-toast').forEach(watchToast)
        })
      })
    }).observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) attach()
  else document.addEventListener('DOMContentLoaded', attach)
}
