/**
 * Book discovery: Open Library (primary, no key) and Google Books (keyless, rate-limited).
 * Every function throws a readable Error on failure so the UI can fall back to manual entry.
 */
export type SearchField = 'any' | 'title' | 'author' | 'isbn';
export type Source = 'openlibrary' | 'google';

export interface SearchResult {
  source: Source;
  id: string; // OL work key (/works/OL..W) or Google volume id
  title: string;
  author: string;
  year?: number;
  coverUrl?: string;
  isbn?: string;
  publisher?: string;
  pages?: number;
  genre?: string;
  editionCount?: number;
  description?: string;
}

export interface Edition {
  id: string;
  title: string;
  publisher?: string;
  publishDate?: string;
  year?: number;
  pages?: number;
  isbn?: string;
  coverUrl?: string;
  language?: string;
}

const OL = 'https://openlibrary.org';
const olCover = (id?: number, size: 'M' | 'L' = 'L') =>
  id && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : undefined;

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('The book service could not be reached. Check your connection, or add the book manually.');
  }
  if (res.status === 429) throw new Error('The book service is rate-limiting requests. Wait a moment and try again.');
  if (!res.ok) throw new Error(`The book service answered with an error (${res.status}).`);
  return res.json() as Promise<T>;
}

const yearOf = (s?: string | number) => {
  if (typeof s === 'number') return s;
  const m = /(\d{4})/.exec(s ?? '');
  return m ? +m[1] : undefined;
};

/** Pick a readable genre from a long subject list. */
const GENRES: [RegExp, string][] = [
  [/science fiction|sci-fi/i, 'Science Fiction'],
  [/fantasy/i, 'Fantasy'],
  [/mystery|detective|crime/i, 'Mystery'],
  [/thriller|suspense/i, 'Thriller'],
  [/horror/i, 'Horror'],
  [/romance|love stories/i, 'Romance'],
  [/poetry|poems/i, 'Poetry'],
  [/biograph|autobiograph|memoir/i, 'Biography'],
  [/histor/i, 'History'],
  [/philosoph/i, 'Philosophy'],
  [/psycholog/i, 'Psychology'],
  [/self-help|self help|personal development|habits/i, 'Self-help'],
  [/business|management|economics|finance/i, 'Business'],
  [/science|physics|biology|chemistry|mathematics/i, 'Science'],
  [/religio|spiritual/i, 'Religion'],
  [/art|design|architecture|photograph/i, 'Art & Design'],
  [/politic/i, 'Politics'],
  [/travel/i, 'Travel'],
  [/cook|food/i, 'Food'],
  [/drama|plays/i, 'Drama'],
  [/essays/i, 'Essays'],
  [/juvenile|children/i, "Children's"],
  [/classic/i, 'Classics'],
  [/fiction|novel/i, 'Fiction'],
];
export function pickGenre(subjects?: string[]): string | undefined {
  if (!subjects?.length) return undefined;
  const joined = subjects.slice(0, 40).join(' | ');
  for (const [re, g] of GENRES) if (re.test(joined)) return g;
  return undefined;
}

/* ---------------- Open Library ---------------- */

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  isbn?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  edition_count?: number;
}

async function searchOL(q: string, field: SearchField, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    fields: 'key,title,author_name,cover_i,first_publish_year,isbn,publisher,number_of_pages_median,subject,edition_count',
    limit: '24',
  });
  if (field === 'title') params.set('title', q);
  else if (field === 'author') params.set('author', q);
  else if (field === 'isbn') params.set('isbn', q.replace(/[^0-9Xx]/g, ''));
  else params.set('q', q);
  const data = await getJSON<{ docs: OLDoc[] }>(`${OL}/search.json?${params}`, signal);
  return data.docs.map((d) => ({
    source: 'openlibrary' as const,
    id: d.key,
    title: d.title,
    author: d.author_name?.slice(0, 2).join(', ') ?? 'Unknown author',
    year: d.first_publish_year,
    coverUrl: olCover(d.cover_i),
    isbn: field === 'isbn' ? q.replace(/[^0-9Xx]/g, '') : d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0],
    publisher: d.publisher?.[0],
    pages: d.number_of_pages_median,
    genre: pickGenre(d.subject),
    editionCount: d.edition_count,
  }));
}

