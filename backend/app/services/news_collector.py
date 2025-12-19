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
    Estratégia Híbrida: Usa termos em PT e EN para maximizar a busca,
    mas filtra resultados apenas em Português do Brasil.
    """
    
    def __init__(self):
        self.api_key = os.getenv("GNEWS_API_KEY")
        self.base_url = "https://gnews.io/api/v4/search"
        
        if not self.api_key:
            logger.error("ERRO: GNEWS_API_KEY não definida.")
        
        # Mapeamento HÍBRIDO (Português + Inglês)
        # O teste do usuário provou que termos como 'sport' trazem resultados melhores
        # devido a nomes de times e URLs, mesmo em notícias brasileiras.
        self.SEARCH_TERMS = {
            "geral": "brasil OR breaking news OR manchetes",
            
            "politica": "política brasil OR congresso nacional OR governo federal OR planalto OR politics brazil",
            
            "economia": "economia brasil OR mercado financeiro OR inflação OR business brazil OR economy",
            
            "tecnologia": "tecnologia inovação OR inteligência artificial OR startups OR tech brazil OR technology",
            
            # AQUI ESTÁ A MUDANÇA SOLICITADA:
            # Adicionamos 'sport' e 'sports' para pegar tanto a categoria quanto nomes de times (Sport Recife, etc)
            "esportes": "esportes brasil OR futebol OR campeonato OR sport brazil OR sports",
            
            "entretenimento": "cinema brasil OR música brasil OR cultura pop OR famosos OR entertainment",
            
            # Aliases
            "futebol": "futebol brasil OR soccer brazil",
            "saude": "saúde pública brasil OR medicina OR health brazil",
            "ciencia": "ciência pesquisa brasil OR science brazil",
            "mundo": "notícias internacionais mundo OR world news"
        }
        
        self.client = httpx.AsyncClient()

    async def collect(
        self,
        categories: List[str] = ["geral"],
        limit: int = 10,
        sources: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Coleta notícias buscando ativamente por palavras-chave.
        """
        if not self.api_key or not categories:
            return []

        # Calcula quantos artigos buscar por categoria
        articles_per_category = max(1, int(limit / len(categories)))
        
        logger.info(f"🔎 Iniciando busca HÍBRIDA para: {categories}")

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
        """ Realiza a busca específica """
        
        # Pega a query híbrida
        search_query = self.SEARCH_TERMS.get(category_name, category_name)
        
        params = {
            "apikey": self.api_key,
            "q": search_query,
            "lang": "pt",       # Mantemos PT para garantir que o texto venha em português
            "country": "br",    # Mantemos BR
            "max": max_articles,
            "sortby": "publishedAt"
        }
        
        try:
            logger.info(f"Buscando GNews por: '{search_query}'")

            response = await self.client.get(
                self.base_url, params=params, timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            articles = data.get("articles", [])
            
            # Fallback
            if not articles and category_name != 'geral':
                logger.warning(f"Busca estrita vazia. Tentando fallback simples: '{category_name}'")
                params['q'] = category_name 
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
