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
    articlesPerCategory: document.getElementById('articlesPerCategory'), 
    boletimStyle: document.getElementById('boletimStyle'),
    saveConfigBtn: document.getElementById('saveConfigBtn')
};

// ========================================
// INICIALIZAÇÃO
// ========================================
async function init() {
    console.log('🎙️ Sistema ON AIR inicializando (Versão Smart)...');
    
    setupEventListeners();
    setupKeyboardShortcuts();
    await loadConfig();
    startTicker();
    
    console.log('✅ Sistema pronto!');
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    elements.configBtn.addEventListener('click', openSidebar);
    elements.closeSidebar.addEventListener('click', closeSidebar);
    elements.overlay.addEventListener('click', closeSidebar);
    
    elements.categoryBtns.forEach(btn => {
        btn.addEventListener('click', toggleCategory);
    });
    
    elements.generateBtn.addEventListener('click', generateBoletim);
    
    elements.playBtn.addEventListener('click', togglePlay);
    elements.downloadBtn.addEventListener('click', downloadAudio);
    elements.volumeBtn.addEventListener('click', toggleMute);
    
    elements.audioPlayer.addEventListener('loadedmetadata', updateDuration);
    elements.audioPlayer.addEventListener('timeupdate', updateProgress);
    elements.audioPlayer.addEventListener('ended', onAudioEnded);
    
    document.querySelector('.progress-bar').addEventListener('click', seekAudioMouse);
    elements.saveConfigBtn.addEventListener('click', saveConfig);
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            if (e.key === 'Escape') closeSidebar();
            return;
        }

        switch (e.code) {
            case 'Space':
            case 'KeyK':
                e.preventDefault(); 
                if (!elements.playerSection.hidden) togglePlay();
                break;
            case 'ArrowLeft':
            case 'KeyJ':
                if (!elements.playerSection.hidden) skipAudio(-5);
                break;
            case 'ArrowRight':
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
// LÓGICA DE CATEGORIAS (SMART)
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
        
        // --- PROTEÇÃO INTELIGENTE ---
        // Se escolheu algo específico (ex: Esportes) e 'Geral' estava marcado, remove 'Geral'.
        if (category !== 'geral' && appState.selectedCategories.includes('geral')) {
            const geralBtn = document.querySelector('.category-btn[data-category="geral"]');
            if (geralBtn) {
                geralBtn.classList.remove('active');
                geralBtn.setAttribute('aria-pressed', 'false');
                appState.selectedCategories = appState.selectedCategories.filter(c => c !== 'geral');
                console.log("🛡️ 'Geral' removido para focar no tema específico.");
            }
        }
        
        if (!appState.selectedCategories.includes(category)) {
            appState.selectedCategories.push(category);
        }
    }
    
    console.log(`📂 Seleção Atual:`, appState.selectedCategories);
}

// ========================================
// GERAR BOLETIM
// ========================================
async function generateBoletim() {
    console.log('🎤 Iniciando geração...');
    
    // Validação de Segurança
    if (appState.selectedCategories.length === 0) {
        showError("Selecione pelo menos uma categoria.");
        return;
    }

    elements.loadingOverlay.removeAttribute('hidden');
    elements.generateBtn.disabled = true;
    elements.newsText.setAttribute('hidden', '');

    // Se o elemento não existir (campo novo), usa padrão 3
    const perCategory = elements.articlesPerCategory ? (parseInt(elements.articlesPerCategory.value) || 3) : 3;
    const totalLimit = (perCategory * appState.selectedCategories.length);

    console.log('🚀 ENVIANDO:', {
        topics: appState.selectedCategories,
        total: totalLimit
    });

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-boletim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categories: appState.selectedCategories, // ATENÇÃO: Backend espera 'categories', não 'topics' no Pydantic novo
                num_articles: totalLimit,
                style: appState.config.style,
                include_intro: true,
                include_outro: true,
                summary_mode: appState.config.ai_summary_mode,
                tts_engine: appState.config.tts_engine
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        appState.currentBoletim = data;
        displayBoletim(data);
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showError(`Erro: ${error.message}`);
    } finally {
        elements.loadingOverlay.setAttribute('hidden', '');
        elements.generateBtn.disabled = false;
    }
}

