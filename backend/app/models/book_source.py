"""Book source database model"""
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class BookSource(Base):
    """Book source model for storing Legado book sources"""
    __tablename__ = "book_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    source_type = Column(Integer, default=0)  # 0: text, 1: audio, 2: image
    enabled = Column(Boolean, default=True)
    source_group = Column(String(100), nullable=True)
    source_comment = Column(Text, nullable=True)
    source_json = Column(Text, nullable=False)  # Complete JSON of the book source
    compiled_source = Column(Text, nullable=True)  # Compiled source cache (optional)
    custom_order = Column(Integer, default=0)
    weight = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<BookSource(id={self.id}, name='{self.name}', enabled={self.enabled})>"

