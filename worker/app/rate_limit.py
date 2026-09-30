from __future__ import annotations
import time
from collections import defaultdict, deque

class InMemoryRateLimiter:
    def __init__(self, limit:int=30, window:int=60):
        self.limit=limit; self.window=window; self.events=defaultdict(deque)
    def check(self, key:str):
        now=time.time(); q=self.events[key]
        while q and q[0] <= now-self.window: q.popleft()
        if len(q) >= self.limit: return False
        q.append(now); return True

limiter=InMemoryRateLimiter(limit=30,window=60)
