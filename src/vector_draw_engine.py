"""SigmaOS-office Vector Draw Engine (Draw / VectorCraft / LibreOffice Draw inspired).

Provides vector shapes (Rect, Ellipse, Line, Path, Polygon, BezierCurve, TextShape, GroupShape),
canvas geometry, stroke/fill styling, transformation matrices, diagram connectors, and SVG export.

Principles: Encapsulation, Composition over Inheritance, Clear Abstraction, Deterministic Testing.
"""

from typing import List, Dict, Any, Optional, Tuple
import math
import json


class StrokeStyle:
    def __init__(self, color: str = "#000000", width: float = 1.0, dash_array: Optional[str] = None):
        self.color = color
        self.width = width
        self.dash_array = dash_array

    def to_dict(self) -> Dict[str, Any]:
        return {"color": self.color, "width": self.width, "dash_array": self.dash_array}

    def to_svg_attrs(self) -> str:
        attrs = [f'stroke="{self.color}"', f'stroke-width="{self.width}"']
        if self.dash_array:
            attrs.append(f'stroke-dasharray="{self.dash_array}"')
        return " ".join(attrs)


class FillStyle:
    def __init__(self, color: str = "#CCCCCC", opacity: float = 1.0):
        self.color = color
        self.opacity = opacity

    def to_dict(self) -> Dict[str, Any]:
        return {"color": self.color, "opacity": self.opacity}

    def to_svg_attrs(self) -> str:
        if self.color.lower() in ("none", "transparent"):
            return 'fill="none"'
        attrs = [f'fill="{self.color}"']
        if self.opacity < 1.0:
            attrs.append(f'fill-opacity="{self.opacity}"')
        return " ".join(attrs)


class Transform:
    """2D Affine Transformation (translate, rotate, scale)."""
    def __init__(self, tx: float = 0.0, ty: float = 0.0, rotate_deg: float = 0.0,
                 sx: float = 1.0, sy: float = 1.0):
        self.tx = tx
        self.ty = ty
        self.rotate_deg = rotate_deg
        self.sx = sx
        self.sy = sy

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tx": self.tx, "ty": self.ty,
            "rotate_deg": self.rotate_deg,
            "sx": self.sx, "sy": self.sy,
        }

    def to_svg_attr(self) -> str:
        parts = []
        if self.tx != 0.0 or self.ty != 0.0:
            parts.append(f"translate({self.tx},{self.ty})")
        if self.rotate_deg != 0.0:
            parts.append(f"rotate({self.rotate_deg})")
        if self.sx != 1.0 or self.sy != 1.0:
            parts.append(f"scale({self.sx},{self.sy})")
        return " ".join(parts)


class Shape:
    """Base vector shape class."""
    def __init__(self, shape_id: str, stroke: Optional[StrokeStyle] = None,
                 fill: Optional[FillStyle] = None, transform: Optional[Transform] = None):
        self.shape_id = shape_id
        self.stroke = stroke or StrokeStyle()
        self.fill = fill or FillStyle()
        self.transform = transform or Transform()

    def bounding_box(self) -> Tuple[float, float, float, float]:
        """Returns (min_x, min_y, width, height)."""
        raise NotImplementedError

    def to_dict(self) -> Dict[str, Any]:
        raise NotImplementedError

    def to_svg(self) -> str:
        raise NotImplementedError


class Rectangle(Shape):
    def __init__(self, shape_id: str, x: float, y: float, width: float, height: float,
                 rx: float = 0.0, ry: float = 0.0,
                 stroke: Optional[StrokeStyle] = None, fill: Optional[FillStyle] = None,
                 transform: Optional[Transform] = None):
        super().__init__(shape_id, stroke, fill, transform)
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.rx = rx
        self.ry = ry

    def bounding_box(self) -> Tuple[float, float, float, float]:
        return (self.x + self.transform.tx, self.y + self.transform.ty, self.width * self.transform.sx, self.height * self.transform.sy)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "rectangle",
            "id": self.shape_id,
            "x": self.x, "y": self.y, "width": self.width, "height": self.height,
            "rx": self.rx, "ry": self.ry,
            "stroke": self.stroke.to_dict(),
            "fill": self.fill.to_dict(),
            "transform": self.transform.to_dict(),
        }

    def to_svg(self) -> str:
        tf = f' transform="{self.transform.to_svg_attr()}"' if self.transform.to_svg_attr() else ""
        corner = f' rx="{self.rx}" ry="{self.ry}"' if (self.rx > 0 or self.ry > 0) else ""
        return f'<rect id="{self.shape_id}" x="{self.x}" y="{self.y}" width="{self.width}" height="{self.height}"{corner} {self.stroke.to_svg_attrs()} {self.fill.to_svg_attrs()}{tf} />'


