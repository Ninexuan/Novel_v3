import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, CheckCircle, XCircle, Book } from 'lucide-react';
import { libraryApi } from '@/services/api';
import { DownloadProgress } from '@/types';

export default function Downloads() {
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDownloads();

    // Poll for updates every 2 seconds
    const interval = setInterval(() => {
      loadDownloads();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadDownloads = async () => {
    try {
      const response = await libraryApi.getAllActiveDownloads();
      setDownloads(response.data);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = async (bookId: number) => {
    try {
      const bookResponse = await libraryApi.getById(bookId);
      const book = bookResponse.data;

      navigate('/book', {
        state: {
          searchResult: {
            name: book.name,
            author: book.author,
            book_url: book.book_url,
            cover_url: book.cover_url,
            intro: book.intro,
            kind: book.kind,
            last_chapter: book.last_chapter,
            word_count: book.word_count,
            source_id: book.source_id,
            source_name: book.source_name,
            variables: book.variables ? JSON.parse(book.variables) : {},
          },
          fromLibrary: true,
          libraryBookId: book.id,
          isDownloaded: book.is_downloaded,
        },
      });
    } catch (error) {
      console.error('Failed to load book:', error);
      alert('加载书籍失败');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Download className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'downloading':
        return '下载中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Download className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            下载管理
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          查看所有正在下载的小说
        </p>
      </div>

      {downloads.length === 0 ? (
        <div className="card p-12 text-center">
          <Download className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            暂无下载任务
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((download) => (
            <div
              key={download.book_id}
              className={`card p-6 border-2 ${getStatusColor(download.status)}`}
            >
              <div className="flex items-start gap-4">
                {/* Book Cover */}
                {download.book_cover_url ? (
                  <img
                    src={download.book_cover_url}
                    alt={download.book_name || '书籍'}
                    className="w-20 h-28 object-cover rounded-lg shadow-md cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleBookClick(download.book_id)}
                  />
                ) : (
                  <div className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Book className="w-8 h-8 text-gray-400" />
                  </div>
                )}

                {/* Download Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3
                        className="text-lg font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        onClick={() => handleBookClick(download.book_id)}
                      >
                        {download.book_name || `书籍 #${download.book_id}`}
                      </h3>
                      {download.book_author && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          作者: {download.book_author}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(download.status)}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {getStatusText(download.status)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        进度
                      </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {download.downloaded_chapters}/{download.total_chapters} 章 ({download.progress}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          download.status === 'downloading'
                            ? 'bg-blue-600 dark:bg-blue-500'
                            : download.status === 'completed'
                            ? 'bg-green-600 dark:bg-green-500'
                            : 'bg-red-600 dark:bg-red-500'
                        }`}
                        style={{ width: `${download.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Status Message */}
                  {download.message && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                      {download.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

