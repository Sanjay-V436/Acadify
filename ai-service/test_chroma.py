import chromadb

client = chromadb.HttpClient(host="localhost", port=8000)

collection = client.get_or_create_collection(name="test_collection")

collection.add(
    documents=["This is a test document about machine learning"],
    ids=["doc1"]
)

results = collection.query(
    query_texts=["ML research"],
    n_results=1
)

print(results)