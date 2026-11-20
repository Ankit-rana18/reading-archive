import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { Book } from '../types/book';
import { activeFilterCount, facets, NO_FILTERS, SORT_LABEL, type Filters, type SortKey } from '../lib/filter';

export function SearchBar({ value, onChange, placeholder = 'Search titles, authors, notes…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="searchbar">
      <Search size={15} strokeWidth={1.4} aria-hidden="true" />
      <input className="searchbar__input" type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label="Filter books" />
      {value && (
        <button type="button" className="searchbar__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <X size={13} />
        </button>
      )}
    </label>
  );
}

export function SortSelect({ value, onChange, keys }: { value: SortKey; onChange: (k: SortKey) => void; keys?: SortKey[] }) {
  const ks = keys ?? (Object.keys(SORT_LABEL) as SortKey[]);
  return (
    <label className="sortsel lbl muted">
      Sort
      <select className="select select--sm" value={value} onChange={(e) => onChange(e.target.value as SortKey)}>
        {ks.map((k) => (
          <option key={k} value={k}>
            {SORT_LABEL[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Collapsible filter drawer: genre, author, publication decade, reading year, rating. */
export function FilterPanel({
  books,
  filters,
  onChange,
  hide = [],
}: {
  books: Book[];
  filters: Filters;
  onChange: (f: Filters) => void;
  hide?: ('genre' | 'author' | 'pubYear' | 'readYear' | 'rating')[];
}) {
  const [open, setOpen] = useState(false);
  const f = facets(books);
  const n = activeFilterCount(filters);
  const set = (p: Partial<Filters>) => onChange({ ...filters, ...p });
  return (
    <div className={`fpanel ${open ? 'is-open' : ''}`}>
      <button type="button" className="chip" aria-expanded={open} aria-pressed={n > 0} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal size={12} /> Filters{n ? ` · ${n}` : ''}
      </button>
      {open && (
        <div className="fpanel__body">
          {!hide.includes('genre') && (
            <label className="field">
              <span>Genre</span>
              <select className="select select--sm" value={filters.genre} onChange={(e) => set({ genre: e.target.value })}>
                <option value="">All genres</option>
                {f.genres.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          {!hide.includes('author') && (
            <label className="field">
              <span>Author</span>
              <select className="select select--sm" value={filters.author} onChange={(e) => set({ author: e.target.value })}>
                <option value="">All authors</option>
                {f.authors.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
          )}
          {!hide.includes('pubYear') && (
            <label className="field">
              <span>Published</span>
              <select className="select select--sm" value={filters.pubYear} onChange={(e) => set({ pubYear: e.target.value })}>
                <option value="">Any decade</option>
                {f.decades.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          )}
          {!hide.includes('readYear') && (
            <label className="field">
              <span>Year read</span>
              <select className="select select--sm" value={filters.readYear} onChange={(e) => set({ readYear: e.target.value })}>
                <option value="">Any year</option>
                {f.readYears.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
          {!hide.includes('rating') && (
            <label className="field">
              <span>Rating</span>
              <select className="select select--sm" value={filters.minRating} onChange={(e) => set({ minRating: Number(e.target.value) })}>
                <option value={0}>Any rating</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r === 5 ? '★★★★★ only' : `${'★'.repeat(r)} and up`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {n > 0 && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange({ ...NO_FILTERS, q: filters.q, status: filters.status })}>
              <X size={11} /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
