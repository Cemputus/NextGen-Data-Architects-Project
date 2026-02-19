"""
PDF Report Generator for Dashboard Data
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import requests
import json

class PDFReportGenerator:
    def __init__(self, api_base_url='http://localhost:5000', token=None):
        self.api_base_url = api_base_url
        self.token = token
    
    def generate_report(self, output_path=None):
        """Generate comprehensive PDF report"""
        if output_path is None:
            from pathlib import Path
            output_path = Path('reports') / f'nextgen_analytics_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
            Path(output_path).parent.mkdir(exist_ok=True)
        
        doc = SimpleDocTemplate(str(output_path), pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        story.append(Paragraph("Uganda Christian University", title_style))
        story.append(Paragraph("Analytics Dashboard Report", styles['Heading2']))
        story.append(Spacer(1, 0.2*inch))
        
        # Get data from API
        try:
            headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}
            # Use a different endpoint to get JSON data
            response = requests.get(f'{self.api_base_url}/api/dashboard/stats', headers=headers)
            stats_data = response.json()
            
            # Get additional data
            dept_response = requests.get(f'{self.api_base_url}/api/dashboard/students-by-department', headers=headers)
            dept_data = dept_response.json()
            
            grade_response = requests.get(f'{self.api_base_url}/api/dashboard/grade-distribution', headers=headers)
            grade_data = grade_response.json()
            
            data = {
                'stats': {
                    'total_students': stats_data.get('total_students', 0),
                    'total_courses': stats_data.get('total_courses', 0),
                    'total_enrollments': stats_data.get('total_enrollments', 0),
                    'avg_grade': stats_data.get('avg_grade', 0),
                    'total_payments': stats_data.get('total_payments', 0)
                },
                'departments': [{'department': d, 'student_count': c} for d, c in 
                               zip(dept_data.get('departments', []), dept_data.get('counts', []))],
                'grades': [{'letter_grade': g, 'count': c} for g, c in 
                          zip(grade_data.get('grades', []), grade_data.get('counts', []))]
            }
        except Exception as e:
            print(f"Error fetching data: {e}")
            # Fallback data if API unavailable
            data = {
                'stats': {
                    'total_students': 0,
                    'total_courses': 0,
                    'total_enrollments': 0,
                    'avg_grade': 0,
                    'total_payments': 0
                },
                'departments': [],
                'grades': []
            }
        
        # Executive Summary
        story.append(Paragraph("Executive Summary", styles['Heading2']))
        story.append(Spacer(1, 0.1*inch))
        
        summary_data = [
            ['Metric', 'Value'],
            ['Total Students', str(data['stats'].get('total_students', 0))],
            ['Total Courses', str(data['stats'].get('total_courses', 0))],
            ['Total Enrollments', str(data['stats'].get('total_enrollments', 0))],
            ['Average Grade', f"{data['stats'].get('avg_grade', 0):.2f}%"],
            ['Total Payments (UGX)', f"{data['stats'].get('total_payments', 0):,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Department Distribution
        if data.get('departments'):
            story.append(Paragraph("Student Distribution by Department", styles['Heading2']))
            story.append(Spacer(1, 0.1*inch))
            
            dept_data = [['Department', 'Student Count']]
            for dept in data['departments']:
                dept_data.append([dept.get('department', 'N/A'), str(dept.get('student_count', 0))])
            
            dept_table = Table(dept_data, colWidths=[3*inch, 2*inch])
            dept_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(dept_table)
            story.append(Spacer(1, 0.3*inch))
        
        # Grade Distribution
        if data.get('grades'):
            story.append(Paragraph("Grade Distribution", styles['Heading2']))
            story.append(Spacer(1, 0.1*inch))
            
            grade_data = [['Letter Grade', 'Count']]
            for grade in data['grades']:
                grade_data.append([grade.get('letter_grade', 'N/A'), str(grade.get('count', 0))])
            
            grade_table = Table(grade_data, colWidths=[3*inch, 2*inch])
            grade_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(grade_table)
            story.append(Spacer(1, 0.3*inch))
        
        # Report Information
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph(f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
                              styles['Normal']))
        story.append(Paragraph("NextGen-Data-Architects - Uganda Christian University", 
                              styles['Normal']))
        
        # Build PDF
        doc.build(story)
        return output_path

if __name__ == '__main__':
    generator = PDFReportGenerator()
    generator.generate_report()

