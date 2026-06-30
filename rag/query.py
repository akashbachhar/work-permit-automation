"""
RAG query module — embed a question, retrieve top-k chunks from Chroma.
Import and use from the Flask backend:
    from rag.query import retrieve, generate_sop
"""

import threading
from pathlib import Path

import chromadb
import ollama

STORE_DIR = Path(__file__).parent / "vectorstore"
COLLECTION_NAME = "hpcl_docs"
EMBED_MODEL = "nomic-embed-text"
GENERATE_MODEL = "gemma4:12b"
GENERATE_OPTIONS = {"num_ctx": 8192}

_client = None
_collection = None
_lock = threading.Lock()


def _get_collection():
    global _client, _collection
    with _lock:
        if _collection is None:
            _client = chromadb.PersistentClient(path=str(STORE_DIR))
            col = _client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            # warm-up: force HNSW index to load before any threaded request hits it
            col.query(query_embeddings=[[0.0] * 768], n_results=1, include=[])
            _collection = col
    return _collection


def retrieve(question: str, n_results: int = 5) -> list[dict]:
    """Embed the question and return the top-k matching chunks with metadata."""
    resp = ollama.embeddings(model=EMBED_MODEL, prompt=question)
    query_embedding = resp["embedding"]

    collection = _get_collection()
    with _lock:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text": doc,
            "source": meta.get("source", ""),
            "page": meta.get("page", ""),
            "score": round(1 - dist, 4),  # cosine distance -> similarity
        })
    return chunks


def generate_sop(permit: dict) -> str:
    """
    Given a work permit dict, retrieve relevant SOP context and generate
    a structured SOP using gemma4:12b.
    """
    query = (
        f"Safety procedures and work permit requirements for: "
        f"{permit.get('work_type', '')} "
        f"at {permit.get('location', '')}. "
        f"Equipment: {permit.get('equipment', '')}. "
        f"Hazards: {permit.get('hazards', '')}."
    )

    chunks = retrieve(query, n_results=6)

    context = "\n\n---\n\n".join(
        f"[Source: {c['source']}, Page {c['page']}]\n{c['text']}"
        for c in chunks
    )

    prompt = f"""You are a safety officer at HPCL (Hindustan Petroleum Corporation Limited).
Using ONLY the reference material provided below, generate a detailed Standard Operating Procedure (SOP)
for the following work permit.

WORK PERMIT DETAILS:
- Work Type: {permit.get('work_type', 'N/A')}
- Location: {permit.get('location', 'N/A')}
- Equipment: {permit.get('equipment', 'N/A')}
- Hazards: {permit.get('hazards', 'N/A')}
- Description: {permit.get('description', 'N/A')}

REFERENCE MATERIAL:
{context}

Generate the SOP with the following sections:
1. Scope & Purpose
2. Precautions & PPE Requirements
3. Step-by-Step Procedure
4. Emergency Procedures
5. Post-Work Checklist

Base every point on the reference material above. Be specific and practical."""

    response = ollama.chat(
        model=GENERATE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        options=GENERATE_OPTIONS,
    )
    return response["message"]["content"]


LANGUAGE_NAMES = {
    "hindi": "Hindi (Devanagari script)",
    "bengali": "Bengali (Bengali script)",
    "kannada": "Kannada (Kannada script)",
}


def translate_sop(sop_text: str, language: str) -> str:
    """Translate a generated SOP into the target language, preserving markdown structure."""
    label = LANGUAGE_NAMES.get(language, language)
    prompt = f"""Translate the following Standard Operating Procedure into {label}.
Preserve the markdown formatting exactly as-is (lines starting with #, ##, ###, -, *, or numbers
followed by a period, and **bold** markers) — only translate the natural language content,
not the markdown symbols. Output ONLY the translated SOP text, with no preamble, explanation,
or English commentary.

SOP TEXT:
{sop_text}"""

    response = ollama.chat(
        model=GENERATE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        options=GENERATE_OPTIONS,
    )
    return response["message"]["content"]
