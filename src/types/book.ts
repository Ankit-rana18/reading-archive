export type ReadingStatus = 'read' | 'reading' | 'want';
export type Priority = 'high' | 'medium' | 'low';
export type ViewMode = 'shelf' | 'grid' | 'list';

export interface Book {
  id: string;
  title: string;
  author: string;
  /** Remote cover URL (Open Library / Google Books / pasted). */
  coverUrl?: string;
  /** Id of a cover image stored as a Blob in IndexedDB (uploaded or cached). */
  coverBlobId?: string;
  genre?: string;
  isbn?: string;
  publisher?: string;
  year?: number;
  pages?: number;
  status: ReadingStatus;
  /** ISO date strings, YYYY-MM-DD. */
  dateStarted?: string;
  dateCompleted?: string;
  rating?: number;
  description?: string;
  notes?: string;
  review?: string;
  quotes: string[];
  lessons: string[];
  currentPage?: number;
  priority?: Priority;
  reason?: string;
  /** Spine cloth colour override (hex). */
  spineColor?: string;
  source?: 'openlibrary' | 'google' | 'manual';
  sourceId?: string;
  addedAt: string;
  updatedAt: string;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  /** YYYY-MM-DD */
  date: string;
  fromPage?: number;
  toPage?: number;
  pages: number;
  minutes?: number;
  note?: string;
  createdAt: string;
}

export interface Prefs {
  theme: 'paper' | 'ink';
  motion: 'system' | 'reduce';
  yearGoals: Record<string, number>;
  dailyPageGoal: number;
  defaultView: ViewMode;
}

export type BookInput = Omit<Book, 'id' | 'addedAt' | 'updatedAt' | 'quotes' | 'lessons'> &
  Partial<Pick<Book, 'quotes' | 'lessons'>>;

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  read: 'Read',
  reading: 'Reading',
  want: 'Want to Read',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};
