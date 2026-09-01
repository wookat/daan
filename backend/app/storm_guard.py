"""按客户端 IP 的错误风暴防护：滑动窗口统计 /api 错误响应，超阈值临时拒绝。

正常客户端不会在短窗口内产出大量 4xx/5xx（生产基线：单 IP 每 10s 最多 12 个
/api 请求且几乎全 2xx）；故障/陈旧 bundle/恶意客户端的错误重试风暴则可打到
~3 req/s 持续数小时，把 2 vCPU 共享宿主排队到分钟级并殃及其他端点（R182 取证）。
封禁只依赖错误计数，与正常行为零重叠；429 不计入窗口，封禁随窗口滑出自然解除。
"""
import threading
from collections import OrderedDict, deque


class ErrorStormGuard:
    def __init__(self, threshold: int = 30, window: float = 60.0, max_ips: int = 1024):
        self.threshold = threshold
        self.window = window
        self.max_ips = max_ips
        self._errs: OrderedDict[str, deque] = OrderedDict()
        self._lock = threading.Lock()

    def _prune(self, dq: deque, now: float) -> None:
        while dq and now - dq[0] > self.window:
            dq.popleft()

    def record(self, ip: str, status: int, now: float) -> None:
        if status < 400 or not ip:
            return
        with self._lock:
            dq = self._errs.get(ip)
            if dq is None:
                dq = self._errs[ip] = deque()
                while len(self._errs) > self.max_ips:
                    self._errs.popitem(last=False)
            else:
                self._errs.move_to_end(ip)
            self._prune(dq, now)
            dq.append(now)

    def blocked(self, ip: str, now: float) -> bool:
        with self._lock:
            dq = self._errs.get(ip)
            if dq is None:
                return False
            self._prune(dq, now)
            return len(dq) >= self.threshold
