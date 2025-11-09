"""Download service for downloading entire books"""
import asyncio
import json
from pathlib import Path
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.library_service import LibraryService
from app.services.book_source_service import BookSourceService
from app.services.legado_service import LegadoService


class DownloadService:
    """Service for downloading books"""
    
    # Store active downloads
    active_downloads: Dict[int, dict] = {}
    
    @staticmethod
    async def download_book(
        db: AsyncSession,
        book_id: int,
        book_url: str,
        source_id: int,
        variables: Optional[dict] = None
    ):
        """Download entire book to server"""
        try:
            # Mark as downloading
            DownloadService.active_downloads[book_id] = {
                'status': 'downloading',
                'progress': 0,
                'total_chapters': 0,
                'downloaded_chapters': 0,
                'message': 'Starting download...'
            }
            
            # Get book source
            source = await BookSourceService.get_book_source(db, source_id)
            if not source:
                raise Exception("Book source not found")
            
            compiled_source = BookSourceService.get_compiled_source(source)
            
            # Get book info
            book_info = LegadoService.get_book_info(compiled_source, book_url, variables or {})
            if not book_info:
                raise Exception("Failed to get book info")
            
            # Get chapter list
            toc_url = book_info.get('tocUrl', book_url)
            chapter_variables = book_info.get('variables', {})
            chapters = LegadoService.get_chapter_list(compiled_source, toc_url, chapter_variables)
            
            if not chapters:
                raise Exception("Failed to get chapter list")
            
            total_chapters = len(chapters)
            DownloadService.active_downloads[book_id]['total_chapters'] = total_chapters

            # Update database with initial progress (1 to mark as started)
            await LibraryService.update_download_progress(db, book_id, 0, total_chapters, 1)
            
            # Ensure download directory exists
            LibraryService.ensure_download_dir()
            
            # Get library book for filename
            library_book = await LibraryService.get_book_by_id(db, book_id)
            if not library_book:
                raise Exception("Library book not found")
            
            # Create book directory
            book_dir_name = LibraryService.get_safe_filename(library_book.name, library_book.author).replace('.txt', '')
            book_dir = LibraryService.DOWNLOAD_DIR / book_dir_name
            book_dir.mkdir(parents=True, exist_ok=True)

            # Save book info
            book_info_data = {
                'name': library_book.name,
                'author': library_book.author,
                'intro': library_book.intro,
                'cover_url': library_book.cover_url,
                'kind': library_book.kind,
                'last_chapter': library_book.last_chapter,
                'word_count': library_book.word_count,
                'total_chapters': total_chapters
            }
            info_file = book_dir / 'info.json'
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(book_info_data, f, ensure_ascii=False, indent=2)

            # Prepare chapter list for saving
            chapter_list_data = []

            # Download chapters
            downloaded_chapters = 0
            chapters_dir = book_dir / 'chapters'
            chapters_dir.mkdir(exist_ok=True)

            # Download each chapter
            for i, chapter in enumerate(chapters):
                try:
                    chapter_url = chapter.get('url')
                    chapter_name = chapter.get('name', f'第{i+1}章')
                    chapter_vars = chapter.get('variables', {})

                    # Get next chapter URL for some sources
                    next_url = chapters[i+1].get('url') if i+1 < len(chapters) else ''

                    # Get chapter content
                    content_data = LegadoService.get_chapter_content(
                        compiled_source,
                        chapter_url,
                        chapter_vars,
                        next_url
                    )

                    if content_data and content_data.get('content'):
                        content = content_data['content']

                        # Save chapter to individual file
                        chapter_file = chapters_dir / f'{i:04d}.txt'
                        with open(chapter_file, 'w', encoding='utf-8') as cf:
                            cf.write(content)

                        # Add to chapter list
                        chapter_list_data.append({
                            'index': i,
                            'name': chapter_name,
                            'file': f'chapters/{i:04d}.txt'
                        })

                        downloaded_chapters += 1
                        progress = int((downloaded_chapters / total_chapters) * 100)

                        # Update progress
                        DownloadService.active_downloads[book_id].update({
                            'downloaded_chapters': downloaded_chapters,
                            'progress': progress,
                            'message': f'Downloading: {chapter_name}'
                        })

                        # Update database every 10 chapters
                        if downloaded_chapters % 10 == 0:
                            await LibraryService.update_download_progress(
                                db, book_id, downloaded_chapters, total_chapters, progress
                            )

                    # Small delay to avoid overwhelming the server
                    await asyncio.sleep(0.1)

                except Exception as e:
                    print(f"Failed to download chapter {i+1}: {e}")
                    continue

            # Save chapter list
            chapters_file = book_dir / 'chapters.json'
            with open(chapters_file, 'w', encoding='utf-8') as f:
                json.dump(chapter_list_data, f, ensure_ascii=False, indent=2)
            
            # Mark as completed - save the book directory path
            relative_path = str(book_dir)
            await LibraryService.mark_as_downloaded(db, book_id, relative_path)
            
            DownloadService.active_downloads[book_id].update({
                'status': 'completed',
                'progress': 100,
                'downloaded_chapters': downloaded_chapters,
                'message': f'Download completed! {downloaded_chapters}/{total_chapters} chapters'
            })
            
        except Exception as e:
            DownloadService.active_downloads[book_id] = {
                'status': 'failed',
                'progress': 0,
                'total_chapters': 0,
                'downloaded_chapters': 0,
                'message': str(e)
            }
            raise
    
    @staticmethod
    async def get_download_progress(db: AsyncSession, book_id: int) -> Optional[dict]:
        """Get download progress for a book from database and memory"""
        # First check in-memory status (most up-to-date for active downloads)
        if book_id in DownloadService.active_downloads:
            return DownloadService.active_downloads[book_id]

        # Then check database
        book = await LibraryService.get_book_by_id(db, book_id)
        if not book:
            return None

        # Return database status
        if book.is_downloaded:
            return {
                'total_chapters': book.total_chapters,
                'downloaded_chapters': book.downloaded_chapters,
                'progress': book.download_progress,
                'status': 'completed',
                'message': None
            }
        elif book.download_progress > 0:
            # Was downloading (maybe different worker or server restart)
            return {
                'total_chapters': book.total_chapters,
                'downloaded_chapters': book.downloaded_chapters,
                'progress': book.download_progress,
                'status': 'downloading',
                'message': f'正在下载第 {book.downloaded_chapters + 1} 章'
            }
        else:
            return {
                'total_chapters': book.total_chapters,
                'downloaded_chapters': 0,
                'progress': 0,
                'status': 'not_started',
                'message': None
            }

    @staticmethod
    async def get_all_active_downloads(db: AsyncSession) -> Dict[int, dict]:
        """Get all active downloads from database and memory"""
        from sqlalchemy import select
        from app.models.library import LibraryBook

        downloads = {}

        # First, add all in-memory active downloads (most up-to-date)
        for book_id, progress_data in DownloadService.active_downloads.items():
            if progress_data.get('status') == 'downloading':
                downloads[book_id] = progress_data

        # Then, check database for downloads that might not be in memory
        # (e.g., after server restart)
        stmt = select(LibraryBook).where(
            LibraryBook.download_progress > 0,
            LibraryBook.is_downloaded == False
        )
        result = await db.execute(stmt)
        books = result.scalars().all()

        for book in books:
            # Only add if not already in downloads (memory takes priority)
            if book.id not in downloads:
                downloads[book.id] = {
                    'total_chapters': book.total_chapters,
                    'downloaded_chapters': book.downloaded_chapters,
                    'progress': book.download_progress,
                    'status': 'downloading',
                    'message': f'正在下载第 {book.downloaded_chapters + 1} 章'
                }

        return downloads

    @staticmethod
    async def is_downloading(db: AsyncSession, book_id: int) -> bool:
        """Check if a book is currently being downloaded"""
        # Check in-memory status first (fastest)
        if book_id in DownloadService.active_downloads:
            progress = DownloadService.active_downloads[book_id]
            return progress.get('status') == 'downloading'

        # Check database status
        book = await LibraryService.get_book_by_id(db, book_id)
        if not book:
            return False

        return book.download_progress > 0 and not book.is_downloaded

