# Quick Start Guide

## 🚀 Getting Started

### 1. Setup Environment

```bash
# Navigate to backend folder
cd backend

# Create virtual environment (if not exists)
python -m venv .venv

# Activate virtual environment
.venv\Scripts\activate  # Windows
# or
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Database

Edit `backend/config.py` with your MySQL credentials:
```python
MYSQL_USER = 'root'
MYSQL_PASSWORD = 'your_password'
```

### 3. Setup Databases

```bash
cd backend
python setup_databases.py
```

### 4. Run ETL Pipeline

```bash
python etl_pipeline.py
```

### 5. Train ML Models

```bash
python ml_models.py
```

### 6. Start Backend Server

```bash
python app.py
# Server runs on http://localhost:5000
```

### 7. Start Frontend

```bash
cd frontend
npm install
npm start
# Frontend runs on http://localhost:3000
```

## 🔑 Default Login

After setup, create users in the database. For testing:
- **Students**: Login with Access Number (A#####)
- **Staff/Admin**: Login with username/email

## 📊 Access the System

1. Open browser: `http://localhost:3000`
2. Login with your credentials
3. Navigate to your role-specific dashboard

## 🎯 Key Features to Test

1. **Analytics**: View FEX and High School analytics
2. **Predictions**: Test prediction with different models
3. **Scenarios**: Try scenario analysis (Analyst/SysAdmin/Senate)
4. **Filters**: Use global filter panel to filter data

## ⚠️ Troubleshooting

- **Import errors**: Make sure you're running from the correct directory
- **Database connection**: Check MySQL is running and credentials are correct
- **Port conflicts**: Change ports in `app.py` (backend) and `package.json` (frontend)


