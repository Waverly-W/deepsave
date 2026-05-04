FROM python:3.11-alpine AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

FROM base AS api

COPY requirements-api.txt /app/requirements-api.txt
COPY requirements-common.txt /app/requirements-common.txt
RUN pip install --no-cache-dir -r /app/requirements-api.txt

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY app /app/app
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8356

CMD ["/app/entrypoint.sh"]

FROM base AS worker

COPY requirements-common.txt /app/requirements-common.txt
COPY requirements-worker.txt /app/requirements-worker.txt
RUN pip install --no-cache-dir -r /app/requirements-worker.txt

COPY app /app/app

CMD ["celery", "-A", "app.worker.celery_app", "worker", "--loglevel=info", "--concurrency=2"]

FROM base AS beat

COPY requirements-beat.txt /app/requirements-beat.txt
RUN pip install --no-cache-dir -r /app/requirements-beat.txt

RUN mkdir -p /app/app/worker
COPY app/__init__.py /app/app/__init__.py
COPY app/worker/__init__.py /app/app/worker/__init__.py
COPY app/worker/beat_app.py /app/app/worker/beat_app.py

CMD ["celery", "-A", "app.worker.beat_app", "beat", "--loglevel=info"]
