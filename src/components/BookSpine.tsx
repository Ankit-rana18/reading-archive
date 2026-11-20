import { memo, type CSSProperties } from 'react';
import type { Book } from '../types/book';
import { clothFor } from '../lib/util';

const surname = (author: string) => {
  const first = author.split(/,|&| and /)[0].trim();
  const parts = first.split(/\s+/);
  return parts[parts.length - 1] || first;
};

/** The spine face of a book: cloth colour, gilt bands, vertical title, author. */
export const BookSpine = memo(function BookSpine({
  book,
  width,
  height,
  variant,
}: {
  book: Pick<Book, 'title' | 'author' | 'spineColor' | 'status'>;
  width: number;
  height: number;
  variant: number;
}) {
  const c = clothFor(book);
  const title = book.title.length > 48 ? book.title.slice(0, 46).trimEnd() + '…' : book.title;
  const usable = height * (variant === 2 ? 0.56 : 0.62);
  const fs = Math.max(7, Math.min(width * 0.42, usable / Math.max(4, title.length * 0.5)));
  const afs = Math.max(5.5, Math.min(width * 0.2, 9.5));
  return (
    <div className={`spine spine--v${variant}`} style={{ '--bg': c.bg, '--fg': c.fg } as CSSProperties}>
      <i className="spine__band spine__band--top" />
      <span className="spine__title" style={{ fontSize: fs }}>
        {title}
      </span>
      <span className="spine__author" style={{ fontSize: afs }}>
        {surname(book.author)}
      </span>
      <i className="spine__band spine__band--bot" />
      {book.status === 'reading' && <i className="spine__ribbon" />}
    </div>
  );
});
