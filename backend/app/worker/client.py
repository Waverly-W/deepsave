from celery.result import AsyncResult

from app.worker.celery_app import celery_app


def enqueue_process_item(item_id: str, lock_key: str | None = None) -> AsyncResult:
    return celery_app.send_task("items.process", args=[item_id, lock_key])


def enqueue_process_item_content(item_id: str, lock_key: str | None = None) -> AsyncResult:
    return celery_app.send_task("items.process_content", args=[item_id, lock_key])


def enqueue_polish_item_content(item_id: str, lock_key: str | None = None) -> AsyncResult:
    return celery_app.send_task("items.polish_content", args=[item_id, lock_key])
