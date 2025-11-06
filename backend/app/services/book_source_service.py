"""Service for book source CRUD operations"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.book_source import BookSource
from app.schemas.book_source import BookSourceCreate, BookSourceUpdate
from app.services.legado_service import LegadoService
import json

class BookSourceService:
    """Service for managing book sources"""
    
    @staticmethod
    async def create_book_source(db: AsyncSession, source_data: BookSourceCreate) -> BookSource:
        """
        Create a new book source
        
        Args:
            db: Database session
            source_data: Book source creation data
            
        Returns:
            Created book source
            
        Raises:
            ValueError: If source JSON is invalid
        """
        # Parse and validate source JSON
        book_source_dict = LegadoService.parse_book_source(source_data.source_json)
        
        # Create book source model
        book_source = BookSource(
            name=book_source_dict.get('bookSourceName', 'Unknown'),
            url=book_source_dict.get('bookSourceUrl', ''),
            source_type=book_source_dict.get('bookSourceType', 0),
            enabled=book_source_dict.get('enabled', True),
            source_group=book_source_dict.get('bookSourceGroup'),
            source_comment=book_source_dict.get('bookSourceComment'),
            source_json=source_data.source_json,
            custom_order=book_source_dict.get('customOrder', 0),
            weight=book_source_dict.get('weight', 0)
        )
        
        db.add(book_source)
        await db.commit()
        await db.refresh(book_source)
        
        return book_source
    
    @staticmethod
    async def get_book_source(db: AsyncSession, source_id: int) -> Optional[BookSource]:
        """Get a book source by ID"""
        result = await db.execute(select(BookSource).where(BookSource.id == source_id))
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_all_book_sources(
        db: AsyncSession, 
        enabled_only: bool = False,
        skip: int = 0,
        limit: int = 100
    ) -> List[BookSource]:
        """Get all book sources"""
        query = select(BookSource)
        
        if enabled_only:
            query = query.where(BookSource.enabled == True)
        
        query = query.order_by(BookSource.custom_order, BookSource.id)
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    async def update_book_source(
        db: AsyncSession, 
        source_id: int, 
        update_data: BookSourceUpdate
    ) -> Optional[BookSource]:
        """Update a book source"""
        book_source = await BookSourceService.get_book_source(db, source_id)
        
        if not book_source:
            return None
        
        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        
        # If source_json is updated, re-parse it
        if 'source_json' in update_dict:
            book_source_dict = LegadoService.parse_book_source(update_dict['source_json'])
            book_source.name = book_source_dict.get('bookSourceName', book_source.name)
            book_source.url = book_source_dict.get('bookSourceUrl', book_source.url)
            book_source.source_type = book_source_dict.get('bookSourceType', book_source.source_type)
            book_source.source_group = book_source_dict.get('bookSourceGroup', book_source.source_group)
            book_source.source_comment = book_source_dict.get('bookSourceComment', book_source.source_comment)
            book_source.custom_order = book_source_dict.get('customOrder', book_source.custom_order)
            book_source.weight = book_source_dict.get('weight', book_source.weight)
            book_source.source_json = update_dict['source_json']
        
        # Update other fields
        for field, value in update_dict.items():
            if field != 'source_json' and hasattr(book_source, field):
                setattr(book_source, field, value)
        
        await db.commit()
        await db.refresh(book_source)
        
        return book_source
    
    @staticmethod
    async def delete_book_source(db: AsyncSession, source_id: int) -> bool:
        """Delete a book source"""
        result = await db.execute(delete(BookSource).where(BookSource.id == source_id))
        await db.commit()
        return result.rowcount > 0
    
    @staticmethod
    def get_compiled_source(book_source: BookSource) -> dict:
        """Get compiled source from book source"""
        source_dict = json.loads(book_source.source_json)
        return LegadoService.compile_source(source_dict)

