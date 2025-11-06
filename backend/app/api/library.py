"""API endpoints for library (favorite books)"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import json
import os

from app.database import get_db
from app.schemas.library import LibraryBookCreate, LibraryBookResponse, DownloadProgress
from app.services.library_service import LibraryService
from app.services.download_service import DownloadService

router = APIRouter(prefix="/library", tags=["Library"])


@router.get("/", response_model=List[LibraryBookResponse])
async def get_library_books(db: AsyncSession = Depends(get_db)):
    """Get all books in library"""
    books = await LibraryService.get_all_books(db)
    return books


@router.get("/downloaded")
async def get_downloaded_books():
    """
    Get all downloaded books by scanning the downloads directory
    This endpoint works offline and doesn't require database access
    """
    books = LibraryService.get_all_downloaded_books()
    return books


@router.get("/downloaded/{directory_name}/info")
async def get_downloaded_book_info_by_dir(directory_name: str):
    """
    Get book info by directory name (works offline)
    """
    from pathlib import Path

    book_dir = LibraryService.DOWNLOAD_DIR / directory_name
    if not book_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book directory not found")

    info_file = book_dir / 'info.json'
    if not info_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book info not found")

    try:
        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)
        return info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read book info: {str(e)}"
        )


@router.get("/downloaded/{directory_name}/chapters")
async def get_downloaded_book_chapters_by_dir(directory_name: str):
    """
    Get chapter list by directory name (works offline)
    """
    from pathlib import Path

    book_dir = LibraryService.DOWNLOAD_DIR / directory_name
    if not book_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book directory not found")

    chapters_file = book_dir / 'chapters.json'
    if not chapters_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapters file not found")

    try:
        with open(chapters_file, 'r', encoding='utf-8') as f:
            chapters = json.load(f)
        return chapters
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read chapters: {str(e)}"
        )


@router.get("/downloaded/{directory_name}/chapters/{chapter_index}")
async def get_downloaded_book_chapter_content_by_dir(directory_name: str, chapter_index: int):
    """
    Get chapter content by directory name and chapter index (works offline)
    """
    from pathlib import Path

    book_dir = LibraryService.DOWNLOAD_DIR / directory_name
    if not book_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book directory not found")

    chapter_file = book_dir / 'chapters' / f'{chapter_index:04d}.txt'
    if not chapter_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter file not found")

    try:
        with open(chapter_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Format content as HTML paragraphs
        paragraphs = content.strip().split('\n')
        formatted_content = ''.join([f'<p>{p.strip()}</p>' for p in paragraphs if p.strip()])

        return {
            "content": formatted_content,
            "next_url": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read chapter content: {str(e)}"
        )


@router.get("/check")
async def check_if_in_library(book_url: str, source_id: int, db: AsyncSession = Depends(get_db)):
    """Check if a book is already in library"""
    book = await LibraryService.check_if_exists(db, book_url, source_id)
    if book:
        return {
            "in_library": True,
            "book_id": book.id,
            "book": LibraryBookResponse.model_validate(book)
        }
    else:
        return {
            "in_library": False,
            "book_id": None,
            "book": None
        }


@router.get("/{book_id}", response_model=LibraryBookResponse)
async def get_library_book(book_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific library book"""
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")
    return book


