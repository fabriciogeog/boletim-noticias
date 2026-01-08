import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional
import httpx

# Tentativa de importar bibliotecas opcionais
try:
    from gtts import gTTS
except ImportError:
    gTTS = None

try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

logger = logging.getLogger(__name__)

class TTSGenerator:
    def __init__(self, output_dir: str = "audio"):
        self.output_dir = Path("/app/audio") 
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Carrega chaves do ambiente
        # Nota: O Frontend salva a chave principal como GROQ_API_KEY.
        # Se o usuário quiser usar OpenAI, a chave sk-... estará nesta variável.
        self.main_api_key = os.getenv("GROQ_API_KEY") 
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")
        
        # Cliente ElevenLabs (apenas valida se tem chave)
        self.elevenlabs_client = True if self.elevenlabs_key else False
        
        # Cliente Google
        self.gTTS_client = True if gTTS else False
        
        # Cliente OpenAI (Inicializa se tiver biblioteca e chave)
        self.openai_client = None
        if AsyncOpenAI and self.main_api_key and self.main_api_key.startswith("sk-"):
            try:
                self.openai_client = AsyncOpenAI(api_key=self.main_api_key)
            except Exception as e:
                logger.warning(f"Erro ao iniciar cliente OpenAI: {e}")

    async def generate(
        self,
        text: str,
        tts_engine: str = "gtts",
        tts_voice_id: str = "21m00Tcm4TlvDq8ikWAM", # Voz padrão ElevenLabs (Rachel)
        tld: Optional[str] = "com.br"
    ) -> str:
        """
        Gera áudio com Fallback Automático: Tenta Premium (Eleven/OpenAI) -> Falha -> Usa gTTS.
        """
        if not text:
            raise ValueError("Texto vazio fornecido")
        
        logger.info(f"Gerando áudio (Motor solicitado: '{tts_engine}')...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"boletim_{timestamp}.mp3"
        output_path = self.output_dir / filename
        
        cleaned_text = self._prepare_text(text)
        temp_path = None
        
        try:
            # --- MOTOR 1: ELEVENLABS ---
            if tts_engine == "elevenlabs":
                if self.elevenlabs_client:
                    try:
                        temp_path = await self._generate_elevenlabs(cleaned_text, output_path, tts_voice_id)
                    except Exception as e_premium:
                        logger.warning(f"⚠️ ElevenLabs falhou: {e_premium}. Ativando Fallback Google.")
                        tts_engine = "gtts" # Força fallback
                else:
                    logger.warning("Chave ElevenLabs não configurada. Usando Google.")
                    tts_engine = "gtts"

            # --- MOTOR 2: OPENAI TTS ---
            elif tts_engine == "openai":
                if self.openai_client:
                    try:
                        temp_path = await self._generate_openai(cleaned_text, output_path)
                    except Exception as e_premium:
                        logger.warning(f"⚠️ OpenAI TTS falhou: {e_premium}. Ativando Fallback Google.")
                        tts_engine = "gtts" # Força fallback
                else:
                    logger.warning("Cliente OpenAI não disponível (Chave inválida ou lib ausente). Usando Google.")
                    tts_engine = "gtts"

            # --- MOTOR 3: GOOGLE TTS (Fallback ou Escolha Direta) ---
            if tts_engine == "gtts":
                if not self.gTTS_client:
                    raise RuntimeError("gTTS não instalado no servidor.")
                temp_path = await self._generate_gtts(cleaned_text, output_path, tld or "com.br")
            
            # --- PÓS-PROCESSAMENTO (Aceleração para gTTS) ---
            # O Google fala devagar, então aceleramos. OpenAI/ElevenLabs já têm ritmo bom.
            if tts_engine == "gtts" and AudioSegment and temp_path:
                try:
                    logger.info("⚡ Acelerando áudio gTTS em 15%...")
                    audio = AudioSegment.from_mp3(str(temp_path))
                    faster_audio = audio.speedup(playback_speed=1.15)
                    faster_audio.export(str(output_path), format="mp3", bitrate="192k")
                    # Limpa temporário
                    if temp_path != output_path and temp_path.exists():
                        temp_path.unlink()
                except Exception as e_speed:
                    logger.warning(f"Falha na aceleração: {e_speed}")
                    if temp_path != output_path:
                        temp_path.rename(output_path)
            
            return str(output_path)

        except Exception as e:
            logger.error(f"✗ Erro fatal em todos os motores: {e}")
            # Último recurso: Salva texto para debug
            text_path = self.output_dir / f"boletim_{timestamp}.txt"
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return str(text_path)

    # --- MÉTODOS PRIVADOS DE CADA MOTOR ---

    async def _generate_elevenlabs(self, text: str, output_path: Path, voice_id: str) -> Path:
        """ Gera usando API da ElevenLabs """
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self.elevenlabs_key,
            "Content-Type": "application/json"
        }
        data = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers, timeout=60.0)
            if response.status_code != 200:
                raise Exception(f"Erro API ElevenLabs: {response.status_code} - {response.text}")
            
            with open(output_path, "wb") as f:
                for chunk in response.iter_bytes():
                    f.write(chunk)
        
        return output_path

    async def _generate_openai(self, text: str, output_path: Path) -> Path:
        """ Gera usando API da OpenAI (Modelo tts-1, Voz Onyx) """
        logger.info("Enviando requisição para OpenAI TTS...")
        
        # Executa a chamada da OpenAI (que é bloqueante) em uma thread separada para não travar o async
        # Nota: Estamos usando o client async nativo, mas a gravação do arquivo streamado requer cuidado
        response = await self.openai_client.audio.speech.create(
            model="tts-1",
            voice="onyx", # Voz masculina jornalística. Opções: alloy, echo, fable, onyx, nova, shimmer
            input=text
        )
        
        # Salva o arquivo
        response.stream_to_file(output_path)
        return output_path

    async def _generate_gtts(self, text: str, output_path: Path, tld: str) -> Path:
        """ Gera usando Google TTS (gTTS) """
        temp_filename = f"temp_{output_path.name}"
        temp_path = output_path.parent / temp_filename
        
        tts = gTTS(text=text, lang='pt', tld=tld)
        tts.save(str(temp_path))
        
        return temp_path

    def _prepare_text(self, text: str) -> str:
        """ Limpeza básica do texto """
        return text.replace("*", "").replace("#", "").strip()
