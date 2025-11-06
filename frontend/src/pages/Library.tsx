import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Trash2 } from 'lucide-react';
import { libraryApi } from '@/services/api';
import type { LibraryBook } from '@/types';

export default function Library() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      // Try to load downloaded books first (works offline)
      try {
        const downloadedResponse = await libraryApi.getDownloaded();
        const downloadedBooks = downloadedResponse.data;

        // Convert downloaded books to LibraryBook format
        const books: LibraryBook[] = downloadedBooks.map((book: any, index: number) => ({
          id: index + 1, // Temporary ID
          name: book.name,
          author: book.author,
          book_url: '',
          cover_url: book.cover_url,
          intro: book.intro,
          kind: book.kind,
          last_chapter: book.last_chapter,
          word_count: book.word_count,
          source_id: 0,
          source_name: '',
          is_downloaded: true,
          download_path: book.download_path,
          download_progress: 100,
          total_chapters: book.total_chapters || 0,
          downloaded_chapters: book.total_chapters || 0,
          variables: JSON.stringify({}),
          created_at: '',
          updated_at: '',
          directory_name: book.directory_name, // Store directory name for later use
        }));

        setBooks(books);
        console.log(`Loaded ${books.length} downloaded books from server`);
      } catch (downloadError) {
        console.error('Failed to load downloaded books, falling back to database:', downloadError);
        // Fallback to database query
        const response = await libraryApi.getAll();
        setBooks(response.data);
      }
    } catch (error) {
      console.error('Failed to load library books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = (book: LibraryBook & { directory_name?: string }) => {
    // Navigate to book detail with library book info
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
        directoryName: book.directory_name, // Pass directory name for direct access
      },
    });
  };

  const handleRemove = async (bookId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要从书库中移除这本书吗？')) return;

    try {
      await libraryApi.remove(bookId);
      setBooks(books.filter((b) => b.id !== bookId));
    } catch (error) {
      console.error('Failed to remove book:', error);
      alert('移除失败');
    }
  };



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">我的书库</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">书库是空的</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            在书籍详情页点击"收藏"按钮即可添加到书库
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {books.map((book) => (
            <div
              key={book.id}
              className="card p-3 hover:shadow-md transition-shadow cursor-pointer relative group"
              onClick={() => handleBookClick(book)}
            >
              {/* Cover */}
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.name}
                  className="w-full aspect-[3/4] object-cover rounded-lg mb-2"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                  <BookOpen className="w-8 h-8 text-gray-400" />
                </div>
              )}

              {/* Download Status Badge */}
              {book.is_downloaded && (
                <div className="absolute top-4 right-4 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                  已下载
                </div>
              )}

              {/* Book Info */}
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1 line-clamp-2" title={book.name}>
                {book.name}
              </h3>
              {book.author && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1" title={book.author}>
                  {book.author}
                </p>
              )}

              {/* Download Progress */}
              {book.download_progress > 0 && book.download_progress < 100 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span className="text-xs">进度</span>
                    <span className="text-xs">{book.download_progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full"
                      style={{ width: `${book.download_progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={(e) => handleRemove(book.id, e)}
                  className="btn btn-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center p-1"
                  title="移除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

