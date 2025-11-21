// ========================================
// CONFIGURAÇÕES E ESTADO
// ========================================
const API_BASE_URL = 'http://localhost:8000';

const appState = {
    selectedCategories: ['geral'],
    currentBoletim: null,
    audioPlayer: null,
    isPlaying: false,
    config: {
        ai_summary_mode: 'groq',
        tts_engine: 'gtts',
        style: 'jornalistico'
    }
};

// ========================================
// ELEMENTOS DO DOM
// ========================================
const elements = {
    // Navegação
    configBtn: document.getElementById('configBtn'),
    sidebar: document.getElementById('sidebar'),
    closeSidebar: document.getElementById('closeSidebar'),
    overlay: document.getElementById('overlay'),
    
    // News Area
    newsArea: document.getElementById('newsArea'),
    placeholder: document.getElementById('placeholder'),
    newsText: document.getElementById('newsText'),
    
    // Player
    playerSection: document.getElementById('playerSection'),
    audioPlayer: document.getElementById('audioPlayer'),
    playBtn: document.getElementById('playBtn'),
    progressFill: document.getElementById('progressFill'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    volumeBtn: document.getElementById('volumeBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    
    // Categories
    categoryBtns: document.querySelectorAll('.category-btn'),
    
    // Generate
    generateBtn: document.getElementById('generateBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    
    // Ticker
    tickerContent: document.getElementById('tickerContent'),
    
    // Config Inputs (para controle de foco)
    summaryMode: document.getElementById('summaryMode'),
    groqKey: document.getElementById('groqKey'),
    ttsEngine: document.getElementById('ttsEngine'),
    elevenLabsKey: document.getElementById('elevenLabsKey'),
    gnewsKey: document.getElementById('gnewsKey'),
    articlesPerCategory: document.getElementById('articlesPerCategory'),
    boletimStyle: document.getElementById('boletimStyle'),
    saveConfigBtn: document.getElementById('saveConfigBtn')
};

// ========================================
// INICIALIZAÇÃO
// ========================================
async function init() {
    console.log('🎙️ Sistema ON AIR inicializando...');
    
    setupEventListeners();
    setupKeyboardShortcuts(); // NOVO: Atalhos de teclado
    await loadConfig();
    startTicker();
    
    console.log('✅ Sistema ON AIR pronto!');
}

// ========================================
// EVENT LISTENERS E ATALHOS
// ========================================
function setupEventListeners() {
    // Sidebar
    elements.configBtn.addEventListener('click', openSidebar);
    elements.closeSidebar.addEventListener('click', closeSidebar);
    elements.overlay.addEventListener('click', closeSidebar);
    
    // Categories
    elements.categoryBtns.forEach(btn => {
        btn.addEventListener('click', toggleCategory);
    });
    
    // Generate
    elements.generateBtn.addEventListener('click', generateBoletim);
    
    // Player Mouse Events
    elements.playBtn.addEventListener('click', togglePlay);
    elements.downloadBtn.addEventListener('click', downloadAudio);
    elements.volumeBtn.addEventListener('click', toggleMute);
    
    // Audio events nativos
    elements.audioPlayer.addEventListener('loadedmetadata', updateDuration);
    elements.audioPlayer.addEventListener('timeupdate', updateProgress);
    elements.audioPlayer.addEventListener('ended', onAudioEnded);
    
    // Barra de progresso (clique)
    document.querySelector('.progress-bar').addEventListener('click', seekAudioMouse);
    
    // Config
    elements.saveConfigBtn.addEventListener('click', saveConfig);
}

// NOVO: Controle total por teclado (Essencial para acessibilidade)
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Se estiver digitando em um input, não ativa atalhos de mídia
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            if (e.key === 'Escape') closeSidebar(); // ESC fecha sidebar mesmo no input
            return;
        }

        switch (e.code) {
            case 'Space':
            case 'KeyK': // Padrão YouTube
                e.preventDefault(); // Evita scroll da página
                if (!elements.playerSection.hidden) togglePlay();
                break;
            
            case 'ArrowLeft': // Voltar 5s
            case 'KeyJ':
                if (!elements.playerSection.hidden) skipAudio(-5);
                break;
                
            case 'ArrowRight': // Avançar 5s
            case 'KeyL':
                if (!elements.playerSection.hidden) skipAudio(5);
                break;
                
            case 'Escape':
                closeSidebar();
                break;
        }
    });
}

