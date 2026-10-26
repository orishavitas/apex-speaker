# LDC Conversion Process - Agent Roles

Any AI agent assisting with this task should follow these guidelines to ensure consistency.

## Roles
- **Transcriber**: Responsible for OCR and text formatting.
- **Image Linker**: Ensures all figures are correctly referenced and linked to files in `images/`.
- **Verifier**: Cross-checks the transcription against the PDF images for accuracy.

## Workflow
1. Identify the next pending chapter/page in `TODO.md`.
2. Perform transcription and image linking.
3. Save the results to the appropriate `chapter_...md` file.
4. Update `VERIFY.md` for the completed section.
5. Update `TODO.md` status.
