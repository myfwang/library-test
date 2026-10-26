import { Router, type IRouter, type Response } from "express";
import { CreateBookBody, CreateBookResponse, DeleteBookParams, GetLibraryStatusResponse, ListBooksResponse } from "@workspace/api-zod";
import { booksRequest, LibraryError } from "../lib/supabase";
import { setupSql } from "../lib/library-setup";

const router: IRouter = Router();
const projection = "id,title,author,genre,notes,created_at";
function failure(res: Response, error: unknown) {
  res.status(error instanceof LibraryError ? error.status : 502).json({
    error: error instanceof LibraryError ? error.message : "Unexpected library response. Check the Supabase table schema.",
  });
}

router.get("/library/status", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    ListBooksResponse.parse(await booksRequest(`select=${projection}&limit=1`));
    res.json(GetLibraryStatusResponse.parse({ connected: true, message: "Connected to Supabase", setupSql }));
  } catch (error) {
    res.json(GetLibraryStatusResponse.parse({
      connected: false,
      message: error instanceof LibraryError ? error.message : "The demo table schema does not match. Check the setup SQL.",
      setupSql,
    }));
  }
});

router.get("/books", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(ListBooksResponse.parse(await booksRequest(`select=${projection}&order=created_at.desc&limit=1000`)));
  } catch (error) { failure(res, error); }
});

router.post("/books", async (req, res): Promise<void> => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a title, author, genre, and notes within the allowed lengths." });
    return;
  }
  const input = { ...parsed.data, title: parsed.data.title.trim(), author: parsed.data.author.trim(), genre: parsed.data.genre.trim() };
  if (!input.title || !input.author || !input.genre) {
    res.status(400).json({ error: "Title, author, and genre cannot be blank." });
    return;
  }
  try {
    const rows = ListBooksResponse.parse(await booksRequest(`select=${projection}`, { method: "POST", body: JSON.stringify(input) }));
    res.status(201).json(CreateBookResponse.parse(rows[0]));
  } catch (error) { failure(res, error); }
});

router.delete("/books/:id", async (req, res): Promise<void> => {
  const parsed = DeleteBookParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid book ID." });
    return;
  }
  try {
    const rows = ListBooksResponse.parse(await booksRequest(`id=eq.${encodeURIComponent(parsed.data.id)}&select=${projection}`, { method: "DELETE" }));
    if (!rows.length) {
      res.status(404).json({ error: "Book not found or delete permission is missing." });
      return;
    }
    res.status(204).end();
  } catch (error) { failure(res, error); }
});

export default router;
