
// ========================================
// NOVOS ELEMENTOS
// ========================================

const newsEditor = document.getElementById('newsEditor');
const editControls = document.getElementById('editControls');
const btnEdit = document.getElementById('btnEdit');
const saveCancelGroup = document.getElementById('saveCancelGroup');
const btnSaveAudio = document.getElementById('btnSaveAudio');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const readModeGroup = document.getElementById('readModeGroup');
const btnCopy = document.getElementById('btnCopy');
const btnSaveTextOnly = document.getElementById('btnSaveTextOnly');

// Elementos de Interface já existentes (Só para conferência)
const newsText = document.getElementById('newsText');
const playerSection = document.getElementById('playerSection');
const audioPlayer = document.getElementById('audioPlayer');
const placeholder = document.getElementById('placeholder');
const durationDisplay = document.getElementById('duration');
const currentTimeDisplay = document.getElementById('currentTime');

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
    btnEdit.addEventListener('click', enterEditMode);
    btnCancelEdit.addEventListener('click', exitEditMode);
    btnSaveAudio.addEventListener('click', saveAndRegenerateAudio);
    btnCopy.addEventListener('click', copyTextToClipboard);
    btnSaveTextOnly.addEventListener('click', saveTextOnly);
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
// EXIBIR E TOCAR (ATUALIZADA)
// ========================================
function displayBoletim(data) {
    // 1. Esconde o Placeholder
    elements.placeholder.setAttribute('hidden', '');

    // 2. Exibe o Texto (Com formatação de parágrafos <br>)
    // Usamos innerHTML para converter quebras de linha em visual
    elements.newsText.innerHTML = data.summary_text.replace(/\n/g, '<br>'); 
    elements.newsText.removeAttribute('hidden');
    
    // 3. Lógica do Editor (NOVO: Reseta o estado da edição)
    // Garante que o editor esteja escondido e os botões certos apareçam
    if (newsEditor) {
        newsEditor.hidden = true;
        newsEditor.value = ""; // Limpa lixo anterior
        editControls.hidden = false; // Mostra a barra de ferramentas (Editar)
        btnEdit.hidden = false;      // Mostra o botão lápis
        readModeGroup.hidden = false;
        saveCancelGroup.hidden = true; // Esconde o Salvar/Cancelar
    }

    // 4. Configura o Player de Áudio
    if (data.audio_filename && data.audio_filename.endsWith('.mp3')) {
        const timestamp = new Date().getTime(); // Truque anti-cache
        const audioUrl = `${API_BASE_URL}/audio/${data.audio_filename}?t=${timestamp}`;
        
        elements.audioPlayer.src = audioUrl;
        elements.audioPlayer.load();
        elements.playerSection.removeAttribute('hidden');
        
        // Foco automático no Play para facilitar acessibilidade
        setTimeout(() => {
            elements.playBtn.focus();
            showSuccessToast("Boletim pronto!");
        }, 500);
        
    } else {
        // Se não tiver áudio, esconde o player e foca no texto
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

// ========================================
// LÓGICA DE EDIÇÃO (NOVO)
// ========================================

function enterEditMode() {
    // 1. Pega o texto atual (sem HTML)
    const currentText = elements.newsText.innerText;
    
    // 2. Preenche o editor
    newsEditor.value = currentText;
    
    // 3. Troca a visualização
    elements.newsText.hidden = true;     // Esconde texto fixo
    newsEditor.hidden = false;           // Mostra caixa de edição
    newsEditor.focus();                  // Foca para digitar
    
    // 4. Troca os botões
    btnEdit.hidden = true;               // Esconde lápis
    saveCancelGroup.hidden = false;      // Mostra Salvar/Cancelar
    saveCancelGroup.style.display = 'flex'; 
}

function exitEditMode() {
    // Apenas desfaz a troca visual (cancela)
    newsEditor.hidden = true;
    elements.newsText.hidden = false;
    
    saveCancelGroup.hidden = true;
    btnEdit.hidden = false;
}

function saveTextOnly() {
    const newText = newsEditor.value;
    if (!newText.trim()) return alert("Texto vazio!");

    // 1. Atualiza o visual
    elements.newsText.innerHTML = newText.replace(/\n/g, '<br>');
    elements.newsText.innerText = newText; // Atualiza o texto puro também
    
    // 2. Sai do modo de edição
    exitEditMode();

    // 3. AVISO IMPORTANTE:
    // Se mudou o texto, o áudio antigo não serve mais.
    // Escondemos o player para evitar confusão (Texto diz A, Áudio diz B).
    elements.playerSection.setAttribute('hidden', '');
    alert("Texto salvo! ⚠️ O áudio foi ocultado pois não corresponde mais ao texto novo. Gere um novo áudio se desejar ouvir.");
}

async function copyTextToClipboard() {
    const text = elements.newsText.innerText;
    try {
        await navigator.clipboard.writeText(text);
        // Feedback visual rápido no botão
        const originalText = btnCopy.innerHTML;
        btnCopy.innerHTML = "✅ Copiado!";
        setTimeout(() => btnCopy.innerHTML = originalText, 2000);
        showSuccessToast("Texto copiado para a área de transferência!");
    } catch (err) {
        showError("Erro ao copiar texto.");
    }
}

async function saveAndRegenerateAudio() {
    const newText = newsEditor.value;
    
    // Validação básica
    if (!newText.trim()) {
        alert("O texto não pode estar vazio!");
        return;
    }

    // Feedback visual (Travando botão)
    const originalLabel = btnSaveAudio.innerHTML;
    btnSaveAudio.innerHTML = "⏳ Gerando Áudio...";
    btnSaveAudio.disabled = true;

    try {
        // Prepara o envio para a API
        const payload = {
            text: newText,
            // Usa as configs atuais
            tts_engine: appState.config.tts_engine || "gtts",
            tts_voice_id: "21m00Tcm4TlvDq8ikWAM"
        };

        // Chama o endpoint de regeneração
        const res = await fetch(`${API_BASE_URL}/api/generate-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Erro ao gerar áudio");

        const data = await res.json();

        // SUCESSO!
        // Atualiza a tela simulando um boletim novo
        displayBoletim({
            summary_text: newText,
            audio_filename: data.audio_filename
        });

        showSuccessToast("Texto e áudio atualizados!");

    } catch (error) {
        console.error(error);
        showError("Erro ao regenerar áudio.");
        
        // Em caso de erro, destrava o botão para tentar de novo
        btnSaveAudio.innerHTML = originalLabel;
        btnSaveAudio.disabled = false;
    } finally {
        // Se deu certo, o displayBoletim já reseta a UI.
        // Se deu erro, precisamos destravar o botão.
        // Por segurança, restauramos o botão aqui.
        if (!btnSaveAudio.disabled) { 
             // Só restaura se não tiver sido resetado pelo displayBoletim
             btnSaveAudio.innerHTML = originalLabel;
        }
    }
}