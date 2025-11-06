"""
书籍发现/探索

用于获取书源的推荐、分类等书籍列表
"""
from typing import List
from .RuleJs.JS import EvalJs
from .RuleEval import getElements, getStrings, getString
from .RuleUrl.Url import parseUrl, getContent, urljoin
from .FormatUtils import Fmt
from .config import DEBUG_MODE


def explore(compiledBookSource, url, page=1):
    """
    探索书籍列表
    
    Args:
        compiledBookSource: 编译后的书源
        url: 探索URL（相对路径）
        page: 页码
    
    Returns:
        书籍列表
    """
    evalJS = EvalJs(compiledBookSource)
    exploreObj = parseExploreUrl(compiledBookSource, url, page, evalJS)
    content, redirected = getContent(exploreObj)
    
    return getExploreResult(compiledBookSource, exploreObj, content, evalJS)


def parseExploreUrl(bS, url, page, evalJs):
    """
    解析探索URL
    
    Args:
        bS: 书源配置
        url: 探索URL（相对路径）
        page: 页码
        evalJs: JS执行器
    
    Returns:
        URL对象
    """
    baseUrl = bS['bookSourceUrl']
    # 删除链接中的fragment
    baseUrl = baseUrl.split('#', 1)[0]
    
    if bS.get('header', None):
        headers = bS['header']
    else:
        headers = ''
    
    evalJs.set('page', page)
    
    # 拼接完整URL
    fullUrl = urljoin(baseUrl, url)
    
    exploreObj = parseUrl(fullUrl, evalJs, baseUrl, headers)
    
    evalJs.set('baseUrl', exploreObj['rawUrl'])
    return exploreObj


def getExploreResult(bS, urlObj, content, evalJs: EvalJs, **kwargs):
    """
    获取探索结果
    
    Args:
        bS: 书源配置
        urlObj: URL对象
        content: 页面内容
        evalJs: JS执行器
    
    Returns:
        书籍列表
    """
    ruleExplore = bS.get('ruleExplore', {})
    
    if not ruleExplore:
        return []
    
    elements = getElements(content, ruleExplore['bookList'], evalJs)
    
    exploreResult: List[dict] = []
    finalUrl = urlObj['finalurl']  # 最终访问的url，可能是跳转后的Url
    
    for e in elements:
        bookInfo = {}
        try:
            bookInfo['name'] = Fmt.bookName(getString(e, ruleExplore['name'], evalJs).strip())
            bookUrlList = getStrings(e, ruleExplore['bookUrl'], evalJs)
            if bookUrlList:
                bookInfo['bookUrl'] = urljoin(finalUrl, bookUrlList[0].strip())
            else:
                bookInfo['bookUrl'] = urlObj['rawUrl']
            if ruleExplore.get('author', None):
                bookInfo['author'] = Fmt.author(getString(e, ruleExplore['author'], evalJs).strip())
            if ruleExplore.get('kind', None):
                bookInfo['kind'] = ','.join(getStrings(e, ruleExplore['kind'], evalJs)).strip()
            if ruleExplore.get('coverUrl', None):
                bookInfo['coverUrl'] = urljoin(finalUrl,
                                               getString(e, ruleExplore['coverUrl'], evalJs).strip())
            if ruleExplore.get('wordCount', None):
                bookInfo['wordCount'] = Fmt.wordCount(
                    getString(e, ruleExplore['wordCount'], evalJs).strip())
            if ruleExplore.get('intro', None):
                bookInfo['intro'] = Fmt.html(getString(e, ruleExplore['intro'], evalJs).strip())
            if ruleExplore.get('lastChapter', None):
                bookInfo['lastChapter'] = getString(e, ruleExplore['lastChapter'], evalJs).strip()
            bookInfo['variables'] = evalJs.dumpVariables()
        except IndexError as e:
            if not len(exploreResult):
                if DEBUG_MODE:
                    raise
        else:
            exploreResult.append(bookInfo)
    
    return exploreResult

