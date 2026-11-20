import { memo, useState, type CSSProperties } from 'react';
import type { Book } from '../types/book';
import { useCover } from '../hooks/useCover';
import { clothFor } from '../lib/util';

type CoverBook = Pick<Book, 'title' | 'author' | 'year' | 'coverUrl' | 'coverBlobId' | 'spineColor'>;

/** A typographic cover for books without artwork: cloth colour, serif title, small rules. */
export function GeneratedCover({ book }: { book: CoverBook }) {
  const c = clothFor(book);
  const len = book.title.length;
  const longest = Math.max(...book.title.split(/\s+/).map((w) => w.length), 1);
  const size = Math.min(len > 60 ? 9 : len > 36 ? 11 : len > 20 ? 13.5 : 16.5, 150 / longest);
  return (
    <div className="gcover" style={{ '--bg': c.bg, '--fg': c.fg, '--ts': `${size}cqw` } as CSSProperties} aria-hidden="true">
      <div className="gcover__in">
      <span className="gcover__author">{book.author}</span>
      <span className="gcover__rule" />
      <span className="gcover__title">{book.title}</span>
      <span className="gcover__orn">
        <i />◆<i />
      </span>
      <span className="gcover__foot">{book.year ?? 'The Reading Archive'}</span>
      </div>
    </div>
  );
}

/** Cover artwork with a graceful typographic fallback. */
export const CoverArt = memo(function CoverArt({ book, eager }: { book: CoverBook; eager?: boolean }) {
  const url = useCover(book);
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return <GeneratedCover book={book} />;
  return (
    <img
      className="cover-img"
      src={url}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onError={() => setFailed(url)}
      onLoad={(e) => {
        // Open Library serves a 1×1 placeholder when an edition has no cover.
        const img = e.currentTarget;
        if (img.naturalWidth < 8) setFailed(url);
      }}
    />
  );
});

/** A cover as a physical object: hinge shadow, page edge, soft drop shadow. */
export function BookCover({ book, className = '', eager, style }: { book: CoverBook; className?: string; eager?: boolean; style?: CSSProperties }) {
  return (
    <div className={`bookcover ${className}`} style={style}>
      <div className="bookcover__inner">
        <CoverArt book={book} eager={eager} />
        <span className="bookcover__hinge" />
      </div>
    </div>
  );
}
