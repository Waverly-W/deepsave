from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.base_class import Base

class Item(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, index=True)
    content_text = Column(Text, nullable=True) # Cleaned text
    summary = Column(Text, nullable=True)
    
    # Classification
    source_type = Column(String, default="article") # article, video, product, code
    
    # Metadata
    owner_id = Column(Integer, ForeignKey("user.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Status
    processing_status = Column(String, default="pending") # pending, scraped, classified, completed, failed
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
