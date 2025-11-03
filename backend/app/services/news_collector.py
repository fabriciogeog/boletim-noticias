import feedparser
import logging
from datetime import datetime
from typing import List, Dict, Optional
import asyncio

logger = logging.getLogger(__name__)

class NewsCollector:
    """
    Coletor de notícias via RSS Feeds dos principais portais brasileiros
    """
    
    def __init__(self):
        self.feeds = {
            "g1": {
                "geral": "https://g1.globo.com/rss/g1/",
                "politica": "https://g1.globo.com/rss/g1/politica/",
                "economia": "https://g1.globo.com/rss/g1/economia/",
                "tecnologia": "https://g1.globo.com/rss/g1/tecnologia/",
                "esportes": "https://g1.globo.com/rss/g1/esportes/"
            },
            "uol": {
                "geral": "https://rss.uol.com.br/feed/noticias.xml",
                "economia": "https://rss.uol.com.br/feed/economia.xml",
                "esportes": "https://rss.uol.com.br/feed/esporte.xml",
                "tecnologia": "https://rss.uol.com.br/feed/tecnologia.xml"
            },
            "folha": {
                "geral": "https://www1.folha.uol.com.br/rss/emcimadahora.xml",
                "mercado": "https://www1.folha.uol.com.br/rss/mercado.xml",
                "mundo": "https://www1.folha.uol.com.br/rss/mundo.xml",
                "esporte": "https://www1.folha.uol.com.br/rss/esporte.xml"
            },
            "cnn": {
                "geral": "https://www.cnnbrasil.com.br/feed/",
                "politica": "https://www.cnnbrasil.com.br/politica/feed/",
                "economia": "https://www.cnnbrasil.com.br/economia/feed/",
                "tecnologia": "https://www.cnnbrasil.com.br/tecnologia/feed/"
            }
        }
        
        # User-Agent para evitar bloqueios
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    
    def get_available_sources(self) -> Dict[str, List[str]]:
        """Retorna lista de fontes e categorias disponíveis"""
        return {
            source: list(categories.keys())
            for source, categories in self.feeds.items()
        }
    
    async def collect(
        self,
        categories: List[str] = ["geral"],
        limit: int = 10,
        sources: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Coleta notícias dos feeds RSS
        
        Args:
            categories: Lista de categorias (ex: ["geral", "politica"])
            limit: Número máximo de artigos por categoria
            sources: Lista de fontes específicas (None = todas)
        
        Returns:
            Lista de dicionários com notícias
        """
        articles = []
        sources_to_use = sources if sources else list(self.feeds.keys())
        
        logger.info(f"Coletando de fontes: {sources_to_use}, categorias: {categories}")
        
        for source in sources_to_use:
            if source not in self.feeds:
                logger.warning(f"Fonte {source} não encontrada")
                continue
            
            for category in categories:
                if category not in self.feeds[source]:
                    logger.warning(f"Categoria {category} não disponível em {source}")
                    continue
                
                feed_url = self.feeds[source][category]
                
                try:
                    # Fazer parse do RSS feed com User-Agent
                    import urllib.request
                    req = urllib.request.Request(feed_url, headers=self.headers)
                    response = urllib.request.urlopen(req, timeout=10)
                    feed = feedparser.parse(response.read())
                    
                    # Processar entradas
                    for entry in feed.entries[:limit]:
                        article = self._parse_entry(entry, source, category)
                        if article:
                            articles.append(article)
                    
                    logger.info(f"Coletados {len(feed.entries[:limit])} artigos de {source}/{category}")
                
                except Exception as e:
                    logger.error(f"Erro ao coletar de {source}/{category}: {e}")
                    continue
        
        # Ordenar por data (mais recentes primeiro)
        articles.sort(key=lambda x: x.get('published', ''), reverse=True)
        
        logger.info(f"Total de artigos coletados: {len(articles)}")
        return articles[:limit * len(categories)]
    
    def _parse_entry(self, entry, source: str, category: str) -> Optional[Dict]:
        """
        Parse de uma entrada RSS
        """
        try:
            # Extrair dados do feed
            title = entry.get('title', '').strip()
            summary = entry.get('summary', entry.get('description', '')).strip()
            link = entry.get('link', '')
            
            # Data de publicação
            published = entry.get('published', entry.get('updated', ''))
            if published:
                try:
                    published_date = datetime(*entry.published_parsed[:6])
                    published = published_date.isoformat()
                except:
                    published = datetime.now().isoformat()
            else:
                published = datetime.now().isoformat()
            
            # Limpar HTML do summary (se houver)
            from bs4 import BeautifulSoup
            if summary:
                soup = BeautifulSoup(summary, 'html.parser')
                summary = soup.get_text().strip()
            
            if not title:
                return None
            
            return {
                'title': title,
                'summary': summary,
                'link': link,
                'source': source,
                'category': category,
                'published': published
            }
        
        except Exception as e:
            logger.error(f"Erro ao processar entrada: {e}")
            return None
    
    async def test_feeds(self) -> Dict[str, bool]:
        """
        Testa conectividade com todos os feeds
        """
        results = {}
        
        for source, categories in self.feeds.items():
            for category, url in categories.items():
                try:
                    feed = await asyncio.to_thread(feedparser.parse, url)
                    success = len(feed.entries) > 0
                    results[f"{source}/{category}"] = success
                    
                    if success:
                        logger.info(f"✓ {source}/{category}: {len(feed.entries)} artigos")
                    else:
                        logger.warning(f"✗ {source}/{category}: sem artigos")
                
                except Exception as e:
                    logger.error(f"✗ {source}/{category}: {e}")
                    results[f"{source}/{category}"] = False
        
        return results
