# ThermiGraph AI — Dockerfile (Streamlit)
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY . .

EXPOSE 8501

# Streamlit runs on port 8501; --server.address 0.0.0.0 makes it reachable
# from outside the container.
CMD ["streamlit", "run", "dashboard.py", "--server.port=8501", "--server.address=0.0.0.0"]
