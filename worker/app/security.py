from __future__ import annotations
import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_HOSTS = {
    'youtube.com', 'youtu.be',
    'instagram.com',
    'pinterest.com', 'pin.it', 'pinimg.com',
}
ALLOWED_SUFFIXES = (
    '.youtube.com', '.instagram.com', '.pinterest.com', '.pinimg.com', '.pin.it',
)


def is_private(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def assert_safe_url(raw: str, *, allow_generic: bool = True):
    if len(raw) > 4096:
        raise ValueError('The URL is too long.')
    parsed = urlparse(raw)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
        raise ValueError('Only HTTP(S) URLs are supported.')

    host = parsed.hostname.lower().rstrip('.')
    if host in {'localhost', '0.0.0.0', '127.0.0.1', '::1'}:
        raise ValueError('Private hosts are not allowed.')
    if host.endswith('.local') or host.endswith('.internal') or host.endswith('.lan'):
        raise ValueError('Internal hosts are not allowed.')

    source_allowed = host in ALLOWED_HOSTS or any(host.endswith(suffix) for suffix in ALLOWED_SUFFIXES)
    if not allow_generic and not source_allowed:
        raise ValueError('This source is not supported.')

    try:
        infos = socket.getaddrinfo(
            host,
            parsed.port or (443 if parsed.scheme == 'https' else 80),
            type=socket.SOCK_STREAM,
        )
        ips = {item[4][0] for item in infos}
        if not ips or any(is_private(ip) for ip in ips):
            raise ValueError('Private network destinations are not allowed.')
    except socket.gaierror as exc:
        raise ValueError('The source hostname could not be resolved.') from exc

    return parsed