class Ellipse(Shape):
    def __init__(self, shape_id: str, cx: float, cy: float, rx: float, ry: float,
                 stroke: Optional[StrokeStyle] = None, fill: Optional[FillStyle] = None,
                 transform: Optional[Transform] = None):
        super().__init__(shape_id, stroke, fill, transform)
        self.cx = cx
        self.cy = cy
        self.rx = rx
        self.ry = ry

    def bounding_box(self) -> Tuple[float, float, float, float]:
        return (self.cx - self.rx + self.transform.tx, self.cy - self.ry + self.transform.ty,
                self.rx * 2 * self.transform.sx, self.ry * 2 * self.transform.sy)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "ellipse",
            "id": self.shape_id,
            "cx": self.cx, "cy": self.cy, "rx": self.rx, "ry": self.ry,
            "stroke": self.stroke.to_dict(),
            "fill": self.fill.to_dict(),
            "transform": self.transform.to_dict(),
        }

    def to_svg(self) -> str:
        tf = f' transform="{self.transform.to_svg_attr()}"' if self.transform.to_svg_attr() else ""
        return f'<ellipse id="{self.shape_id}" cx="{self.cx}" cy="{self.cy}" rx="{self.rx}" ry="{self.ry}" {self.stroke.to_svg_attrs()} {self.fill.to_svg_attrs()}{tf} />'


class Line(Shape):
    def __init__(self, shape_id: str, x1: float, y1: float, x2: float, y2: float,
                 stroke: Optional[StrokeStyle] = None, transform: Optional[Transform] = None):
        super().__init__(shape_id, stroke, FillStyle("none"), transform)
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2

    def bounding_box(self) -> Tuple[float, float, float, float]:
        min_x = min(self.x1, self.x2) + self.transform.tx
        min_y = min(self.y1, self.y2) + self.transform.ty
        return (min_x, min_y, abs(self.x2 - self.x1) * self.transform.sx, abs(self.y2 - self.y1) * self.transform.sy)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "line",
            "id": self.shape_id,
            "x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2,
            "stroke": self.stroke.to_dict(),
            "transform": self.transform.to_dict(),
        }

    def to_svg(self) -> str:
        tf = f' transform="{self.transform.to_svg_attr()}"' if self.transform.to_svg_attr() else ""
        return f'<line id="{self.shape_id}" x1="{self.x1}" y1="{self.y1}" x2="{self.x2}" y2="{self.y2}" {self.stroke.to_svg_attrs()}{tf} />'


class Connector(Shape):
    """Diagram connector line linking two shape anchors."""
    def __init__(self, shape_id: str, start_point: Tuple[float, float], end_point: Tuple[float, float],
                 routing: str = "orthogonal", stroke: Optional[StrokeStyle] = None):
        super().__init__(shape_id, stroke, FillStyle("none"), Transform())
        self.start_point = start_point
        self.end_point = end_point
        self.routing = routing  # 'straight', 'orthogonal', 'curved'

    def points(self) -> List[Tuple[float, float]]:
        if self.routing == "straight":
            return [self.start_point, self.end_point]
        elif self.routing == "orthogonal":
            mid_x = (self.start_point[0] + self.end_point[0]) / 2.0
            return [
                self.start_point,
                (mid_x, self.start_point[1]),
                (mid_x, self.end_point[1]),
                self.end_point,
            ]
        else:
            return [self.start_point, self.end_point]

    def bounding_box(self) -> Tuple[float, float, float, float]:
        pts = self.points()
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "connector",
            "id": self.shape_id,
            "start": self.start_point,
            "end": self.end_point,
            "routing": self.routing,
            "stroke": self.stroke.to_dict(),
        }

    def to_svg(self) -> str:
        pts = self.points()
        if len(pts) == 2:
            return f'<line id="{self.shape_id}" x1="{pts[0][0]}" y1="{pts[0][1]}" x2="{pts[1][0]}" y2="{pts[1][1]}" {self.stroke.to_svg_attrs()} marker-end="url(#arrow)" />'
        d = f"M {pts[0][0]} {pts[0][1]} " + " ".join(f"L {x} {y}" for x, y in pts[1:])
        return f'<path id="{self.shape_id}" d="{d}" {self.stroke.to_svg_attrs()} fill="none" marker-end="url(#arrow)" />'


