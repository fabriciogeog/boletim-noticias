📻 Sistema de Boletim de Notícias
Sistema automatizado para geração de boletins de notícias, desenvolvido com foco em acessibilidade e autonomia para locutores de rádio que utilizam leitores de tela.

O sistema agora permite o uso híbrido, funcionando tanto em notebooks quanto em smartphones via rede local (intranet), com interface otimizada para gestos de toque.

🎯 Características Principais
✅ Coleta Inteligente: Notícias em tempo real via GNews.io.

🎙️ Processamento via IA: Sumarização profissional utilizando Groq.

🔊 Narração Versátil: Suporte para gTTS (Google) e vozes premium da ElevenLabs.

📱 Mobile-Friendly: Design responsivo com botões grandes e áreas de toque otimizadas para TalkBack e VoiceOver.

♿ Acessibilidade Plena: Navegação por teclado, atalhos dedicados e compatibilidade total com NVDA.

🐋 Arquitetura Docker: Execução simplificada em Ubuntu 24.04 e Windows.

📋 Requisitos e APIs
Software
Docker e Docker Compose.

Navegador: Chrome ou Safari (recomendados para mobile).

🔑 Chaves de API (Configurar no arquivo .env)
Este projeto utiliza três motores principais:

GNews.io: Coleta de notícias.

Groq: Sumarização das notícias via IA.

ElevenLabs (Opcional): Para narração de alta fidelidade.

🚀 Instalação e Execução
1. Preparação
2. Inicialização
Para subir o sistema no host (Ubuntu ou Windows):

🌐 Configuração de Rede Local (Mobile)
Para que um colega acesse o sistema pelo smartphone na mesma rede Wi-Fi:

No Host: Descubra o IP da máquina (ex: 192.168.1.15).

No Código: No arquivo frontend/src/js/app.js, altere a variável API_BASE_URL para o IP do host (ex: http://192.168.1.15:8000).

No Celular: Acesse no navegador http://IP-DO-HOST:3000.

Dica: Adicione o site à "Tela de Início" do celular para usá-lo como um aplicativo nativo.

📂 Scripts de Manutenção
O projeto inclui scripts automatizados para facilitar a gestão:

./sync_git.sh: Sincroniza as alterações de código com o GitHub.

./migrar_dados.sh exportar: Cria um backup completo (.tar.gz) dos áudios, banco de dados e configurações para migração.

./migrar_dados.sh importar: Restaura o sistema a partir de um arquivo de backup em um novo host.

♿ Acessibilidade e Atalhos
O sistema responde aos seguintes comandos de teclado no navegador:

Espaço ou K: Inicia ou pausa a reprodução do áudio.

J / L: Retrocede ou avança 5 segundos no áudio.

ESC: Fecha menus de configuração e sobreposições.

Botão Copiar: Implementado com fallback para funcionar em dispositivos móveis via rede local sem HTTPS.

Desenvolvido para promover a inclusão digital e a autonomia profissional de locutores cegos.