@router.get("/{book_id}/info")
async def get_library_book_full_info(book_id: int, db: AsyncSession = Depends(get_db)):
    """Get full info of a library book, including downloaded info if available"""
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")

    # Base info from database
    book_info = {
        "id": book.id,
        "name": book.name,
        "author": book.author,
        "book_url": book.book_url,
        "cover_url": book.cover_url,
        "intro": book.intro,
        "kind": book.kind,
        "last_chapter": book.last_chapter,
        "word_count": book.word_count,
        "source_id": book.source_id,
        "source_name": book.source_name,
        "is_downloaded": book.is_downloaded,
        "download_path": book.download_path,
        "download_progress": book.download_progress,
        "total_chapters": book.total_chapters,
        "downloaded_chapters": book.downloaded_chapters,
        "variables": book.variables,
    }

    # If downloaded, try to get info from info.json
    if book.is_downloaded:
        downloaded_info = LibraryService.get_downloaded_book_info(book)
        if downloaded_info:
            # Merge downloaded info (it may have more complete data)
            book_info.update({
                "name": downloaded_info.get("name", book.name),
                "author": downloaded_info.get("author", book.author),
                "intro": downloaded_info.get("intro", book.intro),
                "cover_url": downloaded_info.get("cover_url", book.cover_url),
                "kind": downloaded_info.get("kind", book.kind),
                "last_chapter": downloaded_info.get("last_chapter", book.last_chapter),
                "word_count": downloaded_info.get("word_count", book.word_count),
                "total_chapters": downloaded_info.get("total_chapters", book.total_chapters),
            })

    return book_info


@router.post("/", response_model=LibraryBookResponse)
async def add_to_library(book_data: LibraryBookCreate, db: AsyncSession = Depends(get_db)):
    """Add a book to library (favorite)"""
    book = await LibraryService.add_book(db, book_data)
    return book


@router.delete("/{book_id}")
async def remove_from_library(book_id: int, db: AsyncSession = Depends(get_db)):
    """Remove a book from library"""
    success = await LibraryService.remove_book(db, book_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")
    return {"message": "Book removed from library"}


@router.post("/{book_id}/download")
async def download_book_to_server(
    book_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Download entire book to server (background task)"""
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")
    
    # Parse variables
    variables = {}
    if book.variables:
        try:
            variables = json.loads(book.variables)
        except:
            pass
    
    # Start download in background
    background_tasks.add_task(
        DownloadService.download_book,
        db,
        book_id,
        book.book_url,
        book.source_id,
        variables
    )
    
    return {"message": "Download started", "book_id": book_id}


@router.get("/{book_id}/download/progress", response_model=DownloadProgress)
async def get_download_progress(book_id: int, db: AsyncSession = Depends(get_db)):
    """Get download progress for a book"""
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")
    
    # Get progress from download service
    progress_data = DownloadService.get_download_progress(book_id)
    
    if progress_data:
        return DownloadProgress(
            book_id=book_id,
            total_chapters=progress_data.get('total_chapters', 0),
            downloaded_chapters=progress_data.get('downloaded_chapters', 0),
            progress=progress_data.get('progress', 0),
            status=progress_data.get('status', 'unknown'),
            message=progress_data.get('message')
        )
    else:
        # Return database info
        return DownloadProgress(
            book_id=book_id,
            total_chapters=book.total_chapters,
            downloaded_chapters=book.downloaded_chapters,
            progress=book.download_progress,
            status='completed' if book.is_downloaded else 'not_started',
            message=None
        )





@router.get("/{book_id}/chapters")
async def get_downloaded_chapters(book_id: int, db: AsyncSession = Depends(get_db)):
    """Get chapter list from downloaded book"""
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")

    if not book.is_downloaded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Book not downloaded yet")

    chapters = LibraryService.get_downloaded_chapters(book)
    if chapters is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter list not found")

    return chapters


@router.get("/{book_id}/chapters/{chapter_index}")
async def get_downloaded_chapter_content(book_id: int, chapter_index: int, db: AsyncSession = Depends(get_db)):
    """Get chapter content from downloaded book"""
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found in library")

    if not book.is_downloaded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Book not downloaded yet")

    content = LibraryService.get_downloaded_chapter_content(book, chapter_index)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter content not found")

    # Format content as HTML paragraphs
    paragraphs = content.split('\n')
    formatted_paragraphs = []
    for para in paragraphs:
        para = para.strip()
        if para:
            formatted_paragraphs.append(f'<p>{para}</p>')

    formatted_content = '\n'.join(formatted_paragraphs)

    return {
        "content": formatted_content,
        "next_url": None  # No next_url for downloaded content
    }

