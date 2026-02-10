import os
import logging
from typing import List, Dict
from groq import Groq

logger = logging.getLogger(__name__)

class NewsSummarizer:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = Groq(api_key=self.api_key) if self.api_key else None
        self.model = "llama-3.3-70b-versatile"

    async def summarize(
        self, 
        articles: List[Dict], 
        style: str = "jornalistico",
        include_intro: bool = True,
        include_outro: bool = True,
        summary_mode: str = "groq"
    ) -> str:
        if not articles or not isinstance(articles, list):
            return "Nenhuma notícia válida para resumir."

        # --- EXTRAÇÃO DE FONTES "RAIO-X" ---
        nomes_fontes = []
        for art in articles:
            if not isinstance(art, dict): continue
            
            fonte = art.get('source', {})
            nome = None
            
            if isinstance(fonte, dict):
                nome = fonte.get('name') or fonte.get('title')
            elif isinstance(fonte, str):
                nome = fonte
                
            if not nome and art.get('url'):
                url = art.get('url').lower()
                if 'g1' in url: nome = 'G1'
                elif 'uol' in url: nome = 'UOL'
                elif 'estadao' in url: nome = 'Estadão'
                elif 'folha' in url: nome = 'Folha de S.Paulo'
                elif 'cnn' in url: nome = 'CNN Brasil'
                elif 'terra' in url: nome = 'Portal Terra'
            
            if nome:
                nomes_fontes.append(nome.strip())

        fontes_unicas = sorted(list(set(nomes_fontes)))
        lista_fontes_str = ", ".join(fontes_unicas) if fontes_unicas else "G1, UOL e agências de notícias"

        # --- PREPARAÇÃO DO CONTEÚDO ---
        contexto = ""
        for i, art in enumerate(articles, 1):
            if isinstance(art, dict):
                titulo = art.get('title', 'Notícia sem título')
                desc = art.get('description', 'Sem detalhes adicionais.')
                contexto += f"NOTÍCIA {i}: {titulo}. DETALHES: {desc}\n\n"

        # --- PROMPT ---
        system_instruction = (
            "Você é um redator sênior de rádio. Estilo formal e direto. "
            "Siga rigorosamente estas regras:\n"
            "1. FORMATO: Manchete impactante seguida de um resumo explicativo de 2 frases.\n"
            "2. CORTE SECO: Sem conectivos entre as notícias.\n"
            "3. FONTES: Você DEVE usar APENAS a lista de fontes fornecida. PROIBIDO dizer 'Fontes Diversas'.\n"
            "4. ENCERRAMENTO: Use exatamente a frase: 'Este boletim teve informações de: [LISTA]'."
        )

        user_prompt = f"""
        Escreva o boletim com base nestas notícias:
        {contexto}

        LISTA DE FONTES OBRIGATÓRIA: {lista_fontes_str}

        ESTRUTURA:
        {'1. Introdução breve.' if include_intro else ''}
        2. Notícias com manchete e resumo (Corte Seco).
        {'3. Encerramento citando a LISTA DE FONTES OBRIGATÓRIA.' if include_outro else ''}
        """

        try:
            if summary_mode == "groq" and self.client:
                logger.info(f"Sumarizando com fontes: {lista_fontes_str}")
                # CORREÇÃO: .chat.completions.create em vez de .chat.create
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.3
                )
                return completion.choices[0].message.content
            
            return self._simple_format(articles, include_intro, include_outro, lista_fontes_str)

        except Exception as e:
            logger.error(f"Erro na IA: {e}")
            # Em caso de erro, retorna o formato simples em vez de uma mensagem de erro crua
            return self._simple_format(articles, include_intro, include_outro, lista_fontes_str)

    def _simple_format(self, articles, intro, outro, fontes_str):
        """Fallback formatado para quando a IA falha"""
        texto = "Boletim de notícias (Modo de Segurança).\n\n" if intro else ""
        for art in articles:
            if isinstance(art, dict):
                texto += f"{art.get('title', 'Notícia')}. {art.get('description', '')}\n\n"
        if outro:
            texto += f"Este boletim teve informações de: {fontes_str}."
        return texto