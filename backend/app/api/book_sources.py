"""API endpoints for book source management"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.schemas.book_source import (
    BookSourceCreate,
    BookSourceUpdate,
    BookSourceResponse,
    BookSourceDetail,
    BookSourceImportResult
)
from app.services.book_source_service import BookSourceService
import httpx
import json

router = APIRouter(prefix="/book-sources", tags=["Book Sources"])

@router.post("/", response_model=BookSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_book_source(
    source_data: BookSourceCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new book source from JSON"""
    try:
        book_source = await BookSourceService.create_book_source(db, source_data)
        return book_source
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/from-url", response_model=BookSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_book_source_from_url(
    url: str,
    db: AsyncSession = Depends(get_db)
):
    """Create a new book source from URL"""
    try:
        # Fetch JSON from URL
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            source_json = response.text
        
        source_data = BookSourceCreate(source_json=source_json)
        book_source = await BookSourceService.create_book_source(db, source_data)
        return book_source
    except httpx.HTTPError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to fetch URL: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/", response_model=List[BookSourceResponse])
async def get_book_sources(
    enabled_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all book sources"""
    sources = await BookSourceService.get_all_book_sources(db, enabled_only, skip, limit)
    return sources

@router.get("/{source_id}", response_model=BookSourceDetail)
async def get_book_source(
    source_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific book source by ID"""
    book_source = await BookSourceService.get_book_source(db, source_id)
    if not book_source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")
    return book_source

@router.put("/{source_id}", response_model=BookSourceResponse)
async def update_book_source(
    source_id: int,
    update_data: BookSourceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a book source"""
    try:
        book_source = await BookSourceService.update_book_source(db, source_id, update_data)
        if not book_source:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")
        return book_source
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book_source(
    source_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a book source"""
    success = await BookSourceService.delete_book_source(db, source_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")
    return None

@router.post("/import-from-url", response_model=BookSourceImportResult)
async def import_book_sources_from_url(
    url: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Import multiple book sources from a subscription URL
    The URL should return a JSON array of book sources
    """
    try:
        # Fetch JSON from URL
        async with httpx.AsyncClient(timeout=30.0, verify=False, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

            # Parse JSON
            try:
                sources_data = response.json()
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid JSON format from URL"
                )

            # Ensure it's a list
            if not isinstance(sources_data, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL must return a JSON array of book sources"
                )

            # Import each source
            success_count = 0
            failed_count = 0
            failed_sources = []
            imported_sources = []

            for source_dict in sources_data:
                try:
                    # Convert dict to JSON string
                    source_json = json.dumps(source_dict, ensure_ascii=False)
                    source_data = BookSourceCreate(source_json=source_json)

                    # Create book source
                    book_source = await BookSourceService.create_book_source(db, source_data)
                    success_count += 1
                    imported_sources.append({
                        "id": book_source.id,
                        "name": book_source.name,
                        "url": book_source.url
                    })
                except Exception as e:
                    failed_count += 1
                    failed_sources.append({
                        "name": source_dict.get('bookSourceName', 'Unknown'),
                        "error": str(e)
                    })

            return BookSourceImportResult(
                total=len(sources_data),
                success=success_count,
                failed=failed_count,
                imported_sources=imported_sources,
                failed_sources=failed_sources
            )

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch URL: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )

