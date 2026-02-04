import re

class ContentClassifier:
    @staticmethod
    def classify(text: str, url: str) -> str:
        """
        Simple rule-based classification for MVP.
        Will be replaced by TinyBERT or similar later.
        """
        url_lower = url.lower()
        
        # 1. Code Repos
        if "github.com" in url_lower or "gitlab.com" in url_lower:
            return "code"
            
        # 2. Video Platforms
        if "youtube.com" in url_lower or "bilibili.com" in url_lower:
            return "video"
            
        # 3. Shopping
        if "amazon" in url_lower or "taobao" in url_lower or "jd.com" in url_lower:
            return "product"
            
        # 4. Papers
        if "arxiv.org" in url_lower:
            return "paper"
            
        # Default
        return "article"
