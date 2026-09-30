from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

from .base import Provider
from ..security import assert_safe_url

MEDIA_PREFIXES = ('video/', 'audio/', 'image/')


async def safe_request(
    client: httpx.AsyncClient,
    url: str,
    *,
    method: str,
    max_redirects: int = 5,
    headers: dict[str, str] | None = None,
) -> tuple[httpx.Response, str]:
    current = url
    base_headers = {'User-Agent': 'AllDownloader/1.0'}
    if headers:
        base_headers.update(headers)
    for _ in range(max_redirects + 1):
        assert_safe_url(current, allow_generic=True)
        request = client.build_request(method, current, headers=base_headers)
        response = await client.send(request, follow_redirects=False, stream=True)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get('location')
            await response.aclose()
            if not location:
                raise ValueError('The source returned an invalid redirect.')
            current = urljoin(current, location)
            continue
        return response, current
    raise ValueError('Too many redirects from the source.')


class DirectProvider(Provider):
    name = 'direct'

    def can_handle(self, url: str) -> bool:
        return True

    async def analyze(self, url: str):
        assert_safe_url(url, allow_generic=True)
        timeout = httpx.Timeout(15, read=30)
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response, final_url = await safe_request(client, url, method='HEAD')
            try:
                if response.status_code in {405, 403} or not response.headers.get('content-type'):
                    await response.aclose()
                    response, final_url = await safe_request(
                        client,
                        url,
                        method='GET',
                        headers={'Range': 'bytes=0-0'},
                    )
                response.raise_for_status()
                content_type = (response.headers.get('content-type') or '').split(';')[0].lower()
                size_value = response.headers.get('content-length')
                content_range = response.headers.get('content-range')
            finally:
                await response.aclose()

        if not content_type.startswith(MEDIA_PREFIXES):
            raise ValueError('The URL is not a direct supported media file.')

        length = int(size_value) if size_value and size_value.isdigit() else None
        if content_range and '/' in content_range:
            advertised = content_range.rsplit('/', 1)[-1]
            if advertised.isdigit():
                length = int(advertised)
        extension = (
            mimetypes.guess_extension(content_type) or
            Path(urlparse(final_url).path).suffix or
            '.bin'
        ).lstrip('.').lower()
        kind = 'video' if content_type.startswith('video/') else 'audio' if content_type.startswith('audio/') else 'image'
        title = Path(urlparse(final_url).path).name or 'download'

        format_item = {
            'id': 'direct-original',
            'container': extension,
            'label': f'Original {extension.upper()}',
            'kind': kind,
            'extension': extension,
            'mime': content_type,
            'filesize': length,
        }

        return {
            'success': True,
            'source': 'direct',
            'title': title,
            'creator': None,
            'thumbnail': final_url if kind == 'image' else None,
            'duration': None,
            'mediaType': kind,
            'formats': [format_item],
            'outputFormats': ['original'],
            'estimatedSize': length,
        }

    def get_formats(self, info: dict):
        return info.get('formats', [])

    async def create_download_job(self, options: dict):
        return options

    async def validate(self, url: str):
        assert_safe_url(url, allow_generic=True)
