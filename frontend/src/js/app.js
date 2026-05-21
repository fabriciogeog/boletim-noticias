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
const resetBtn = document.getElementById('resetBtn');
const newsText = document.getElementById('newsText');
const playerSection = document.getElementById('playerSection');
const audioPlayer = document.getElementById('audioPlayer');
const placeholder = document.getElementById('placeholder');
const durationDisplay = document.getElementById('duration');
const currentTimeDisplay = document.getElementById('currentTime');

// ========================================
// CONFIGURAÇÕES E ESTADO
// ========================================
// const API_BASE_URL = 'http://localhost:8000';
const API_BASE_URL = 'http://192.168.15.23:8000';


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
    resetBtn: document.getElementById('resetBtn'),
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
    if (resetBtn) resetBtn.addEventListener('click', resetInterface);
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

    // 2. Exibe o Texto e ATUALIZA O LETREIRO (Breaking News)
    elements.newsText.innerHTML = data.summary_text.replace(/\n/g, '<br>'); 
    elements.newsText.removeAttribute('hidden');
    
    // --- LINHA NOVA ADICIONADA AQUI ---
    updateTickerWithNews(data.summary_text); 
    // ----------------------------------

    // 3. Lógica do Editor (Reseta o estado da edição)
    if (newsEditor) {
        newsEditor.hidden = true;
        newsEditor.value = ""; 
        editControls.hidden = false; 
        btnEdit.hidden = false;      
        saveCancelGroup.hidden = true; 
        // Se você incluiu o botão Copiar/Grupo de leitura:
        if (typeof readModeGroup !== 'undefined') readModeGroup.hidden = false;
    }

    // 4. Configura o Player de Áudio
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
    
    // Função auxiliar para feedback visual e auditivo
    const setSuccessUI = () => {
        const originalText = btnCopy.innerHTML;
        btnCopy.innerHTML = "✅ Copiado!";
        setTimeout(() => btnCopy.innerHTML = originalText, 2000);
        showSuccessToast("Texto copiado para a área de transferência!");
    };

    // 1. Tenta o método moderno (Funciona em localhost ou HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            setSuccessUI();
            return;
        } catch (err) {
            console.warn("Clipboard API falhou, tentando fallback...", err);
        }
    }

    // 2. Método Fallback (Funciona em HTTP e Redes Locais)
    // Criamos um elemento invisível para o sistema de cópia antigo
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Garante que o elemento não apareça na tela mas seja acessível
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            setSuccessUI();
        } else {
            showError("Não foi possível copiar automaticamente.");
        }
    } catch (err) {
        console.error("Erro ao copiar no fallback:", err);
        showError("Erro ao copiar texto.");
    }

    document.body.removeChild(textArea);
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


// ========================================
// ATUALIZAR O LETREIRO (BREAKING NEWS)
// ========================================
function updateTickerWithNews(text) {
    if (!elements.tickerContent) return;

    // 1. Remove quebras de linha e espaços extras do texto original
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // 2. Monta a string única com separadores chamativos
    const tickerText = `🚨 ÚLTIMAS NOTÍCIAS: ${cleanText} • 🚨 BREAKING NEWS: ${cleanText} • `;

    // 3. Insere no HTML (repetimos o texto para garantir que não haja vácuo na rolagem)
    elements.tickerContent.innerHTML = tickerText + tickerText;
    
    // 4. Reinicia a animação
    elements.tickerContent.style.animation = 'none';
    elements.tickerContent.offsetHeight; // Reset técnico
    
    // Ajuste a velocidade aqui (ex: 60s para texto longo, 30s para curto)
    elements.tickerContent.style.animation = 'scroll 160s linear infinite';
}

function resetInterface() {
    console.log("🧹 Limpando interface...");

    // 1. Para o áudio e remove a origem
    if (elements.audioPlayer) {
        elements.audioPlayer.pause();
        elements.audioPlayer.src = "";
    }

    // 2. Esconde as áreas de conteúdo
    elements.playerSection.setAttribute('hidden', '');
    elements.newsText.setAttribute('hidden', '');
    
    // 3. Se o editor estiver aberto, fecha-o
    if (typeof newsEditor !== 'undefined') newsEditor.hidden = true;
    if (typeof editControls !== 'undefined') editControls.hidden = true;

    // 4. Mostra o placeholder original
    elements.placeholder.removeAttribute('hidden');

    // 5. Opcional: Limpa o letreiro (Ticker)
    if (elements.tickerContent) {
        elements.tickerContent.textContent = "🎙️ Sistema Operacional • Aguardando...";
        elements.tickerContent.style.animation = 'none';
    }

    // Joga o foco para o topo para acessibilidade (NVDA)
    document.querySelector('h1').focus();
}

// ========================================
// INTERFACE DE COMANDOS
// Adicionar ao final do app.js existente
// ========================================

// Categorias válidas do sistema
const CATEGORIAS_VALIDAS = [
    'geral', 'politica', 'economia', 'tecnologia',
    'esportes', 'entretenimento', 'saude', 'ciencia', 'mundo'
];