class TextShape(Shape):
    def __init__(self, shape_id: str, text: str, x: float, y: float,
                 font_family: str = "DejaVu Sans", font_size: float = 14.0,
                 fill: Optional[FillStyle] = None, transform: Optional[Transform] = None):
        super().__init__(shape_id, StrokeStyle("none", 0), fill or FillStyle("#000000"), transform)
        self.text = text
        self.x = x
        self.y = y
        self.font_family = font_family
        self.font_size = font_size

    def bounding_box(self) -> Tuple[float, float, float, float]:
        est_width = len(self.text) * self.font_size * 0.6
        return (self.x + self.transform.tx, self.y - self.font_size + self.transform.ty,
                est_width * self.transform.sx, self.font_size * self.transform.sy)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "text",
            "id": self.shape_id,
            "text": self.text,
            "x": self.x, "y": self.y,
            "font_family": self.font_family,
            "font_size": self.font_size,
            "fill": self.fill.to_dict(),
            "transform": self.transform.to_dict(),
        }

    def to_svg(self) -> str:
        tf = f' transform="{self.transform.to_svg_attr()}"' if self.transform.to_svg_attr() else ""
        return f'<text id="{self.shape_id}" x="{self.x}" y="{self.y}" font-family="{self.font_family}" font-size="{self.font_size}" {self.fill.to_svg_attrs()}{tf}>{self.text}</text>'


class BezierCurve(Shape):
    """Cubic Bezier curve: start point (x1, y1), control point 1 (cx1, cy1), control point 2 (cx2, cy2), end point (x2, y2)."""
    def __init__(self, shape_id: str, x1: float, y1: float, cx1: float, cy1: float,
                 cx2: float, cy2: float, x2: float, y2: float,
                 stroke: Optional[StrokeStyle] = None, transform: Optional[Transform] = None):
        super().__init__(shape_id, stroke, FillStyle("none"), transform)
        self.x1, self.y1 = x1, y1
        self.cx1, self.cy1 = cx1, cy1
        self.cx2, self.cy2 = cx2, cy2
        self.x2, self.y2 = x2, y2

    def sample_point(self, t: float) -> Tuple[float, float]:
        """Compute point on cubic Bezier curve at parameter t in [0, 1]."""
        u = 1.0 - t
        tt = t * t
        uu = u * u
        uuu = uu * u
        ttt = tt * t
        x = uuu * self.x1 + 3 * uu * t * self.cx1 + 3 * u * tt * self.cx2 + ttt * self.x2
        y = uuu * self.y1 + 3 * uu * t * self.cy1 + 3 * u * tt * self.cy2 + ttt * self.y2
        return (x, y)

    def bounding_box(self) -> Tuple[float, float, float, float]:
        xs = [self.x1, self.cx1, self.cx2, self.x2]
        ys = [self.y1, self.cy1, self.cy2, self.y2]
        min_x, max_x = min(xs) + self.transform.tx, max(xs) + self.transform.tx
        min_y, max_y = min(ys) + self.transform.ty, max(ys) + self.transform.ty
        return (min_x, min_y, (max_x - min_x) * self.transform.sx, (max_y - min_y) * self.transform.sy)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "bezier",
            "id": self.shape_id,
            "x1": self.x1, "y1": self.y1,
            "cx1": self.cx1, "cy1": self.cy1,
            "cx2": self.cx2, "cy2": self.cy2,
            "x2": self.x2, "y2": self.y2,
            "stroke": self.stroke.to_dict(),
            "transform": self.transform.to_dict(),
        }

    def to_svg(self) -> str:
        tf = f' transform="{self.transform.to_svg_attr()}"' if self.transform.to_svg_attr() else ""
        d = f"M {self.x1} {self.y1} C {self.cx1} {self.cy1}, {self.cx2} {self.cy2}, {self.x2} {self.y2}"
        return f'<path id="{self.shape_id}" d="{d}" {self.stroke.to_svg_attrs()} fill="none"{tf} />'


