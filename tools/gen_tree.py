#!/usr/bin/env python3
"""
Reads a newline-delimited list of relative file paths from stdin
and prints an ASCII tree (like `tree`) to stdout.
"""
from __future__ import annotations
import sys
from typing import Dict, Any


def build_tree(paths):
    root: Dict[str, Any] = {}
    for p in paths:
        parts = p.strip().split('/') if p.strip() else []
        node = root
        for i, part in enumerate(parts):
            is_file = i == len(parts) - 1
            if is_file:
                node.setdefault('__files__', []).append(part)
            else:
                node = node.setdefault(part, {})
    return root


def render_tree(node: Dict[str, Any], prefix: str = ""):
    dirs = sorted([k for k in node.keys() if k != '__files__'])
    files = sorted(node.get('__files__', []))
    entries = [(d, True) for d in dirs] + [(f, False) for f in files]
    for idx, (name, is_dir) in enumerate(entries):
        last = idx == len(entries) - 1
        branch = '└── ' if last else '├── '
        yield prefix + branch + (name + '/' if is_dir else name)
        if is_dir:
            child = node[name]
            next_prefix = prefix + ('    ' if last else '│   ')
            yield from render_tree(child, next_prefix)


def main():
    files = [line.rstrip('\n') for line in sys.stdin if line.strip()]
    tree = build_tree(files)
    for line in render_tree(tree):
        print(line)


if __name__ == '__main__':
    main()

