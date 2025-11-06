import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, List } from 'lucide-react';
import { bookApi, libraryApi } from '@/services/api';
import type { Chapter, ChapterContent } from '@/types';

export default function Reader() {
  const location = useLocation();
  const navigate = useNavigate();

  const { sourceId, chapter, chapters, currentIndex, libraryBookId, directoryName } = location.state as {
    sourceId: number;
    chapter: Chapter;
    chapters: Chapter[];
    currentIndex: number;
    libraryBookId?: number | null;
    directoryName?: string;
  };

  const [content, setContent] = useState<ChapterContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChapterList, setShowChapterList] = useState(false);
  const [index, setIndex] = useState(currentIndex);
  const [loadingNextPage, setLoadingNextPage] = useState(false);

  useEffect(() => {
    // For downloaded books, we don't need sourceId
    if (!chapter) {
      navigate('/');
      return;
    }

    // For non-downloaded books, we need sourceId
    if (!directoryName && !libraryBookId && !sourceId) {
      navigate('/');
      return;
    }

    loadChapter(chapters[index]);
  }, [index]);

  const loadChapter = async (chap: Chapter) => {
    setLoading(true);
    try {
      // Priority 1: If we have directory name, load directly from directory (fastest, works offline)
      const dirName = (chap.variables?.directoryName as string) || directoryName;
      if (dirName && chap.variables?.index !== undefined) {
        console.log(`Loading chapter from directory: ${dirName}, index: ${chap.variables.index}`);
        const response = await libraryApi.getDownloadedChapterContentByDir(
          dirName,
          chap.variables.index
        );
        setContent(response.data);
      } else if (libraryBookId && chap.variables?.index !== undefined) {
        // Priority 2: If book is downloaded, load from server using library book ID
        console.log(`Loading chapter from library book ID: ${libraryBookId}, index: ${chap.variables.index}`);
        const response = await libraryApi.getDownloadedChapterContent(
          libraryBookId,
          chap.variables.index
        );
        setContent(response.data);
      } else {
        // Priority 3: Load from book source (requires internet)
        console.log('Loading chapter from book source (requires internet)');
        const nextChapterUrl = index < chapters.length - 1 ? chapters[index + 1].url : '';
        const response = await bookApi.getChapterContent({
          source_id: sourceId,
          chapter_url: chap.url,
          variables: chap.variables,
          next_chapter_url: nextChapterUrl,
        });
        setContent(response.data);
      }
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Failed to load chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNextPage = async () => {
    if (!content?.next_url) return;

    setLoadingNextPage(true);
    try {
      const nextChapterUrl = index < chapters.length - 1 ? chapters[index + 1].url : '';
      const response = await bookApi.getChapterContent({
        source_id: sourceId,
        chapter_url: content.next_url,
        variables: chapters[index].variables,
        next_chapter_url: nextChapterUrl,
      });

      // 拼接内容
      setContent({
        content: content.content + '\n' + response.data.content,
        next_url: response.data.next_url,
      });
    } catch (error) {
      console.error('Failed to load next page:', error);
    } finally {
      setLoadingNextPage(false);
    }
  };

  const goToPrevChapter = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  const goToNextChapter = () => {
    if (index < chapters.length - 1) {
      setIndex(index + 1);
    }
  };

  const goToChapter = (newIndex: number) => {
    setIndex(newIndex);
    setShowChapterList(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
              返回
            </button>
            <button
              onClick={() => setShowChapterList(!showChapterList)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <List className="w-5 h-5" />
              目录
            </button>
          </div>
        </div>
      </div>

      {/* Chapter List Sidebar */}
      {showChapterList && (
        <div className="fixed inset-0 z-20 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setShowChapterList(false)}
          />
          <div className="w-80 bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                章节列表
              </h3>
              <div className="space-y-1">
                {chapters.map((chap, i) => (
                  <button
                    key={`${chap.url}-${i}`}
                    onClick={() => goToChapter(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      i === index
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {chap.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : content ? (
          <div className="card p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
              {chapters[index].name}
            </h1>
            <div
              className="prose dark:prose-invert max-w-none reader-content"
              style={{
                fontSize: '18px',
                lineHeight: '2',
                color: 'inherit',
              }}
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
            <style>{`
              .reader-content p {
                margin-bottom: 1em;
                text-indent: 2em;
              }
              .reader-content p:last-child {
                margin-bottom: 0;
              }
            `}</style>

            {/* 下一页按钮 - 只在有next_url时显示 */}
            {content.next_url && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={loadNextPage}
                  disabled={loadingNextPage}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingNextPage ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-5 h-5" />
                      加载下一页
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-600 dark:text-gray-400">加载失败</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 mb-20 md:mb-8">
          <button
            onClick={goToPrevChapter}
            disabled={index === 0}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            上一章
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {index + 1} / {chapters.length}
          </span>
          <button
            onClick={goToNextChapter}
            disabled={index === chapters.length - 1}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一章
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

