import logging
from typing import List, Dict
from datetime import datetime
import os # Importar 'os' para ler a variável de ambiente

logger = logging.getLogger(__name__)

class NewsSummarizer:
    """
    Sumarizador de notícias MODO LEVE (Fallback).
    Apenas formata os títulos e descrições do GNews em um roteiro simples.
    """
    
    def __init__(self):
        # Lemos a variável de ambiente para o "interruptor"
        self.enable_ollama = os.getenv("ENABLE_OLLAMA", "false").lower() == "true"
        
        if self.enable_ollama:
            logger.info("Sumarização com OLLAMA está HABILITADA.")
            # Você pode inicializar o cliente Ollama aqui se quiser
            # self.model = "mistral" 
        else:
            logger.warning("="*50)
            logger.warning("Sumarização com OLLAMA está DESABILITADA (ENABLE_OLLAMA=false).")
            logger.warning("Usando o modo de fallback (lista de notícias simples).")
            logger.warning("="*50)
        
    async def summarize(
        self,
        articles: List[Dict],
        style: str = "jornalistico",
        include_intro: bool = True,
        include_outro: bool = True,
        max_words_per_article: int = 50
    ) -> str:
        """
        Cria resumo simples sem LLM (Fallback)
        """
        if not articles:
            return "Nenhuma notícia disponível no momento."

        # Se o Ollama estivesse habilitado, a lógica de IA entraria aqui.
        # Como está desabilitado (ENABLE_OLLAMA=false), pulamos direto para o fallback.
        if self.enable_ollama:
            logger.warning("Tentativa de sumarizar com IA, mas o hardware/modelo é o problema. Revertendo para fallback.")
            # (Aqui entraria a chamada real para o Ollama que estava travando)
            # Por segurança, forçamos o fallback:
            pass

        logger.info(f"Gerando resumo simples (fallback) para {len(articles)} artigos.")
        return self._create_simple_summary(articles, include_intro, include_outro)
    
    def _create_simple_summary(
        self,
        articles: List[Dict],
        include_intro: bool,
        include_outro: bool
    ) -> str:
        """
        Cria resumo simples sem LLM (fallback)
        """
        from datetime import datetime
        
        lines = []
        source_names = set() # Usamos um 'set' para evitar fontes duplicadas
        
        if include_intro:
            now = datetime.now()
            periodo = "Bom dia" if now.hour < 12 else "Boa tarde" if now.hour < 18 else "Boa noite"
            lines.append(f"{periodo}! Estas são as principais notícias de hoje.\n")
        
        for article in articles:
            title = article.get('title', '')
            summary = article.get('summary', '')
            
            # Coleta o nome da fonte de cada artigo
            source = article.get('source')
            if source and source != 'Fonte desconhecida':
                source_names.add(source)
            
            if summary:
                # Remove quebras de linha da descrição do GNews
                summary = summary.replace('\n', ' ').replace('\r', ' ')
                lines.append(f"{title}. {summary}\n")
            else:
                lines.append(f"{title}.\n")
        
        # ================================================================
        # AÇÃO 2 (Fase 1): Adicionar os créditos das fontes
        # ================================================================
        if source_names:
            # Formata as fontes: "G1, UOL, Folha"
            sources_text = ", ".join(source_names)
            lines.append(f"\nEste boletim teve informações de {sources_text}.")
        
        if include_outro:
            lines.append("\nEssas foram as principais notícias. Até a próxima!")
        
        return "\n".join(lines)