// ========================================
// EXIBIR E TOCAR
// ========================================
function displayBoletim(data) {
    elements.placeholder.setAttribute('hidden', '');
    elements.newsText.textContent = data.summary_text;
    elements.newsText.removeAttribute('hidden');
    
    if (data.audio_filename && data.audio_filename.endsWith('.mp3')) {
        const timestamp = new Date().getTime();
        const audioUrl = `${API_BASE_URL}/audio/${data.audio_filename}?t=${timestamp}`;
        
        elements.audioPlayer.src = audioUrl;
        elements.audioPlayer.load();
        elements.playerSection.removeAttribute('hidden');
        
        setTimeout(() => {
            elements.playBtn.focus();
            showSuccessToast("Boletim pronto!");
        }, 500);
        
    } else {
        elements.playerSection.setAttribute('hidden', '');
        elements.newsText.focus();
    }
}

// ========================================
// UTILITÁRIOS E CONFIG
// ========================================
function openSidebar() {
    elements.sidebar.classList.add('active');
    elements.overlay.removeAttribute('hidden');
}

function closeSidebar() {
    elements.sidebar.classList.remove('active');
    elements.overlay.setAttribute('hidden', '');
}

async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        if (response.ok) {
            const config = await response.json();
            if (elements.summaryMode) elements.summaryMode.value = config.AI_SUMMARY_MODE || 'groq';
            if (elements.ttsEngine) elements.ttsEngine.value = config.TTS_ENGINE || 'gtts';
            
            // Atualiza estado local
            appState.config.ai_summary_mode = config.AI_SUMMARY_MODE;
            appState.config.tts_engine = config.TTS_ENGINE;
        }
    } catch (e) {
        console.warn('Config offline');
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
        
        if (response.ok) {
            showSuccess('Configurações salvas!');
            await loadConfig();
        } else {
            throw new Error('Falha ao salvar');
        }
    } catch (error) {
        showError('Erro ao salvar config.');
    } finally {
        elements.saveConfigBtn.textContent = originalText;
    }
}

// Funções do Player (Play/Pause, Seek, etc)
function togglePlay() {
    if (elements.audioPlayer.paused) {
        elements.audioPlayer.play();
        elements.playBtn.textContent = '⏸️';
    } else {
        elements.audioPlayer.pause();
        elements.playBtn.textContent = '▶️';
    }
}
function updateProgress() {
    const cur = elements.audioPlayer.currentTime;
    const dur = elements.audioPlayer.duration || 1;
    elements.progressFill.style.width = `${(cur/dur)*100}%`;
    elements.currentTime.textContent = formatTime(cur);
}
function updateDuration() {
    elements.duration.textContent = formatTime(elements.audioPlayer.duration);
}
function seekAudioMouse(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    elements.audioPlayer.currentTime = pct * elements.audioPlayer.duration;
}
function onAudioEnded() {
    elements.playBtn.textContent = '▶️';
    elements.progressFill.style.width = '0%';
}
function toggleMute() {
    elements.audioPlayer.muted = !elements.audioPlayer.muted;
    elements.volumeBtn.textContent = elements.audioPlayer.muted ? '🔇' : '🔊';
}
function downloadAudio() {
    if (elements.audioPlayer.src) {
        const a = document.createElement('a');
        a.href = elements.audioPlayer.src;
        a.download = `boletim_${Date.now()}.mp3`;
        a.click();
    }
}
function skipAudio(s) {
    elements.audioPlayer.currentTime += s;
}
function formatTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s/60);
    const sc = Math.floor(s%60);
    return `${m}:${sc.toString().padStart(2,'0')}`;
}
function showError(msg) { alert('❌ ' + msg); }
function showSuccess(msg) { console.log('✅ ' + msg); }
function showSuccessToast(msg) { console.log(msg); }
function startTicker() {
    const d = new Date().toLocaleDateString('pt-BR');
    elements.tickerContent.textContent = `🎙️ Sistema Operacional • ${d} • Aguardando...`;
}

document.addEventListener('DOMContentLoaded', init);
