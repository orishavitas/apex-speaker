# LDC Conversion Process - Claude Context

This file provides context for any agent working on the conversion of the "Loudspeaker Design Cookbook" (LDC) to Markdown.

## Project Goal
Convert the LDC 7th Edition PDF to high-quality Markdown files, including:
- Full text transcription.
- Math formulas in LaTeX (where possible) or clear text.
- References to extracted images (graphs, diagrams, photos).
- Structured headers and sub-headers matching the book.

## Directory Structure
- `docs/knowledge_base/LDC/`: Root for the LDC KB.
- `docs/knowledge_base/LDC/images/`: Extracted images from the PDF.
- `docs/knowledge_base/LDC/chapter_N_...md`: Individual chapter files.

## Transcription Guidelines
- Maintain the original structure (headings, lists, tables).
- Use `### FIGURE X.Y: Caption` for figure references.
- Link images using `![Figure Caption](images/pX_imgY.png)`.
- Use `---` to separate pages if needed, or just follow the logical flow.
- Ensure math is readable. Use `$...$` for inline and `$$...$$` for block math.

## Current Progress
- Chapter 0: Complete.
- Chapter 1: Images mapped, transcription pending.
- Chapter 2-12: Placeholders/Images mapped, transcription pending.
