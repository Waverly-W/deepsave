from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Float
from sqlalchemy.types import UserDefinedType


class VectorComparator(UserDefinedType.Comparator):
    def cosine_distance(self, other: Sequence[float]):
        return self.op("<=>", return_type=Float())(other)


class Vector(UserDefinedType):
    cache_ok = True
    comparator_factory = VectorComparator

    def __init__(self, dimensions: int) -> None:
        self.dimensions = dimensions

    def get_col_spec(self, **_: Any) -> str:
        return f"vector({self.dimensions})"

    def bind_processor(self, dialect):
        def process(value):
            if value is None:
                return None
            return "[" + ",".join(str(float(item)) for item in value) + "]"

        return process
