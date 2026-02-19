"""
UCU Payment Deadlines Calculator
Calculates payment deadlines and weeks from semester start date
"""
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

# UCU Payment Deadlines (relative to semester start)
# Based on the image provided: Semester starts 29-08-2025
PAYMENT_DEADLINES = {
    'prompt_payment': {
        'weeks_from_start': 0,  # Same day as semester start
        'date_offset': 0,
        'description': 'Prompt Payment Option',
        'tuition_percentage': [50, 100],  # 50% or 100%
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,  # For residents
    },
    'registration': {
        'weeks_from_start': 4,  # ~4 weeks (29-08 to 26-09)
        'date_offset': 28,
        'description': 'Registration Deadline',
        'tuition_percentage': [45, 100],  # 45% to 100%
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,  # For residents
    },
    'midterm': {
        'weeks_from_start': 8,  # ~8 weeks (29-08 to 24-10)
        'date_offset': 56,
        'description': 'Midterm Deadline',
        'tuition_percentage': [75],  # At least 75%
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,  # For residents
    },
    'full_fees': {
        'weeks_from_start': 11,  # ~11 weeks (29-08 to 14-11)
        'date_offset': 77,
        'description': 'Full Fees Deadline',
        'tuition_percentage': [100],
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,  # For residents
    },
    'late_penalty_week1': {
        'weeks_from_start': 12,  # Week after full fees deadline
        'date_offset': 84,
        'description': 'Late Payment - Week 1',
        'penalty_percentage': 5,  # 5% penalty
    },
    'late_penalty_week2': {
        'weeks_from_start': 13,  # 2 weeks after full fees deadline
        'date_offset': 91,
        'description': 'Late Payment - Week 2',
        'penalty_percentage': 10,  # 10% penalty
    }
}

def calculate_payment_deadlines(semester_start_date: str) -> List[Dict]:
    """
    Calculate payment deadlines from semester start date
    
    Args:
        semester_start_date: Date string in format 'YYYY-MM-DD' or 'DD-MM-YYYY'
    
    Returns:
        List of deadline dictionaries with dates, descriptions, and requirements
    """
    try:
        # Parse date
        if '-' in semester_start_date:
            parts = semester_start_date.split('-')
            if len(parts[0]) == 4:  # YYYY-MM-DD
                start_date = datetime.strptime(semester_start_date, '%Y-%m-%d')
            else:  # DD-MM-YYYY
                start_date = datetime.strptime(semester_start_date, '%d-%m-%Y')
        else:
            raise ValueError("Invalid date format")
    except:
        # Default to the date from the image
        start_date = datetime(2025, 8, 29)
    
    deadlines = []
    
    for key, deadline_info in PAYMENT_DEADLINES.items():
        deadline_date = start_date + timedelta(days=deadline_info['date_offset'])
        weeks = deadline_info['weeks_from_start']
        
        deadline = {
            'deadline_type': key,
            'deadline_date': deadline_date.strftime('%d-%m-%Y'),
            'weeks_from_semester_start': weeks,
            'description': deadline_info['description'],
        }
        
        if 'tuition_percentage' in deadline_info:
            deadline['tuition_percentage'] = deadline_info['tuition_percentage']
            deadline['other_fees_percentage'] = deadline_info.get('other_fees_percentage', 100)
            deadline['accommodation_percentage'] = deadline_info.get('accommodation_percentage', 100)
        
        if 'penalty_percentage' in deadline_info:
            deadline['penalty_percentage'] = deadline_info['penalty_percentage']
            deadline['requires_all_fees'] = True
        
        deadlines.append(deadline)
    
    return deadlines

def calculate_required_payment(
    student_type: str,  # 'resident' or 'non-resident'
    tuition_amount: float,
    functional_fees: float,
    accommodation_fees: float = 0,
    deadline_type: str = 'full_fees'
) -> Dict:
    """
    Calculate required payment amount based on deadline and student type
    
    Args:
        student_type: 'resident' or 'non-resident'
        tuition_amount: Base tuition amount
        functional_fees: Functional fees amount
        accommodation_fees: Accommodation fees (for residents)
        deadline_type: Type of deadline (prompt_payment, registration, midterm, full_fees)
    
    Returns:
        Dictionary with payment breakdown
    """
    deadline_info = PAYMENT_DEADLINES.get(deadline_type, PAYMENT_DEADLINES['full_fees'])
    
    # Get minimum tuition percentage required
    tuition_percentages = deadline_info.get('tuition_percentage', [100])
    min_tuition_percentage = min(tuition_percentages)
    
    # Calculate required amounts
    required_tuition = tuition_amount * (min_tuition_percentage / 100)
    required_functional = functional_fees * (deadline_info.get('other_fees_percentage', 100) / 100)
    
    if student_type == 'resident':
        required_accommodation = accommodation_fees * (deadline_info.get('accommodation_percentage', 100) / 100)
        total_required = required_tuition + required_functional + required_accommodation
    else:
        required_accommodation = 0
        total_required = required_tuition + required_functional
    
    return {
        'required_tuition': round(required_tuition, 2),
        'required_functional_fees': round(required_functional, 2),
        'required_accommodation': round(required_accommodation, 2),
        'total_required': round(total_required, 2),
        'tuition_percentage': min_tuition_percentage,
        'functional_fees_percentage': deadline_info.get('other_fees_percentage', 100),
        'accommodation_percentage': deadline_info.get('accommodation_percentage', 0) if student_type == 'non-resident' else deadline_info.get('accommodation_percentage', 100),
    }

def get_current_deadline_status(
    semester_start_date: str,
    current_date: datetime = None
) -> Dict:
    """
    Get current deadline status based on today's date
    
    Returns:
        Dictionary with current deadline info and next deadline
    """
    if current_date is None:
        current_date = datetime.now()
    
    deadlines = calculate_payment_deadlines(semester_start_date)
    
    # Find current and next deadline
    current_deadline = None
    next_deadline = None
    
    for deadline in deadlines:
        deadline_date = datetime.strptime(deadline['deadline_date'], '%d-%m-%Y')
        if deadline_date <= current_date:
            current_deadline = deadline
        elif next_deadline is None and deadline_date > current_date:
            next_deadline = deadline
            break
    
    return {
        'current_deadline': current_deadline,
        'next_deadline': next_deadline,
        'all_deadlines': deadlines,
        'current_date': current_date.strftime('%d-%m-%Y')
    }


