"""Book source schemas for API request/response"""
from pydantic import BaseModel, Field
from typing import Optional, Any, List
from datetime import datetime

class BookSourceBase(BaseModel):
    """Base book source schema"""
    name: str = Field(..., description="Book source name")
    url: str = Field(..., description="Book source URL")
    source_type: int = Field(0, description="Source type: 0=text, 1=audio, 2=image")
    enabled: bool = Field(True, description="Whether the source is enabled")
    source_group: Optional[str] = Field(None, description="Source group")
    source_comment: Optional[str] = Field(None, description="Source comment")
    custom_order: int = Field(0, description="Custom order")
    weight: int = Field(0, description="Source weight")

class BookSourceCreate(BaseModel):
    """Schema for creating a book source"""
    source_json: str = Field(..., description="Complete JSON of the book source")

class BookSourceUpdate(BaseModel):
    """Schema for updating a book source"""
    enabled: Optional[bool] = None
    source_group: Optional[str] = None
    source_comment: Optional[str] = None
    custom_order: Optional[int] = None
    source_json: Optional[str] = None

class BookSourceResponse(BookSourceBase):
    """Schema for book source response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class BookSourceDetail(BookSourceResponse):
    """Schema for detailed book source response"""
    source_json: str

class SearchRequest(BaseModel):
    """Schema for search request"""
    keyword: str = Field(..., min_length=1, description="Search keyword")
    source_ids: Optional[list[int]] = Field(None, description="Specific source IDs to search, None for all")
    page: int = Field(1, ge=1, description="Page number")

class SearchResult(BaseModel):
    """Schema for search result item"""
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
    variables: dict = Field(default_factory=dict)

class BookInfoResponse(BaseModel):
    """Schema for book info response"""
    name: str
    author: Optional[str] = None
    cover_url: Optional[str] = None
    intro: Optional[str] = None
    kind: Optional[str] = None
    last_chapter: Optional[str] = None
    word_count: Optional[str] = None
    toc_url: str
    variables: dict = Field(default_factory=dict)

class ChapterItem(BaseModel):
    """Schema for chapter item"""
    name: str
    url: str
    variables: dict = Field(default_factory=dict)

class ChapterContentResponse(BaseModel):
    """Schema for chapter content response"""
    content: str
    next_url: Optional[str] = None

class ImportedSourceInfo(BaseModel):
    """Schema for imported source info"""
    id: int
    name: str
    url: str

class FailedSourceInfo(BaseModel):
    """Schema for failed source info"""
    name: str
    error: str

class BookSourceImportResult(BaseModel):
    """Schema for book source import result"""
    total: int = Field(..., description="Total number of sources in the URL")
    success: int = Field(..., description="Number of successfully imported sources")
    failed: int = Field(..., description="Number of failed imports")
    imported_sources: List[ImportedSourceInfo] = Field(default_factory=list, description="List of imported sources")
    failed_sources: List[FailedSourceInfo] = Field(default_factory=list, description="List of failed sources")

