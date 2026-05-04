"""Tests for server/utils.py."""
import os
import tempfile

import pytest

from utils import hex_to_rgb, clamp_param, parse_form_param, safe_remove


class TestHexToRgb:
    def test_standard_hex(self):
        assert hex_to_rgb("#FF5733") == (255, 87, 51)

    def test_no_hash_prefix(self):
        assert hex_to_rgb("FF5733") == (255, 87, 51)

    def test_black(self):
        assert hex_to_rgb("#000000") == (0, 0, 0)

    def test_white(self):
        assert hex_to_rgb("#FFFFFF") == (255, 255, 255)


class TestClampParam:
    def test_within_range(self):
        assert clamp_param(50, 0, 100) == 50

    def test_below_min(self):
        assert clamp_param(-10, 0, 100) == 0

    def test_above_max(self):
        assert clamp_param(150, 0, 100) == 100

    def test_exact_bounds(self):
        assert clamp_param(0, 0, 100) == 0
        assert clamp_param(100, 0, 100) == 100


class TestParseFormParam:
    def test_valid_int(self):
        form = {"width": "64"}
        assert parse_form_param(form, "width", 32) == 64

    def test_missing_key_uses_default(self):
        form = {}
        assert parse_form_param(form, "width", 32) == 32

    def test_empty_string_uses_default(self):
        form = {"width": ""}
        assert parse_form_param(form, "width", 32) == 32

    def test_invalid_value_uses_default(self):
        form = {"width": "abc"}
        assert parse_form_param(form, "width", 32) == 32

    def test_clamping(self):
        form = {"size": "200"}
        assert parse_form_param(form, "size", 50, min_val=10, max_val=100) == 100

        form = {"size": "5"}
        assert parse_form_param(form, "size", 50, min_val=10, max_val=100) == 10

    def test_float_cast(self):
        form = {"ratio": "0.75"}
        assert parse_form_param(form, "ratio", 0.5, cast=float) == 0.75


class TestSafeRemove:
    def test_removes_existing_file(self):
        fd, path = tempfile.mkstemp()
        os.close(fd)
        assert os.path.exists(path)
        safe_remove(path)
        assert not os.path.exists(path)

    def test_no_error_on_missing_file(self):
        # Should not raise
        safe_remove("/tmp/nonexistent_file_12345.txt")

    def test_none_input(self):
        # Should not raise
        safe_remove(None)
