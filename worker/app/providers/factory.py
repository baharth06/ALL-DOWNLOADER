from .yt_dlp_provider import YTDLPProvider
from .direct import DirectProvider

YTDLP = YTDLPProvider()
DIRECT = DirectProvider()

def get_provider(url: str):
    return YTDLP if YTDLP.can_handle(url) else DIRECT
