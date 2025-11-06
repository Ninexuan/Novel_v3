import axios from 'axios';
import type {
  BookSource,
  BookSourceDetail,
  BookSourceCreate,
  BookSourceUpdate,
  BookSourceImportResult,
  SearchRequest,
  SearchResult,
  BookInfo,
  Chapter,
  ChapterContent,
  GetBookInfoRequest,
  GetChaptersRequest,
  GetChapterContentRequest,
  LibraryBook,
  LibraryBookCreate,
  DownloadProgress,
  ExploreCategory,
  ExploreRequest,
} from '@/types';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 5000, // Reduced from 30s to 5s for faster failure when offline
  headers: {
    'Content-Type': 'application/json',
  },
});

// Book Source APIs
export const bookSourceApi = {
  getAll: (enabledOnly = false) =>
    api.get<BookSource[]>('/book-sources/', { params: { enabled_only: enabledOnly } }),

  getById: (id: number) =>
    api.get<BookSourceDetail>(`/book-sources/${id}`),

  create: (data: BookSourceCreate) =>
    api.post<BookSource>('/book-sources/', data),

  createFromUrl: (url: string) =>
    api.post<BookSource>('/book-sources/from-url', null, { params: { url } }),

  importFromUrl: (url: string) =>
    api.post<BookSourceImportResult>('/book-sources/import-from-url', null, { params: { url } }),

  update: (id: number, data: BookSourceUpdate) =>
    api.put<BookSource>(`/book-sources/${id}`, data),

  delete: (id: number) =>
    api.delete(`/book-sources/${id}`),
};

// Search APIs
export const searchApi = {
  search: (data: SearchRequest) =>
    api.post<SearchResult[]>('/search/', data),

  // 流式搜索 - 使用Server-Sent Events
  searchStream: async (
    data: SearchRequest,
    onResult: (sourceId: number, sourceName: string, results: SearchResult[]) => void,
    onComplete: () => void,
    onError?: (error: Error) => void
  ) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/search/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is null');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.done) {
              onComplete();
            } else if (data.results && data.results.length > 0) {
              onResult(data.source_id, data.source_name, data.results);
            }
          }
        }
      }
    } catch (error) {
      if (onError) {
        onError(error as Error);
      } else {
        console.error('Search stream error:', error);
      }
    }
  },

  searchBySource: (sourceId: number, keyword: string, page = 1) =>
    api.get<SearchResult[]>(`/search/by-source/${sourceId}`, {
      params: { keyword, page },
    }),
};

// Book APIs
export const bookApi = {
  getInfo: (data: GetBookInfoRequest) =>
    api.post<BookInfo>('/books/info', data),

  getChapters: (data: GetChaptersRequest) =>
    api.post<Chapter[]>('/books/chapters', data),

  getChapterContent: (data: GetChapterContentRequest) =>
    api.post<ChapterContent>('/books/chapter/content', data),
};

// Library APIs
export const libraryApi = {
  getAll: () =>
    api.get<LibraryBook[]>('/library/'),

  // Get all downloaded books from downloads directory (works offline)
  getDownloaded: () =>
    api.get<any[]>('/library/downloaded'),

  // Get book info by directory name (works offline)
  getDownloadedInfoByDir: (directoryName: string) =>
    api.get(`/library/downloaded/${directoryName}/info`),

  // Get chapters by directory name (works offline)
  getDownloadedChaptersByDir: (directoryName: string) =>
    api.get(`/library/downloaded/${directoryName}/chapters`),

  // Get chapter content by directory name (works offline)
  getDownloadedChapterContentByDir: (directoryName: string, chapterIndex: number) =>
    api.get(`/library/downloaded/${directoryName}/chapters/${chapterIndex}`),

  getById: (id: number) =>
    api.get<LibraryBook>(`/library/${id}`),

  getFullInfo: (id: number) =>
    api.get(`/library/${id}/info`),

  checkIfInLibrary: (bookUrl: string, sourceId: number) =>
    api.get<{ in_library: boolean; book_id: number | null; book: LibraryBook | null }>('/library/check', {
      params: { book_url: bookUrl, source_id: sourceId }
    }),

  add: (data: LibraryBookCreate) =>
    api.post<LibraryBook>('/library/', data),

  remove: (id: number) =>
    api.delete(`/library/${id}`),

  downloadToServer: (id: number) =>
    api.post(`/library/${id}/download`),

  getDownloadProgress: (id: number) =>
    api.get<DownloadProgress>(`/library/${id}/download/progress`),

  getDownloadedChapters: (id: number) =>
    api.get<Chapter[]>(`/library/${id}/chapters`),

  getDownloadedChapterContent: (id: number, chapterIndex: number) =>
    api.get<ChapterContent>(`/library/${id}/chapters/${chapterIndex}`),
};

// Explore APIs
export const exploreApi = {
  getCategories: (sourceId: number) =>
    api.get<ExploreCategory[]>(`/explore/categories/${sourceId}`),

  explore: (data: ExploreRequest) =>
    api.post<SearchResult[]>('/explore/', data),
};

export default api;

