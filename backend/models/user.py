from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import bcrypt
from rbac import Role

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(Role), nullable=False)
    access_number = Column(String(10), unique=True, nullable=True)
    reg_number = Column(String(50), nullable=True)
    staff_number = Column(String(50), nullable=True)
    student_id = Column(Integer, ForeignKey('students.StudentID'), nullable=True)
    staff_id = Column(Integer, nullable=True)
    department_id = Column(Integer, nullable=True)
    faculty_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    profile_picture = Column(String(255), nullable=True)
    
    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role.value,
            'access_number': self.access_number,
            'reg_number': self.reg_number,
            'staff_number': self.staff_number,
            'student_id': self.student_id,
            'staff_id': self.staff_id,
            'department_id': self.department_id,
            'faculty_id': self.faculty_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=False)
    resource_id = Column(Integer, nullable=True)
    details = Column(String(1000), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="audit_logs")
