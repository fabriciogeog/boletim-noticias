import logging
import os
import httpx
import asyncio
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class NewsCollector:
    """
    Coleta notícias usando a API GNews via endpoint TOP-HEADLINES.
    Retorna apenas notícias recentes (sem mistura com dados históricos).
    Plano gratuito: atraso de 12h, sem limite de datas além de 30 dias.
    """

    def __init__(self):
        self.api_key    = os.getenv("GNEWS_API_KEY")
        self.url_top    = "https://gnews.io/api/v4/top-headlines"
        self.url_search = "https://gnews.io/api/v4/search"   # fallback

        if not self.api_key:
            logger.error("ERRO: GNEWS_API_KEY não definida.")

        # Mapeamento das categorias do sistema para as categorias do GNews top-headlines
        # Documentação: https://gnews.io/docs/v4#top-headlines
        self.GNEWS_CATEGORIES = {
            "geral":          "general",
            "mundo":          "world",
            "politica":       "nation",
            "economia":       "business",
            "tecnologia":     "technology",
            "entretenimento": "entertainment",
            "esportes":       "sports",
            "futebol":        "sports",
            "saude":          "health",
            "ciencia":        "science",
        }

        # Termos de busca usados APENAS como fallback (search endpoint)
        self.SEARCH_FALLBACK = {
            "geral":          "brasil notícias",
            "politica":       "política brasil",
            "economia":       "economia brasil",
            "tecnologia":     "tecnologia brasil",
            "esportes":       "esportes brasil",
            "futebol":        "futebol brasil",
            "entretenimento": "entretenimento brasil",
            "saude":          "saúde brasil",
            "ciencia":        "ciência brasil",
            "mundo":          "world news",
        }

        self.client = httpx.AsyncClient()

    async def collect(
        self,
        categories: List[str] = ["geral"],
        limit: int = 10,
        sources: Optional[List[str]] = None
    ) -> List[Dict]:
        if not self.api_key or not categories:
            return []

        articles_per_category = max(1, int(limit / len(categories)))
        logger.info(f"Coletando top-headlines para: {categories}")

        tasks = [
            self._fetch_category(cat.lower().strip(), articles_per_category)
            for cat in categories
        ]
        results = await asyncio.gather(*tasks)

        all_articles = []
        seen_titles  = set()

        for category_articles in results:
            for article in category_articles:
                if article["title"] not in seen_titles:
                    all_articles.append(article)
                    seen_titles.add(article["title"])

        return all_articles[:limit]

    async def _fetch_category(self, category: str, max_articles: int) -> List[Dict]:
        """Busca notícias pelo endpoint top-headlines; usa search como fallback."""

        gnews_cat = self.GNEWS_CATEGORIES.get(category, "general")

        params = {
            "apikey":   self.api_key,
            "category": gnews_cat,
            "lang":     "pt",
            "country":  "br",
            "max":      max_articles,
        }

        try:
            logger.info(f"top-headlines: categoria='{gnews_cat}' (solicitado: '{category}')")
            r = await self.client.get(self.url_top, params=params, timeout=15.0)
            r.raise_for_status()
            articles = r.json().get("articles", [])

            if articles:
                return self._parse(articles, category)

            # Fallback para search se top-headlines não retornar resultados
            logger.warning(f"top-headlines vazio para '{gnews_cat}'. Tentando search...")
            return await self._fallback_search(category, max_articles)

        except Exception as e:
            logger.error(f"Erro em top-headlines para '{category}': {e}")
            return await self._fallback_search(category, max_articles)

    async def _fallback_search(self, category: str, max_articles: int) -> List[Dict]:
        """Fallback: busca por termos quando top-headlines falha."""
        query = self.SEARCH_FALLBACK.get(category, category)
        params = {
            "apikey":  self.api_key,
            "q":       query,
            "lang":    "pt",
            "country": "br",
            "max":     max_articles,
            "sortby":  "publishedAt",
        }
        try:
            logger.info(f"search fallback: query='{query}'")
            r = await self.client.get(self.url_search, params=params, timeout=15.0)
            r.raise_for_status()
            articles = r.json().get("articles", [])
            return self._parse(articles, category)
        except Exception as e:
            logger.error(f"Erro no fallback search para '{category}': {e}")
            return []

    def _parse(self, articles: List[Dict], category: str) -> List[Dict]:
        result = []
        for a in articles:
            if not a.get("title"):
                continue
            result.append({
                "title":    a.get("title", ""),
                "summary":  a.get("description", ""),
                "source":   a.get("source", {}).get("name", "Fonte desconhecida"),
                "url":      a.get("url", ""),
                "category": category,
            })
        return result