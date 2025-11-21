import logging
import os
import httpx
import asyncio
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

class NewsCollector:
    """
    Coleta notícias usando a API oficial do GNews.io de forma ASSÍNCRONA (Paralela).
    """
    
    def __init__(self):
        self.api_key = os.getenv("GNEWS_API_KEY")
        self.base_url = "https://gnews.io/api/v4/top-headlines"
        
        if not self.api_key:
            logger.error("="*50)
            logger.error("ERRO: GNEWS_API_KEY não definida.")
            logger.error("="*50)
        
        self.CATEGORY_MAP = {
            "geral": "general", "politica": "nation", "futebol": "sports",
            "esportes": "sports", "economia": "business", "cultura": "entertainment",
            "tecnologia": "technology", "saude": "health", "ciencia": "science",
            "mundo": "world"
        }
        
        # Cliente HTTP assíncrono
        self.client = httpx.AsyncClient()

    async def collect(
        self,
        categories: List[str] = ["geral"],
        limit: int = 10,
        sources: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Coleta notícias de múltiplas categorias EM PARALELO.
        O 'limit' recebido aqui é o TOTAL de notícias (calculado pelo frontend).
        """
        if not self.api_key:
            logger.warning("GNEWS_API_KEY ausente. Retornando lista vazia.")
            return []

        # Evita divisão por zero
        if not categories:
            return []

        # Se o frontend pediu 12 notícias e tem 4 categorias, buscamos 3 de cada.
        # Se a divisão não for exata, arredondamos para cima para não faltar.
        articles_per_category = max(1, int(limit / len(categories)))
        
        logger.info(f"Iniciando coleta: {len(categories)} categorias, alvo de ~{articles_per_category} notícias/cada.")

        # Cria uma lista de tarefas para rodar ao mesmo tempo
        tasks = []
        for category in categories:
            tasks.append(self._fetch_category(category, articles_per_category))
        
        # DISPARA TODAS AS REQUISIÇÕES SIMULTANEAMENTE (Aqui está a velocidade!)
        results = await asyncio.gather(*tasks)
        
        # Processa os resultados
        all_articles = []
        seen_titles = set()
        
        for category_articles in results:
            for article in category_articles:
                # Remove duplicatas (mesma notícia em categorias diferentes)
                if article['title'] not in seen_titles:
                    all_articles.append(article)
                    seen_titles.add(article['title'])
                    
        logger.info(f"Total de artigos coletados e únicos: {len(all_articles)}")
        
        # Retorna o limite exato pedido pelo usuário
        return all_articles[:limit]

    async def _fetch_category(self, category_name: str, max_articles: int) -> List[Dict]:
        """ Função auxiliar para buscar uma única categoria """
        api_topic = self.CATEGORY_MAP.get(category_name.lower(), "general")
        
        params = {
            "apikey": self.api_key,
            "country": "br",
            "lang": "pt",
            "topic": api_topic,
            "max": max_articles
        }
        
        try:
            response = await self.client.get(
                self.base_url, params=params, timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            articles = data.get("articles", [])
            return self._parse_json_response(articles, category_name)
            
        except Exception as e:
            logger.error(f"Erro ao coletar categoria '{category_name}': {e}")
            return []

    def _parse_json_response(self, articles: List[Dict], category: str) -> List[Dict]:
        parsed_list = []
        for article in articles:
            if not article.get("title"): continue
            
            parsed_list.append({
                "title": article.get("title"),
                "summary": article.get("description", ""),
                "source": article.get("source", {}).get("name", "Fonte desconhecida"),
                "url": article.get("url"),
                "category": category
            })
        return parsed_list
