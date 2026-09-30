from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import urlparse

import yt_dlp

from .base import Provider
from ..security import assert_safe_url

SUPPORTED_HOSTS = (
    'youtube.com', 'youtu.be',
    'instagram.com',
    'pinterest.com', 'pin.it', 'pinimg.com',
)


class YTDLPProvider(Provider):
    name = 'yt-dlp'

    def can_handle(self, url: str) -> bool:
        try:
            host = re.sub(r'^www\.', '', urlparse(url).hostname or '').lower()
        except Exception:
            return False
        return host in SUPPORTED_HOSTS or any(host.endswith('.' + item) for item in SUPPORTED_HOSTS)

    def _extract(self, url: str, download: bool = False):
        assert_safe_url(url, allow_generic=False)
        options = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'skip_download': not download,
            'restrictfilenames': True,
            'nocheckcertificate': False,
            'cookiefile': None,
            'remote_components': ['ejs:github'],
            'retries': 3,
            'fragment_retries': 3,
            'concurrent_fragment_downloads': 4,
            'socket_timeout': 20,
            'http_chunk_size': 10 * 1024 * 1024,
        }
        with yt_dlp.YoutubeDL(options) as downloader:
            return downloader.extract_info(url, download=download)

    async def analyze(self, url: str):
        info = await asyncio.to_thread(self._extract, url, False)
        return self._normalize(info)

    def _normalize(self, info: dict[str, Any]) -> dict[str, Any]:
        entries = info.get('entries') or []
        if entries:
            info = entries[0]

        raw = info.get('formats') or []
        selected_formats = []
        seen = set()
        candidates = []
        for item in raw:
            format_id = item.get('format_id')
            vcodec = item.get('vcodec')
            acodec = item.get('acodec')
            if not format_id:
                continue
            if vcodec in (None, 'none') and acodec in (None, 'none'):
                continue
            candidates.append(item)

        video_candidates = [x for x in candidates if x.get('vcodec') not in (None, 'none') and x.get('height')]
        video_candidates.sort(key=lambda item: (
            item.get('height') or 0,
            item.get('fps') or 0,
            item.get('tbr') or 0,
            1 if item.get('acodec') not in (None, 'none') else 0,
        ), reverse=True)

        for item in video_candidates:
            height = int(item.get('height') or 0)
            ext = item.get('ext') or 'mp4'
            signature = (height, ext, item.get('fps') or 0, item.get('vcodec') or '')
            if signature in seen:
                continue
            seen.add(signature)
            selected_formats.append(self._format_item(item))
            if len(selected_formats) >= 12:
                break

        if not selected_formats:
            audio_candidates = [x for x in candidates if x.get('acodec') not in (None, 'none')]
            audio_candidates.sort(key=lambda item: item.get('abr') or item.get('tbr') or 0, reverse=True)
            for item in audio_candidates[:8]:
                selected_formats.append(self._format_item(item))

        if not selected_formats:
            raise ValueError('The source did not return a downloadable media format.')

        media_type = 'video' if any(item['kind'] == 'video' for item in selected_formats) else 'audio'
        output_formats = ['original']
        if media_type == 'video':
            output_formats += ['mp4', 'webm', 'mp3', 'aac']
        elif media_type == 'audio':
            output_formats += ['mp3', 'aac']

        return {
            'success': True,
            'source': self.source_name(info),
            'title': info.get('title') or 'Untitled media',
            'creator': info.get('uploader') or info.get('channel') or info.get('creator'),
            'thumbnail': info.get('thumbnail'),
            'duration': info.get('duration'),
            'mediaType': media_type,
            'formats': selected_formats,
            'outputFormats': output_formats,
            'estimatedSize': next((x.get('filesize') for x in selected_formats if x.get('filesize')), None),
        }

    @staticmethod
    def _format_item(item: dict[str, Any]) -> dict[str, Any]:
        height = item.get('height')
        ext = item.get('ext') or 'mp4'
        vcodec = item.get('vcodec')
        acodec = item.get('acodec')
        kind = 'video' if vcodec not in (None, 'none') else 'audio'
        label = f"{height}p {ext}" if height else f"Audio {ext}"
        return {
            'id': str(item['format_id']),
            'container': ext,
            'label': label,
            'kind': kind,
            'extension': ext,
            'mime': item.get('mime'),
            'width': item.get('width'),
            'height': int(height) if height else None,
            'fps': item.get('fps'),
            'filesize': item.get('filesize') or item.get('filesize_approx'),
            'videoCodec': vcodec,
            'audioCodec': acodec,
            'hasAudio': acodec not in (None, 'none'),
        }

    @staticmethod
    def source_name(info: dict[str, Any]) -> str:
        extractor = (info.get('extractor_key') or info.get('extractor') or '').lower()
        if 'youtube' in extractor:
            return 'youtube'
        if 'instagram' in extractor:
            return 'instagram'
        if 'pinterest' in extractor:
            return 'pinterest'
        raise ValueError('Unsupported media provider.')

    def get_formats(self, info: dict[str, Any]) -> list[dict[str, Any]]:
        return info.get('formats') or []

    async def create_download_job(self, options: dict[str, Any]):
        return options

    async def validate(self, url: str):
        assert_safe_url(url, allow_generic=False)

    async def get_info_for_download(self, url: str):
        return await asyncio.to_thread(self._extract, url, False)