// Elementos do componente
const cmdInput    = document.getElementById('comandoInput');
const cmdBtn      = document.getElementById('comandoBtn');
const cmdFeedback = document.getElementById('comandoFeedback');
const cmdAjuda    = document.getElementById('comandoAjuda');
const cmdHistorico = document.getElementById('historicoLista');

// ----------------------------------------
// FEEDBACK VISUAL E DE ACESSIBILIDADE
// ----------------------------------------
function cmdMostrarFeedback(msg, tipo = 'ok') {
    // tipo: 'ok' | 'erro' | 'info'
    cmdFeedback.textContent = msg;
    cmdFeedback.className = `comando-feedback ${tipo}`;
    cmdFeedback.style.display = 'block';

    // Esconde automaticamente após 5s (exceto erros)
    if (tipo !== 'erro') {
        setTimeout(() => {
            cmdFeedback.style.display = 'none';
        }, 5000);
    }
}

function cmdSetLoading(ativo) {
    cmdBtn.disabled = ativo;
    cmdInput.disabled = ativo;
    cmdBtn.textContent = ativo ? '⏳' : '▶ Executar';
}

// ----------------------------------------
// INTERPRETADOR DE COMANDOS
// ----------------------------------------
async function interpretarComando(raw) {
    const texto = raw.trim().toLowerCase();
    if (!texto) return;

    // Esconde painéis auxiliares
    cmdAjuda.classList.remove('visivel');
    cmdHistorico.classList.remove('visivel');
    cmdFeedback.style.display = 'none';

    const partes = texto.split(/\s+/);
    const acao = partes[0];

    // ---- AJUDA ----
    if (acao === 'ajuda' || acao === 'help') {
        cmdAjuda.classList.add('visivel');
        cmdAjuda.focus();
        return;
    }

    // ---- LIMPAR ----
    if (acao === 'limpar' || acao === 'clear') {
        resetInterface();
        cmdMostrarFeedback('✓ Tela limpa.', 'ok');
        return;
    }

    // ---- STATUS ----
    if (acao === 'status') {
        cmdSetLoading(true);
        try {
            const r = await fetch(`${API_BASE_URL}/health`);
            if (r.ok) {
                const d = await r.json();
                cmdMostrarFeedback(`✓ Sistema online · ${d.timestamp || ''}`, 'ok');
            } else {
                cmdMostrarFeedback('✗ API não respondeu corretamente.', 'erro');
            }
        } catch {
            cmdMostrarFeedback('✗ Sem conexão com o servidor. Verifique o Docker.', 'erro');
        } finally {
            cmdSetLoading(false);
        }
        return;
    }

    // ---- HISTORICO ----
    if (acao === 'historico' || acao === 'histórico' || acao === 'hist') {
        cmdSetLoading(true);
        try {
            const r = await fetch(`${API_BASE_URL}/api/historico`);
            const lista = await r.json();

            if (!lista.length) {
                cmdMostrarFeedback('ℹ Nenhum boletim encontrado no histórico.', 'info');
                cmdSetLoading(false);
                return;
            }

            // Monta a lista visual
            cmdHistorico.innerHTML = lista.slice(0, 20).map(b => {
                const data = b.timestamp
                    ? new Date(b.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                    : '';
                const preview = (b.summary_text || '').substring(0, 60) + '...';
                return `
                    <div class="historico-item">
                        <span class="historico-id" aria-label="ID ${b.id}">#${b.id}</span>
                        <span class="historico-info" title="${b.summary_text || ''}">${data} · ${b.categories || ''} · ${preview}</span>
                        <button class="historico-btn-apagar"
                            aria-label="Apagar boletim ${b.id}"
                            onclick="cmdApagarBoletim(${b.id})">
                            🗑 Apagar
                        </button>
                    </div>`;
            }).join('');

            cmdHistorico.classList.add('visivel');
            cmdMostrarFeedback(`✓ ${lista.length} boletim(ns) encontrado(s).`, 'ok');

        } catch {
            cmdMostrarFeedback('✗ Erro ao buscar histórico.', 'erro');
        } finally {
            cmdSetLoading(false);
        }
        return;
    }

    // ---- APAGAR [id] ----
    if (acao === 'apagar' || acao === 'deletar' || acao === 'remover') {
        const id = parseInt(partes[1]);
        if (isNaN(id)) {
            cmdMostrarFeedback('✗ Informe o id. Ex: apagar 154', 'erro');
            return;
        }
        if (!confirm(`Confirma a exclusão do boletim #${id}?`)) return;

        await cmdApagarBoletim(id);
        return;
    }

    // ---- AUDIO [texto] ----
    if (acao === 'audio' || acao === 'áudio' || acao === 'narrar') {
        const textoCrudo = partes.slice(1).join(' ').trim();
        if (!textoCrudo) {
            cmdMostrarFeedback('✗ Informe o texto. Ex: audio Bom dia ouvintes', 'erro');
            return;
        }

        cmdSetLoading(true);
        cmdMostrarFeedback('⏳ Gerando áudio...', 'info');

        try {
            const r = await fetch(`${API_BASE_URL}/api/generate-audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textoCrudo,
                    tts_engine: appState.config.tts_engine || 'gtts',
                    tts_voice_id: '21m00Tcm4TlvDq8ikWAM'
                })
            });

            if (!r.ok) throw new Error('Falha na API');
            const d = await r.json();

            displayBoletim({ summary_text: textoCrudo, audio_filename: d.audio_filename });
            cmdMostrarFeedback(`✓ Áudio gerado: ${d.audio_filename}`, 'ok');

        } catch {
            cmdMostrarFeedback('✗ Erro ao gerar áudio.', 'erro');
        } finally {
            cmdSetLoading(false);
        }
        return;
    }

    // ---- GERAR [categorias...] [n] ----
    if (acao === 'gerar' || acao === 'gera') {
        // Extrai partes: categorias e número opcional
        const resto = partes.slice(1);
        let categorias = [];
        let quantidade = 5; // padrão

        resto.forEach(p => {
            const n = parseInt(p);
            if (!isNaN(n) && n > 0 && n <= 20) {
                quantidade = n;
            } else if (CATEGORIAS_VALIDAS.includes(p)) {
                categorias.push(p);
            }
        });

        if (categorias.length === 0) categorias = ['geral'];

        const total = quantidade * categorias.length;

        cmdSetLoading(true);
        cmdMostrarFeedback(`⏳ Gerando boletim (${categorias.join(', ')}, ${quantidade} notícias)...`, 'info');

        // Mostra loading overlay como o botão principal
        elements.loadingOverlay.removeAttribute('hidden');
        elements.generateBtn.disabled = true;

        try {
            const r = await fetch(`${API_BASE_URL}/api/generate-boletim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categories: categorias,
                    num_articles: total,
                    style: appState.config.style || 'jornalistico',
                    include_intro: true,
                    include_outro: true,
                    summary_mode: appState.config.ai_summary_mode || 'groq',
                    tts_engine: appState.config.tts_engine || 'gtts'
                })
            });

            if (!r.ok) {
                const err = await r.json();
                throw new Error(err.detail || `HTTP ${r.status}`);
            }

            const d = await r.json();
            appState.currentBoletim = d;
            displayBoletim(d);
            cmdMostrarFeedback(`✓ Boletim #${d.id} gerado · ${categorias.join(', ')} · ${quantidade} notícias`, 'ok');

        } catch (e) {
            cmdMostrarFeedback(`✗ Erro: ${e.message}`, 'erro');
        } finally {
            cmdSetLoading(false);
            elements.loadingOverlay.setAttribute('hidden', '');
            elements.generateBtn.disabled = false;
        }
        return;
    }

    // ---- CATEGORIAS ----
    if (acao === 'categorias') {
        cmdMostrarFeedback(
            '📂 Categorias disponíveis: geral · politica · economia · tecnologia · ' +
            'esportes · entretenimento · saude · ciencia · mundo',
            'info'
        );
        return;
    }

    // ---- COMANDO DESCONHECIDO ----
    cmdMostrarFeedback(`✗ Comando "${acao}" não reconhecido. Digite ajuda para ver os comandos.`, 'erro');
}

