FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn httpx python-multipart
COPY backend backend
COPY frontend frontend
COPY knowledge knowledge
ENV DB_PATH=/data/data.db
VOLUME /data
EXPOSE 8000
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
