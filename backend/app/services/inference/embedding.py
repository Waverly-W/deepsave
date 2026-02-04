from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import os

# Initialize Chroma Client (HttpClient to connect to Docker container)
# In production this should be in app/core/config.py
CHROMA_HOST = os.getenv("CHROMA_HOST", "chroma")
CHROMA_PORT = os.getenv("CHROMA_PORT", "8000")

# For MVP, we might run this inside the worker container which has access to chroma container
chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=int(CHROMA_PORT))

# Load Model (Downloads on first run, cached in /root/.cache/torch...)
# Use a small, fast model
MODEL_NAME = "all-MiniLM-L6-v2"
model = SentenceTransformer(MODEL_NAME)

class EmbeddingService:
    @staticmethod
    def generate_embedding(text: str):
        return model.encode(text).tolist()

    @staticmethod
    def store_embedding(item_id: str, text: str, metadata: dict):
        collection = chroma_client.get_or_create_collection(name="knowledge_base")
        
        vector = EmbeddingService.generate_embedding(text)
        
        collection.add(
            ids=[str(item_id)],
            embeddings=[vector],
            metadatas=[metadata],
            documents=[text[:1000]] # Store first 1000 chars as context snippet
        )

    @staticmethod
    def search(query: str, n_results: int = 5):
        collection = chroma_client.get_or_create_collection(name="knowledge_base")
        query_vector = EmbeddingService.generate_embedding(query)
        
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=n_results
        )
        return results
