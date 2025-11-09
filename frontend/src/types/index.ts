// Book Source Types
export interface BookSource {
  id: number;
  name: string;
  url: string;
  source_type: number;
  enabled: boolean;
  source_group?: string;
  source_comment?: string;
  custom_order: number;
  weight: number;
  created_at: string;
  updated_at?: string;
}

export interface BookSourceDetail extends BookSource {
  source_json: string;
}

export interface BookSourceCreate {
  source_json: string;
}

export interface BookSourceUpdate {
  source_json?: string;
  name?: string;
  url?: string;
  enabled?: boolean;
  source_group?: string;
  source_comment?: string;
  custom_order?: number;
  weight?: number;
}

export interface ImportedSourceInfo {
  id: number;
  name: string;
  url: string;
}

export interface FailedSourceInfo {
  name: string;
  error: string;
}

export interface BookSourceImportResult {
  total: number;
  success: number;
  failed: number;
  imported_sources: ImportedSourceInfo[];
  failed_sources: FailedSourceInfo[];
}

// Explore Types
export interface ExploreCategory {
  title: string;
  url: string;
  style?: {
    layout_flexBasisPercent?: number;
    layout_flexGrow?: number;
  };
}

export interface ExploreRequest {
  source_id: number;
  url: string;
  page?: number;
}

// Library Types
export interface LibraryBook {
  id: number;
  name: string;
  author?: string;
  book_url: string;
  cover_url?: string;
  intro?: string;
  kind?: string;
  last_chapter?: string;
  word_count?: string;
  source_id: number;
  source_name: string;
  is_downloaded: boolean;
  download_path?: string;
  download_progress: number;
  total_chapters: number;
  downloaded_chapters: number;
  variables?: string;
  created_at: string;
  updated_at?: string;
}

export interface LibraryBookCreate {
  name: string;
  author?: string;
  book_url: string;
  cover_url?: string;
  intro?: string;
  kind?: string;
  last_chapter?: string;
  word_count?: string;
  source_id: number;
  source_name: string;
  variables?: string;
}

export interface DownloadProgress {
  book_id: number;
  book_name?: string;
  book_author?: string;
  book_cover_url?: string;
  total_chapters: number;
  downloaded_chapters: number;
  progress: number;
  status: 'downloading' | 'completed' | 'failed' | 'not_started' | 'unknown';
  message?: string;
}

// Search Types
export interface SearchRequest {
  keyword: string;
  source_ids?: number[];
  page?: number;
}

export interface SearchResult {
  name: string;
  author?: string;
  book_url: string;
  cover_url?: string;
  intro?: string;
  kind?: string;
  last_chapter?: string;
  word_count?: string;
  source_id: number;
  source_name: string;
  variables: Record<string, any>;
}

// Book Types
export interface BookInfo {
  name: string;
  author?: string;
  cover_url?: string;
  intro?: string;
  kind?: string;
  last_chapter?: string;
  word_count?: string;
  toc_url: string;
  variables: Record<string, any>;
}

export interface Chapter {
  name: string;
  url: string;
  variables: Record<string, any>;
}

export interface ChapterContent {
  content: string;
  next_url?: string;
}

// Request Types
export interface GetBookInfoRequest {
  source_id: number;
  book_url: string;
  variables: Record<string, any>;
}

export interface GetChaptersRequest {
  source_id: number;
  toc_url: string;
  variables: Record<string, any>;
}

export interface GetChapterContentRequest {
  source_id: number;
  chapter_url: string;
  variables: Record<string, any>;
  next_chapter_url?: string;
}

