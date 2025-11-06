"""API endpoints for book search"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.database import get_db
from app.schemas.book_source import SearchRequest, SearchResult
from app.services.book_source_service import BookSourceService
from app.services.legado_service import LegadoService
import asyncio
import json

router = APIRouter(prefix="/search", tags=["Search"])

async def _search_single_source(source, keyword: str, page: int, max_pages: int = 3) -> List[SearchResult]:
    """
    Search in a single book source (helper function for parallel search)

    Args:
        source: Book source to search
        keyword: Search keyword
        page: Starting page number (usually 1)
        max_pages: Maximum number of pages to search (default: 3)

    Returns:
        List of search results from all pages combined
    """
    try:
        compiled_source = BookSourceService.get_compiled_source(source)
        all_results = []
        keyword_lower = keyword.lower()

        # 搜索多页以获取更多结果
        for current_page in range(page, page + max_pages):
            # 在线程池中运行同步的搜索函数，避免阻塞事件循环
            results = await asyncio.to_thread(LegadoService.search, compiled_source, keyword, current_page)

            # 如果当前页没有结果，停止搜索后续页
            if not results:
                break

            # Add source info to results
            for result in results:
                book_name = result.get('name', '')
                author = result.get('author', '')

                # 宽松的关键词匹配验证
                # 只有当关键词长度>=2时才进行严格过滤
                # 单字关键词（如"我"）可能匹配不到，所以放宽限制
                should_include = True
                if len(keyword) >= 2:
                    # 关键词长度>=2，进行严格匹配
                    name_match = keyword_lower in book_name.lower()
                    author_match = author and keyword_lower in author.lower()
                    should_include = name_match or author_match
                # 否则，信任书源的搜索结果，不进行过滤

                if should_include:
                    search_result = SearchResult(
                        name=book_name,
                        author=author,
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
                    all_results.append(search_result)

            # 如果结果数量少于5个，说明可能是最后一页了
            if len(results) < 5:
                break

        return all_results
    except Exception as e:
        print(f"Error searching in source {source.name}: {str(e)}")
        return []


@router.post("/stream")
async def search_books_stream(
    search_request: SearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Search books across all or specified book sources with streaming response
    Returns results as they become available (Server-Sent Events)
    """
    async def event_generator():
        # Get book sources
        if search_request.source_ids:
            sources = []
            for source_id in search_request.source_ids:
                source = await BookSourceService.get_book_source(db, source_id)
                if source and source.enabled:
                    sources.append(source)
        else:
            sources = await BookSourceService.get_all_book_sources(db, enabled_only=True)

        if not sources:
            yield f"data: {json.dumps({'done': True, 'results': []})}\n\n"
            return

        # 创建任务队列
        pending_tasks = {
            asyncio.create_task(_search_single_source(source, search_request.keyword, search_request.page)): source
            for source in sources
        }

        # 当有任务完成时立即返回结果
        while pending_tasks:
            done, pending = await asyncio.wait(
                pending_tasks.keys(),
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in done:
                source = pending_tasks.pop(task)
                try:
                    results = task.result()
                    # 发送这个书源的搜索结果（即使没有结果也发送，让前端知道这个书源已完成）
                    event_data = {
                        'source_id': source.id,
                        'source_name': source.name,
                        'results': [r.dict() for r in results],
                        'done': False
                    }
                    yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
                except Exception as e:
                    print(f"Search error in {source.name}: {str(e)}")

        # 发送完成信号
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/", response_model=List[SearchResult])
async def search_books(
    search_request: SearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Search books across all or specified book sources
    Returns results from all sources combined (legacy endpoint, waits for all sources)
    Uses parallel search for better performance
    """
    # Get book sources
    if search_request.source_ids:
        sources = []
        for source_id in search_request.source_ids:
            source = await BookSourceService.get_book_source(db, source_id)
            if source and source.enabled:
                sources.append(source)
    else:
        sources = await BookSourceService.get_all_book_sources(db, enabled_only=True)

    if not sources:
        return []

    # 并行搜索所有书源（提高速度）
    tasks = [
        _search_single_source(source, search_request.keyword, search_request.page)
        for source in sources
    ]

    # 等待所有搜索任务完成
    results_lists = await asyncio.gather(*tasks, return_exceptions=True)

    # 合并所有结果
    all_results = []
    for results in results_lists:
        if isinstance(results, list):
            all_results.extend(results)

    return all_results

@router.get("/by-source/{source_id}", response_model=List[SearchResult])
async def search_books_by_source(
    source_id: int,
    keyword: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """
    Search books in a specific book source
    Useful for searching one source at a time
    """
    source = await BookSourceService.get_book_source(db, source_id)

    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book source not found")

    if not source.enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Book source is disabled")

    try:
        compiled_source = BookSourceService.get_compiled_source(source)
        results = LegadoService.search(compiled_source, keyword, page)

        search_results = []
        keyword_lower = keyword.lower()

        for result in results:
            book_name = result.get('name', '')
            author = result.get('author', '')

            # 宽松的关键词匹配验证
            # 只有当关键词长度>=2时才进行严格过滤
            should_include = True
            if len(keyword) >= 2:
                # 关键词长度>=2，进行严格匹配
                name_match = keyword_lower in book_name.lower()
                author_match = author and keyword_lower in author.lower()
                should_include = name_match or author_match
            # 否则，信任书源的搜索结果，不进行过滤

            if should_include:
                search_result = SearchResult(
                    name=book_name,
                    author=author,
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
                search_results.append(search_result)

        return search_results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

