"""SigmaOS-office Spreadsheet Engine (Calc / Excel / GridCraft inspired).

Provides cell matrix, formula evaluation DAG (SUM, AVERAGE, MIN, MAX, COUNT, IF),
dependency tracking, range operations, CSV and structured JSON serialization.

Principles: Locality of Reference, Cache Conscious Design, Fail-Fast, Deterministic Testing.
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import re
import csv
import io
import json


def col_name_to_idx(col_str: str) -> int:
    """Convert column name (e.g. 'A', 'Z', 'AA') to 0-based column index."""
    idx = 0
    for ch in col_str.upper():
        idx = idx * 26 + (ord(ch) - ord('A') + 1)
    return idx - 1


def col_idx_to_name(col_idx: int) -> str:
    """Convert 0-based column index to letter representation."""
    name = ""
    col_idx += 1
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        name = chr(65 + remainder) + name
    return name


def parse_cell_coord(coord: str) -> Tuple[int, int]:
    """Parse cell coordinate string like 'B3' into (row, col) (0-based)."""
    m = re.match(r"^([A-Za-z]+)(\d+)$", coord.strip())
    if not m:
        raise ValueError(f"Invalid cell coordinate: {coord}")
    col = col_name_to_idx(m.group(1))
    row = int(m.group(2)) - 1
    return (row, col)


def format_cell_coord(row: int, col: int) -> str:
    return f"{col_idx_to_name(col)}{row + 1}"


class Cell:
    """Represents a single cell with raw value, formula, and computed value."""
    def __init__(self, raw: Any = None):
        self.raw = raw
        self.computed: Any = None
        self.formula: Optional[str] = None
        self.format: str = "general"

        if isinstance(raw, str) and raw.startswith("="):
            self.formula = raw[1:].strip()
        else:
            if isinstance(raw, str):
                try:
                    self.computed = float(raw) if "." in raw else int(raw)
                except ValueError:
                    self.computed = raw
            else:
                self.computed = raw

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw": self.raw,
            "computed": self.computed,
            "formula": self.formula,
            "format": self.format,
        }


class Sheet:
    """A 2D sparse grid of cells."""
    def __init__(self, name: str = "Sheet1", title: Optional[str] = None):
        self.name = title or name
        self.title = title or name
        self.cells: Dict[Tuple[int, int], Cell] = {}

    def set_cell(self, coord: str, val: Any) -> Cell:
        r, c = parse_cell_coord(coord)
        cell = Cell(raw=val)
        self.cells[(r, c)] = cell
        return cell

    def get_cell(self, coord: str) -> Optional[Cell]:
        r, c = parse_cell_coord(coord)
        return self.cells.get((r, c))

    def get_value(self, coord: str) -> Any:
        cell = self.get_cell(coord)
        if cell is None:
            return None
        return cell.computed if cell.computed is not None else cell.raw

    def get_cell_value(self, coord: str) -> Any:
        return self.get_value(coord)

    def get_range(self, start_coord: str, end_coord: str) -> List[List[Any]]:
        r1, c1 = parse_cell_coord(start_coord)
        r2, c2 = parse_cell_coord(end_coord)
        min_r, max_r = min(r1, r2), max(r1, r2)
        min_c, max_c = min(c1, c2), max(c1, c2)

        result = []
        for r in range(min_r, max_r + 1):
            row = []
            for c in range(min_c, max_c + 1):
                cell = self.cells.get((r, c))
                row.append(cell.computed if cell and cell.computed is not None else (cell.raw if cell else None))
            result.append(row)
        return result

    def calculate(self):
        """Evaluate formulas across the sheet with cycle detection."""
        evaluating = set()

        def evaluate_cell(coord_tuple):
            if coord_tuple in evaluating:
                raise ValueError(f"Circular reference detected at {format_cell_coord(*coord_tuple)}")
            cell = self.cells.get(coord_tuple)
            if cell and cell.formula:
                evaluating.add(coord_tuple)
                cell.computed = self._eval_formula(cell.formula, evaluating)
                evaluating.remove(coord_tuple)

        for coord in list(self.cells.keys()):
            evaluate_cell(coord)

    def evaluate_all(self):
        self.calculate()

    def _eval_formula(self, formula: str, evaluating_stack: Optional[set] = None) -> Any:
        f = formula.strip()
        m_func = re.match(r"^([A-Za-z0-9_]+)\((.*)\)$", f)
        if m_func:
            func_name = m_func.group(1).upper()
            arg_str = m_func.group(2).strip()

            # VLOOKUP(val, range, col_idx)
            if func_name == "VLOOKUP":
                args = [a.strip() for a in arg_str.split(",")]
                if len(args) >= 3:
                    lookup_val = self._eval_expr(args[0])
                    rng_parts = args[1].split(":")
                    col_idx = int(self._eval_expr(args[2])) - 1
                    grid = self.get_range(rng_parts[0], rng_parts[1])
                    for row in grid:
                        if row and str(row[0]) == str(lookup_val):
                            return row[col_idx] if col_idx < len(row) else None
                    return None

            # INDEX(range, row_idx, col_idx)
            if func_name == "INDEX":
                args = [a.strip() for a in arg_str.split(",")]
                if len(args) >= 2:
                    rng_parts = args[0].split(":")
                    row_idx = int(self._eval_expr(args[1])) - 1
                    col_idx = int(self._eval_expr(args[2])) - 1 if len(args) >= 3 else 0
                    grid = self.get_range(rng_parts[0], rng_parts[1])
                    if 0 <= row_idx < len(grid) and 0 <= col_idx < len(grid[row_idx]):
                        return grid[row_idx][col_idx]
                    return None

            # String functions
            if func_name == "CONCATENATE":
                args = [str(self._eval_expr(a.strip())) for a in arg_str.split(",")]
                return "".join(args)
            if func_name == "UPPER":
                return str(self._eval_expr(arg_str)).upper()
            if func_name == "LOWER":
                return str(self._eval_expr(arg_str)).lower()
            if func_name == "TRIM":
                return str(self._eval_expr(arg_str)).strip()
            if func_name == "LEN":
                return len(str(self._eval_expr(arg_str)))

            # Math / Stats
            if func_name == "ABS":
                return abs(float(self._eval_expr(arg_str)))
            if func_name == "ROUND":
                args = [a.strip() for a in arg_str.split(",")]
                v = float(self._eval_expr(args[0]))
                digits = int(self._eval_expr(args[1])) if len(args) > 1 else 0
                return round(v, digits)

            # Range argument: e.g. A1:A5
            if ":" in arg_str:
                parts = [p.strip() for p in arg_str.split(":")]
                grid = self.get_range(parts[0], parts[1])
                flat = []
                for row in grid:
                    for v in row:
                        if isinstance(v, (int, float)):
                            flat.append(v)
                        elif isinstance(v, str):
                            try:
                                flat.append(float(v) if "." in v else int(v))
                            except ValueError:
                                pass

                if func_name == "SUM":
                    return sum(flat)
                elif func_name == "AVERAGE":
                    return sum(flat) / len(flat) if flat else 0.0
                elif func_name == "MIN":
                    return min(flat) if flat else 0.0
                elif func_name == "MAX":
                    return max(flat) if flat else 0.0
                elif func_name == "COUNT":
                    return len(flat)
                elif func_name == "STDEV":
                    if len(flat) < 2:
                        return 0.0
                    avg = sum(flat) / len(flat)
                    variance = sum((x - avg) ** 2 for x in flat) / (len(flat) - 1)
                    return variance ** 0.5

            # Simple two-argument IF function: IF(condition, true_val, false_val)
            if func_name == "IF":
                args = [a.strip() for a in arg_str.split(",")]
                if len(args) == 3:
                    cond_val = self._eval_expr(args[0])
                    return self._eval_expr(args[1]) if cond_val else self._eval_expr(args[2])

        # Simple arithmetic expressions e.g. "A1 + B1"
        return self._eval_expr(f, evaluating_stack)

    def _eval_expr(self, expr: str, evaluating_stack: Optional[set] = None) -> Any:
        token = expr.strip()
        # Direct cell coordinate
        if re.match(r"^[A-Za-z]+\d+$", token):
            c_cell = self.get_cell(token)
            if c_cell and c_cell.formula and c_cell.computed is None:
                coord_t = parse_cell_coord(token)
                if evaluating_stack is not None:
                    if coord_t in evaluating_stack:
                        raise ValueError(f"Circular reference detected at {token}")
                    evaluating_stack.add(coord_t)
                c_cell.computed = self._eval_formula(c_cell.formula, evaluating_stack)
                if evaluating_stack is not None and coord_t in evaluating_stack:
                    evaluating_stack.remove(coord_t)
            return self.get_value(token) or 0
        # Direct number
        try:
            if "." in token:
                return float(token)
            return int(token)
        except ValueError:
            pass
        # Basic binary operators
        for op in ("+", "-", "*", "/"):
            if op in token:
                parts = token.split(op, 1)
                left = self._eval_expr(parts[0], evaluating_stack)
                right = self._eval_expr(parts[1], evaluating_stack)
                try:
                    left, right = float(left), float(right)
                    if op == "+": return left + right
                    if op == "-": return left - right
                    if op == "*": return left * right
                    if op == "/": return left / right if right != 0 else 0.0
                except (ValueError, TypeError):
                    pass
        return token.strip('"\'')

    def to_csv(self) -> str:
        if not self.cells:
            return ""
        max_r = max(r for r, c in self.cells.keys())
        max_c = max(c for r, c in self.cells.keys())

        output = io.StringIO()
        writer = csv.writer(output)
        for r in range(max_r + 1):
            row = []
            for c in range(max_c + 1):
                val = self.get_value(format_cell_coord(r, c))
                row.append("" if val is None else str(val))
            writer.writerow(row)
        return output.getvalue()

    @classmethod
    def from_csv(cls, csv_text: str, name: str = "Sheet1") -> "Sheet":
        sheet = cls(name=name)
        reader = csv.reader(io.StringIO(csv_text))
        for r, row in enumerate(reader):
            for c, val in enumerate(row):
                if val:
                    try:
                        parsed: Any = float(val) if "." in val else int(val)
                    except ValueError:
                        parsed = val
                    sheet.set_cell(format_cell_coord(r, c), parsed)
        return sheet


class Workbook:
    """Collection of sheets representing a spreadsheet document."""
    def __init__(self, title: str = "Workbook"):
        self.title = title
        self.sheets: List[Sheet] = [Sheet("Sheet1")]

    def active_sheet(self) -> Sheet:
        return self.sheets[0]

    def add_sheet(self, name: str) -> Sheet:
        s = Sheet(name=name)
        self.sheets.append(s)
        return s

    def calculate_all(self):
        for s in self.sheets:
            s.calculate()


Spreadsheet = Sheet

