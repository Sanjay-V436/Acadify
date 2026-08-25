"""
Standalone test — confirms BGE-Small loads correctly and produces embeddings.
No FastAPI, no ChromaDB — just the model, in isolation.
"""

from sentence_transformers import SentenceTransformer

print("Loading BGE-Small model... (this may take a minute the first time, it downloads the model)")
model = SentenceTransformer("BAAI/bge-small-en-v1.5")
print("Model loaded successfully.")

text = "Machine learning for agricultural sensing and IoT systems"
embedding = model.encode(text)

print(f"\nInput text: {text}")
print(f"Embedding shape: {embedding.shape}")
print(f"First 5 values: {embedding[:5]}")