// ----------------------------------------
// APAGAR BOLETIM (usado pelo botão do histórico e pelo comando)
// ----------------------------------------
async function cmdApagarBoletim(id) {
    cmdSetLoading(true);
    try {
        const r = await fetch(`${API_BASE_URL}/api/historico/${id}`, { method: 'DELETE' });
        if (r.ok) {
            cmdMostrarFeedback(`✓ Boletim #${id} removido.`, 'ok');
            // Atualiza o histórico se estiver visível
            if (cmdHistorico.classList.contains('visivel')) {
                await interpretarComando('historico');
            }
        } else {
            cmdMostrarFeedback(`✗ Boletim #${id} não encontrado.`, 'erro');
        }
    } catch {
        cmdMostrarFeedback('✗ Erro ao apagar boletim.', 'erro');
    } finally {
        cmdSetLoading(false);
    }
}

// ----------------------------------------
// EVENT LISTENERS DO COMPONENTE
// ----------------------------------------
if (cmdInput && cmdBtn) {

    // Enter no campo executa o comando
    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            interpretarComando(cmdInput.value);
            cmdInput.value = '';
        }
        // Esc fecha os painéis auxiliares
        if (e.key === 'Escape') {
            cmdAjuda.classList.remove('visivel');
            cmdHistorico.classList.remove('visivel');
            cmdFeedback.style.display = 'none';
        }
    });

    // Botão executar
    cmdBtn.addEventListener('click', () => {
        interpretarComando(cmdInput.value);
        cmdInput.value = '';
        cmdInput.focus();
    });

    // Sugestão ao digitar "aj" → mostra ajuda preemptivamente
    cmdInput.addEventListener('input', () => {
        const v = cmdInput.value.trim().toLowerCase();
        if (v === 'ajuda' || v === 'aj' || v === 'help') {
            cmdAjuda.classList.add('visivel');
        } else {
            cmdAjuda.classList.remove('visivel');
        }
    });
}