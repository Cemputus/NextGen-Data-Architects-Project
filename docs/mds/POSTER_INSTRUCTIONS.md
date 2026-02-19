# Academic Poster Creation Instructions

## Overview
This document provides instructions for creating and converting the academic poster for the NextGen Data Architects project.

## Files Created

1. **academic_poster.html** - The complete academic poster in HTML format
2. **convert_poster_to_pdf.py** - Python script to convert HTML to PDF
3. **POSTER_INSTRUCTIONS.md** - This instruction file

## Poster Sections Included

The poster includes all requested sections:

1. ✅ **Title** - NextGen Data Architects
2. ✅ **Authors** - Placeholder for your name and co-authors
3. ✅ **Affiliations** - Uganda Christian University
4. ✅ **Abstract** - Brief summary of the project
5. ✅ **Introduction** - Including project objectives
6. ✅ **Background of Study** - Context and challenges
7. ✅ **Related Literature Review** - Key references and research gap
8. ✅ **Methodology** - System architecture, implementation methods, reference studies
9. ✅ **Results / Findings** - Key findings with metrics
10. ✅ **Analysis** - Data interpretation, visualizations, model performance
11. ✅ **Conclusion** - Summary, key findings, implications, recommendations
12. ✅ **Contact Info** - Contact details

## Customization Required

Before generating the PDF, please update the following in `academic_poster.html`:

1. **Authors Section:**
   - Replace `[Your Name]` with your actual name
   - Add co-author names
   - Add supervisor name

2. **Contact Information:**
   - Update email address
   - Add project repository URL (if available)
   - Verify institution details

3. **References:**
   - Add any additional references from your PDF document
   - Update citation format if needed

## Converting to PDF

### Method 1: Using WeasyPrint (Recommended)

```bash
# Install WeasyPrint
pip install weasyprint

# Run the conversion script
python convert_poster_to_pdf.py
```

### Method 2: Using Playwright

```bash
# Install Playwright
pip install playwright
playwright install chromium

# Run the conversion script
python convert_poster_to_pdf.py
```

### Method 3: Using pdfkit (Requires wkhtmltopdf)

```bash
# Install pdfkit
pip install pdfkit

# Download and install wkhtmltopdf from:
# https://wkhtmltopdf.org/downloads.html

# Run the conversion script
python convert_poster_to_pdf.py
```

### Method 4: Manual Browser Conversion

1. Open `academic_poster.html` in a web browser (Chrome, Firefox, Edge)
2. Press `Ctrl+P` (Windows) or `Cmd+P` (Mac) to open print dialog
3. Select "Save as PDF" as the destination
4. Choose "A0" or "A1" paper size for poster format
5. Set margins to "None" or "Minimum"
6. Enable "Background graphics"
7. Click "Save"

## Poster Size Recommendations

- **A0**: 841mm × 1189mm (33.1" × 46.8") - Standard academic poster size
- **A1**: 594mm × 841mm (23.4" × 33.1") - Smaller alternative
- **Custom**: Adjust CSS in HTML if needed

## Printing Tips

1. **Print Quality:** Use high-resolution (300 DPI minimum) for best results
2. **Color:** Ensure color printing is enabled for UCU branding colors
3. **Paper:** Use high-quality poster paper or photo paper
4. **Preview:** Always preview the PDF before printing to check layout

## Adding Visualizations

The poster includes placeholder boxes for visualizations. To add actual charts:

1. Generate charts from your system (screenshots or exported images)
2. Replace the placeholder divs with `<img>` tags:
   ```html
   <img src="chart_student_distribution.png" alt="Student Distribution" style="width: 100%; height: auto;">
   ```

## UCU Branding Colors

The poster uses UCU branding colors:
- **Primary Blue:** #003366
- **Navy:** #1a237e
- **Gold:** #FFD700

These are already applied in the CSS styling.

## Troubleshooting

### PDF conversion fails
- Ensure you have installed at least one PDF library (WeasyPrint, Playwright, or pdfkit)
- Check that the HTML file is valid and can be opened in a browser
- Try a different conversion method

### Layout issues
- Adjust CSS padding and margins in the `<style>` section
- Modify font sizes if text is too large/small
- Check print preview before final conversion

### Missing content
- Verify all sections are filled in
- Check that references are complete
- Ensure contact information is accurate

## Next Steps

1. Customize author and contact information
2. Add actual chart images if available
3. Review and edit content as needed
4. Convert to PDF using one of the methods above
5. Print or share the final poster

## Support

For issues or questions:
- Check the Python script error messages
- Verify all dependencies are installed correctly
- Test HTML file in a browser first before PDF conversion

