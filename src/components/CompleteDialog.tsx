import { useEffect, useState } from 'react';
import { useLibrary } from '../hooks/useBooks';
import { useUI } from '../hooks/useUI';
import { todayISO } from '../lib/util';
import { Modal, Stars } from './ui';
import { BookCover } from './BookCover';

/** Finishing a book: confirm the date, rate it, write a review. */
export function CompleteDialog() {
  const ui = useUI();
  const lib = useLibrary();
  const book = ui.completeId ? lib.getBook(ui.completeId) : undefined;
  const [rating, setRating] = useState<number | undefined>();
  const [review, setReview] = useState('');
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (book) {
      setRating(book.rating);
      setReview(book.review ?? '');
      setDate(todayISO());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.completeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    await lib.completeBook(book.id, { rating, review, date });
    ui.closeComplete();
    ui.toast(`“${book.title}” is now in your reading history`);
  };

  return (
    <Modal open={!!book} onClose={ui.closeComplete} title={book ? `Finished “${book.title}”?` : ''} kicker="Mark as completed" width={680}>
      {book && (
        <form className="complete" onSubmit={submit}>
          <BookCover book={book} className="complete__cover" />
          <div className="complete__fields">
            <label className="field">
              <span>Completion date</span>
              <input type="date" className="input" value={date} min={book.dateStarted} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} required />
            </label>
            <div className="field">
              <span>Your rating</span>
              <Stars value={rating} onChange={setRating} size="lg" />
            </div>
            <label className="field">
              <span>Your review</span>
              <textarea className="textarea" rows={6} value={review} placeholder="What will you remember about this book?" onChange={(e) => setReview(e.target.value)} />
            </label>
            <div className="confirm__actions">
              <button type="button" className="btn" onClick={ui.closeComplete}>
                Not yet
              </button>
              <button type="submit" className="btn btn--solid">
                Add to history
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
