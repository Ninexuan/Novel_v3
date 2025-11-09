import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader2, List, Heart, HardDrive } from 'lucide-react';
import { bookApi, libraryApi } from '@/services/api';
import type { SearchResult, BookInfo, Chapter, DownloadProgress } from '@/types';

export default function BookDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchResult = location.state?.searchResult as SearchResult;
  const fromLibrary = location.state?.fromLibrary as boolean;
  const initialLibraryBookId = location.state?.libraryBookId as number | null;
  const isDownloaded = location.state?.isDownloaded as boolean;
  const directoryName = location.state?.directoryName as string | undefined;

  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [libraryBookId, setLibraryBookId] = useState<number | null>(initialLibraryBookId);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    if (!searchResult) {
      navigate('/');
      return;
    }

    const init = async () => {
      // If coming from library with directory name, load directly from directory (fastest, works offline)
      if (fromLibrary && isDownloaded && directoryName) {
        console.log('Loading from library using directory name (offline mode)...');
        setIsFavorited(true);
        setLoading(true);
        try {
          await loadFromDirectory(directoryName);
        } catch (error) {
          console.error('Failed to load from directory:', error);
          alert('加载失败：' + (error as Error).message);
        } finally {
          setLoading(false);
        }
      } else if (fromLibrary && initialLibraryBookId && isDownloaded) {
        // Fallback: load using library book ID
        console.log('Loading from library (downloaded book)...');
        setIsFavorited(true);
        setLoading(true);
        try {
          await loadFromServer(initialLibraryBookId);
        } catch (error) {
          console.error('Failed to load from server:', error);
          alert('加载失败：' + (error as Error).message);
        } finally {
          setLoading(false);
        }
      } else if (fromLibrary && initialLibraryBookId) {
        // If coming from library but not downloaded, still mark as favorited
        console.log('Loading from library (not downloaded)...');
        setIsFavorited(true);
        await checkFavoriteStatusAndLoadInfo();
      } else {
        // Coming from search or other pages
        await checkFavoriteStatusAndLoadInfo();
      }
    };
    init();
  }, [searchResult]);

  // Poll for download progress if book is in library
  useEffect(() => {
    if (!libraryBookId) return;

    const checkDownloadStatus = async () => {
      try {
        const response = await libraryApi.getDownloadProgress(libraryBookId);
        const progress = response.data;

        if (progress.status === 'downloading') {
          setDownloading(true);
          setDownloadProgress(progress);
        } else if (progress.status === 'completed') {
          setDownloading(false);
          setDownloadProgress(null);
        } else if (progress.status === 'failed') {
          setDownloading(false);
          setDownloadProgress(progress);
        }
      } catch (error) {
        console.error('Failed to check download status:', error);
      }
    };

    // Check immediately
    checkDownloadStatus();

    // Poll every 2 seconds
    const interval = setInterval(checkDownloadStatus, 2000);

    return () => clearInterval(interval);
  }, [libraryBookId]);

  const checkFavoriteStatusAndLoadInfo = async () => {
    setLoading(true);
    try {
      // First check if book is in library
      const response = await libraryApi.checkIfInLibrary(
        searchResult.book_url,
        searchResult.source_id
      );

      if (response.data.in_library) {
        setIsFavorited(true);
        setLibraryBookId(response.data.book_id);

        // If book is downloaded, load from server
        if (response.data.book && response.data.book.is_downloaded && response.data.book_id) {
          console.log('Book is downloaded, loading from server...');
          await loadFromServer(response.data.book_id);
          setLoading(false);
          return;
        }
      } else {
        setIsFavorited(false);
        setLibraryBookId(null);
      }

      // Otherwise, load from book source
      console.log('Book not downloaded, loading from book source...');
      await loadFromBookSource();
    } catch (error) {
      console.error('Failed to load book:', error);
      alert('加载失败：' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadFromDirectory = async (dirName: string) => {
    try {
      // Get full info from directory (works offline)
      const infoResponse = await libraryApi.getDownloadedInfoByDir(dirName);
      const serverInfo = infoResponse.data;

      // Set book info
      setBookInfo({
        name: serverInfo.name,
        author: serverInfo.author,
        cover_url: serverInfo.cover_url,
        intro: serverInfo.intro,
        kind: serverInfo.kind,
        last_chapter: serverInfo.last_chapter,
        word_count: serverInfo.word_count,
        toc_url: '', // Not needed for downloaded books
        variables: {},
      });

      // Load chapters from directory (works offline)
      const chaptersResponse = await libraryApi.getDownloadedChaptersByDir(dirName);
      const downloadedChapters = chaptersResponse.data.map((ch: any) => ({
        name: ch.name,
        url: '', // Not needed for downloaded chapters
        variables: { index: ch.index, directoryName: dirName } // Store directory name for reader
      }));
      setChapters(downloadedChapters);
    } catch (error) {
      console.error('Failed to load from directory:', error);
      throw error;
    }
  };

  const loadFromServer = async (bookId: number) => {
    try {
      // Get full info from server
      const infoResponse = await libraryApi.getFullInfo(bookId);
      const serverInfo = infoResponse.data;

      // Set book info
      setBookInfo({
        name: serverInfo.name,
        author: serverInfo.author,
        cover_url: serverInfo.cover_url,
        intro: serverInfo.intro,
        kind: serverInfo.kind,
        last_chapter: serverInfo.last_chapter,
        word_count: serverInfo.word_count,
        toc_url: '', // Not needed for downloaded books
        variables: serverInfo.variables ? JSON.parse(serverInfo.variables) : {},
      });

      // Load chapters from server
      const chaptersResponse = await libraryApi.getDownloadedChapters(bookId);
      const downloadedChapters = chaptersResponse.data.map((ch: any) => ({
        name: ch.name,
        url: '', // Not needed for downloaded chapters
        variables: { index: ch.index }
      }));
      setChapters(downloadedChapters);
    } catch (error) {
      console.error('Failed to load from server:', error);
      throw error;
    }
  };

  const loadFromBookSource = async () => {
    try {
      // Get book info from book source
      const response = await bookApi.getInfo({
        source_id: searchResult.source_id,
        book_url: searchResult.book_url,
        variables: searchResult.variables,
      });
      setBookInfo(response.data);

      // Load chapters from book source
      await loadChaptersFromSource(response.data);
    } catch (error) {
      console.error('Failed to load from book source:', error);
      throw error;
    }
  };

  const loadChaptersFromSource = async (info: BookInfo) => {
    setLoadingChapters(true);
    try {
      const response = await bookApi.getChapters({
        source_id: searchResult.source_id,
        toc_url: info.toc_url,
        variables: info.variables,
      });
      setChapters(response.data);
    } catch (error) {
      console.error('Failed to load chapters:', error);
    } finally {
      setLoadingChapters(false);
    }
  };

  const handleChapterClick = async (chapter: Chapter, index: number) => {
    // Check if we have directory name in chapter variables (fastest way)
    const dirName = chapter.variables?.directoryName as string | undefined;

    navigate('/reader', {
      state: {
        sourceId: searchResult.source_id || 0, // Use 0 for downloaded books without source
        chapter,
        chapters,
        currentIndex: index,
        libraryBookId: libraryBookId, // Pass library book ID
        directoryName: dirName || directoryName, // Pass directory name for offline access
      },
    });
  };

  const handleFavorite = async () => {
    if (isFavorited) {
      // Remove from library
      if (libraryBookId) {
        try {
          await libraryApi.remove(libraryBookId);
          setIsFavorited(false);
          setLibraryBookId(null);
        } catch (error) {
          console.error('Failed to remove from library:', error);
          alert('取消收藏失败');
        }
      }
    } else {
      // Add to library
      try {
        const response = await libraryApi.add({
          name: bookInfo?.name || searchResult.name,
          author: bookInfo?.author || searchResult.author,
          book_url: searchResult.book_url,
          cover_url: bookInfo?.cover_url || searchResult.cover_url,
          intro: bookInfo?.intro || searchResult.intro,
          kind: bookInfo?.kind || searchResult.kind,
          last_chapter: bookInfo?.last_chapter || searchResult.last_chapter,
          word_count: bookInfo?.word_count || searchResult.word_count,
          source_id: searchResult.source_id,
          source_name: searchResult.source_name,
          variables: JSON.stringify(searchResult.variables || {}),
        });
        setIsFavorited(true);
        setLibraryBookId(response.data.id);
        alert('收藏成功！');
      } catch (error) {
        console.error('Failed to add to library:', error);
        alert('收藏失败');
      }
    }
  };

  const handleDownloadToServer = async () => {
    if (!libraryBookId) {
      alert('请先收藏此书');
      return;
    }

    try {
      await libraryApi.downloadToServer(libraryBookId);
      // The polling is now handled by the useEffect hook
    } catch (error: any) {
      console.error('Failed to start download:', error);
      const errorMessage = error.response?.data?.detail || '下载失败';
      alert(errorMessage);
      setDownloading(false);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!bookInfo) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600 dark:text-gray-400">加载失败</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        返回
      </button>

      {/* Book Info */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {bookInfo.cover_url ? (
            <img
              src={bookInfo.cover_url}
              alt={bookInfo.name}
              className="w-full md:w-48 h-64 object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full md:w-48 h-64 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-gray-400" />
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {bookInfo.name}
            </h1>
            {bookInfo.author && (
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                作者: {bookInfo.author}
              </p>
            )}
            {bookInfo.kind && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                分类: {bookInfo.kind}
              </p>
            )}
            {bookInfo.word_count && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                字数: {bookInfo.word_count}
              </p>
            )}
            {bookInfo.intro && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">简介</h3>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {bookInfo.intro}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleFavorite}
                className={`btn flex items-center gap-2 ${
                  isFavorited
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'btn-primary'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                {isFavorited ? '已收藏' : '收藏'}
              </button>

              <button
                onClick={handleDownloadToServer}
                disabled={downloading || !isFavorited}
                className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    下载中...
                  </>
                ) : (
                  <>
                    <HardDrive className="w-5 h-5" />
                    下载到服务器
                  </>
                )}
              </button>
            </div>

            {/* Download Progress */}
            {downloadProgress && downloadProgress.status === 'downloading' && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    下载进度
                  </span>
                  <span className="text-sm text-blue-700 dark:text-blue-400">
                    {downloadProgress.downloaded_chapters}/{downloadProgress.total_chapters} 章
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.progress}%` }}
                  ></div>
                </div>
                {downloadProgress.message && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    {downloadProgress.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <List className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            目录 {chapters.length > 0 && `(${chapters.length}章)`}
          </h2>
        </div>

        {loadingChapters ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-400 py-8">暂无章节</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {chapters.map((chapter, index) => (
              <button
                key={`${chapter.url}-${index}`}
                onClick={() => handleChapterClick(chapter, index)}
                className="text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
                         text-gray-700 dark:text-gray-300 transition-colors"
              >
                <span className="text-sm">{chapter.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

