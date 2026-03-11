###################################
# Backend / ETL Docker image      #
# - Runs Flask API and ETL        #
# - Uses PostgreSQL as warehouse  #
# - Bronze/Silver/Gold paths      #
###################################

FROM python:3.11-slim AS backend

# Set a consistent working directory inside the container
WORKDIR /app

# Install system packages needed for building Python wheels and talking to PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definitions first (leverages Docker layer cache when code changes)
COPY requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy the rest of the backend source code
COPY . .

# Environment for Flask and PostgreSQL connection (overridable via docker-compose / Kubernetes)
ENV FLASK_APP=app.py \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=5000 \
    PG_HOST=postgres \
    PG_PORT=5432 \
    PG_USER=postgres \
    PG_PASSWORD=postgres

# Expose backend HTTP port
EXPOSE 5000

# Default command: run the Flask API (ETL is triggered via the existing /api/admin/run-etl endpoint)
CMD ["python", "app.py"]
