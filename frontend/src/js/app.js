// ========================================
// Configuração e Constantes
// ========================================
const API_BASE_URL = ''; // Usa o proxy Nginx

// Estado da aplicação
const appState = {
    currentBoletim: null,
    audioUrl: null,
    isGenerating: false,
    historicoCache: [],
    // Cache para as configurações carregadas
    currentConfig: {
        gnews_api_key: "",
        gemini_api_key: "",
        elevenlabs_api_key: "",
        ai_summary_mode: "none",
        tts_engine: "gtts"
    }
};

// ========================================
// Inicialização
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Boletim de Notícias inicializado');
    
    initializeEventListeners();
    initializeKeyboardShortcuts();
    checkApiHealth();
    
    // Carrega as configurações globais ao iniciar
    loadConfiguracoes();
});

// ========================================
// Event Listeners
// ========================================
function initializeEventListeners() {
    // Formulário de geração
    const form = document.getElementById('boletim-form');
    form.addEventListener('submit', handleFormSubmit);
    
    // Botão limpar
    const btnLimpar = document.getElementById('btn-limpar');
    btnLimpar.addEventListener('click', handleLimparForm);
    
    // Botão editar texto
    const btnEditarTexto = document.getElementById('btn-editar-texto');
    btnEditarTexto.addEventListener('click', handleEditarTexto);

    const btnCopiarTexto = document.getElementById('btn-copiar-texto');
    btnCopiarTexto.addEventListener('click', handleCopiarTexto);
    
    // Botão regenerar áudio
    const btnRegenerar = document.getElementById('btn-regenerar-audio');
    btnRegenerar.addEventListener('click', handleRegenerarAudio);
    
    // Botão download
    const btnDownload = document.getElementById('btn-download');
    btnDownload.addEventListener('click', handleDownloadAudio);
    
    // Navegação
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Listeners do Histórico
    const btnAtualizarHistorico = document.getElementById('btn-atualizar-historico');
    btnAtualizarHistorico.addEventListener('click', loadHistorico);

    const tabelaHistorico = document.getElementById('historico-tabela-corpo');
    tabelaHistorico.addEventListener('click', handleHistoricoActions);
    
    // Listener das Configurações
    const configForm = document.getElementById('config-form');
    configForm.addEventListener('submit', handleConfigFormSubmit);
}

// ========================================
// Atalhos de Teclado (Sem alterações)
// ========================================
function initializeKeyboardShortcuts() {
    // ... (código existente)
}

// ========================================
// Navegação (Atualizada)
// ========================================
function handleNavigation(e) {
    e.preventDefault();
    const href = e.target.getAttribute('href');
    const sectionId = href.substring(1); // Remove '#'
    navigateToSection(sectionId);
}

function navigateToSection(sectionId) {
    // Esconder todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.hidden = true;
    });
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.hidden = false;
        
        const firstHeading = targetSection.querySelector('h2');
        if (firstHeading) {
            firstHeading.setAttribute('tabindex', '-1');
            firstHeading.focus();
        }

        if (sectionId === 'historico') {
            loadHistorico(); 
        }
        if (sectionId === 'configuracoes') {
            loadConfiguracoes(); 
        }
    }
    
    // Atualizar navegação
    document.querySelectorAll('nav a').forEach(link => {
        link.removeAttribute('aria-current');
    });
    
    const activeLink = document.querySelector(`nav a[href="#${sectionId}"]`);
    if (activeLink) {
        activeLink.setAttribute('aria-current', 'page');
    }
}

// ========================================
// Geração de Boletim
// ========================================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (appState.isGenerating) {
        showStatus('Aguarde a geração em andamento...', 'info');
        return;
    }
    
    const formData = getFormData();
    
    if (!formData.categories || formData.categories.length === 0) {
        showStatus('Selecione pelo menos uma categoria', 'error');
        accessibility.announceToScreenReader('Erro: Selecione pelo menos uma categoria');
        return;
    }
    
    const resultadoDiv = document.getElementById('resultado');
    const textoTextarea = document.getElementById('texto-gerado');
    const audioPlayer = document.getElementById('audio-player');
    
    resultadoDiv.hidden = true;
    textoTextarea.value = '';
    audioPlayer.hidden = true;
    
    await generateBoletim(formData);
}

