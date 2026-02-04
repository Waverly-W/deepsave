import trafilatura
from typing import Optional, Dict

class HttpClient:
    @staticmethod
    def fetch_and_extract(url: str) -> Dict[str, Optional[str]]:
        downloaded = trafilatura.fetch_url(url)
        if downloaded is None:
            return {"error": "Failed to download", "status": "failed"}
            
        result = trafilatura.extract(downloaded, include_comments=False, include_tables=False, with_metadata=True)
        
        if not result:
             return {"error": "Failed to extract content", "status": "failed"}

        # Extract metadata specifically if needed, trafilatura.extract returns string or None (if no output_format specified, default is txt)
        # To get metadata, we use extraction options or helper functions.
        # For MVP, let's just trust extract() returns the main body text.
        
        # We can also get title specifically
        metadata = trafilatura.extract_metadata(downloaded)
        title = metadata.title if metadata else None
        
        return {
            "content": result,
            "title": title,
            "raw_html": downloaded,
            "status": "success"
        }
