import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb
from sentence_transformers import SentenceTransformer
from rag_data import documents

app = FastAPI()

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION", "chatbot_knowledge")

# Load embedding model once at startup so requests only do inference.
model = SentenceTransformer(EMBEDDING_MODEL)

# PersistentClient stores vectors on disk instead of rebuilding on every restart.
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)

if collection.count() == 0:
    embeddings = model.encode(documents).tolist()
    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=[{"source": "seed", "index": i} for i in range(len(documents))],
        ids=[f"seed-{i}" for i in range(len(documents))]
    )

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3

class AddDocumentsRequest(BaseModel):
    documents: List[str]
    ids: Optional[List[str]] = None
    source: Optional[str] = "api"

@app.post("/search")
def search(payload: SearchRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="query is required")

    query_embedding = model.encode([payload.query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=payload.top_k or 3
    )

    return {
        "results": results["documents"][0],
        "distances": results.get("distances", [[]])[0],
        "metadatas": results.get("metadatas", [[]])[0],
    }

@app.post("/documents")
def add_documents(payload: AddDocumentsRequest):
    clean_documents = [doc.strip() for doc in payload.documents if doc.strip()]

    if not clean_documents:
        raise HTTPException(status_code=400, detail="documents are required")

    ids = payload.ids or [
        f"{payload.source}-{collection.count() + i}" for i in range(len(clean_documents))
    ]

    if len(ids) != len(clean_documents):
        raise HTTPException(status_code=400, detail="ids length must match documents length")

    embeddings = model.encode(clean_documents).tolist()
    collection.add(
        documents=clean_documents,
        embeddings=embeddings,
        metadatas=[{"source": payload.source or "api"} for _ in clean_documents],
        ids=ids,
    )

    return {
        "success": True,
        "count": len(clean_documents),
        "collection_count": collection.count(),
    }

@app.get("/")
def test():
    return {
        "status": "working",
        "collection": COLLECTION_NAME,
        "document_count": collection.count(),
        "embedding_model": EMBEDDING_MODEL,
    }