function getFormData() {
    const categories = Array.from(
        document.querySelectorAll('input[name="categories"]:checked')
    ).map(cb => cb.value);
    
    const numArticles = parseInt(
        document.getElementById('num-articles').value
    );
    
    const style = document.querySelector(
        'input[name="style"]:checked'
    ).value;
    
    const includeIntro = document.getElementById('include-intro').checked;
    const includeOutro = document.getElementById('include-outro').checked;

    // Pega as configurações globais de IA e Voz
    const summary_mode = appState.currentConfig.ai_summary_mode;
    const tts_engine = appState.currentConfig.tts_engine;
    // Opcional: Pegar o ID da voz do ElevenLabs de um select
    const tts_voice_id = "Adam"; // Por enquanto, usamos um padrão
    
    return {
        categories,
        num_articles: numArticles,
        style,
        include_intro: includeIntro,
        include_outro: includeOutro,
        
        // Novas configs
        summary_mode: summary_mode,
        tts_engine: tts_engine,
        tts_voice_id: tts_voice_id,
        tld: (tts_engine === 'gtts') ? 'com.br' : null // TLD só é relevante para gTTS
    };
}

async function generateBoletim(data) {
    appState.isGenerating = true;
    
    showLoading('Coletando e gerando notícias...');
    showStatus('Gerando boletim...', 'info');
    accessibility.announceToScreenReader('Gerando boletim, aguarde...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-boletim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data) 
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `Erro ${response.status}`);
        }
        
        if (result && result.summary_text) {
            appState.currentBoletim = result;
            
            const displayData = {
                summary: result.summary_text,
                audio_filename: result.audio_filename,
                audio_url: `/api/download/${result.audio_filename}`
            };

            displayBoletim(displayData);
            showStatus('Boletim gerado com sucesso!', 'success');
            accessibility.announceToScreenReader('Boletim gerado com sucesso');
        } else {
            throw new Error('Falha na geração do boletim');
        }
        
    } catch (error) {
        console.error('Erro ao gerar boletim:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        accessibility.announceToScreenReader(`Erro ao gerar boletim: ${error.message}`);
    } finally {
        hideLoading();
        appState.isGenerating = false;
    }
}

function displayBoletim(result) {
    // ... (código existente)
}

// ========================================
// Edição de Texto e Cópia
// ========================================
function handleEditarTexto() {
    // ... (código existente)
}

function handleCopiarTexto() {
    // ... (código existente)
}


