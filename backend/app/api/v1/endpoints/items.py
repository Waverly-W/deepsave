from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.user import User
from app.models.item import Item
from app.schemas.item import ItemCreate, Item as ItemSchema
from app.worker.tasks import ingest_url

router = APIRouter()

@router.post("/ingest", response_model=ItemSchema)
async def ingest_item(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_in: ItemCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Ingest a new URL.
    1. Save to DB (Status: Pending)
    2. Trigger Celery Task
    """
    # Check if exists
    result = await db.execute(select(Item).where(Item.url == str(item_in.url), Item.owner_id == current_user.id))
    existing = result.scalars().first()
    if existing:
        return existing
        
    # Create
    db_item = Item(
        url=str(item_in.url),
        title=item_in.title,
        owner_id=current_user.id,
        processing_status="pending"
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    
    # Trigger Async Task
    ingest_url.delay(str(db_item.url), db_item.owner_id)
    
    return db_item

@router.get("/", response_model=List[ItemSchema])
async def read_items(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve items.
    """
    result = await db.execute(
        select(Item)
        .where(Item.owner_id == current_user.id, Item.is_deleted == False)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()
