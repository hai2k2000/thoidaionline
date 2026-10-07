# Weekly report DOCX visual fixtures

Run `node --experimental-strip-types scripts/fixtures/personal-weekly-report-docx.mjs` to create short, normal, and long completed-report fixtures under `artifacts/personal-weekly-report-docx/`.

Render each fixture with the repository DOCX renderer or Word/Poppler fallback and inspect every page for:

- Vietnamese Unicode glyphs and Times New Roman rendering
- two-column administrative header and centered title
- Sections I-IV and list indentation
- natural page breaks without clipping or overlap
- footer text and page number
- signature placement

Generated DOCX/PDF/PNG outputs are intentionally ignored by Git.
