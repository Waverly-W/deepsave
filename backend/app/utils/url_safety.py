import ipaddress
import logging
import os
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_BLOCKED_HOSTS = {"localhost"}
_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),  # AWS/GCP metadata
    ipaddress.ip_address("100.100.100.200"),  # Alibaba Cloud metadata
    ipaddress.ip_address("169.254.170.2"),  # ECS task metadata
}


class UnsafeUrlError(ValueError):
    """Raised when URL points to private or dangerous destinations."""


def _protection_mode() -> str:
    mode = (os.getenv("SSRF_PROTECTION_MODE", "enforce") or "enforce").strip().lower()
    if mode not in {"warn", "enforce"}:
        return "enforce"
    return mode


def _domain_allowlist() -> list[str]:
    raw = os.getenv("INGEST_DOMAIN_ALLOWLIST", "")
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def _host_allowed(host: str, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    if host in allowlist:
        return True
    return any(host.endswith(f".{domain}") for domain in allowlist)


def _resolve_ips(hostname: str, port: int) -> set[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    ips: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()
    infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    for family, _, _, _, sockaddr in infos:
        raw_ip = sockaddr[0]
        ip = ipaddress.ip_address(raw_ip)
        if family not in {socket.AF_INET, socket.AF_INET6}:
            continue
        ips.add(ip)
    return ips


def _is_forbidden_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip in _METADATA_IPS:
        return True
    return any(
        (
            ip.is_loopback,
            ip.is_private,
            ip.is_link_local,
            ip.is_reserved,
            ip.is_multicast,
            ip.is_unspecified,
        )
    )


def _validate_url_target(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("Only http/https URLs are allowed")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise UnsafeUrlError("URL hostname is required")
    if host in _BLOCKED_HOSTS or host.endswith(".localhost"):
        raise UnsafeUrlError("Localhost targets are not allowed")

    allowlist = _domain_allowlist()
    if not _host_allowed(host, allowlist):
        raise UnsafeUrlError("Target domain is not in allowlist")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        ips = _resolve_ips(host, port)
    except OSError as exc:
        raise UnsafeUrlError("Unable to resolve target hostname") from exc

    if not ips:
        raise UnsafeUrlError("Unable to resolve target hostname")

    for ip in ips:
        if _is_forbidden_ip(ip):
            raise UnsafeUrlError(f"Target IP is not allowed: {ip}")


def validate_ingest_url(url: str) -> None:
    try:
        _validate_url_target(url)
    except UnsafeUrlError:
        if _protection_mode() == "warn":
            logger.warning("SSRF warning for URL: %s", url)
            return
        raise
