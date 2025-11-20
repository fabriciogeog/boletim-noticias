import logging
from typing import Optional, List
import os
from datetime import datetime
from pathlib import Path
import asyncio
import functools 

# Imports dos motores TTS
try:
    from gtts import gTTS
except ImportError:
    gTTS = None

try:
    from elevenlabs import Voice, VoiceSettings
    from elevenlabs.client import ElevenLabs
except ImportError:
    ElevenLabs = None

# Imports de áudio
try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None


logger = logging.getLogger(__name__)

class TTSGenerator:
    """
    Roteador de TTS Híbrido: gTTS (fallback) ou ElevenLabs (premium).
    """
    
    def __init__(self):
        self.output_dir = Path("/app/audio")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        
        if self.elevenlabs_api_key and ElevenLabs:
            try:
                self.elevenlabs_client = ElevenLabs(api_key=self.elevenlabs_api_key)
                logger.info("✓ Cliente ElevenLabs (Nuvem) inicializado.")
            except Exception as e:
                logger.error(f"✗ Falha ao inicializar ElevenLabs (verifique a API Key): {e}")
                self.elevenlabs_client = None
        else:
            self.elevenlabs_client = None
        
        if gTTS:
            self.gTTS_client = gTTS
            logger.info("✓ Cliente Google TTS (gTTS) pronto.")
        else:
            logger.error("gTTS não está instalado. Geração de áudio falhará se o ElevenLabs não estiver configurado.")
            self.gTTS_client = None

    
    async def generate(
        self,
        text: str,
        tts_engine: str = "gtts",
        # ================================================================
        # CORREÇÃO 4: Usando o ID da Voz "Clyde" (como você sugeriu)
        # ================================================================
        tts_voice_id: str = "21m00Tcm4TlvDq8ikWAM",
        tld: Optional[str] = "com.br"
    ) -> str:
        """
        Gera áudio a partir do texto usando o motor selecionado.
        """
        if not text:
            raise ValueError("Texto vazio fornecido")
        
        logger.info(f"Gerando áudio com motor '{tts_engine}': {len(text)} caracteres")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"boletim_{timestamp}.mp3"
        output_path = self.output_dir / filename
        
        try:
            cleaned_text = self._prepare_text(text)
            
            # --- Roteador do Motor TTS ---
            if tts_engine == "elevenlabs" and self.elevenlabs_client:
                temp_path = await self._generate_elevenlabs(cleaned_text, output_path, tts_voice_id)
            elif tts_engine == "gtts" and self.gTTS_client:
                temp_path = await self._generate_gtts(cleaned_text, output_path, tld or "com.br")
            else:
                logger.warning(f"Motor '{tts_engine}' não disponível. Revertendo para gTTS.")
                if not self.gTTS_client:
                    raise RuntimeError("Nenhum motor TTS disponível (gTTS falhou ao carregar)")
                temp_path = await self._generate_gtts(cleaned_text, output_path, tld or "com.br")
            
            # --- Pós-processamento (Aceleração - apenas para gTTS) ---
            if tts_engine == "gtts" and AudioSegment:
                try:
                    logger.info("Aplicando aceleração de 15% (1.15x) no áudio gTTS...")
                    audio = AudioSegment.from_mp3(str(temp_path))
                    faster_audio = audio.speedup(playback_speed=1.15)
                    faster_audio.export(str(output_path), format="mp3", bitrate="192k")
                    temp_path.unlink()
                except Exception as e:
                    logger.warning(f"Não foi possível acelerar áudio: {e}. Usando arquivo original.")
                    temp_path.rename(output_path)
            elif temp_path != output_path:
                 temp_path.rename(output_path) # Se for ElevenLabs, só renomeia

            return str(output_path)

        except Exception as e:
            logger.error(f"✗ Erro fatal ao gerar áudio: {e}")
            text_path = self.output_dir / f"boletim_{timestamp}.txt"
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return str(text_path)

    async def _generate_gtts(self, text: str, final_path: Path, tld: str) -> Path:
        """ Lógica de geração do gTTS (online) """
        logger.info(f"Gerando áudio com gTTS (tld={tld})...")
        tts = self.gTTS_client(
            text=text, lang='pt', tld=tld, slow=False, lang_check=False
        )
        
        temp_path = final_path.with_suffix(".temp.mp3")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, tts.save, str(temp_path))
        
        logger.info("Áudio gTTS intermediário salvo.")
        return temp_path

    async def _generate_elevenlabs(self, text: str, final_path: Path, voice_id: str) -> Path:
        """ Lógica de geração do ElevenLabs (Nuvem Premium) """
        logger.info(f"Gerando áudio com ElevenLabs (Voz: {voice_id})...")
        
        generate_func = functools.partial(
            self.elevenlabs_client.generate,
            text=text,
            voice=Voice(
                voice_id=voice_id,
                settings=VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.1, use_speaker_boost=True)
            ),
            model="eleven_multilingual_v2"
        )
        
        loop = asyncio.get_event_loop()
        
        # ================================================================
        # CORREÇÃO 5: Consumindo o 'generator' para obter 'bytes'
        # ================================================================
        def generate_and_save():
            # 1. Chame a função que retorna o gerador
            audio_generator = generate_func()
            
            # 2. Consuma o gerador e junte os pedaços (chunks) de áudio
            audio_bytes = b"".join([chunk for chunk in audio_generator])
            
            # 3. Salva os bytes completos do áudio no disco
            with open(final_path, "wb") as f:
                f.write(audio_bytes)
        
        await loop.run_in_executor(
            None,
            generate_and_save 
        )
        
        if not final_path.exists():
            raise RuntimeError("ElevenLabs falhou em criar o arquivo de áudio")
            
        logger.info(f"✓ Áudio ElevenLabs salvo em: {final_path}")
        return final_path
    
    def _prepare_text(self, text: str) -> str:
        """ Prepara texto para TTS (normalização, limpeza) """
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
