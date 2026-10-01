FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY weather_api.py .
COPY collector_integration.py .
COPY validation_store.py .

CMD ["python", "weather_api.py"]