async function handleRegenerarAudio() {
    if (!appState.currentBoletim || appState.isGenerating) {
        return;
    }
    
    appState.isGenerating = true;
    showLoading('Gerando novo áudio...');
    showStatus('Regenerando áudio...', 'info');
    accessibility.announceToScreenReader('Regenerando áudio, aguarde...');
    
    try {
        const textarea = document.getElementById('texto-gerado');
        const text = textarea.value;
        
        // Pega as configurações de voz do estado global
        const tts_engine = appState.currentConfig.tts_engine;
        const tld = (tts_engine === 'gtts') ? 'com.br' : null;
        const tts_voice_id = "Adam"; // Padrão
        
        const response = await fetch(`${API_BASE_URL}/api/generate-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                text: text, 
                tld: tld,
                tts_engine: tts_engine,
                tts_voice_id: tts_voice_id
            }) 
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Falha ao gerar áudio');
        }
        
        if (result.success && result.download_url) {
            // ... (código existente para atualizar o player)
        } else {
            throw new Error('Resposta da API de áudio inválida');
        }
        
    } catch (error) {
        // ... (código existente)
    } finally {
        hideLoading();
        appState.isGenerating = false;
    }
}

// ========================================
// Download (Sem alterações)
// ========================================
function handleDownloadAudio() {
    // ... (código existente)
}

// ========================================
// Utilidades UI (Sem alterações)
// ========================================
function handleLimparForm() {
    // ... (código existente)
}
function showLoading(message) {
    // ... (código existente)
}
function hideLoading() {
    // ... (código existente)
}
function showStatus(message, type = 'info') {
    // ... (código existente)
}

// ========================================
// Health Check (Sem alterações)
// ========================================
async function checkApiHealth() {
    // ... (código existente)
}

// ========================================
// Funções de Debug (Removidas/Simplificadas)
// ========================================
// ...

// ========================================
// Funções do Histórico (Fase 2) (Sem alterações)
// ========================================
async function loadHistorico() {
    // ... (código existente)
}
function renderHistorico(boletins) {
    // ... (código existente)
}
function handleHistoricoActions(e) {
    // ... (código existente)
}
async function handleDeleteBoletim(id) {
    // ... (código existente)
}

// ================================================================
// NOVAS FUNÇÕES (Fase Híbrida - Configurações)
// ================================================================

/**
 * Carrega as configurações atuais do .env (via API) e preenche o formulário.
 */
async function loadConfiguracoes() {
    showStatus('Carregando configurações...', 'info');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        if (!response.ok) {
            throw new Error('Falha ao carregar configurações');
        }
        const config = await response.json();

        // Armazena no estado global
        appState.currentConfig = {
            gnews_api_key: config.GNEWS_API_KEY,
            gemini_api_key: config.GEMINI_API_KEY,
            elevenlabs_api_key: config.ELEVENLABS_API_KEY,
            ai_summary_mode: config.AI_SUMMARY_MODE,
            tts_engine: config.TTS_ENGINE
        };

        // Preenche os campos do formulário
        const gnewsKeyInput = document.getElementById('config-gnews-key');
        const geminiKeyInput = document.getElementById('config-gemini-key');
        const elevenlabsKeyInput = document.getElementById('config-elevenlabs-key');

        gnewsKeyInput.value = config.GNEWS_API_KEY;
        geminiKeyInput.value = config.GEMINI_API_KEY;
        elevenlabsKeyInput.value = config.ELEVENLABS_API_KEY;
        
        // Armazena o valor mascarado para saber se foi alterado
        gnewsKeyInput.dataset.maskedValue = config.GNEWS_API_KEY;
        geminiKeyInput.dataset.maskedValue = config.GEMINI_API_KEY;
        elevenlabsKeyInput.dataset.maskedValue = config.ELEVENLABS_API_KEY;

        // Modos
        document.getElementById('config-summary-mode').value = config.AI_SUMMARY_MODE || 'none';
        document.getElementById('config-tts-engine').value = config.TTS_ENGINE || 'gtts';

        showStatus('Configurações carregadas.', 'success');
        
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showStatus('Erro ao carregar configurações.', 'error');
    }
}

/**
 * Lida com o 'submit' do formulário de configurações.
 * Envia os novos dados para o backend salvar no .env.
 */
async function handleConfigFormSubmit(e) {
    e.preventDefault();
    showStatus('Salvando configurações...', 'info');

    // Pega os inputs
    const gnewsKeyInput = document.getElementById('config-gnews-key');
    const geminiKeyInput = document.getElementById('config-gemini-key');
    const elevenlabsKeyInput = document.getElementById('config-elevenlabs-key');
    
    let gnewsKey = gnewsKeyInput.value;
    let geminiKey = geminiKeyInput.value;
    let elevenlabsKey = elevenlabsKeyInput.value;

    // Se o valor for o mesmo mascarado (ou vazio), envia 'null'
    if (gnewsKey === gnewsKeyInput.dataset.maskedValue || gnewsKey === "") {
        gnewsKey = null;
    }
    if (geminiKey === geminiKeyInput.dataset.maskedValue || geminiKey === "") {
        geminiKey = null;
    }
    if (elevenlabsKey === elevenlabsKeyInput.dataset.maskedValue || elevenlabsKey === "") {
        elevenlabsKey = null;
    }
    
    // Pega os selects
    const summaryMode = document.getElementById('config-summary-mode').value;
    const ttsEngine = document.getElementById('config-tts-engine').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gnews_api_key: gnewsKey,
                gemini_api_key: geminiKey,
                elevenlabs_api_key: elevenlabsKey,
                ai_summary_mode: summaryMode,
                tts_engine: ttsEngine
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Falha ao salvar');
        }
        
        showStatus('Configurações salvas com sucesso!', 'success');
        accessibility.announceToScreenReader('Configurações salvas com sucesso');

        // Recarrega os valores (para atualizar o cache e as chaves mascaradas)
        await loadConfiguracoes();

    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        accessibility.announceToScreenReader(`Erro ao salvar: ${error.message}`);
    }
}
