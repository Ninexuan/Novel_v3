import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, BookOpen } from 'lucide-react';
import { searchApi, exploreApi, bookSourceApi } from '@/services/api';
import type { SearchResult } from '@/types';

export default function Home() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<SearchResult[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setSearching(true);
    setResults([]); // 清空之前的结果

    try {
      await searchApi.searchStream(
        { keyword: keyword.trim(), page: 1 },
        // onResult: 每个书源返回结果时调用
        (_sourceId, _sourceName, newResults) => {
          setResults(prev => [...prev, ...newResults]);
        },
        // onComplete: 所有书源搜索完成时调用
        () => {
          setSearching(false);
        },
        // onError: 发生错误时调用
        (error) => {
          console.error('Search failed:', error);
          setSearching(false);
        }
      );
    } catch (error) {
      console.error('Search failed:', error);
      setSearching(false);
    }
  };

  const handleBookClick = (result: SearchResult) => {
    navigate('/book', { state: { searchResult: result } });
  };

  // 加载阅友书源的推荐小说
  useEffect(() => {
    const loadRecommendedBooks = async () => {
      try {
        // 获取所有书源
        const sourcesResponse = await bookSourceApi.getAll(true);
        const sources = sourcesResponse.data;

        // 查找阅友书源
        const yueyouSource = sources.find(s => s.name.includes('阅友'));
        if (!yueyouSource) {
          console.log('未找到阅友书源，跳过推荐加载');
          return;
        }

        // 获取分类
        const categoriesResponse = await exploreApi.getCategories(yueyouSource.id);
        const allCategories = categoriesResponse.data;

        setLoadingRecommended(true);

        // 获取玄幻和都市两个分类的小说
        const xuanhuanCategory = allCategories.find(c => c.title.includes('玄幻'));
        const dushiCategory = allCategories.find(c => c.title.includes('都市'));

        const allBooks: SearchResult[] = [];

        // 获取玄幻小说
        if (xuanhuanCategory && xuanhuanCategory.url) {
          const xuanhuanResponse = await exploreApi.explore({
            source_id: yueyouSource.id,
            url: xuanhuanCategory.url,
            page: 1,
          });
          allBooks.push(...xuanhuanResponse.data);
        }

        // 获取都市小说
        if (dushiCategory && dushiCategory.url) {
          const dushiResponse = await exploreApi.explore({
            source_id: yueyouSource.id,
            url: dushiCategory.url,
            page: 1,
          });
          allBooks.push(...dushiResponse.data);
        }

        // 随机打乱并取前15本
        const shuffled = allBooks.sort(() => Math.random() - 0.5);
        setRecommendedBooks(shuffled.slice(0, 15));
      } catch (error) {
        console.error('加载推荐小说失败（可能是网络问题）:', error);
        // 快速失败，不影响其他功能
      } finally {
        setLoadingRecommended(false);
      }
    };

    // 延迟加载推荐，避免阻塞页面渲染
    const timer = setTimeout(() => {
      loadRecommendedBooks();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            发现你的下一本好书
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            搜索海量书源，开启阅读之旅
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            💡 若搜索无结果，请稍等片刻后重试
          </p>
        </div>
        

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="relative">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入书名、作者或关键词..."
              className="w-full px-6 py-4 pr-14 text-lg rounded-2xl border-2 border-gray-200 dark:border-gray-700 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:border-primary-500 dark:focus:border-primary-400
                       shadow-lg transition-all"
            />
            <button
              type="submit"
              disabled={searching || !keyword.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl
                       bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600
                       text-white disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            >
              {searching ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
          </div>
        </form>

        {/* Recommended Books */}
        {!searching && results.length === 0 && recommendedBooks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              📚 推荐小说 <span className="text-lg font-normal text-gray-600 dark:text-gray-400">· 玄幻 & 都市</span>
            </h2>
            {loadingRecommended ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recommendedBooks.map((book, index) => (
                  <div
                    key={`${book.source_id}-${book.book_url}-${index}`}
                    onClick={() => handleBookClick(book)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-[3/4] mb-2 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-md group-hover:shadow-xl transition-shadow">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                      {book.name}
                    </h3>
                    {book.author && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {book.author}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              搜索结果 ({results.length})
            </h2>
            <div className="grid gap-4">
              {results.map((result, index) => (
                <div
                  key={`${result.source_id}-${result.book_url}-${index}`}
                  onClick={() => handleBookClick(result)}
                  className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex gap-4">
                    {result.cover_url ? (
                      <img
                        src={result.cover_url}
                        alt={result.name}
                        className="w-20 h-28 object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {result.name}
                      </h3>
                      {result.author && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          作者: {result.author}
                        </p>
                      )}
                      {result.intro && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {result.intro}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                        <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                          {result.source_name}
                        </span>
                        {result.kind && <span>{result.kind}</span>}
                        {result.word_count && <span>{result.word_count}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

