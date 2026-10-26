import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLibraryStatus,
  getGetLibraryStatusQueryKey,
  useListBooks,
  getListBooksQueryKey,
  useCreateBook,
  useDeleteBook,
} from "@workspace/api-client-react";
import type { Book } from "@workspace/api-client-react";
import { AlertTriangle, BookOpen, Check, Copy, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const SPINES = ["222 52% 30%", "12 62% 48%", "160 30% 34%", "42 65% 45%", "280 18% 38%", "200 35% 38%"];
function spineFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SPINES[h % SPINES.length];
}
function fmtDate(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Library() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const status = useGetLibraryStatus();
  const connected = status.data?.connected === true;
  const books = useListBooks({ query: { enabled: connected, queryKey: getListBooksQueryKey() } });
  const createBook = useCreateBook();
  const deleteBook = useDeleteBook();

  const [q, setQ] = useState("");
  const [form, setForm] = useState({ title: "", author: "", genre: "", notes: "" });
  const [open, setOpen] = useState<Book | null>(null);
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const list = books.data ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((b) => [b.title, b.author, b.genre, b.notes].some((f) => f.toLowerCase().includes(t)));
  }, [books.data, q]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetLibraryStatusQueryKey() });
    qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
  };

  const valid = form.title.trim() && form.author.trim() && form.genre.trim();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !connected) return;
    createBook.mutate(
      { data: { title: form.title.trim(), author: form.author.trim(), genre: form.genre.trim(), notes: form.notes.trim() } },
      {
        onSuccess: (b) => {
          setForm({ title: "", author: "", genre: "", notes: "" });
          qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
          toast({ title: "Shelved", description: `"${b.title}" is on the shelf.` });
        },
        onError: () => toast({ title: "Could not add book", description: "The server rejected the request. Try again.", variant: "destructive" }),
      },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const b = toDelete;
    deleteBook.mutate(
      { id: b.id },
      {
        onSuccess: () => {
          setToDelete(null);
          setOpen(null);
          qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
          toast({ title: "Removed", description: `"${b.title}" left the shelf.` });
        },
        onError: () => toast({ title: "Could not delete", description: "Try again in a moment.", variant: "destructive" }),
      },
    );
  };

  const copySql = async () => {
    if (!status.data?.setupSql) return;
    await navigator.clipboard.writeText(status.data.setupSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const fetching = status.isFetching || books.isFetching;

  return (
    <div className="min-h-[100dvh]">
      <div className="bg-primary text-primary-foreground text-xs" data-testid="text-public-warning">
        <div className="mx-auto max-w-6xl px-5 py-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[hsl(42_80%_65%)]" />
          <span>Shared public demo. Use sample data only — anyone can add or delete books.</span>
        </div>
      </div>

      <header className="mx-auto max-w-6xl px-5 pt-12 pb-8 rise">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Est. on Supabase</p>
            <h1 className="font-serif text-5xl md:text-7xl font-extrabold tracking-tight leading-[0.95] mt-2">
              Little <span className="italic font-normal">Library</span>
            </h1>
            <p className="mt-3 text-muted-foreground max-w-md">Take a book, leave a book. A small shared shelf, stored for real in a Postgres table.</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill loading={status.isLoading} connected={connected} errored={status.isError} />
            <Button variant="outline" size="sm" onClick={refresh} disabled={fetching} data-testid="button-refresh">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 grid gap-8 md:grid-cols-[1fr_320px]">
        <section className="order-2 md:order-1 min-w-0">
          {status.isLoading ? (
            <ShelfSkeleton />
          ) : status.isError ? (
            <Notice title="Can't reach the library server" body="The API did not respond. Check that the server is running, then retry." action={<Button onClick={refresh} data-testid="button-retry-status">Retry</Button>} />
          ) : !connected ? (
            <div className="rounded-lg border border-accent/40 bg-card p-6 rise" data-testid="panel-setup">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Setup needed</p>
              <h2 className="font-serif text-2xl font-semibold mt-1">The shelf isn't connected yet</h2>
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-status-message">{status.data?.message}</p>
              <ol className="text-sm mt-4 space-y-1 list-decimal pl-5">
                <li>Open your Supabase project and go to the SQL Editor.</li>
                <li>Paste the SQL below and run it.</li>
                <li>Come back and retry the connection.</li>
              </ol>
              {status.data?.setupSql && (
                <div className="relative mt-4">
                  <pre className="font-mono text-xs bg-foreground text-background/90 rounded-md p-4 overflow-x-auto max-h-72" data-testid="text-setup-sql">{status.data.setupSql}</pre>
                  <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={copySql} data-testid="button-copy-sql">
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              )}
              <Button className="mt-5" onClick={refresh} disabled={status.isFetching} data-testid="button-retry-connection">
                <RefreshCw className={`h-4 w-4 mr-1.5 ${status.isFetching ? "animate-spin" : ""}`} /> Retry connection
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, genre, notes" className="pl-9 bg-card" data-testid="input-search" />
                  {q && (
                    <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" data-testid="button-clear-search" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap" data-testid="text-book-count">
                  {books.data ? `${filtered.length} / ${books.data.length}` : ""}
                </span>
              </div>
              {books.isLoading ? (
                <ShelfSkeleton />
              ) : books.isError ? (
                <Notice title="The shelf wouldn't load" body="Something went wrong fetching books." action={<Button onClick={() => books.refetch()} data-testid="button-retry-books">Retry</Button>} />
              ) : books.data && books.data.length === 0 ? (
                <Notice title="An empty shelf" body="No books yet. Add the first one with the form." />
              ) : filtered.length === 0 ? (
                <Notice title="Nothing matches" body={`No books match "${q}".`} action={<Button variant="outline" onClick={() => setQ("")}>Clear search</Button>} />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((b, i) => (
                    <li key={b.id} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                      <button
                        onClick={() => setOpen(b)}
                        className="group w-full text-left flex rounded-md border bg-card overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_hsl(222_40%_20%/0.4)]"
                        data-testid={`card-book-${b.id}`}
                      >
                        <span className="w-2.5 shrink-0 transition-transform duration-200 origin-left group-hover:scale-x-150" style={{ background: `hsl(${spineFor(b.genre)})` }} />
                        <span className="p-4 min-w-0 flex-1">
                          <span className="block font-serif text-lg font-semibold leading-snug truncate">{b.title}</span>
                          <span className="block text-sm text-muted-foreground truncate">{b.author}</span>
                          <span className="mt-3 flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ background: `hsl(${spineFor(b.genre)} / 0.12)`, color: `hsl(${spineFor(b.genre)})` }}>{b.genre}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{b.notes ? "has notes" : ""}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <aside className="order-1 md:order-2">
          <form onSubmit={submit} className="md:sticky md:top-6 rounded-lg border bg-card p-5 rise" style={{ animationDelay: "120ms" }} data-testid="form-add-book">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Return slip</p>
            <h2 className="font-serif text-xl font-semibold mb-4">Add a book</h2>
            <fieldset disabled={!connected || createBook.isPending} className="space-y-3 disabled:opacity-60">
              <Field label="Title"><Input maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-title" /></Field>
              <Field label="Author"><Input maxLength={200} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} data-testid="input-author" /></Field>
              <Field label="Genre"><Input maxLength={80} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} data-testid="input-genre" /></Field>
              <Field label="Notes (optional)"><Textarea maxLength={2000} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="input-notes" /></Field>
              <Button type="submit" className="w-full" disabled={!valid} data-testid="button-add-book">
                <Plus className="h-4 w-4 mr-1.5" /> {createBook.isPending ? "Shelving..." : "Put on shelf"}
              </Button>
            </fieldset>
            {!connected && !status.isLoading && <p className="text-xs text-muted-foreground mt-3">Adding is disabled until the database is connected.</p>}
          </form>
        </aside>
      </main>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-card">
          {open && (
            <>
              <DialogHeader>
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: `hsl(${spineFor(open.genre)})` }}>{open.genre}</span>
                <DialogTitle className="font-serif text-2xl" data-testid="text-detail-title">{open.title}</DialogTitle>
                <DialogDescription>by {open.author} · added {fmtDate(open.created_at)}</DialogDescription>
              </DialogHeader>
              <div className="rounded-md bg-background border p-4 text-sm whitespace-pre-wrap min-h-20" data-testid="text-detail-notes">
                {open.notes || <span className="text-muted-foreground italic">No notes for this one.</span>}
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={!connected} onClick={() => setToDelete(open)} data-testid="button-delete-book">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Remove from shelf
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Remove this book?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.title}" will be deleted from the shared shelf for everyone. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleteBook.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteBook.isPending ? "Removing..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ loading, connected, errored }: { loading: boolean; connected: boolean; errored: boolean }) {
  const label = loading ? "Checking" : errored ? "Offline" : connected ? "Connected" : "Not set up";
  const color = loading ? "222 12% 55%" : connected ? "160 40% 34%" : "12 62% 48%";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-[11px]" data-testid="status-connection">
      <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse" : ""}`} style={{ background: `hsl(${color})` }} />
      {label}
    </span>
  );
}

function ShelfSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex rounded-md border bg-card overflow-hidden">
          <Skeleton className="w-2.5 rounded-none" />
          <div className="p-4 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-16 mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/60 px-6 py-14 text-center rise">
      <BookOpen className="h-8 w-8 mx-auto text-accent" strokeWidth={1.5} />
      <h3 className="font-serif text-xl font-semibold mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
