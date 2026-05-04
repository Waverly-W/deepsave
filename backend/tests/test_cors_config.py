import re
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.cors import get_cors_config


class CorsConfigTest(unittest.TestCase):
    def test_default_regex_allows_private_lan_frontend_origins(self) -> None:
        config = get_cors_config({})

        self.assertIsNotNone(config.allow_origin_regex)
        pattern = re.compile(config.allow_origin_regex or "")
        self.assertIsNotNone(pattern.fullmatch("http://192.168.100.106:10100"))
        self.assertIsNotNone(pattern.fullmatch("http://10.0.0.2:10100"))
        self.assertIsNotNone(pattern.fullmatch("http://172.16.0.5:10100"))

    def test_default_regex_does_not_allow_public_origins(self) -> None:
        config = get_cors_config({})

        pattern = re.compile(config.allow_origin_regex or "")
        self.assertIsNone(pattern.fullmatch("http://203.0.113.10:10100"))

    def test_empty_regex_env_uses_private_lan_default(self) -> None:
        config = get_cors_config({"CORS_ALLOW_ORIGIN_REGEX": ""})

        pattern = re.compile(config.allow_origin_regex or "")
        self.assertIsNotNone(pattern.fullmatch("http://192.168.100.106:10100"))
