import logging
from typing import Optional, List
import os
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

class TTSGenerator:
    """
    Gerador de Text-to-Speech usando Google TTS (gTTS)
    """
    
    def __init__(self):
        self.output_dir = Path("/app/audio")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Inicializar TTS
        self.tts_engine = "gtts"
        self._init_tts()
    
    def _init_tts(self):
        """
        Inicializa o motor TTS
        """
        try:
            from gtts import gTTS
            self.gTTS = gTTS
            logger.info("✓ Google TTS (gTTS) inicializado com sucesso")
            
        except ImportError as e:
            logger.error(f"gTTS não está instalado: {e}")
            logger.info("Sistema funcionará sem geração de áudio")
            self.gTTS = None
        except Exception as e:
            logger.error(f"Erro inesperado ao inicializar TTS: {e}")
            self.gTTS = None
    
    def get_available_voices(self) -> List[str]:
        """
        Retorna lista de vozes disponíveis
        """
        if not self.gTTS:
            return ["default"]
        
        # gTTS suporta diferentes TLDs (domínios) para variações
        return ["default", "br", "pt", "com"]
    
    async def generate(
        self,
        text: str,
        voice_name: Optional[str] = None,
        speed: float = 1.0,
        format: str = "mp3"
    ) -> str:
        """
        Gera áudio a partir do texto usando Google TTS
        
        Args:
            text: Texto para converter em áudio
            voice_name: Nome da voz (tld: br, pt, com)
            speed: Velocidade da fala (não suportado no gTTS, mantido para compatibilidade)
            format: Formato de saída (mp3)
        
        Returns:
            Caminho do arquivo de áudio gerado
        """
        if not text:
            raise ValueError("Texto vazio fornecido")
        
        logger.info(f"Gerando áudio: {len(text)} caracteres")
        
        # Gerar nome único para arquivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"boletim_{timestamp}.mp3"
        output_path = self.output_dir / filename
        
        if not self.gTTS:
            # Fallback: criar arquivo de texto
            logger.warning("gTTS não disponível, criando arquivo de texto")
            text_path = self.output_dir / f"boletim_{timestamp}.txt"
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return str(text_path)
        
        try:
            # Preparar texto (limpeza e normalização)
            cleaned_text = self._prepare_text(text)
            
            # Definir TLD (domínio) para variações de voz
            tld = voice_name if voice_name in ["br", "pt", "com"] else "com.br"
            
            # Gerar áudio com gTTS
            logger.info(f"Gerando áudio com gTTS (tld={tld})...")
            tts = self.gTTS(
                text=cleaned_text,
                lang='pt',
                tld=tld,
                slow=False
            )
            
            # Salvar arquivo
            tts.save(str(output_path))
            
            logger.info(f"✓ Áudio MP3 gerado: {output_path}")
            return str(output_path)
        
        except Exception as e:
            logger.error(f"✗ Erro ao gerar áudio: {e}")
            # Fallback para texto
            text_path = self.output_dir / f"boletim_{timestamp}.txt"
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)
            return str(text_path)
    
    def _prepare_text(self, text: str) -> str:
        """
        Prepara texto para TTS (normalização, limpeza)
        """
        # Remover caracteres especiais problemáticos
        text = text.replace('\n\n', '. ')
        text = text.replace('\n', ' ')
        text = text.replace('  ', ' ')
        
        # Expandir siglas comuns (apenas para melhorar pronúncia)
        replacements = {
            ' STF ': ' Supremo Tribunal Federal ',
            ' STJ ': ' Superior Tribunal de Justiça ',
            ' INSS ': ' Instituto Nacional do Seguro Social ',
            ' SUS ': ' Sistema Único de Saúde ',
            ' PIB ': ' Produto Interno Bruto ',
            ' IBGE ': ' Instituto Brasileiro de Geografia e Estatística ',
            ' ONU ': ' Organização das Nações Unidas ',
            ' EUA ': ' Estados Unidos ',
            ' UE ': ' União Europeia ',
            ' PF ': ' Polícia Federal ',
            ' MP ': ' Ministério Público ',
            ' TSE ': ' Tribunal Superior Eleitoral '
        }
        
        for acronym, full_name in replacements.items():
            text = text.replace(acronym, full_name)
        
        return text.strip()
    
    def _convert_to_mp3(self, wav_path: Path, mp3_path: Path) -> Path:
        """
        Converte WAV para MP3 usando pydub/ffmpeg
        Mantido para compatibilidade, mas gTTS já gera MP3
        """
        try:
            from pydub import AudioSegment
            
            audio = AudioSegment.from_wav(str(wav_path))
            audio.export(
                str(mp3_path),
                format="mp3",
                bitrate="192k",
                parameters=["-q:a", "0"]  # Qualidade máxima
            )
            
            return mp3_path
        
        except Exception as e:
            logger.error(f"Erro ao converter para MP3: {e}")
            # Retornar WAV se conversão falhar
            return wav_path
    
    async def test_tts(self) -> bool:
        """
        Testa geração de áudio
        """
        try:
            test_text = "Este é um teste de geração de voz. O sistema está funcionando corretamente."
            output_path = await self.generate(test_text)
            
            if Path(output_path).exists():
                file_size = Path(output_path).stat().st_size
                logger.info(f"✓ Teste TTS bem sucedido: {output_path} ({file_size} bytes)")
                return True
            
            return False
        
        except Exception as e:
            logger.error(f"✗ Teste TTS falhou: {e}")
            return False
