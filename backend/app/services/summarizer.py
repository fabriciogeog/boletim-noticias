import logging
from typing import List, Dict
import os
from datetime import datetime
import google.generativeai as genai

logger = logging.getLogger(__name__)

class NewsSummarizer:
    """
    Sumarizador Híbrido: Usa Google Gemini (Nuvem) se habilitado,
    ou reverte para o fallback simples.
    """
    
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.default_summary_mode = os.getenv("AI_SUMMARY_MODE", "none").lower()
        
        if self.gemini_api_key and self.default_summary_mode == "gemini":
            try:
                genai.configure(api_key=self.gemini_api_key)
                
                # ================================================================
                # CORREÇÃO: Usando 'gemini-pro' (compatível com a biblioteca 0.8.5)
                # ================================================================
                self.gemini_model = genai.GenerativeModel('gemini-pro')
                
                logger.info("✓ Sumarizador Google Gemini (Nuvem) inicializado.")
            except Exception as e:
                logger.error(f"✗ Falha ao inicializar Google Gemini (verifique a API Key): {e}")
                self.gemini_model = None
        else:
            self.gemini_model = None
            logger.warning("="*50)
            logger.warning("Sumarização com IA (Gemini) está DESABILITADA (sem chave ou modo 'none').")
            logger.warning("Usando o modo de fallback (lista de notícias simples).")
            logger.warning("="*50)

    async def summarize(
        self,
        articles: List[Dict],
        style: str = "jornalistico",
        include_intro: bool = True,
        include_outro: bool = True,
        summary_mode: str = None
    ) -> str:
        """
        Gera o roteiro do boletim. Tenta usar IA (Gemini) se disponível
        e habilitado, senão, usa o fallback simples.
        """
        if not articles:
            return "Nenhuma notícia disponível no momento."

        mode = summary_mode or self.default_summary_mode

        if mode == "gemini" and self.gemini_model:
            logger.info(f"Sumarizando {len(articles)} artigos com Gemini (Nuvem)...")
            try:
                prompt = self._create_gemini_prompt(articles, style, include_intro, include_outro)
                
                response = self.gemini_model.generate_content(prompt)
                
                source_names = self._get_source_credits(articles)
                credits = f"\n\nEste boletim teve informações de {source_names}."
                
                return response.text + credits
            except Exception as e:
                logger.error(f"✗ Erro ao sumarizar com Gemini: {e}")
                logger.warning("Revertendo para o modo de fallback (lista simples)...")
                return self._create_simple_summary(articles, include_intro, include_outro)
        else:
            logger.info(f"Gerando resumo simples (fallback) para {len(articles)} artigos.")
            return self._create_simple_summary(articles, include_intro, include_outro)
    
    def _create_simple_summary(
        self,
        articles: List[Dict],
        include_intro: bool,
        include_outro: bool
    ) -> str:
        """ Cria resumo simples sem LLM (fallback) """
        lines = []
        
        if include_intro:
            now = datetime.now()
            periodo = "Bom dia" if now.hour < 12 else "Boa tarde" if now.hour < 18 else "Boa noite"
            lines.append(f"{periodo}! Estas são as principais notícias de hoje.\n")
        
        for article in articles:
            title = article.get('title', '')
            summary = article.get('summary', '')
            
            if summary:
                summary = summary.replace('\n', ' ').replace('\r', ' ')
                lines.append(f"{title}. {summary}\n")
            else:
                lines.append(f"{title}.\n")
        
        source_names = self._get_source_credits(articles)
        if source_names:
            lines.append(f"\nEste boletim teve informações de {source_names}.")
        
        if include_outro:
            lines.append("\nEssas foram as principais notícias. Até a próxima!")
        
        return "\n".join(lines)

    def _get_source_credits(self, articles: List[Dict]) -> str:
        """ Pega os nomes das fontes para os créditos. """
        source_names = set()
        for article in articles:
            source = article.get('source')
            if source and source != 'Fonte desconhecida':
                source_names.add(source)
        return ", ".join(source_names)

    def _format_articles_for_prompt(self, articles: List[Dict]) -> str:
        """ Formata artigos para o prompt do Gemini. """
        formatted = []
        for i, article in enumerate(articles, 1):
            formatted.append(f"Notícia {i} (Categoria: {article.get('category')}, Fonte: {article.get('source')}):\n"
                             f"Título: {article.get('title')}\n"
                             f"Descrição: {article.get('summary')}\n---")
        return "\n".join(formatted)

    def _create_gemini_prompt(
        self,
        articles: List[Dict],
        style: str,
        include_intro: bool,
        include_outro: bool
    ) -> str:
        """ Cria o prompt otimizado para o Gemini. """
        
        articles_text = self._format_articles_for_prompt(articles)
        
        prompt = f"""
        Você é um roteirista de rádio. Sua tarefa é transformar a lista de notícias abaixo em um roteiro de áudio coeso, fluido e profissional.

        REGRAS PRINCIPAIS:
        1.  **Tom:** {style} (Se for 'jornalistico', seja formal. Se 'conversacional', seja mais amigável, mas mantenha a credibilidade).
        2.  **Transições:** Crie transições suaves entre as notícias (ex: "Mudando para a política...", "No mundo dos esportes...").
        3.  **Não liste:** Não use marcadores (bullets) ou numeração. O texto deve ser um parágrafo único e fluido.
        4.  **Não cite fontes:** Não diga "Segundo o G1..." no meio do texto. Os créditos serão adicionados no final.
        5.  {'**Introdução:** Comece com uma saudação e introdução adequadas.' if include_intro else 'Comece direto com a primeira notícia.'}
        6.  {'**Encerramento:** Finalize com um encerramento apropriado.' if include_outro else 'Termine após a última notícia.'}
        7.  **Seja conciso:** Resuma cada notícia em 1-2 frases.
        
        Aqui estão as notícias:
        ---
        {articles_text}
        ---
        
        Por favor, gere APENAS o roteiro final.
        """
        return prompt
