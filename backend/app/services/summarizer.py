import ollama
import logging
from typing import List, Dict
import os

logger = logging.getLogger(__name__)

class NewsSummarizer:
    """
    Sumarizador de notícias usando Ollama (LLM local)
    """
    
    def __init__(self):
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        #self.model = "llama3:8b"  # Modelo padrão
        self.model = "deepseek-v3.1:671b-cloud"
        
    async def summarize(
        self,
        articles: List[Dict],
        style: str = "jornalistico",
        include_intro: bool = True,
        include_outro: bool = True,
        max_words_per_article: int = 50
    ) -> str:
        """
        Sumariza lista de notícias em formato de boletim
        
        Args:
            articles: Lista de dicionários com notícias
            style: Estilo do boletim (jornalistico, conversacional)
            include_intro: Incluir introdução
            include_outro: Incluir encerramento
            max_words_per_article: Máximo de palavras por notícia
        
        Returns:
            Texto sumarizado do boletim
        """
        if not articles:
            return "Nenhuma notícia disponível no momento."
        
        logger.info(f"Sumarizando {len(articles)} artigos com estilo '{style}'")
        
        # Preparar contexto para o LLM
        articles_text = self._format_articles(articles)
        
        # Criar prompt baseado no estilo
        prompt = self._create_prompt(
            articles_text=articles_text,
            style=style,
            include_intro=include_intro,
            include_outro=include_outro,
            num_articles=len(articles)
        )
        
        try:
            # Chamar Ollama
            response = ollama.chat(
                model=self.model,
                messages=[
                    {
                        'role': 'system',
                        'content': self._get_system_prompt(style)
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ]
            )
            
            summary = response['message']['content'].strip()
            logger.info(f"Boletim gerado com sucesso ({len(summary)} caracteres)")
            
            return summary
        
        except Exception as e:
            logger.error(f"Erro ao sumarizar com Ollama: {e}")
            # Fallback: retornar formatação simples
            return self._create_simple_summary(articles, include_intro, include_outro)
    
    def _format_articles(self, articles: List[Dict]) -> str:
        """
        Formata artigos para contexto do LLM
        """
        formatted = []
        
        for i, article in enumerate(articles, 1):
            title = article.get('title', 'Sem título')
            summary = article.get('summary', '')
            source = article.get('source', 'fonte desconhecida')
            category = article.get('category', 'geral')
            
            formatted.append(f"""
Notícia {i}:
Título: {title}
Resumo: {summary}
Fonte: {source}
Categoria: {category}
---""")
        
        return "\n".join(formatted)
    
    def _get_system_prompt(self, style: str) -> str:
        """
        Prompt de sistema baseado no estilo
        """
        base = """Você é um assistente especializado em criar boletins de notícias para rádio.
Seu objetivo é transformar notícias em um texto fluido, natural e adequado para locução.
"""
        
        if style == "jornalistico":
            return base + """
Características do seu texto:
- Tom formal e profissional
- Linguagem clara e objetiva
- Transições suaves entre notícias
- Sem expressões coloquiais
- Foco nos fatos principais
"""
        else:  # conversacional
            return base + """
Características do seu texto:
- Tom amigável e acessível
- Linguagem natural e fluida
- Pode usar expressões cotidianas
- Mais próximo do ouvinte
- Mantém profissionalismo sem ser formal demais
"""
    
    def _create_prompt(
        self,
        articles_text: str,
        style: str,
        include_intro: bool,
        include_outro: bool,
        num_articles: int
    ) -> str:
        """
        Cria prompt para o LLM
        """
        prompt = f"""Com base nas {num_articles} notícias abaixo, crie um boletim de notícias para rádio.

{articles_text}

Instruções:
1. {"Comece com uma saudação e introdução adequada" if include_intro else "Comece direto com as notícias"}
2. Apresente cada notícia de forma resumida mas informativa (2-3 frases por notícia)
3. Use transições naturais entre as notícias
4. Mantenha o texto fluido e adequado para locução
5. {"Finalize com um encerramento apropriado" if include_outro else "Termine após a última notícia"}
6. NÃO use marcadores, bullets ou numeração
7. Escreva em parágrafos corridos
8. Tom: {style}

Gere APENAS o texto do boletim, sem comentários adicionais."""
        
        return prompt
    
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
        
        if include_intro:
            now = datetime.now()
            periodo = "Bom dia" if now.hour < 12 else "Boa tarde" if now.hour < 18 else "Boa noite"
            lines.append(f"{periodo}! Estas são as principais notícias de hoje.\n")
        
        for article in articles:
            title = article.get('title', '')
            summary = article.get('summary', '')
            
            if summary:
                lines.append(f"{title}. {summary}\n")
            else:
                lines.append(f"{title}.\n")
        
        if include_outro:
            lines.append("\nEssas foram as principais notícias. Até a próxima!")
        
        return "\n".join(lines)
    
    async def test_ollama_connection(self) -> bool:
        """
        Testa conexão com Ollama
        """
        try:
            response = ollama.list()
            logger.info(f"✓ Ollama conectado. Modelos disponíveis: {[m['name'] for m in response['models']]}")
            return True
        except Exception as e:
            logger.error(f"✗ Erro ao conectar com Ollama: {e}")
            return False
    
    async def pull_model(self, model_name: str = None) -> bool:
        """
        Baixa modelo do Ollama se não estiver disponível
        """
        model = model_name or self.model
        try:
            logger.info(f"Baixando modelo {model}...")
            ollama.pull(model)
            logger.info(f"✓ Modelo {model} baixado com sucesso")
            return True
        except Exception as e:
            logger.error(f"✗ Erro ao baixar modelo: {e}")
            return False
