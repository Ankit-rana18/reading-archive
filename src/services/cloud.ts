/**
 * Supabase backend: the shared, public-read archive.
 * The URL and anon key are public by design (they ship in every browser); what protects
 * the data is the row-level security in supabase/schema.sql: anyone can read, only the
 * owner account can write.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Book, ReadingSession } from '../types/book';
import type { StorageAdapter } from './storage';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://atkeltjwgvycoxzuxnhz.supabase.co';
// Publishable (public) key: safe to ship; row-level security decides what it may do.
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'sb_publishable_ar-2xLlzwYYEJqnhe-vXxQ_W5oZYLuq';

export const cloudEnabled = Boolean(URL && KEY);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(URL, KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const BUCKET = 'covers';
const PAGE = 1000;

function sb(): SupabaseClient {
  if (!supabase) throw new Error('The cloud archive is not configured.');
  return supabase;
}

function check<T extends { error: { message: string } | null }>(r: T): T {
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = check(await sb().from(table).select(columns).order('id').range(from, from + PAGE - 1));
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const bookRow = (b: Book) => ({ id: b.id, data: b, updated_at: b.updatedAt });
const sessionRow = (s: ReadingSession) => ({ id: s.id, book_id: s.bookId, data: s });

export const cloudAdapter: StorageAdapter = {
  async loadBooks() {
    return (await selectAll<{ data: Book }>('books', 'data')).map((r) => r.data);
  },
  async saveBook(b) {
    check(await sb().from('books').upsert(bookRow(b)));
  },
  async saveBooks(bs) {
    for (let i = 0; i < bs.length; i += 200) check(await sb().from('books').upsert(bs.slice(i, i + 200).map(bookRow)));
  },
  async deleteBook(id) {
    check(await sb().from('sessions').delete().eq('book_id', id));
    check(await sb().from('books').delete().eq('id', id));
  },
  async loadSessions() {
    return (await selectAll<{ data: ReadingSession }>('sessions', 'data')).map((r) => r.data);
  },
  async saveSession(s) {
    check(await sb().from('sessions').upsert(sessionRow(s)));
  },
  async saveSessions(ss) {
    for (let i = 0; i < ss.length; i += 200) check(await sb().from('sessions').upsert(ss.slice(i, i + 200).map(sessionRow)));
  },
  async deleteSession(id) {
    check(await sb().from('sessions').delete().eq('id', id));
  },
  async saveCover(id, blob) {
    check(await sb().storage.from(BUCKET).upload(id, blob, { upsert: true, contentType: blob.type || 'image/jpeg', cacheControl: '31536000' }));
  },
  async getCover(id) {
    // Public bucket: a plain GET, cacheable by the browser and the CDN.
    const res = await fetch(sb().storage.from(BUCKET).getPublicUrl(id).data.publicUrl);
    return res.ok ? await res.blob() : undefined;
  },
  async deleteCover(id) {
    check(await sb().storage.from(BUCKET).remove([id]));
  },
  async listCoverIds() {
    const { data } = check(await sb().storage.from(BUCKET).list('', { limit: 10000 }));
    return (data ?? []).map((f) => f.name);
  },
  async clearAll() {
    check(await sb().from('sessions').delete().neq('id', ''));
    check(await sb().from('books').delete().neq('id', ''));
    const ids = await this.listCoverIds();
    for (let i = 0; i < ids.length; i += 100) check(await sb().storage.from(BUCKET).remove(ids.slice(i, i + 100)));
  },
};

/** Is the signed-in user the archive's owner? (Same check the database enforces.) */
export async function checkOwner(): Promise<boolean> {
  const { data, error } = await sb().rpc('is_archive_owner');
  if (error) throw new Error(error.message);
  return data === true;
}

export async function sendSignInLink(email: string) {
  const redirect = `${window.location.origin}${window.location.pathname}`;
  check(await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
}
