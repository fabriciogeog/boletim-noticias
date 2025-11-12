import logging
from typing import Optional, List
import os
from datetime import datetime
from pathlib import Path
import asyncio

# Imports dos motores TTS
try:
    from gtts import gTTS
except ImportError:
    gTTS = None

# Imports de áudio
try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None


logger = logging.getLogger(__name__)

class TTSGenerator:
    """
    Gerador de Text-to-Speech (Modo Leve).
    Usa gTTS (online) como padrão.
    """
    
    def __init__(self):
        self.output_dir = Path("/app/audio")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Lemos o motor padrão do .env
        self.default_tts_engine = os.getenv("TTS_ENGINE", "gtts").lower()
        self.gTTS_client = None
        
        if self.default_tts_engine == "gtts" and gTTS:
            self.gTTS_client = gTTS
            logger.info("✓ Cliente Google TTS (gTTS) pronto.")
        else:
            logger.error("gTTS não está instalado ou não foi selecionado. Geração de áudio falhará.")

    
    def get_available_voices(self) -> List[str]:
        # Esta função agora é um placeholder
        return ["default (gtts-br)", "pt", "com"]
    
    async def generate(
        self,
        text: str,
        # ================================================================
        # ESTA É A CORREÇÃO:
        # A função agora aceita o argumento 'tld' (sotaque)
        # ================================================================
        tld: str = "com.br",
        voice_name: Optional[str] = None # voice_name é mantido, mas 'tld' é priorizado
    ) -> str:
        """
        Gera áudio a partir do texto usando o motor selecionado.
        """
        if not text:
            raise ValueError("Texto vazio fornecido")
        
        # Decide qual motor usar. Padrão é 'gtts'
        engine_to_use = self.default_tts_engine
        
        logger.info(f"Gerando áudio com motor '{engine_to_use}': {len(text)} caracteres")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"boletim_{timestamp}.mp3"
        output_path = self.output_dir / filename
        
        try:
            cleaned_text = self._prepare_text(text)
            
            # --- Roteador do Motor TTS ---
            if engine_to_use == "gtts" and self.gTTS_client:
                # Passamos o TLD (sotaque) para a função
                temp_path = await self._generate_gtts(cleaned_text, output_path, tld)
            else:
                logger.error(f"Nenhum motor TTS funcional foi encontrado ('{engine_to_use}').")
                raise RuntimeError("Nenhum motor TTS disponível")
            
            # --- Pós-processamento (Aceleração) ---
            if AudioSegment:
                try:
                    logger.info("Aplicando aceleração de 10% (1.1x) no áudio...")
                    audio = AudioSegment.from_mp3(str(temp_path))
                    speed_factor = 1.15 # Padrão gTTS
                    
                    faster_audio = audio.speedup(playback_speed=speed_factor)
                    faster_audio.export(str(output_path), format="mp3", bitrate="192k")
                    
                    if temp_path != output_path:
                        temp_path.unlink()
                    
                    logger.info(f"✓ Áudio acelerado salvo em: {output_path}")
                except Exception as e:
                    logger.warning(f"Não foi possível acelerar áudio: {e}. Usando arquivo original.")
                    if temp_path != output_path:
                        temp_path.rename(output_path)
            else:
                 if temp_path != output_path:
                    temp_path.rename(output_path)

            return str(output_path)

        except Exception as e:
            logger.error(f"✗ Erro fatal ao gerar áudio: {e}")
            text_path = self.output_dir / f"boletim_{timestamp}.txt"
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return str(text_path)

    async def _generate_gtts(self, text: str, final_path: Path, tld: str) -> Path:
        """ Lógica de geração do gTTS (online) """
        
        logger.info(f"Gerando áudio com gTTS (tld={tld}, velocidade normal)...")
        tts = self.gTTS_client(
            text=text,
            lang='pt',
            tld=tld, # <-- Usa o sotaque escolhido
            slow=False,
            lang_check=False
        )
        
        temp_path = final_path.with_suffix(".temp.mp3")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, tts.save, str(temp_path))
        
        logger.info("Áudio gTTS intermediário salvo.")
        return temp_path
    
    def _prepare_text(self, text: str) -> str:
        """
        Prepara texto para TTS (normalização, limpeza)
        """
        text = text.replace('\n\n', '. ')
        text = text.replace('\n', ' ')
        text = text.replace('  ', ' ')
        
        replacements = {
            ' STF ': ' Supremo Tribunal Federal ', ' STJ ': ' Superior Tribunal de Justiça ',
            ' INSS ': ' Instituto Nacional do Seguro Social ', ' SUS ': ' Sistema Único de Saúde ',
            ' PIB ': ' Produto Interno Bruto ', ' IBGE ': ' Instituto Brasileiro de Geografia e Estatística ',
            ' ONU ': ' Organização das Nações Unidas ', ' EUA ': ' Estados Unidos ',
            ' UE ': ' União Europeia ', ' PF ': ' Polícia Federal ',
            ' MP ': ' Ministério Público ', ' TSE ': ' Tribunal Superior Eleitoral '
        }
        
        for acronym, full_name in replacements.items():
            text = text.replace(acronym, full_name)
        
        return text.strip()
