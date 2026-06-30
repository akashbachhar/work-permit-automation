"""
Ingestion pipeline: PDF -> chunks -> nomic-embed-text embeddings -> Chroma vectorstore.
Run once (or whenever PDFs in rag/documents/ change):
    ./venv/bin/python rag/ingest.py
"""

import os
import sys
import json
import hashlib
from pathlib import Path

import chromadb
import ollama
from pypdf import PdfReader

DOCS_DIR = Path(__file__).parent / "documents"
STORE_DIR = Path(__file__).parent / "vectorstore"
MANIFEST_FILE = Path(__file__).parent / "vectorstore" / ".manifest.json"
COLLECTION_NAME = "hpcl_docs"
EMBED_MODEL = "nomic-embed-text"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def file_hash(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()


def load_manifest() -> dict:
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text())
    return {}


def save_manifest(manifest: dict):
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))


def extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    reader = PdfReader(str(pdf_path))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append((i + 1, text))
    return pages


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def embed(texts: list[str]) -> list[list[float]]:
    embeddings = []
    for text in texts:
        resp = ollama.embeddings(model=EMBED_MODEL, prompt=text)
        embeddings.append(resp["embedding"])
    return embeddings


def ingest_pdf(pdf_path: Path, collection: chromadb.Collection, manifest: dict) -> int:
    fhash = file_hash(pdf_path)
    fname = pdf_path.name

    if manifest.get(fname) == fhash:
        print(f"  [skip] {fname} — unchanged")
        return 0

    # Remove old chunks for this file if re-ingesting
    if fname in manifest:
        try:
            existing = collection.get(where={"source": fname})
            if existing["ids"]:
                collection.delete(ids=existing["ids"])
                print(f"  [clean] removed {len(existing['ids'])} old chunks for {fname}")
        except Exception:
            pass

    pages = extract_pages(pdf_path)
    if not pages:
        print(f"  [warn] {fname} — no extractable text, skipping")
        return 0

    all_ids, all_docs, all_metas = [], [], []
    chunk_global = 0
    for page_num, page_text in pages:
        for chunk in chunk_text(page_text):
            chunk_id = f"{fname}__p{page_num}__c{chunk_global}"
            all_ids.append(chunk_id)
            all_docs.append(chunk)
            all_metas.append({"source": fname, "page": page_num})
            chunk_global += 1

    print(f"  [embed] {fname} — {chunk_global} chunks across {len(pages)} pages")

    # Embed and add in batches of 50 to avoid overwhelming Ollama
    batch = 50
    for i in range(0, len(all_ids), batch):
        batch_docs = all_docs[i : i + batch]
        batch_ids = all_ids[i : i + batch]
        batch_metas = all_metas[i : i + batch]
        print(f"    batch {i // batch + 1}/{(len(all_ids) + batch - 1) // batch} ({len(batch_docs)} chunks)...", end="", flush=True)
        embeddings = embed(batch_docs)
        collection.add(ids=batch_ids, embeddings=embeddings, documents=batch_docs, metadatas=batch_metas)
        print(" done")

    manifest[fname] = fhash
    return chunk_global


def main():
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(DOCS_DIR.glob("*.pdf"))
    if not pdfs:
        print("No PDFs found in rag/documents/")
        sys.exit(0)

    print(f"Found {len(pdfs)} PDF(s) in {DOCS_DIR}\n")

    client = chromadb.PersistentClient(path=str(STORE_DIR))
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    manifest = load_manifest()
    total_chunks = 0

    for pdf in pdfs:
        print(f"Processing: {pdf.name}")
        n = ingest_pdf(pdf, collection, manifest)
        total_chunks += n
        save_manifest(manifest)  # save after each file so a crash doesn't lose progress

    print(f"\nDone. Total chunks in vectorstore: {collection.count()}")
    print(f"New chunks added this run: {total_chunks}")


if __name__ == "__main__":
    main()