class Polygon(Shape):
    """Closed polygon specified by a sequence of (x, y) vertices."""
    def __init__(self, shape_id: str, points: List[Tuple[float, float]],
                 stroke: Optional[StrokeStyle] = None, fill: Optional[FillStyle] = None,
                 transform: Optional[Transform] = None):
        super().__init__(shape_id, stroke, fill, transform)
        self.points = points

    def bounding_box(self) -> Tuple[float, float, float, float]:
        if not self.points:
            return (0.0, 0.0, 0.0, 0.0)
        xs = [p[0] for p in self.points]
        ys = [p[1] for p in self.points]
        min_x, max_x = min(xs) + self.transform.tx, max(xs) + self.transform.tx
        min_y, max_y = min(ys) + self.transform.ty, max(ys) + self.transform.ty
        return (min_x, min_y, (max_x - min_x) * self.transform.sx, (max_y - min_y) * self.transform.sy)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "polygon",
            "id": self.shape_id,
            "points": self.points,
            "stroke": self.stroke.to_dict(),
            "fill": self.fill.to_dict(),
            "transform": self.transform.to_dict(),
        }

    def to_svg(self) -> str:
        tf = f' transform="{self.transform.to_svg_attr()}"' if self.transform.to_svg_attr() else ""
        pts_str = " ".join(f"{x},{y}" for x, y in self.points)
        return f'<polygon id="{self.shape_id}" points="{pts_str}" {self.stroke.to_svg_attrs()} {self.fill.to_svg_attrs()}{tf} />'



class DrawingCanvas:
    """A vector drawing canvas (SVG compatible)."""
    def __init__(self, width: float = 800.0, height: float = 600.0, title: str = "Drawing"):
        self.width = width
        self.height = height
        self.title = title
        self.shapes: List[Shape] = []

    def add_shape(self, shape: Shape) -> None:
        self.shapes.append(shape)

    def get_shape(self, shape_id: str) -> Optional[Shape]:
        for s in self.shapes:
            if s.shape_id == shape_id:
                return s
        return None

    def remove_shape(self, shape_id: str) -> bool:
        initial_len = len(self.shapes)
        self.shapes = [s for s in self.shapes if s.shape_id != shape_id]
        return len(self.shapes) < initial_len

    def to_svg(self) -> str:
        lines = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" width="{self.width}" height="{self.height}">',
            f'  <title>{self.title}</title>',
            '  <defs>',
            '    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
            '      <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />',
            '    </marker>',
            '  </defs>',
        ]
        for s in self.shapes:
            lines.append(f"  {s.to_svg()}")
        lines.append("</svg>")
        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "title": self.title,
            "shapes": [s.to_dict() for s in self.shapes],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DrawingCanvas":
        canvas = cls(width=data.get("width", 800.0), height=data.get("height", 600.0), title=data.get("title", "Drawing"))
        for sd in data.get("shapes", []):
            st = sd.get("type")
            sid = sd.get("id", "shape")
            stroke_d = sd.get("stroke", {})
            stroke = StrokeStyle(stroke_d.get("color", "#000"), stroke_d.get("width", 1.0), stroke_d.get("dash_array"))
            fill_d = sd.get("fill", {})
            fill = FillStyle(fill_d.get("color", "#CCC"), fill_d.get("opacity", 1.0))
            tf_d = sd.get("transform", {})
            tf = Transform(tf_d.get("tx", 0.0), tf_d.get("ty", 0.0), tf_d.get("rotate_deg", 0.0), tf_d.get("sx", 1.0), tf_d.get("sy", 1.0))

            if st == "rectangle":
                canvas.add_shape(Rectangle(sid, sd["x"], sd["y"], sd["width"], sd["height"], sd.get("rx", 0.0), sd.get("ry", 0.0), stroke, fill, tf))
            elif st == "ellipse":
                canvas.add_shape(Ellipse(sid, sd["cx"], sd["cy"], sd["rx"], sd["ry"], stroke, fill, tf))
            elif st == "line":
                canvas.add_shape(Line(sid, sd["x1"], sd["y1"], sd["x2"], sd["y2"], stroke, tf))
            elif st == "connector":
                canvas.add_shape(Connector(sid, tuple(sd["start"]), tuple(sd["end"]), sd.get("routing", "orthogonal"), stroke))
            elif st == "text":
                canvas.add_shape(TextShape(sid, sd["text"], sd["x"], sd["y"], sd.get("font_family", "DejaVu Sans"), sd.get("font_size", 14.0), fill, tf))
            elif st == "bezier":
                canvas.add_shape(BezierCurve(sid, sd["x1"], sd["y1"], sd["cx1"], sd["cy1"], sd["cx2"], sd["cy2"], sd["x2"], sd["y2"], stroke, tf))
            elif st == "polygon":
                canvas.add_shape(Polygon(sid, [tuple(p) for p in sd.get("points", [])], stroke, fill, tf))
        return canvas
