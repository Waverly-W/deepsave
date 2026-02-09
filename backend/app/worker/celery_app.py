import os

from celery import Celery
from celery.schedules import crontab


def create_celery() -> Celery:
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")

    app = Celery("deepsave", broker=broker_url, backend=result_backend)
    app.conf.update(
        task_default_queue="celery_default",
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        task_track_started=True,
        timezone="UTC",
        beat_schedule={
            "maintenance-cleanup": {
                "task": "maintenance.cleanup",
                "schedule": crontab(hour=3, minute=0),
            }
        },
    )
    app.autodiscover_tasks(["app.worker"])
    return app


celery_app = create_celery()
