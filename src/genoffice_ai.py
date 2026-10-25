"""SigmaOS-office GenOffice AI Engine (GenOffice / AI Copilot / Office Assistant inspired).

Provides deterministic prompt-to-document synthesis, prompt-to-presentation synthesis,
document summarization, grammar & readability analysis, and template variable expansion.

Principles: Pure Functions, Deterministic Testing, Clear Abstraction, Single Responsibility.
"""

from typing import List, Dict, Any, Optional
import re
import math

from document_engine import Document, Paragraph, TextRun, Table, TableCell, CharacterStyle
from presentation_engine import SlideDeck, Slide, TextElement


class GenOfficeAI:
    """Intelligent document generation and analysis assistant."""

    @staticmethod
    def generate_document_from_prompt(topic: str, sections: Optional[List[str]] = None,
                                      author: str = "SigmaOS AI") -> Document:
        """Deterministically synthesizes a structured Document AST from a topic and section outline."""
        doc = Document(title=topic, author=author)

        # Title paragraph
        p_title = Paragraph(alignment="center", heading_level=1)
        p_title.runs.append(TextRun(topic, CharacterStyle(bold=True, font_size=22.0)))
        doc.add_element(p_title)

        # Subtitle / metadata
        p_meta = Paragraph(alignment="center")
        p_meta.runs.append(TextRun(f"Prepared by: {author} | SigmaOS GenOffice Synthesis",
                                   CharacterStyle(italic=True, font_size=10.0, color="#666666")))
        doc.add_element(p_meta)

        outline = sections or ["Executive Summary", "System Architecture & Principles", "Implementation Roadmap", "Conclusion"]

        for idx, sec_title in enumerate(outline, 1):
            p_head = Paragraph(heading_level=2)
            p_head.runs.append(TextRun(f"{idx}. {sec_title}", CharacterStyle(bold=True, font_size=14.0)))
            doc.add_element(p_head)

            p_body = Paragraph()
            p_body.runs.append(TextRun(f"This section details the critical aspects of {sec_title.lower()} within the context of {topic}. It adheres strictly to high-cohesion, low-coupling design principles and zero-loss specifications."))
            doc.add_element(p_body)

            if "roadmap" in sec_title.lower() or "architecture" in sec_title.lower():
                # Add a structured table
                tbl = Table()
                tbl.add_row(["Phase / Component", "Objective", "Target Deliverable", "Status"])
                tbl.add_row(["Foundation", "Establish clean interfaces and core data models", "AST Engine", "Completed"])
                tbl.add_row(["Integration", "Verify multi-format interoperability", "ODF/OOXML Bridge", "Active"])
                tbl.add_row(["Optimization", "Memory safety and cache-conscious execution", "Native Assembly", "Scheduled"])
                doc.add_element(tbl)
            else:
                p_bullet1 = Paragraph(bullet=True)
                p_bullet1.runs.append(TextRun(f"Key insight A for {sec_title}: Rigorous enforcement of architectural standards."))
                p_bullet2 = Paragraph(bullet=True)
                p_bullet2.runs.append(TextRun(f"Key insight B for {sec_title}: Deterministic testing with verifiable outputs."))
                doc.add_element(p_bullet1)
                doc.add_element(p_bullet2)

        return doc

    @staticmethod
    def generate_presentation_from_prompt(topic: str, slide_count: int = 4,
                                          presenter: str = "SigmaOS AI") -> SlideDeck:
        """Deterministically synthesizes a SlideDeck AST from a topic prompt."""
        deck = SlideDeck(title=topic, author=presenter)

        # 1. Title Slide
        title_slide = Slide(title=topic, layout="title")
        title_slide.add_element(TextElement(topic, x=80, y=200, width=800, height=80, font_size=36.0, bold=True, color="#1B5E20"))
        title_slide.add_element(TextElement(f"Presented by {presenter} | SigmaOS Productivity Suite", x=80, y=300, width=800, height=40, font_size=18.0, color="#555555"))
        title_slide.notes = f"Welcome everyone. Today we are presenting {topic}."
        deck.add_slide(title_slide)

        # 2. Agenda / Overview Slide
        agenda_slide = Slide(title=f"Agenda: {topic}", layout="content")
        agenda_slide.add_element(TextElement("Key Themes & Roadmap", x=50, y=40, font_size=26.0, bold=True))
        agenda_slide.add_element(TextElement("• Architectural Abstractions & Data Models\n• Interoperability & Cross-Platform Parity\n• Operational Transform & Real-Time Sync\n• Next Generation Automation",
                                             x=60, y=120, font_size=20.0))
        agenda_slide.notes = "Highlight the 4 key stages of this presentation."
        deck.add_slide(agenda_slide)

        # 3. Deep Dive Slide
        deep_slide = Slide(title="Core Innovations", layout="content")
        deep_slide.add_element(TextElement("Core Innovations & Performance", x=50, y=40, font_size=26.0, bold=True))
        deep_slide.add_element(TextElement("• Native zero-copy memory buffers\n• Modular sub-engines (Writer, Calc, Impress, Draw, Math, Base)\n• Offline-first AI synthesis and automated refactoring",
                                           x=60, y=120, font_size=20.0))
        deck.add_slide(deep_slide)

        # 4. Summary / Conclusion Slide
        sum_slide = Slide(title="Summary & Next Steps", layout="conclusion")
        sum_slide.add_element(TextElement("Conclusion & Deliverables", x=50, y=40, font_size=26.0, bold=True))
        sum_slide.add_element(TextElement("• All components validated via deterministic unit testing.\n• Full parity with OpenOffice, LibreOffice, and OnlyOffice formats.\n• Ready for deployment across the SigmaOS ecosystem.",
                                          x=60, y=120, font_size=20.0))
        deck.add_slide(sum_slide)

        return deck

    @staticmethod
    def summarize_text(text: str, max_sentences: int = 3) -> Dict[str, Any]:
        """Extracts executive summary and key takeaways from document text."""
        raw_sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 10]

        total_words = len(text.split())
        est_reading_time_mins = max(1, math.ceil(total_words / 200.0))

        summary_sentences = sentences[:max_sentences]
        summary = " ".join(summary_sentences)

        return {
            "summary": summary,
            "key_takeaways": summary_sentences,
            "total_sentences": len(sentences),
            "total_words": total_words,
            "reading_time_minutes": est_reading_time_mins,
        }

    @staticmethod
    def review_style_and_grammar(text: str) -> Dict[str, Any]:
        """Analyzes text for passive voice, sentence complexity, and readability."""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
        words = text.split()

        # Passive voice patterns (is/are/was/were/been/be + past participle ending in 'ed')
        passive_matches = re.findall(r"\b(is|are|was|were|been|be|being)\s+([a-z]+ed)\b", text, flags=re.IGNORECASE)

        # Long sentence warnings (> 30 words)
        long_sentences = [s for s in sentences if len(s.split()) > 30]

        # Flesch-Kincaid Grade Level approximation
        num_sentences = max(1, len(sentences))
        num_words = max(1, len(words))
        # Syllables estimation
        syllables = sum(max(1, len(re.findall(r"[aeiouy]+", w.lower()))) for w in words)
        flesch_kincaid_grade = 0.39 * (num_words / num_sentences) + 11.8 * (syllables / num_words) - 15.59
        grade_level = round(max(1.0, flesch_kincaid_grade), 1)

        suggestions = []
        if passive_matches:
            suggestions.append(f"Detected {len(passive_matches)} potential passive voice instances. Consider active phrasing.")
        if long_sentences:
            suggestions.append(f"{len(long_sentences)} sentence(s) exceed 30 words. Consider breaking them up for clarity.")

        return {
            "total_words": num_words,
            "total_sentences": num_sentences,
            "reading_grade_level": grade_level,
            "passive_voice_count": len(passive_matches),
            "long_sentences_count": len(long_sentences),
            "suggestions": suggestions,
        }

    @staticmethod
    def expand_template(template_str: str, context: Dict[str, Any]) -> str:
        """Expands template variables {{key}}, loops {{#each list}}...{{/each}}, and conditionals {{#if cond}}...{{/if}}."""
        output = template_str

        # Conditionals: {{#if key}}...{{/if}}
        def replace_if(m):
            key = m.group(1).strip()
            body = m.group(2)
            val = context.get(key)
            return body if val else ""

        output = re.sub(r"\{\{#if\s+([a-zA-Z0-9_]+)\}\}(.*?)\{\{/if\}\}", replace_if, output, flags=re.DOTALL)

        # Loops: {{#each key}}...{{/each}}
        def replace_each(m):
            key = m.group(1).strip()
            body = m.group(2)
            items = context.get(key, [])
            rendered = []
            for item in items:
                item_rendered = body
                if isinstance(item, dict):
                    for ik, iv in item.items():
                        item_rendered = item_rendered.replace(f"{{{{{ik}}}}}", str(iv))
                else:
                    item_rendered = item_rendered.replace("{{this}}", str(item))
                rendered.append(item_rendered)
            return "".join(rendered)

        output = re.sub(r"\{\{#each\s+([a-zA-Z0-9_]+)\}\}(.*?)\{\{/each\}\}", replace_each, output, flags=re.DOTALL)

        # Simple variables: {{key}}
        for k, v in context.items():
            if not isinstance(v, (list, dict)):
                output = output.replace(f"{{{{{k}}}}}", str(v))

        return output
