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
    
    // Config Inputs
    summaryMode: document.getElementById('summaryMode'),
    groqKey: document.getElementById('groqKey'),
    ttsEngine: document.getElementById('ttsEngine'),
    elevenLabsKey: document.getElementById('elevenLabsKey'),
    gnewsKey: document.getElementById('gnewsKey'),
    articlesPerCategory: document.getElementById('articlesPerCategory'), // Campo de Qtde
    boletimStyle: document.getElementById('boletimStyle'),
    saveConfigBtn: document.getElementById('saveConfigBtn')
};

// ========================================
// INICIALIZAÇÃO
// ========================================
async function init() {
    console.log('🎙️ Sistema ON AIR inicializando...');
    
    setupEventListeners();
    setupKeyboardShortcuts();
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

// Controle por teclado (Acessibilidade)
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Se estiver digitando em um input, ignora atalhos de mídia
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            if (e.key === 'Escape') closeSidebar();
            return;
        }

        switch (e.code) {
            case 'Space':
            case 'KeyK': // Padrão YouTube
                e.preventDefault(); 
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
// SIDEBAR (Gestão de Foco)
// ========================================
function openSidebar() {
    elements.sidebar.classList.add('active');
    elements.overlay.removeAttribute('hidden');
    elements.configBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => elements.summaryMode.focus(), 300);
}

function closeSidebar() {
    elements.sidebar.classList.remove('active');
    elements.overlay.setAttribute('hidden', '');
    elements.configBtn.setAttribute('aria-expanded', 'false');
    elements.configBtn.focus();
}

// ========================================
// CATEGORIES (SMART MULTI-SELECT)
// ========================================
function toggleCategory(e) {
    const btn = e.currentTarget;
    const category = btn.dataset.category;
    
    // 1. Se já está ativo, tenta desmarcar
    if (btn.classList.contains('active')) {
        // Impede desmarcar o último para não ficar lista vazia
        if (appState.selectedCategories.length > 1) {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
            appState.selectedCategories = appState.selectedCategories.filter(c => c !== category);
        } else {
            console.warn("⚠️ Mínimo de 1 categoria necessária.");
        }
    } else {
        // 2. Se está inativo, vai marcar
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        
        // --- LÓGICA DE PROTEÇÃO DE RELEVÂNCIA ---
        // Se o usuário clicou em algo ESPECÍFICO (não 'geral')
        // e o 'geral' estava marcado, nós tiramos o 'geral' para evitar contaminação.
        if (category !== 'geral' && appState.selectedCategories.includes('geral')) {
            const geralBtn = document.querySelector('.category-btn[data-category="geral"]');
            if (geralBtn) {
                geralBtn.classList.remove('active');
                geralBtn.setAttribute('aria-pressed', 'false');
                appState.selectedCategories = appState.selectedCategories.filter(c => c !== 'geral');
                console.log("🛡️ 'Geral' desmarcado automaticamente para priorizar tema específico.");
            }
        }
        
        // Adiciona a nova categoria na lista
        if (!appState.selectedCategories.includes(category)) {
            appState.selectedCategories.push(category);
        }
    }
    
    console.log(`📂 Seleção Atual:`, appState.selectedCategories);
}

// ========================================
// GERAR BOLETIM (COM CÁLCULO DE COTA)
// ========================================
async function generateBoletim() {
    console.log('🎤 Iniciando geração...');
    
    elements.loadingOverlay.removeAttribute('hidden');
    elements.generateBtn.disabled = true;
    elements.newsText.setAttribute('hidden', '');

    // CÁLCULO INTELIGENTE:
    // Pega o número do input (padrão 3 se vazio)
    const perCategory = parseInt(elements.articlesPerCategory?.value) || 3;
    // Conta quantas categorias estão ativas
    const numCategories = appState.selectedCategories.length;
    // Define o total para enviar ao backend
    const totalLimit = (perCategory * numCategories);

    // DEBUG: Verifique isso no console se tiver dúvidas
    console.log('🚀 ENVIANDO PARA O PYTHON:', {
        topics: appState.selectedCategories,
        per_category: perCategory,
        total_requested: totalLimit
    });

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-boletim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topics: appState.selectedCategories,
                style: appState.config.style,
                num_articles: totalLimit, // Envia o total calculado
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
        showError('Erro ao gerar boletim. Verifique logs/chaves.');
    } finally {
        elements.loadingOverlay.setAttribute('hidden', '');
        elements.generateBtn.disabled = false;
    }
}

// ========================================
// EXIBIR BOLETIM E PLAYER
// ========================================
function displayBoletim(data) {
    elements.placeholder.setAttribute('hidden', '');
    elements.newsText.textContent = data.summary_text;
    elements.newsText.removeAttribute('hidden');
    
    // Tratamento de Cache de Áudio
    if (data.audio_filename && data.audio_filename.endsWith('.mp3')) {
        const timestamp = new Date().getTime();
        const audioUrl = `${API_BASE_URL}/audio/${data.audio_filename}?t=${timestamp}`;
        
        elements.audioPlayer.src = audioUrl;
        elements.audioPlayer.load();
        elements.playerSection.removeAttribute('hidden');
        
        // Foco acessível
        setTimeout(() => {
            elements.playBtn.focus();
            showSuccessToast("Boletim pronto para tocar!");
        }, 500);
        
        console.log('🔊 Áudio carregado:', audioUrl);
        
    } else {
        elements.playerSection.setAttribute('hidden', '');
        elements.newsText.tabIndex = 0;
        elements.newsText.focus();
    }
}

// ========================================
// CONTROLES DO PLAYER
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

function skipAudio(seconds) {
    const newTime = elements.audioPlayer.currentTime + seconds;
    elements.audioPlayer.currentTime = Math.max(0, Math.min(newTime, elements.audioPlayer.duration));
}

function seekAudioMouse(e) {
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    elements.audioPlayer.currentTime = percent * elements.audioPlayer.duration;
}

function updateDuration() {
    elements.duration.textContent = formatTime(elements.audioPlayer.duration);
}

function updateProgress() {
    const current = elements.audioPlayer.currentTime;
    const duration = elements.audioPlayer.duration || 1;
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
    const audioUrl = elements.audioPlayer.src;
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
// API E CONFIGURAÇÃO
// ========================================
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        if (!response.ok) throw new Error('Falha no carregamento');
        
        const config = await response.json();
        
        if (elements.summaryMode) elements.summaryMode.value = config.AI_SUMMARY_MODE || 'groq';
        if (elements.ttsEngine) elements.ttsEngine.value = config.TTS_ENGINE || 'gtts';
        
        if (config.GROQ_API_KEY) elements.groqKey.placeholder = '•••• (Salvo)';
        if (config.ELEVENLABS_API_KEY) elements.elevenLabsKey.placeholder = '•••• (Salvo)';
        if (config.GNEWS_API_KEY) elements.gnewsKey.placeholder = '•••• (Salvo)';
        
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
        await loadConfig(); 
        
    } catch (error) {
        showError('Falha ao salvar configurações.');
    } finally {
        elements.saveConfigBtn.textContent = originalText;
    }
}

// ========================================
// UTILITÁRIOS
// ========================================
function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    console.log('✅ ' + message);
}

function showSuccessToast(msg) {
    console.log(msg); 
}

function startTicker() {
    const date = new Date().toLocaleDateString('pt-BR');
    elements.tickerContent.textContent = `🎙️ Sistema Operacional • ${date} • Aguardando geração do boletim...`;
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);