async function olDescription(workKey: string, signal?: AbortSignal): Promise<{ description?: string; genre?: string }> {
  const w = await getJSON<{ description?: string | { value: string }; subjects?: string[] }>(`${OL}${workKey}.json`, signal);
  const raw = typeof w.description === 'string' ? w.description : w.description?.value;
  const description = raw
    ?.replace(/\r/g, '')
    .split(/\n-{3,}|\n\s*\(\[source\]|\nSee also:/)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
  return { description, genre: pickGenre(w.subjects) };
}

interface OLEdition {
  key: string;
  title: string;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  languages?: { key: string }[];
}

async function olEditions(workKey: string, signal?: AbortSignal): Promise<Edition[]> {
  const data = await getJSON<{ entries: OLEdition[] }>(`${OL}${workKey}/editions.json?limit=40`, signal);
  return data.entries
    .map((e) => ({
      id: e.key,
      title: e.title,
      publisher: e.publishers?.[0],
      publishDate: e.publish_date,
      year: yearOf(e.publish_date),
      pages: e.number_of_pages,
      isbn: e.isbn_13?.[0] ?? e.isbn_10?.[0],
      coverUrl: olCover(e.covers?.find((c) => c > 0)),
      language: e.languages?.[0]?.key.split('/').pop(),
    }))
    .sort((a, b) => Number(!!b.coverUrl) - Number(!!a.coverUrl) || Number(!!b.isbn) - Number(!!a.isbn));
}

/* ---------------- Google Books ---------------- */

interface GVolume {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

const gCover = (v: GVolume) => {
  const t = v.volumeInfo.imageLinks?.thumbnail ?? v.volumeInfo.imageLinks?.smallThumbnail;
  return t ? t.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=2') : undefined;
};

async function searchGoogle(q: string, field: SearchField, signal?: AbortSignal): Promise<SearchResult[]> {
  const prefix = field === 'title' ? 'intitle:' : field === 'author' ? 'inauthor:' : field === 'isbn' ? 'isbn:' : '';
  const query = field === 'isbn' ? prefix + q.replace(/[^0-9Xx]/g, '') : prefix + q;
  const data = await getJSON<{ items?: GVolume[] }>(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=24&printType=books`,
    signal,
  );
  return (data.items ?? []).map((v) => {
    const vi = v.volumeInfo;
    const ids = vi.industryIdentifiers ?? [];
    return {
      source: 'google' as const,
      id: v.id,
      title: vi.subtitle ? `${vi.title}: ${vi.subtitle}` : vi.title,
      author: vi.authors?.slice(0, 2).join(', ') ?? 'Unknown author',
      year: yearOf(vi.publishedDate),
      coverUrl: gCover(v),
      isbn: ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier,
      publisher: vi.publisher,
      pages: vi.pageCount || undefined,
      genre: pickGenre(vi.categories) ?? vi.categories?.[0],
      description: vi.description?.replace(/<[^>]+>/g, ''),
    };
  });
}

/* ---------------- Public API ---------------- */

export function searchBooks(q: string, field: SearchField, source: Source, signal?: AbortSignal) {
  if (!q.trim()) return Promise.resolve([]);
  return source === 'google' ? searchGoogle(q.trim(), field, signal) : searchOL(q.trim(), field, signal);
}

/** Extra details for a chosen result: description and (Open Library) editions. */
export async function resultDetails(
  r: SearchResult,
  signal?: AbortSignal,
): Promise<{ description?: string; genre?: string; editions: Edition[] }> {
  if (r.source === 'google') return { description: r.description, genre: r.genre, editions: [] };
  const [desc, eds] = await Promise.allSettled([olDescription(r.id, signal), olEditions(r.id, signal)]);
  return {
    description: desc.status === 'fulfilled' ? desc.value.description : undefined,
    genre: (desc.status === 'fulfilled' ? desc.value.genre : undefined) ?? r.genre,
    editions: eds.status === 'fulfilled' ? eds.value : [],
  };
}

/** Try to download a remote cover so it survives offline. Fails quietly when CORS forbids it. */
export async function fetchCoverBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size < 1200) return null; // OL returns a 1px gif for missing covers
    return blob;
  } catch {
    return null;
  }
}
