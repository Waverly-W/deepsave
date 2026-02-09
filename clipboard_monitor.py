#!/usr/bin/env python3
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import pyperclip
import requests


DEFAULT_POLL_SECONDS = 2.0


def load_env_from_file(env_path: Path) -> dict[str, str]:
    if not env_path.exists():
        return {}
    data: dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            data[key] = value
    return data


def resolve_config() -> tuple[str, str]:
    env_path = Path(__file__).resolve().parent / ".env"
    file_env = load_env_from_file(env_path)

    api_url = os.getenv("API_URL") or file_env.get("API_URL") or ""
    access_token = os.getenv("ACCESS_TOKEN") or file_env.get("ACCESS_TOKEN") or ""

    if not api_url or not access_token:
        print("Missing API_URL or ACCESS_TOKEN in environment or .env file.")
        sys.exit(1)

    return api_url.rstrip("/"), access_token


def is_http_url(text: str) -> bool:
    try:
        parsed = urlparse(text)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def ingest_url(api_url: str, token: str, url: str) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"url": url}
    try:
        response = requests.post(f"{api_url}/items/ingest", json=payload, headers=headers, timeout=15)
    except requests.RequestException as exc:
        print(f"Request failed: {exc}")
        return

    if response.status_code == 202:
        data = response.json()
        print(f"Ingested: {url} (task_id={data.get('task_id')})")
        return
    if response.status_code == 409:
        print(f"Already processing: {url}")
        return
    if response.status_code == 401:
        print("Unauthorized: check ACCESS_TOKEN.")
        return

    print(f"Failed ({response.status_code}): {response.text}")


def main() -> None:
    api_url, token = resolve_config()
    print("clipboard_monitor running. Copy a URL to ingest.")
    last_clipboard = ""
    last_sent = ""

    while True:
        try:
            current = pyperclip.paste()
        except pyperclip.PyperclipException as exc:
            print(f"Clipboard error: {exc}")
            time.sleep(DEFAULT_POLL_SECONDS)
            continue

        if current != last_clipboard:
            last_clipboard = current
            candidate = current.strip()
            if candidate and is_http_url(candidate) and candidate != last_sent:
                ingest_url(api_url, token, candidate)
                last_sent = candidate

        time.sleep(DEFAULT_POLL_SECONDS)


if __name__ == "__main__":
    main()
