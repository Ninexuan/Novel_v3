"""Service for integrating with LegadoParser"""
import sys
import json
import re
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from app.config import settings

# Add LegadoParser to Python path
legado_path = str(settings.LEGADO_PARSER_PATH)
if legado_path not in sys.path:
    sys.path.insert(0, legado_path)

# Import LegadoParser modules
from LegadoParser2.RuleCompile import compileBookSource
from LegadoParser2.Search import search as legado_search
from LegadoParser2.BookInfo import getBookInfo
from LegadoParser2.ChapterList import getChapterList
from LegadoParser2.Chapter import getChapterContent

class LegadoService:
    """Service for handling Legado book source operations"""

    # 不支持的JavaScript特性关键字
    UNSUPPORTED_KEYWORDS = [
        'java.ajax',
        'java.get',
        'java.put',
        'java.post',
        'java.base64Encode',
        'java.base64Decode',
        'java.getString',
        'java.toast',
        'java.log',
        'java.timeFormat',
        'java.hexDecodeToString',
        'source.getVariable',
        'source.setVariable',
        'source.getLoginInfoMap',
        'source.variable',
    ]

    @staticmethod
    def validate_book_source_compatibility(book_source: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        验证书源是否与LegadoParser兼容

        Args:
            book_source: 书源字典

        Returns:
            (is_compatible, error_message) - 如果兼容返回(True, None)，否则返回(False, 错误信息)
        """
        # 将书源转换为JSON字符串以便搜索
        source_json_str = json.dumps(book_source, ensure_ascii=False)

        # 检查是否包含不支持的关键字
        found_keywords = []
        for keyword in LegadoService.UNSUPPORTED_KEYWORDS:
            if keyword in source_json_str:
                found_keywords.append(keyword)

        if found_keywords:
            error_msg = (
                f"❌ 此书源使用了不支持的高级JavaScript特性，无法在本平台使用。\n\n"
                f"检测到以下不兼容的功能：\n"
                f"  • {', '.join(found_keywords[:5])}"  # 只显示前5个
            )
            if len(found_keywords) > 5:
                error_msg += f"\n  • ... 以及其他 {len(found_keywords) - 5} 个功能"

            error_msg += (
                f"\n\n💡 本平台仅支持使用简单规则的Legado书源，包括：\n"
                f"  ✓ CSS选择器 (如: .item, h3 a@text)\n"
                f"  ✓ XPath (如: //div[@class='book'])\n"
                f"  ✓ JSONPath (如: $.data.list[*])\n"
                f"  ✓ 正则表达式\n"
                f"  ✓ 简单的JavaScript表达式\n\n"
                f"❌ 不支持依赖Legado APP运行时环境的复杂JavaScript代码\n\n"
                f"建议：请使用类似笔趣阁这样的简单规则书源。"
            )
            return False, error_msg

        return True, None

    @staticmethod
    def parse_book_source(source_json: str) -> Dict[str, Any]:
        """
        Parse and validate book source JSON

        Args:
            source_json: JSON string of book source

        Returns:
            Parsed book source dict

        Raises:
            ValueError: If JSON is invalid or incompatible
        """
        try:
            if isinstance(source_json, str):
                book_source = json.loads(source_json)
            else:
                book_source = source_json

            # Validate required fields
            required_fields = ['bookSourceName', 'bookSourceUrl']
            for field in required_fields:
                if field not in book_source:
                    raise ValueError(f"Missing required field: {field}")

            # 验证书源兼容性
            is_compatible, error_msg = LegadoService.validate_book_source_compatibility(book_source)
            if not is_compatible:
                raise ValueError(error_msg)

            return book_source
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
    
    @staticmethod
    def compile_source(book_source: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compile book source using LegadoParser
        
        Args:
            book_source: Book source dict
            
        Returns:
            Compiled book source
        """
        return compileBookSource(book_source)
    
    @staticmethod
    def search(compiled_source: Dict[str, Any], keyword: str, page: int = 1) -> List[Dict[str, Any]]:
        """
        Search books using compiled source

        Args:
            compiled_source: Compiled book source
            keyword: Search keyword
            page: Page number

        Returns:
            List of search results
        """
        try:
            results = legado_search(compiled_source, keyword, page)
            return results if results else []
        except Exception as e:
            print(f"Search error: {str(e)}")
            return []

    @staticmethod
    def explore(compiled_source: Dict[str, Any], url: str, page: int = 1) -> List[Dict[str, Any]]:
        """
        Explore books using compiled source

        Args:
            compiled_source: Compiled book source
            url: Explore URL (relative path)
            page: Page number

        Returns:
            List of books
        """
        try:
            # Lazy import to avoid circular dependency
            from LegadoParser2.Explore import explore as legado_explore
            results = legado_explore(compiled_source, url, page)
            return results if results else []
        except Exception as e:
            print(f"Search error: {str(e)}")
            return []
    
    @staticmethod
    def get_book_info(compiled_source: Dict[str, Any], url: str, variables: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get book information
        
        Args:
            compiled_source: Compiled book source
            url: Book URL
            variables: Variables from search result
            
        Returns:
            Book information dict or None
        """
        try:
            return getBookInfo(compiled_source, url, variables)
        except Exception as e:
            print(f"Get book info error: {str(e)}")
            return None
    
    @staticmethod
    def get_chapter_list(compiled_source: Dict[str, Any], url: str, variables: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get chapter list
        
        Args:
            compiled_source: Compiled book source
            url: TOC URL
            variables: Variables from book info
            
        Returns:
            List of chapters
        """
        try:
            chapters = getChapterList(compiled_source, url, variables)
            return chapters if chapters else []
        except Exception as e:
            print(f"Get chapter list error: {str(e)}")
            return []
    
    @staticmethod
    def get_chapter_content(
        compiled_source: Dict[str, Any],
        url: str,
        variables: Dict[str, Any],
        next_chapter_url: str = ''
    ) -> Optional[Dict[str, Any]]:
        """
        Get chapter content

        Args:
            compiled_source: Compiled book source
            url: Chapter URL
            variables: Variables from chapter
            next_chapter_url: Next chapter URL

        Returns:
            Chapter content dict or None
        """
        try:
            result = getChapterContent(compiled_source, url, variables, next_chapter_url)

            # 格式化内容：将换行符转换为HTML段落标签，以便在前端正确显示
            if result and 'content' in result:
                content = result['content']

                # 将内容按换行符分割成段落
                paragraphs = content.split('\n')

                # 过滤空段落，并为每个段落添加<p>标签
                formatted_paragraphs = []
                for para in paragraphs:
                    para = para.strip()
                    if para:  # 只保留非空段落
                        formatted_paragraphs.append(f'<p>{para}</p>')

                # 合并所有段落
                result['content'] = '\n'.join(formatted_paragraphs)

            return result
        except Exception as e:
            print(f"Get chapter content error: {str(e)}")
            return None

