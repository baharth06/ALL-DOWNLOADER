from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Literal
from time import time

Status = Literal['queued','analyzing','downloading','processing','completed','failed','cancelled']

@dataclass
class Job:
    id: str
    status: Status = 'queued'
    progress: float = 0
    downloaded_bytes: int = 0
    total_bytes: Optional[int] = None
    speed_bytes_per_second: Optional[float] = None
    eta_seconds: Optional[int] = None
    filename: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time)
    file_token: Optional[str] = None

    def public(self) -> dict:
        return {
            'id': self.id,
            'status': self.status,
            'progress': self.progress,
            'downloaded_bytes': self.downloaded_bytes,
            'total_bytes': self.total_bytes,
            'speed_bytes_per_second': self.speed_bytes_per_second,
            'eta_seconds': self.eta_seconds,
            'filename': self.filename,
            'download_url': self.download_url,
            'error': self.error,
            'created_at': self.created_at,
        }
