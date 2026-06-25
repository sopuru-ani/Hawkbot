from pinecone import Pinecone
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import os

load_dotenv()

model = SentenceTransformer(os.getenv("SENTENCE_TRANSFORMER_MODEL"))
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

response = index.query(
    vector=model.encode("How much does it cost to apply for UMES").tolist(),
    top_k=1,
    include_metadata=True
)

print(response.matches[0])