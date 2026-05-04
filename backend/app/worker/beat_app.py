import os

from celery import Celery
from celery.schedules import crontab


def create_beat_celery() -> Celery:
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")

    app = Celery("deepsave-beat", broker=broker_url, backend=result_backend)
    app.conf.update(
        task_default_queue="celery_default",
        timezone="UTC",
        beat_schedule={
            "maintenance-cleanup": {
                "task": "maintenance.cleanup",
                "schedule": crontab(hour=3, minute=0),
            }
        },
    )
    return app


celery_app = create_beat_celery()
