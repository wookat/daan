FROM node:20-slim AS fe
WORKDIR /fe
COPY frontend-uni/package.json frontend-uni/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend-uni .
RUN npm run build:h5

FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn httpx python-multipart
COPY backend backend
COPY frontend frontend
COPY knowledge knowledge
COPY --from=fe /fe/dist/build/h5 frontend-uni/dist/build/h5
ENV DB_PATH=/data/data.db
VOLUME /data
EXPOSE 8000
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
