"""Library (favorite books) model"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class LibraryBook(Base):
    """Model for books in user's library (favorites)"""
    __tablename__ = "library_books"

    id = Column(Integer, primary_key=True, index=True)
    
    # Book information
    name = Column(String, nullable=False, index=True)
    author = Column(String)
    book_url = Column(String, nullable=False)
    cover_url = Column(String)
    intro = Column(Text)
    kind = Column(String)
    last_chapter = Column(String)
    word_count = Column(String)
    
    # Source information
    source_id = Column(Integer, ForeignKey("book_sources.id"), nullable=False)
    source_name = Column(String, nullable=False)
    
    # Download status
    is_downloaded = Column(Boolean, default=False)
    download_path = Column(String)  # Relative path to downloaded file
    download_progress = Column(Integer, default=0)  # 0-100
    total_chapters = Column(Integer, default=0)
    downloaded_chapters = Column(Integer, default=0)
    
    # Metadata
    variables = Column(Text)  # JSON string for LegadoParser variables
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<LibraryBook(id={self.id}, name='{self.name}', author='{self.author}')>"

