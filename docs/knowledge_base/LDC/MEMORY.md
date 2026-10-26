# LDC Conversion - Memory

This file stores long-term insights and recurring patterns discovered during the conversion.

## Image Mapping Patterns
- PDF page numbers usually differ from printed page numbers by some offset.
- `images/page_X.png` refers to the full page image.
- `images/pX_imgY.jpeg` refers to a specific figure extracted from page X.

## Formatting Conventions
- Symbols: Use $Bl$ for motor strength, $Q_{ts}$ for total Q, $V_{as}$ for compliance volume.
- Subscripts: Always use LaTeX style `_{...}` for clarity.
- Headings: Use `#`, `##`, `###` to match the book's hierarchy.