// ========================================
// SIDEBAR (Com gestão de Foco)
// ========================================
function openSidebar() {
    elements.sidebar.classList.add('active');
    elements.overlay.removeAttribute('hidden');
    elements.configBtn.setAttribute('aria-expanded', 'true');
    
    // ACESSIBILIDADE: Mover foco para o primeiro campo
    setTimeout(() => elements.summaryMode.focus(), 300);
}

function closeSidebar() {
    elements.sidebar.classList.remove('active');
    elements.overlay.setAttribute('hidden', '');
    elements.configBtn.setAttribute('aria-expanded', 'false');
    
    // ACESSIBILIDADE: Devolver foco ao botão de abrir
    elements.configBtn.focus();
}

// ========================================
// CATEGORIES
// ========================================
function toggleCategory(e) {
    const btn = e.currentTarget;
    const category = btn.dataset.category;
    
    btn.classList.toggle('active');
    
    // Atualiza aria-pressed para leitores de tela
    const isActive = btn.classList.contains('active');
    btn.setAttribute('aria-pressed', isActive);
    
    if (isActive) {
        if (!appState.selectedCategories.includes(category)) {
            appState.selectedCategories.push(category);
        }
    } else {
        appState.selectedCategories = appState.selectedCategories.filter(c => c !== category);
    }
    
    // Garantir ao menos uma categoria
    if (appState.selectedCategories.length === 0) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        appState.selectedCategories.push(category);
    }
}

// ========================================
// GERAR BOLETIM
// ========================================
async function generateBoletim() {
    console.log('🎤 Gerando boletim...');
    
    elements.loadingOverlay.removeAttribute('hidden');
    elements.generateBtn.disabled = true;
    elements.newsText.setAttribute('hidden', '');

    // CÁLCULO INTELIGENTE:
    // Pega o número do input (ex: 3)
    const perCategory = parseInt(elements.articlesPerCategory.value) || 3;
    // Conta quantas categorias estão ativas (ex: 4)
    const numCategories = appState.selectedCategories.length;
    // Define o total para enviar ao backend (ex: 12)
    // Adicionamos +1 de margem de segurança para garantir arredondamentos
    const totalLimit = (perCategory * numCategories);

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-boletim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topics: appState.selectedCategories,
                style: appState.config.style,
                // AQUI ESTÁ O TRUQUE: Enviamos o total calculado
                num_articles: totalLimit, 
                include_intro: true,
                include_outro: true
            })
        });
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const data = await response.json();
        appState.currentBoletim = data;
        displayBoletim(data);
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showError('Erro ao gerar boletim. Verifique as chaves de API.');
    } finally {
        elements.loadingOverlay.setAttribute('hidden', '');
        elements.generateBtn.disabled = false;
    }
}

// ========================================
// EXIBIR BOLETIM
// ========================================
function displayBoletim(data) {
    elements.placeholder.setAttribute('hidden', '');
    elements.newsText.textContent = data.summary_text;
    elements.newsText.removeAttribute('hidden');
    
    // TRUQUE: Timestamp para evitar cache do navegador (browser caching)
    // Se o backend sempre retorna "boletim.mp3", o navegador não atualiza sem isso.
    if (data.audio_filename && data.audio_filename.endsWith('.mp3')) {
        const timestamp = new Date().getTime();
        const audioUrl = `${API_BASE_URL}/audio/${data.audio_filename}?t=${timestamp}`;
        
        elements.audioPlayer.src = audioUrl;
        elements.audioPlayer.load(); // Força recarregamento dos metadados
        elements.playerSection.removeAttribute('hidden');
        
        // ACESSIBILIDADE: Mover foco para o botão PLAY
        // Isso avisa ao deficiente visual que o áudio está pronto
        setTimeout(() => {
            elements.playBtn.focus();
            showSuccessToast("Boletim pronto para tocar!");
        }, 500);
        
    } else {
        elements.playerSection.setAttribute('hidden', '');
        // Se não tem áudio, foca no texto
        elements.newsText.tabIndex = 0;
        elements.newsText.focus();
    }
}

// ========================================
// LÓGICA DO PLAYER
// ========================================
function togglePlay() {
    if (elements.audioPlayer.paused) {
        elements.audioPlayer.play();
        updatePlayButton(true);
    } else {
        elements.audioPlayer.pause();
        updatePlayButton(false);
    }
}

