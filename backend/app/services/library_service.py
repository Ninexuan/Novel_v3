"""Library service for managing favorite books"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import json
import os
import asyncio
from pathlib import Path

from app.models.library import LibraryBook
from app.models.book_source import BookSource
from app.schemas.library import LibraryBookCreate
from app.services.book_source_service import BookSourceService
from app.services.legado_service import LegadoService


class LibraryService:
    """Service for managing library books"""
    
    # Download directory (relative path)
    DOWNLOAD_DIR = Path("downloads")

    @staticmethod
    async def get_all_books(db: AsyncSession) -> List[LibraryBook]:
        """Get all books in library"""
        result = await db.execute(
            select(LibraryBook).order_by(LibraryBook.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    def get_all_downloaded_books() -> List[dict]:
        """
        Get all downloaded books by scanning the downloads directory
        This method doesn't require database access and works offline
        """
        downloaded_books = []

        if not LibraryService.DOWNLOAD_DIR.exists():
            return downloaded_books

        # Scan all subdirectories in downloads folder
        for book_dir in LibraryService.DOWNLOAD_DIR.iterdir():
            if not book_dir.is_dir():
                continue

            info_file = book_dir / 'info.json'
            if not info_file.exists():
                continue

            try:
                with open(info_file, 'r', encoding='utf-8') as f:
                    info = json.load(f)

                # Add directory name and path
                info['directory_name'] = book_dir.name
                info['download_path'] = str(book_dir)

                downloaded_books.append(info)
            except Exception as e:
                print(f"Failed to read {info_file}: {e}")
                continue

        return downloaded_books
    
    @staticmethod
    async def get_book_by_id(db: AsyncSession, book_id: int) -> Optional[LibraryBook]:
        """Get a library book by ID"""
        result = await db.execute(
            select(LibraryBook).where(LibraryBook.id == book_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def check_if_exists(db: AsyncSession, book_url: str, source_id: int) -> Optional[LibraryBook]:
        """Check if a book already exists in library"""
        result = await db.execute(
            select(LibraryBook).where(
                LibraryBook.book_url == book_url,
                LibraryBook.source_id == source_id
            )
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def add_book(db: AsyncSession, book_data: LibraryBookCreate) -> LibraryBook:
        """Add a book to library"""
        # Check if already exists
        existing = await LibraryService.check_if_exists(db, book_data.book_url, book_data.source_id)
        if existing:
            return existing
        
        # Create new library book
        library_book = LibraryBook(**book_data.model_dump())
        db.add(library_book)
        await db.commit()
        await db.refresh(library_book)
        return library_book
    
    @staticmethod
    async def remove_book(db: AsyncSession, book_id: int) -> bool:
        """Remove a book from library"""
        book = await LibraryService.get_book_by_id(db, book_id)
        if not book:
            return False
        
        # Delete downloaded file if exists
        if book.download_path and os.path.exists(book.download_path):
            try:
                os.remove(book.download_path)
            except Exception as e:
                print(f"Failed to delete file: {e}")
        
        await db.delete(book)
        await db.commit()
        return True
    
    @staticmethod
    async def update_download_progress(
        db: AsyncSession,
        book_id: int,
        downloaded_chapters: int,
        total_chapters: int,
        progress: int
    ):
        """Update download progress"""
        book = await LibraryService.get_book_by_id(db, book_id)
        if book:
            book.downloaded_chapters = downloaded_chapters
            book.total_chapters = total_chapters
            book.download_progress = progress
            await db.commit()
    
    @staticmethod
    async def mark_as_downloaded(db: AsyncSession, book_id: int, download_path: str):
        """Mark a book as downloaded"""
        book = await LibraryService.get_book_by_id(db, book_id)
        if book:
            book.is_downloaded = True
            book.download_path = download_path
            book.download_progress = 100
            await db.commit()
    
    @staticmethod
    def ensure_download_dir():
        """Ensure download directory exists"""
        LibraryService.DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    @staticmethod
    def get_safe_filename(name: str, author: str = None) -> str:
        """Get a safe filename for the book"""
        # Remove invalid characters
        invalid_chars = '<>:"/\\|?*'
        safe_name = name
        for char in invalid_chars:
            safe_name = safe_name.replace(char, '_')

        if author:
            safe_author = author
            for char in invalid_chars:
                safe_author = safe_author.replace(char, '_')
            filename = f"{safe_name}_{safe_author}.txt"
        else:
            filename = f"{safe_name}.txt"

        return filename

    @staticmethod
    def get_downloaded_chapters(book: LibraryBook) -> Optional[List[dict]]:
        """Get chapter list from downloaded book"""
        if not book.is_downloaded or not book.download_path:
            return None

        book_dir = Path(book.download_path)
        if not book_dir.exists():
            return None

        chapters_file = book_dir / 'chapters.json'
        if not chapters_file.exists():
            return None

        try:
            with open(chapters_file, 'r', encoding='utf-8') as f:
                chapters = json.load(f)
            return chapters
        except Exception as e:
            print(f"Failed to read chapters file: {e}")
            return None

    @staticmethod
    def get_downloaded_chapter_content(book: LibraryBook, chapter_index: int) -> Optional[str]:
        """Get chapter content from downloaded book"""
        if not book.is_downloaded or not book.download_path:
            return None

        book_dir = Path(book.download_path)
        if not book_dir.exists():
            return None

        chapter_file = book_dir / 'chapters' / f'{chapter_index:04d}.txt'
        if not chapter_file.exists():
            return None

        try:
            with open(chapter_file, 'r', encoding='utf-8') as f:
                content = f.read()
            return content
        except Exception as e:
            print(f"Failed to read chapter file: {e}")
            return None

    @staticmethod
    def get_downloaded_book_info(book: LibraryBook) -> Optional[dict]:
        """Get book info from downloaded book's info.json"""
        if not book.is_downloaded or not book.download_path:
            return None

        book_dir = Path(book.download_path)
        if not book_dir.exists():
            return None

        info_file = book_dir / 'info.json'
        if not info_file.exists():
            return None

        try:
            with open(info_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
            return info
        except Exception as e:
            print(f"Failed to read info file: {e}")
            return None

