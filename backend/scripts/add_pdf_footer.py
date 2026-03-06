"""
Add a centered footer text on every page of a PDF.

Usage:
  python backend/scripts/add_pdf_footer.py <input_pdf> <output_pdf> "Footer Text"
"""

import sys

import fitz  # PyMuPDF


def main():
    if len(sys.argv) < 4:
        print('Usage: python backend/scripts/add_pdf_footer.py <input_pdf> <output_pdf> "Footer Text"')
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    footer_text = sys.argv[3]

    doc = fitz.open(input_pdf)

    for page in doc:
        rect = page.rect
        footer_y = rect.height - 18
        page.insert_textbox(
            fitz.Rect(24, footer_y - 8, rect.width - 24, footer_y + 8),
            footer_text,
            fontsize=9,
            fontname="helv",
            color=(0, 0, 0),
            align=1,  # center
        )

    if output_pdf == input_pdf:
        doc.saveIncr()
    else:
        doc.save(output_pdf)
    doc.close()

    print(f"Updated PDF footer: {output_pdf}")


if __name__ == "__main__":
    main()

