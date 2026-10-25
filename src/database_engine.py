"""SigmaOS-office Database Engine (Base / DataCraft / LibreOffice Base inspired).

Provides relational schemas, typed tables, SQL-like query builder, joins, aggregations,
form design specifications, and report generation.

Principles: Information Hiding, Separation of Concerns, Fail-Fast, Deterministic Testing.
"""

from typing import List, Dict, Any, Optional, Union, Callable
import csv
import io
import json


VALID_DATA_TYPES = ("TEXT", "INTEGER", "REAL", "BOOLEAN", "DATE", "BLOB")


class Column:
    def __init__(self, name: str, data_type: str = "TEXT", primary_key: bool = False,
                 nullable: bool = True, default_value: Any = None):
        if data_type.upper() not in VALID_DATA_TYPES:
            raise ValueError(f"Invalid data type: {data_type}. Choose from {VALID_DATA_TYPES}")
        self.name = name
        self.data_type = data_type.upper()
        self.primary_key = primary_key
        self.nullable = nullable
        self.default_value = default_value

    def validate(self, val: Any) -> Any:
        if val is None:
            if not self.nullable and self.default_value is None:
                raise ValueError(f"Column '{self.name}' cannot be null.")
            return self.default_value

        if self.data_type == "TEXT":
            return str(val)
        elif self.data_type == "INTEGER":
            return int(val)
        elif self.data_type == "REAL":
            return float(val)
        elif self.data_type == "BOOLEAN":
            if isinstance(val, str):
                return val.lower() in ("true", "1", "yes", "t")
            return bool(val)
        return val

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "data_type": self.data_type,
            "primary_key": self.primary_key,
            "nullable": self.nullable,
            "default_value": self.default_value,
        }


class Table:
    def __init__(self, name: str, columns: List[Column]):
        self.name = name
        self.columns = columns
        self.column_map = {c.name: c for c in columns}
        self.rows: List[Dict[str, Any]] = []

    def insert(self, row: Dict[str, Any]) -> Dict[str, Any]:
        validated_row = {}
        for col in self.columns:
            val = row.get(col.name, col.default_value)
            val = col.validate(val)
            if col.primary_key:
                # Check uniqueness
                for existing in self.rows:
                    if existing.get(col.name) == val:
                        raise ValueError(f"Duplicate primary key {val} for column '{col.name}' in table '{self.name}'.")
            validated_row[col.name] = val
        self.rows.append(validated_row)
        return validated_row

    def count(self) -> int:
        return len(self.rows)

    def to_csv(self) -> str:
        output = io.StringIO()
        fieldnames = [c.name for c in self.columns]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in self.rows:
            writer.writerow(r)
        return output.getvalue()


class QueryBuilder:
    """SQL-like fluent query builder for in-memory tables."""
    def __init__(self, table: Table):
        self.table = table
        self._select_cols: Optional[List[str]] = None
        self._where_predicates: List[Callable[[Dict[str, Any]], bool]] = []
        self._order_by_col: Optional[str] = None
        self._order_desc: bool = False
        self._limit: Optional[int] = None
        self._offset: int = 0

    def select(self, *columns: str) -> "QueryBuilder":
        self._select_cols = list(columns)
        return self

    def where(self, col: str, op: str, value: Any) -> "QueryBuilder":
        def predicate(row: Dict[str, Any]) -> bool:
            cell = row.get(col)
            if cell is None:
                return False
            if op == "=":
                return cell == value
            elif op == "!=":
                return cell != value
            elif op == ">":
                return cell > value
            elif op == "<":
                return cell < value
            elif op == ">=":
                return cell >= value
            elif op == "<=":
                return cell <= value
            elif op == "LIKE":
                pattern = str(value).replace("%", ".*")
                import re
                return bool(re.match(f"^{pattern}$", str(cell)))
            elif op == "IN":
                return cell in value
            return False
        self._where_predicates.append(predicate)
        return self

    def order_by(self, column: str, descending: bool = False) -> "QueryBuilder":
        self._order_by_col = column
        self._order_desc = descending
        return self

    def limit(self, count: int, offset: int = 0) -> "QueryBuilder":
        self._limit = count
        self._offset = offset
        return self

    def execute(self) -> List[Dict[str, Any]]:
        results = []
        for r in self.table.rows:
            if all(p(r) for p in self._where_predicates):
                results.append(r)

        if self._order_by_col:
            results.sort(key=lambda x: (x.get(self._order_by_col) is None, x.get(self._order_by_col)),
                         reverse=self._order_desc)

        if self._offset > 0:
            results = results[self._offset:]
        if self._limit is not None:
            results = results[:self._limit]

        if self._select_cols:
            projected = []
            for r in results:
                projected.append({k: r.get(k) for k in self._select_cols})
            return projected
        return results

    def aggregate(self, func: str, col: str) -> Any:
        values = [r.get(col) for r in self.table.rows if r.get(col) is not None and all(p(r) for p in self._where_predicates)]
        if not values:
            return 0 if func.upper() in ("COUNT", "SUM") else None
        fn = func.upper()
        if fn == "COUNT":
            return len(values)
        elif fn == "SUM":
            return sum(values)
        elif fn == "AVG":
            return sum(values) / len(values)
        elif fn == "MIN":
            return min(values)
        elif fn == "MAX":
            return max(values)
        raise ValueError(f"Unknown aggregate function {func}")


class FormField:
    def __init__(self, name: str, label: str, control_type: str = "text",
                 default: Any = None, required: bool = False, options: Optional[List[str]] = None):
        self.name = name
        self.label = label
        self.control_type = control_type  # text, number, checkbox, date, dropdown
        self.default = default
        self.required = required
        self.options = options or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "control_type": self.control_type,
            "default": self.default,
            "required": self.required,
            "options": self.options,
        }


class FormDesign:
    """Base form specification for data entry / inspection."""
    def __init__(self, title: str, target_table: str):
        self.title = title
        self.target_table = target_table
        self.fields: List[FormField] = []

    def add_field(self, field: FormField) -> None:
        self.fields.append(field)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "target_table": self.target_table,
            "fields": [f.to_dict() for f in self.fields],
        }


class ReportGenerator:
    """Generates structured formatted reports from query data."""
    def __init__(self, title: str, columns: List[str]):
        self.title = title
        self.columns = columns

    def generate_text_report(self, data: List[Dict[str, Any]]) -> str:
        lines = [
            "=" * 60,
            f"REPORT: {self.title.upper()}",
            "=" * 60,
        ]
        headers = " | ".join(f"{c:<15}" for c in self.columns)
        lines.append(headers)
        lines.append("-" * 60)
        for row in data:
            row_str = " | ".join(f"{str(row.get(c, '')):<15}" for c in self.columns)
            lines.append(row_str)
        lines.append("-" * 60)
        lines.append(f"Total Records: {len(data)}")
        lines.append("=" * 60)
        return "\n".join(lines)


class Database:
    """In-memory relational database container."""
    def __init__(self, name: str = "main"):
        self.name = name
        self.tables: Dict[str, Table] = {}
        self.forms: Dict[str, FormDesign] = {}

    def create_table(self, name: str, columns: List[Column]) -> Table:
        if name in self.tables:
            raise ValueError(f"Table '{name}' already exists.")
        t = Table(name, columns)
        self.tables[name] = t
        return t

    def get_table(self, name: str) -> Table:
        if name not in self.tables:
            raise ValueError(f"Table '{name}' not found.")
        return self.tables[name]

    def query(self, table_name: str) -> QueryBuilder:
        return QueryBuilder(self.get_table(table_name))
