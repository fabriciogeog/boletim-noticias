import logging
from typing import Optional, List
import os
from datetime import datetime
from pathlib import Path
import asyncio  # Importar asyncio para rodar Coqui em thread

# Imports dos motores TTS
try:
    from gtts import gTTS
except ImportError:
    gTTS = None

try:
    from TTS.api import TTS
except ImportError:
    TTS = None

# Imports de áudio
try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None


logger = logging.getLogger(__name__)

class TTSGenerator:
    """
    Gerador de Text-to-Speech flexível.
    Seleciona o motor (Coqui ou gTTS) baseado na variável de ambiente TTS_ENGINE.
    """
    
    def __init__(self):
        self.output_dir = Path("/app/audio")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.tts_engine_name = os.getenv("TTS_ENGINE", "gtts").lower()
        self.tts_model = None
        self.gTTS_client = None
        
        self._init_tts()
    
    def _init_tts(self):
        """
        Inicializa o motor TTS selecionado.
        """
        if self.tts_engine_name == "coqui":
            if TTS:
                try:
                    model_name = "tts_models/multilingual/multi-dataset/your_tts"
                    logger.info(f"Inicializando Coqui TTS (motor local) com modelo: {model_name}...")
                    self.tts_model = TTS(model_name=model_name, progress_bar=True)
                    logger.info("✓ Coqui TTS (local) inicializado com sucesso")
                except Exception as e:
                    logger.error(f"✗ Falha ao inicializar Coqui TTS: {e}")
                    logger.warning("Alternando para gTTS como fallback.")
                    self._init_gtts() # Tenta gTTS se Coqui falhar
            else:
                logger.error("Biblioteca 'TTS' (Coqui) não instalada.")
                logger.warning("Alternando para gTTS como fallback.")
                self._init_gtts()
                
        elif self.tts_engine_name == "gtts":
            self._init_gtts()
            
        else:
            logger.error(f"Motor TTS desconhecido: '{self.tts_engine_name}'. Usando gTTS.")
            self._init_gtts()

    def _init_gtts(self):
        """Inicializa o gTTS como motor principal ou fallback."""
        self.tts_engine_name = "gtts"
        if gTTS:
            self.gTTS_client = gTTS
            logger.info("✓ Google TTS (gTTS - online) inicializado com sucesso")
        else:
            logger.error("gTTS não está instalado. Sistema funcionará sem geração de áudio.")

    def get_available_voices(self) -> List[str]:
        """ Retorna lista de vozes (placeholder) """
        if self.tts_engine_name == "coqui":
            return ["default (coqui-your_tts)"]
        else:
            return ["default (gtts-br)", "pt", "com"]
    
    async def generate(
        self,
        text: str,
        voice_name: Optional[str] = None,
        speed: float = 1.0
    ) -> str:
        """
        Gera áudio a partir do texto usando o motor selecionado.
        """
        if not text:
            raise ValueError("Texto vazio fornecido")
        
        logger.info(f"Gerando áudio com motor '{self.tts_engine_name}': {len(text)} caracteres")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"boletim_{timestamp}.mp3"
        output_path = self.output_dir / filename
        
        try:
            cleaned_text = self._prepare_text(text)
            
            if self.tts_engine_name == "coqui" and self.tts_model:
                temp_path = await self._generate_coqui(cleaned_text, output_path)
            elif self.tts_engine_name == "gtts" and self.gTTS_client:
                temp_path = await self._generate_gtts(cleaned_text, output_path)
            else:
                logger.error("Nenhum motor TTS está disponível.")
                raise RuntimeError("Nenhum motor TTS disponível")
            
            if AudioSegment:
                try:
                    logger.info("Aplicando aceleração de 10% (1.1x) no áudio...")
                    audio = AudioSegment.from_mp3(str(temp_path))
                    speed_factor = 1.15 if self.tts_engine_name == "gtts" else 1.1
                    
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

    async def _generate_gtts(self, text: str, final_path: Path) -> Path:
        """ Lógica de geração do gTTS (online) """
        logger.info("Gerando áudio com gTTS (tld=com.br, velocidade normal)...")
        tts = self.gTTS_client(
            text=text,
            lang='pt',
            tld='com.br',
            slow=False,
            lang_check=False
        )
        
        temp_path = final_path.with_suffix(".temp.mp3")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, tts.save, str(temp_path))
        
        logger.info("Áudio gTTS intermediário salvo.")
        return temp_path

    async def _generate_coqui(self, text: str, final_path: Path) -> Path:
        """ Lógica de geração do Coqui TTS (local) """
        logger.info("Gerando áudio com Coqui TTS (local)...")
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self.tts_model.tts_to_file,
            text,
            None,  # speaker
            'pt-br',  # <-- ESTA É A CORREÇÃO: 'pt' -> 'pt-br'
            str(final_path)
        )
        
        if not final_path.exists():
            logger.error("✗ Falha crítica: Coqui TTS (tts_to_file) não criou o arquivo de áudio.")
            raise RuntimeError("Coqui TTS falhou em criar o arquivo")
        
        logger.info(f"✓ Áudio Coqui TTS salvo em: {final_path}")
        return final_path
    
    def _prepare_text(self, text: str) -> str:
        """
NORMALIZAÇÃO DE TEXTO (Mantida)
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
