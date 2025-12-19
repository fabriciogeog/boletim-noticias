import logging
from typing import List, Dict
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class NewsSummarizer:
    """
    Sumarizador com Groq (ultra-rápido e gratuito)
    Fallback para resumo simples se Groq não estiver disponível
    """
    
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.default_summary_mode = os.getenv("AI_SUMMARY_MODE", "none").lower()
        
        if self.groq_api_key and self.default_summary_mode == "groq":
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=self.groq_api_key)
                logger.info("✓ Sumarizador Groq (Nuvem) inicializado.")
            except ImportError:
                logger.error("✗ Biblioteca 'groq' não encontrada. Instale com: pip install groq")
                self.groq_client = None
            except Exception as e:
                logger.error(f"✗ Falha ao inicializar Groq (verifique a API Key): {e}")
                self.groq_client = None
        else:
            self.groq_client = None
            logger.warning("="*50)
            logger.warning("Sumarização com IA (Groq) está DESABILITADA (sem chave ou modo 'none').")
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
        Gera o roteiro do boletim. Tenta usar IA (Groq) se disponível
        e habilitado, senão, usa o fallback simples.
        """
        if not articles:
            return "Nenhuma notícia disponível no momento."

        mode = summary_mode or self.default_summary_mode

        if mode == "groq" and self.groq_client:
            logger.info(f"Sumarizando {len(articles)} artigos com Groq (Nuvem)...")
            try:
                prompt = self._create_groq_prompt(articles, style, include_intro, include_outro)
                
                # Chama a API do Groq (compatível com OpenAI)
                response = self.groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",  # Modelo rápido e gratuito
                    messages=[
                        {
                            "role": "system",
                            "content": "Você é um roteirista profissional de rádio. Crie roteiros fluidos, naturais e envolventes para áudio."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )
                
                roteiro = response.choices[0].message.content
                
                # Adiciona créditos das fontes
                source_names = self._get_source_credits(articles)
                credits = f"\n\nEste boletim teve informações de {source_names}."
                
                logger.info("✓ Sumarização com Groq concluída com sucesso!")
                return roteiro + credits
                
            except Exception as e:
                logger.error(f"✗ Erro ao sumarizar com Groq: {e}")
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
        """ Formata artigos para o prompt do Groq. """
        formatted = []
        for i, article in enumerate(articles, 1):
            formatted.append(
                f"Notícia {i} (Categoria: {article.get('category')}, Fonte: {article.get('source')}):\n"
                f"Título: {article.get('title')}\n"
                f"Descrição: {article.get('summary')}\n---"
            )
        return "\n".join(formatted)

    def _create_groq_prompt(
        self,
        articles: List[Dict],
        style: str,
        include_intro: bool,
        include_outro: bool
    ) -> str:
        """ Cria o prompt otimizado para o Groq. """
        
        articles_text = self._format_articles_for_prompt(articles)
        
        prompt = f"""
Você é um âncora de rádio experiente. Sua tarefa é transformar a lista de notícias cruas abaixo em um roteiro de áudio fluido e natural.

REGRAS DE OURO:
1.  **Fidelidade ao Tema:** Se as notícias forem todas do mesmo assunto (ex: só Economia), NÃO invente transições como "Mudando de assunto" ou "No cenário internacional". Apenas conecte uma notícia à outra de forma lógica (ex: "Ainda sobre o mercado...", "Por outro lado...").
2.  **Tom:** {style} (Adapte o vocabulário: Formal para jornalístico, leve para conversacional).
3.  **Estrutura:** Texto corrido, sem tópicos. Use pontuação adequada para a respiração do locutor.
4.  **Conteúdo:** Resuma cada notícia em 1 ou 2 frases curtas. Vá direto ao ponto.
5.  **Proibido:** Não cite nomes de jornais (G1, Folha) no texto. Os créditos vão no final.
6.  {'**Abertura:** Comece com uma saudação rápida.' if include_intro else 'Comece direto na primeira notícia.'}
7.  {'**Fechamento:** Encerre convidando para a próxima edição.' if include_outro else 'Encerre após a última notícia.'}

Notícias para locução:
---
{articles_text}
---

Gere APENAS o texto final para ser lido.
"""
        return prompt
