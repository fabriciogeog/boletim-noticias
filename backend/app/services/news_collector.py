import logging
import os
import httpx
import asyncio
from typing import List, Dict, Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

class NewsCollector:
    """
    Coleta notícias usando a API GNews via endpoint de BUSCA (Search).
    Isso garante relevância temática muito superior ao endpoint 'top-headlines'.
    """
    
    def __init__(self):
        self.api_key = os.getenv("GNEWS_API_KEY")
        # MUDANÇA CRÍTICA: Usando endpoint de busca para forçar relevância
        self.base_url = "https://gnews.io/api/v4/search"
        
        if not self.api_key:
            logger.error("ERRO: GNEWS_API_KEY não definida.")
        
        # Mapeamento de 'Categoria' para 'Termos de Busca'
        # Usamos operadores OR para ampliar a cobertura do tema
        self.SEARCH_TERMS = {
            "geral": "brasil", # Busca ampla
            "politica": "política brasil OR governo federal OR congresso",
            "economia": "economia brasil OR mercado financeiro OR inflação",
            "tecnologia": "tecnologia inovação OR inteligência artificial",
            "esportes": "esportes brasil OR futebol OR campeonato",
            "entretenimento": "entretenimento OR cinema OR famosos OR música",
            "futebol": "futebol brasil",
            "saude": "saúde brasil OR medicina",
            "ciencia": "ciência pesquisa",
            "mundo": "notícias internacionais"
        }
        
        self.client = httpx.AsyncClient()

    async def collect(
        self,
        categories: List[str] = ["geral"],
        limit: int = 10,
        sources: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Coleta notícias buscando ativamente por palavras-chave dos temas.
        """
        if not self.api_key or not categories:
            return []

        # Calcula quantos artigos buscar por categoria
        articles_per_category = max(1, int(limit / len(categories)))
        
        logger.info(f"🔎 Iniciando busca ativa (Search Strategy) para: {categories}")

        tasks = []
        for category in categories:
            clean_cat = category.lower().strip()
            tasks.append(self._search_category(clean_cat, articles_per_category))
        
        results = await asyncio.gather(*tasks)
        
        all_articles = []
        seen_titles = set()
        
        for category_articles in results:
            for article in category_articles:
                if article['title'] not in seen_titles:
                    all_articles.append(article)
                    seen_titles.add(article['title'])
                    
        return all_articles[:limit]

    async def _search_category(self, category_name: str, max_articles: int) -> List[Dict]:
        """ Realiza a busca para uma categoria específica """
        
        # Pega os termos de busca ou usa o próprio nome da categoria como fallback
        search_query = self.SEARCH_TERMS.get(category_name, category_name)
        
        params = {
            "apikey": self.api_key,
            "q": search_query,
            "lang": "pt",
            "country": "br",
            "max": max_articles,
            "sortby": "publishedAt" # Garante notícias frescas
        }
        
        try:
            # Log da URL para conferência (sem a API Key para segurança)
            safe_url = f"{self.base_url}?q={quote(search_query)}&lang=pt..."
            logger.info(f"Buscando GNews: {safe_url}")

            response = await self.client.get(
                self.base_url, params=params, timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            articles = data.get("articles", [])
            
            # Validação extra: Se a busca retornar vazio e for um termo específico,
            # tenta uma busca mais genérica para não vir vazio.
            if not articles and category_name != 'geral':
                logger.warning(f"Busca estrita para '{search_query}' vazia. Tentando termo simples.")
                params['q'] = category_name # Tenta buscar só "economia" em vez da query complexa
                retry = await self.client.get(self.base_url, params=params)
                if retry.status_code == 200:
                    articles = retry.json().get("articles", [])

            return self._parse_json_response(articles, category_name)
            
        except Exception as e:
            logger.error(f"Erro na busca por '{category_name}': {e}")
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
