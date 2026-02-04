import asyncio
from app.worker.celery_app import celery_app
from app.services.ingestion.http_client import HttpClient
# from app.services.ingestion.browser import BrowserClient # Import when needed

@celery_app.task(acks_late=True)
def ingest_url(url: str, user_id: int):
    # This runs in a synchronous worker process, but we might call async code
    print(f"Processing URL: {url} for user {user_id}")
    
    # 1. Try Trafilatura (Sync)
    result = HttpClient.fetch_and_extract(url)
    
    if result["status"] == "success":
        print(f"Trafilatura fetch success: {len(result['content'])} chars")
        # TODO: Save to DB & Trigger AI Pipeline
        return {"status": "success", "length": len(result["content"])}
    
    # 2. Fallback to Playwright (Disabled for MVP to save J4125 CPU)
    # print("Trafilatura failed, trying Playwright...")
    # ...
    
    return {"status": "failed", "error": result.get("error")}
