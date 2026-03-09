###############################
# Backend / ETL Docker image  #
# - Runs Flask API and ETL    #
# - Uses MySQL as warehouse   #
# - Bronze/Silver/Gold paths  #
###############################

FROM python:3.11-slim AS backend

# Set a consistent working directory inside the container
WORKDIR /app

# Install system packages needed for building Python wheels and talking to MySQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definitions first (leverages Docker layer cache when code changes)
COPY requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY . .

# Environment for Flask and MySQL connection (overridable via docker-compose / Kubernetes)
ENV FLASK_APP=app.py \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=5000 \
    MYSQL_HOST=mysql \
    MYSQL_PORT=3306 \
    MYSQL_USER=root \
    MYSQL_PASSWORD=root

# Expose backend HTTP port
EXPOSE 5000

# Default command: run the Flask API (ETL is triggered via the existing /api/admin/run-etl endpoint)
CMD ["python", "app.py"]

