"""API endpoints for book operations"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.schemas.book_source import BookInfoResponse, ChapterItem, ChapterContentResponse
from app.services.book_source_service import BookSourceService
from app.services.legado_service import LegadoService

router = APIRouter(prefix="/books", tags=["Books"])

@router.post("/info", response_model=BookInfoResponse)
async def get_book_info(
    source_id: int = Body(...),
    book_url: str = Body(...),
    variables: dict = Body(default_factory=dict),
    db: AsyncSession = Depends(get_db)
):
    """Get book information from a specific source"""
    source = await BookSourceService.get_book_source(db, source_id)
    
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")
    
    try:
        compiled_source = BookSourceService.get_compiled_source(source)
        book_info = LegadoService.get_book_info(compiled_source, book_url, variables)
        
        if not book_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to get book information"
            )
        
        return BookInfoResponse(
            name=book_info.get('name', ''),
            author=book_info.get('author'),
            cover_url=book_info.get('coverUrl'),
            intro=book_info.get('intro'),
            kind=book_info.get('kind'),
            last_chapter=book_info.get('lastChapter'),
            word_count=book_info.get('wordCount'),
            toc_url=book_info.get('tocUrl', book_url),
            variables=book_info.get('variables', {})
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get book info: {str(e)}"
        )

@router.post("/chapters", response_model=List[ChapterItem])
async def get_chapter_list(
    source_id: int = Body(...),
    toc_url: str = Body(...),
    variables: dict = Body(default_factory=dict),
    db: AsyncSession = Depends(get_db)
):
    """Get chapter list for a book"""
    source = await BookSourceService.get_book_source(db, source_id)
    
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")
    
    try:
        compiled_source = BookSourceService.get_compiled_source(source)
        chapters = LegadoService.get_chapter_list(compiled_source, toc_url, variables)
        
        chapter_items = []
        for chapter in chapters:
            chapter_items.append(ChapterItem(
                name=chapter.get('name', ''),
                url=chapter.get('url', ''),
                variables=chapter.get('variables', {})
            ))
        
        return chapter_items
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get chapter list: {str(e)}"
        )

@router.post("/chapter/content", response_model=ChapterContentResponse)
async def get_chapter_content(
    source_id: int = Body(...),
    chapter_url: str = Body(...),
    variables: dict = Body(default_factory=dict),
    next_chapter_url: str = Body(default=''),
    db: AsyncSession = Depends(get_db)
):
    """Get content of a specific chapter"""
    source = await BookSourceService.get_book_source(db, source_id)
    
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")
    
    try:
        compiled_source = BookSourceService.get_compiled_source(source)
        content = LegadoService.get_chapter_content(
            compiled_source, 
            chapter_url, 
            variables,
            next_chapter_url
        )
        
        if not content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to get chapter content"
            )
        
        return ChapterContentResponse(
            content=content.get('content', ''),
            next_url=content.get('nextUrl')
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get chapter content: {str(e)}"
        )

