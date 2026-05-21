"""Tests for the Python stub (__init__.py)."""

import importlib


def test_module_imports():
    """Verify the pack module imports without error."""
    mod = importlib.import_module("__init__")
    assert hasattr(mod, "NODE_CLASS_MAPPINGS")
    assert hasattr(mod, "NODE_DISPLAY_NAME_MAPPINGS")
    assert hasattr(mod, "WEB_DIRECTORY")


def test_node_class_mappings_empty():
    """NODE_CLASS_MAPPINGS must be empty — this is a frontend-only pack."""
    mod = importlib.import_module("__init__")
    assert mod.NODE_CLASS_MAPPINGS == {}


def test_web_directory_set():
    """WEB_DIRECTORY must point to ./web."""
    mod = importlib.import_module("__init__")
    assert mod.WEB_DIRECTORY == "./web"
