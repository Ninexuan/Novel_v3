"""Library (favorite books) schemas"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LibraryBookCreate(BaseModel):
    """Schema for creating a library book"""
    name: str
    author: Optional[str] = None
    book_url: str
    cover_url: Optional[str] = None
    intro: Optional[str] = None
    kind: Optional[str] = None
    last_chapter: Optional[str] = None
    word_count: Optional[str] = None
    source_id: int
    source_name: str
    variables: Optional[str] = None  # JSON string


class LibraryBookResponse(BaseModel):
    """Schema for library book response"""
    id: int
    name: str
    author: Optional[str] = None
    book_url: str
    cover_url: Optional[str] = None
    intro: Optional[str] = None
    kind: Optional[str] = None
    last_chapter: Optional[str] = None
    word_count: Optional[str] = None
    source_id: int
    source_name: str
    is_downloaded: bool
    download_path: Optional[str] = None
    download_progress: int
    total_chapters: int
    downloaded_chapters: int
    variables: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DownloadProgress(BaseModel):
    """Schema for download progress"""
    book_id: int
    total_chapters: int
    downloaded_chapters: int
    progress: int  # 0-100
    status: str  # 'downloading', 'completed', 'failed'
    message: Optional[str] = None

