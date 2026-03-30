from datetime import datetime, timedelta
from typing import Dict, List, Tuple

PAYMENT_DEADLINES = {
    'prompt_payment': {
        'weeks_from_start': 0,
        'date_offset': 0,
        'description': 'Prompt Payment Option',
        'tuition_percentage': [50, 100],
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,
    },
    'registration': {
        'weeks_from_start': 4,
        'date_offset': 28,
        'description': 'Registration Deadline',
        'tuition_percentage': [45, 100],
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,
    },
    'midterm': {
        'weeks_from_start': 8,
        'date_offset': 56,
        'description': 'Midterm Deadline',
        'tuition_percentage': [75],
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,
    },
    'full_fees': {
        'weeks_from_start': 11,
        'date_offset': 77,
        'description': 'Full Fees Deadline',
        'tuition_percentage': [100],
        'other_fees_percentage': 100,
        'accommodation_percentage': 100,
    },
    'late_penalty_week1': {
        'weeks_from_start': 12,
        'date_offset': 84,
        'description': 'Late Payment - Week 1',
        'penalty_percentage': 5,
    },
    'late_penalty_week2': {
        'weeks_from_start': 13,
        'date_offset': 91,
        'description': 'Late Payment - Week 2',
        'penalty_percentage': 10,
    }
}

def calculate_payment_deadlines(semester_start_date: str) -> List[Dict]:
    try:
        if '-' in semester_start_date:
            parts = semester_start_date.split('-')
            if len(parts[0]) == 4:
                start_date = datetime.strptime(semester_start_date, '%Y-%m-%d')
            else:
                start_date = datetime.strptime(semester_start_date, '%d-%m-%Y')
        else:
            raise ValueError("Invalid date format")
    except:
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
    student_type: str,
    tuition_amount: float,
    functional_fees: float,
    accommodation_fees: float = 0,
    deadline_type: str = 'full_fees'
) -> Dict:
    deadline_info = PAYMENT_DEADLINES.get(deadline_type, PAYMENT_DEADLINES['full_fees'])
    
    tuition_percentages = deadline_info.get('tuition_percentage', [100])
    min_tuition_percentage = min(tuition_percentages)
    
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
    if current_date is None:
        current_date = datetime.now()
    
    deadlines = calculate_payment_deadlines(semester_start_date)
    
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
