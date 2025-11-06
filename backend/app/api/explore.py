"""API endpoints for book exploration/discovery"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.services.book_source_service import BookSourceService
from app.services.legado_service import LegadoService
from app.schemas.book_source import SearchResult

router = APIRouter()


class ExploreRequest(BaseModel):
    """Request model for explore"""
    source_id: int
    url: str
    page: int = 1


@router.post("/", response_model=List[SearchResult])
async def explore_books(
    explore_request: ExploreRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Explore books from a specific book source
    
    Args:
        explore_request: Explore request containing source_id, url, and page
        db: Database session
        
    Returns:
        List of books
    """
    # Get book source
    source = await BookSourceService.get_book_source(db, explore_request.source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Book source not found")
    
    if not source.enabled:
        raise HTTPException(status_code=400, detail="Book source is disabled")
    
    try:
        # Compile source
        compiled_source = BookSourceService.get_compiled_source(source)
        
        # Explore books
        results = LegadoService.explore(compiled_source, explore_request.url, explore_request.page)
        
        # Convert to SearchResult format
        explore_results = []
        for result in results:
            explore_result = SearchResult(
                name=result.get('name', ''),
                author=result.get('author'),
                book_url=result.get('bookUrl', ''),
                cover_url=result.get('coverUrl'),
                intro=result.get('intro'),
                kind=result.get('kind'),
                last_chapter=result.get('lastChapter'),
                word_count=result.get('wordCount'),
                source_id=source.id,
                source_name=source.name,
                variables=result.get('variables', {})
            )
            explore_results.append(explore_result)
        
        return explore_results
    except Exception as e:
        print(f"Explore error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Explore failed: {str(e)}")


@router.get("/categories/{source_id}")
async def get_explore_categories(
    source_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get explore categories from a book source
    
    Args:
        source_id: Book source ID
        db: Database session
        
    Returns:
        List of explore categories
    """
    import json
    
    # Get book source
    source = await BookSourceService.get_book_source(db, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Book source not found")
    
    try:
        # Parse source JSON
        source_config = json.loads(source.source_json)
        explore_url = source_config.get('exploreUrl', '')
        
        if not explore_url:
            return []
        
        # Parse exploreUrl
        # Format can be:
        # 1. JSON array: [{"title":"推荐","url":"/l/s/28/{{page}}.html"}]
        # 2. Simple format: "玄幻::/category/xuanhuan_{{page}}.html\n修真::/category/xiuzhen_{{page}}.html"
        
        categories = []
        
        if explore_url.startswith('['):
            # JSON array format
            try:
                explore_list = json.loads(explore_url)
                for item in explore_list:
                    if item.get('url'):  # Skip empty URLs (section headers)
                        categories.append({
                            'title': item.get('title', ''),
                            'url': item.get('url', ''),
                            'style': item.get('style', {})
                        })
            except json.JSONDecodeError:
                pass
        else:
            # Simple format
            lines = explore_url.strip().split('\n')
            for line in lines:
                if '::' in line:
                    parts = line.split('::', 1)
                    if len(parts) == 2:
                        categories.append({
                            'title': parts[0].strip(),
                            'url': parts[1].strip(),
                            'style': {}
                        })
        
        return categories
    except Exception as e:
        print(f"Get categories error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get categories: {str(e)}")

