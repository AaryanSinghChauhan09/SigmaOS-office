"""SigmaOS-office Presentation Engine (Impress / DeckCraft / OnlyOffice Presentation inspired).

Provides slide decks, structured layouts, shapes, transition specifications, speaker notes,
and bidirectional conversion between presentation AST and structured Markdown.

Principles: Composition over Inheritance, Encapsulation, Single Responsibility.
"""

from typing import List, Dict, Any, Optional
import json


class SlideElement:
    """Base visual element placed on a slide."""
    def __init__(self, elem_type: str, x: float = 0.0, y: float = 0.0,
                 width: float = 100.0, height: float = 50.0):
        self.elem_type = elem_type
        self.x = x
        self.y = y
        self.width = width
        self.height = height

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.elem_type,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }


class TextElement(SlideElement):
    def __init__(self, text: str, x: float = 50.0, y: float = 50.0,
                 width: float = 800.0, height: float = 60.0,
                 font_size: float = 24.0, bold: bool = False, color: str = "#FFFFFF"):
        super().__init__("text", x, y, width, height)
        self.text = text
        self.font_size = font_size
        self.bold = bold
        self.color = color

    def to_dict(self) -> Dict[str, Any]:
        d = super().to_dict()
        d.update({
            "text": self.text,
            "font_size": self.font_size,
            "bold": self.bold,
            "color": self.color,
        })
        return d


class Slide:
    """A single presentation slide with elements, background, notes, and transition."""
    def __init__(self, title: str = "", layout: str = "title_content"):
        self.title = title
        self.layout = layout
        self.elements: List[SlideElement] = []
        self.speaker_notes: str = ""
        self.transition: str = "fade"  # "none", "fade", "push", "wipe"
        self.background_color: str = "#1E1E2E"

        if title:
            self.elements.append(TextElement(text=title, x=50.0, y=40.0, font_size=36.0, bold=True))

    @property
    def notes(self) -> str:
        return self.speaker_notes

    @notes.setter
    def notes(self, value: str):
        self.speaker_notes = value

    def add_element(self, element: SlideElement):
        self.elements.append(element)

    def add_bullet_point(self, text: str, font_size: float = 20.0):
        y_offset = 120.0 + len(self.elements) * 35.0
        self.elements.append(TextElement(text=f"• {text}", x=80.0, y=y_offset, font_size=font_size))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "layout": self.layout,
            "transition": self.transition,
            "background_color": self.background_color,
            "speaker_notes": self.speaker_notes,
            "elements": [e.to_dict() for e in self.elements],
        }


class Presentation:
    """Slide deck presentation containing slides and global theme."""
    def __init__(self, title: str = "Untitled Presentation", author: str = ""):
        self.title = title
        self.author = author
        self.slides: List[Slide] = []
        self.theme: str = "catppuccin-mocha"

    def add_slide(self, slide_or_title: Any = "", layout: str = "title_content", title: Optional[str] = None) -> Slide:
        effective_title = title if title is not None else slide_or_title
        if isinstance(effective_title, Slide):
            self.slides.append(effective_title)
            return effective_title
        slide = Slide(title=str(effective_title), layout=layout)
        self.slides.append(slide)
        return slide

    def to_markdown(self) -> str:
        lines = [f"# {self.title}\n"]
        for i, s in enumerate(self.slides):
            lines.append(f"---\n## {s.title or f'Slide {i+1}'}\n")
            for e in s.elements:
                if isinstance(e, TextElement) and e.text != s.title:
                    lines.append(f"{e.text}\n")
            if s.speaker_notes:
                lines.append(f"\n<!-- Notes: {s.speaker_notes} -->\n")
        return "\n".join(lines)

    @classmethod
    def from_markdown(cls, md_text: str) -> "Presentation":
        lines = md_text.splitlines()
        title = "Presentation"
        if lines and lines[0].startswith("# "):
            title = lines[0][2:].strip()

        pres = cls(title=title)
        current_slide: Optional[Slide] = None

        for line in lines[1:]:
            line_str = line.strip()
            if line_str == "---":
                current_slide = None
            elif line_str.startswith("## "):
                slide_title = line_str[3:].strip()
                current_slide = pres.add_slide(title=slide_title)
            elif line_str.startswith("<!-- Notes:"):
                notes = line_str.replace("<!-- Notes:", "").replace("-->", "").strip()
                if current_slide:
                    current_slide.speaker_notes = notes
            elif line_str and current_slide:
                clean_text = line_str.lstrip("•*- ").strip()
                current_slide.add_bullet_point(clean_text)

        if not pres.slides:
            pres.add_slide("Overview")
        return pres

    def to_json(self) -> str:
        return json.dumps({
            "title": self.title,
            "author": self.author,
            "theme": self.theme,
            "slide_count": len(self.slides),
            "slides": [s.to_dict() for s in self.slides],
        }, indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "Presentation":
        data = json.loads(json_str)
        pres = cls(title=data.get("title", "Presentation"), author=data.get("author", ""))
        pres.theme = data.get("theme", "catppuccin-mocha")
        for s_data in data.get("slides", []):
            s = Slide(title="", layout=s_data.get("layout", "title_content"))
            s.title = s_data.get("title", "")
            s.speaker_notes = s_data.get("speaker_notes", "")
            s.transition = s_data.get("transition", "fade")
            s.background_color = s_data.get("background_color", "#1E1E2E")
            s.elements = []
            for ed in s_data.get("elements", []):
                if ed.get("type") == "text":
                    s.elements.append(TextElement(text=ed.get("text", ""), x=ed.get("x", 0), y=ed.get("y", 0), width=ed.get("width", 100), height=ed.get("height", 50), font_size=ed.get("font_size", 24), bold=ed.get("bold", False), color=ed.get("color", "#FFFFFF")))
                else:
                    s.elements.append(SlideElement(ed.get("type", "generic"), ed.get("x", 0), ed.get("y", 0), ed.get("width", 100), ed.get("height", 50)))
            pres.slides.append(s)
        return pres


SlideDeck = Presentation

