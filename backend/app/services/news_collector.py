import logging
import os
import httpx
from typing import List, Dict, Optional, Set

logger = logging.getLogger(__name__)

class NewsCollector:
    """
    Coleta notícias usando a API oficial do GNews.io.
    """
    
    def __init__(self):
        self.api_key = os.getenv("GNEWS_API_KEY")
        self.base_url = "https://gnews.io/api/v4/top-headlines" # Endpoint correto
        
        if not self.api_key:
            logger.error("="*50)
            logger.error("ERRO CRÍTICO: A variável de ambiente GNEWS_API_KEY não foi definida.")
            logger.error("Por favor, adicione-a ao seu 'docker-compose.yml' e reinicie.")
            logger.error("="*50)
        else:
            logger.info(f"Chave GNews API encontrada. Começa com: '{self.api_key[:4]}...'")
        
        self.CATEGORY_MAP = {
            "geral": "general",
            "politica": "nation",
            "futebol": "sports",
            "esportes": "sports",
            "economia": "business",
            "cultura": "entertainment",
            "tecnologia": "technology",
            "saude": "health",
            "ciencia": "science",
        }
        
        self.client = httpx.AsyncClient()

    async def collect(
        self,
        categories: List[str] = ["geral"],
        limit: int = 10,
        sources: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Coleta notícias de múltiplas categorias fazendo chamadas paralelas à API GNews.
        """
        if not self.api_key:
            logger.warning("Coleta de notícias pulada: GNEWS_API_KEY não definida.")
            return []

        all_articles = []
        seen_titles = set()
        
        articles_per_category = max(limit, limit // len(categories))
        
        for category_name in categories:
            api_topic = self.CATEGORY_MAP.get(category_name.lower(), "general")
            
            try:
                logger.info(f"Coletando notícias para tópico: '{category_name}' (API: '{api_topic}')")
                
                params = {
                    "apikey": self.api_key, # CORRIGIDO
                    "country": "br",
                    "lang": "pt",
                    "topic": api_topic,
                    "max": articles_per_category
                }
                
                headers = {"User-Agent": "BoletimNoticiasApp/1.0"}
                
                logger.info(f"Realizando chamada para: {self.base_url} com tópico: {api_topic}")
                response = await self.client.get(
                    self.base_url, params=params, headers=headers, timeout=10.0
                )
                
                logger.info(f"GNews (raw response) para '{api_topic}': {response.text[:200]}...")
                
                response.raise_for_status() 
                api_response = response.json()
                
                articles_list = api_response.get("articles", [])
                logger.info(f"GNews API retornou {len(articles_list)} artigos para '{api_topic}'")
                
                parsed_articles = self._parse_json_response(articles_list, api_topic)
                
                for article in parsed_articles:
                    if article['title'] not in seen_titles:
                        all_articles.append(article)
                        seen_titles.add(article['title'])

            except httpx.HTTPStatusError as e:
                logger.error(f"Erro de API GNews ao coletar '{api_topic}': {e.response.status_code}")
                logger.error(f"Corpo da resposta do erro: {e.response.text}")
            except Exception as e:
                logger.error(f"Erro inesperado ao coletar '{api_topic}': {e}")
            
            if len(all_articles) >= limit:
                break
        
        logger.info(f"Total de artigos coletados: {len(all_articles)}")
        
        return all_articles[:limit]

    def _parse_json_response(self, articles: List[Dict], category: str) -> List[Dict]:
        """ Converte o formato da GNews API para o formato interno que o Summarizer espera. """
        parsed_list = []
        for article in articles:
            if not article.get("title"):
                continue
            
            parsed_list.append({
                "title": article.get("title"),
                "summary": article.get("description", ""),
                "source": article.get("source", {}).get("name", "Fonte desconhecida"),
                "url": article.get("url"),
                "category": category
            })
        return parsed_list

    def get_available_sources(self) -> Dict:
        return {"Note": "Este método não é mais suportado com a GNews API"}
