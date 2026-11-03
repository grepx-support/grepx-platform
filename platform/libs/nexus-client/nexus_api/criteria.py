"""Criteria language: a small, safe SQL WHERE subset, evaluated in Python.

    status = 'NEW' AND (to_service = 'x' OR from_service = 'x')
    capacity >= 5   name LIKE 'A%'   state IN ('OPEN','DRAFT')   reminded_at IS NULL
An empty string matches everything; a leading WHERE is ignored.
"""
from __future__ import annotations

import re
from typing import Any, Callable

Predicate = Callable[[dict], bool]
_TOKEN = re.compile(r"\s*(?:(?P<str>'(?:[^']|'')*')|(?P<num>-?\d+(?:\.\d+)?)|(?P<op><=|>=|!=|<>|=|<|>|\(|\)|,)|(?P<word>[A-Za-z_][A-Za-z0-9_.]*))")


def _tokens(text: str) -> list[tuple[str, Any]]:
    out, pos = [], 0
    text = text.strip()
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            raise ValueError(f"bad criteria near: {text[pos:pos + 20]!r}")
        pos = m.end()
        if m.group("str") is not None:
            out.append(("val", m.group("str")[1:-1].replace("''", "'")))
        elif m.group("num") is not None:
            n = m.group("num")
            out.append(("val", float(n) if "." in n else int(n)))
        elif m.group("op") is not None:
            out.append(("op", m.group("op")))
        else:
            out.append(("word", m.group("word")))
    return out


def _cmp(a: Any, b: Any) -> tuple[Any, Any]:
    if isinstance(a, (int, float)) and isinstance(b, str):
        try:
            return a, float(b)
        except ValueError:
            return str(a), b
    if isinstance(a, str) and isinstance(b, (int, float)):
        try:
            return float(a), b
        except ValueError:
            return a, str(b)
    if isinstance(a, bool) or isinstance(b, bool):
        return str(a).lower(), str(b).lower()
    return a, b


def _like(value: Any, pattern: str) -> bool:
    rx = "^" + re.escape(pattern).replace("%", ".*").replace("_", ".") + "$"
    return re.match(rx, str(value), re.IGNORECASE | re.DOTALL) is not None


class _Parser:
    def __init__(self, tokens):
        self.t, self.i = tokens, 0

    def peek(self, kind=None, value=None):
        if self.i >= len(self.t):
            return False
        k, v = self.t[self.i]
        return (kind is None or k == kind) and (value is None or (str(v).upper() == value))

    def take(self):
        tok = self.t[self.i]
        self.i += 1
        return tok

    def expr(self) -> Predicate:
        left = self.term()
        while self.peek("word", "OR"):
            self.take()
            right, prev = self.term(), left
            left = lambda f, a=prev, b=right: a(f) or b(f)
        return left

    def term(self) -> Predicate:
        left = self.factor()
        while self.peek("word", "AND"):
            self.take()
            right, prev = self.factor(), left
            left = lambda f, a=prev, b=right: a(f) and b(f)
        return left

    def factor(self) -> Predicate:
        if self.peek("word", "NOT"):
            self.take()
            inner = self.factor()
            return lambda f: not inner(f)
        if self.peek("op", "("):
            self.take()
            inner = self.expr()
            self.take()
            return inner
        return self.comparison()

    def comparison(self) -> Predicate:
        kind, name = self.take()
        if kind != "word":
            raise ValueError(f"expected field name, got {name!r}")
        if self.peek("word", "IS"):
            self.take()
            negate = self.peek("word", "NOT") and self.take()
            self.take()  # NULL
            return (lambda f: f.get(name) not in (None, "")) if negate else (lambda f: f.get(name) in (None, ""))
        negate_in = self.peek("word", "NOT") and self.take()
        if self.peek("word", "IN"):
            self.take()
            self.take()  # (
            values = []
            while not self.peek("op", ")"):
                k, v = self.take()
                if k == "val":
                    values.append(v)
            self.take()
            hit = lambda f: any(_cmp(f.get(name), v)[0] == _cmp(f.get(name), v)[1] for v in values)
            return (lambda f: not hit(f)) if negate_in else hit
        if self.peek("word", "LIKE"):
            self.take()
            _, pattern = self.take()
            return lambda f: f.get(name) is not None and _like(f.get(name), pattern)
        _, op = self.take()
        _, value = self.take()

        def check(f: dict) -> bool:
            actual = f.get(name)
            if hasattr(actual, "value"):
                actual = actual.value
            if actual is None:
                return op in ("!=", "<>") and value is not None
            a, b = _cmp(actual, value)
            try:
                return {"=": a == b, "!=": a != b, "<>": a != b, "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b}[op]
            except TypeError:
                return False
        return check


def compile_criteria(text: str | None) -> Predicate:
    text = (text or "").strip()
    if text.upper().startswith("WHERE "):
        text = text[6:]
    if not text:
        return lambda f: True
    parser = _Parser(_tokens(text))
    predicate = parser.expr()
    if parser.i != len(parser.t):
        raise ValueError(f"unexpected trailing criteria: {text!r}")
    return predicate