function updatePlayButton(isPlaying) {
    appState.isPlaying = isPlaying;
    elements.playBtn.textContent = isPlaying ? '⏸️' : '▶️';
    elements.playBtn.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Tocar');
}

// Função auxiliar para pular tempo (setas do teclado)
function skipAudio(seconds) {
    const newTime = elements.audioPlayer.currentTime + seconds;
    elements.audioPlayer.currentTime = Math.max(0, Math.min(newTime, elements.audioPlayer.duration));
}

// Seek via mouse
function seekAudioMouse(e) {
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    elements.audioPlayer.currentTime = percent * elements.audioPlayer.duration;
}

function updateDuration() {
    const duration = elements.audioPlayer.duration;
    elements.duration.textContent = formatTime(duration);
}

function updateProgress() {
    const current = elements.audioPlayer.currentTime;
    const duration = elements.audioPlayer.duration || 1; // Evita divisão por zero
    const percent = (current / duration) * 100;
    
    elements.progressFill.style.width = `${percent}%`;
    elements.currentTime.textContent = formatTime(current);
}

function onAudioEnded() {
    updatePlayButton(false);
    elements.progressFill.style.width = '0%';
}

function toggleMute() {
    elements.audioPlayer.muted = !elements.audioPlayer.muted;
    const isMuted = elements.audioPlayer.muted;
    elements.volumeBtn.textContent = isMuted ? '🔇' : '🔊';
    elements.volumeBtn.setAttribute('aria-label', isMuted ? 'Ativar som' : 'Mudo');
}

function downloadAudio() {
    if (!appState.currentBoletim?.audio_filename) return;
    
    const audioUrl = elements.audioPlayer.src; // Pega a URL já com timestamp
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `boletim_${new Date().toISOString().slice(0,10)}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ========================================
// CONFIGURAÇÕES E API
// ========================================
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        if (!response.ok) throw new Error('Falha no carregamento');
        
        const config = await response.json();
        
        // Atualiza inputs
        if (elements.summaryMode) elements.summaryMode.value = config.AI_SUMMARY_MODE || 'groq';
        if (elements.ttsEngine) elements.ttsEngine.value = config.TTS_ENGINE || 'gtts';
        
        // Placeholders de segurança
        if (config.GROQ_API_KEY) elements.groqKey.placeholder = '•••• (Chave Salva)';
        if (config.ELEVENLABS_API_KEY) elements.elevenLabsKey.placeholder = '•••• (Chave Salva)';
        if (config.GNEWS_API_KEY) elements.gnewsKey.placeholder = '•••• (Chave Salva)';
        
        // Atualiza estado local
        appState.config = {
            ai_summary_mode: config.AI_SUMMARY_MODE,
            tts_engine: config.TTS_ENGINE,
            style: 'jornalistico'
        };
        
    } catch (error) {
        console.warn('⚠️ Config não carregada (Backend offline?):', error);
    }
}

async function saveConfig() {
    const originalText = elements.saveConfigBtn.textContent;
    elements.saveConfigBtn.textContent = 'Salvando...';
    
    const configData = {
        ai_summary_mode: elements.summaryMode.value,
        tts_engine: elements.ttsEngine.value,
        // Só envia se o usuário digitou algo novo
        groq_api_key: elements.groqKey.value || null,
        elevenlabs_api_key: elements.elevenLabsKey.value || null,
        gnews_api_key: elements.gnewsKey.value || null
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        
        if (!response.ok) throw new Error('Erro ao salvar');
        
        showSuccess('Configurações salvas!');
        await loadConfig(); // Recarrega para confirmar
        
    } catch (error) {
        showError('Falha ao salvar configurações.');
    } finally {
        elements.saveConfigBtn.textContent = originalText;
    }
}

// ========================================
// UTILIDADES VISUAIS
// ========================================
function showError(message) {
    alert('❌ ' + message); // Simples e acessível (lê o alerta automaticamente)
}

function showSuccess(message) {
    // Pequeno feedback visual sem interromper
    console.log('✅ ' + message);
}

// Toast improvisado para feedback de leitor de tela
function showSuccessToast(msg) {
    // Poderia ser expandido para uma div flutuante com aria-live
    console.log(msg); 
}

// ========================================
// TICKER
// ========================================
function startTicker() {
    const date = new Date().toLocaleDateString('pt-BR');
    elements.tickerContent.textContent = `🎙️ Sistema Operacional • ${date} • Aguardando geração do boletim...`;
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);
