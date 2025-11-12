// ========================================
// Configuração e Constantes
// ========================================
const API_BASE_URL = ''; // Usa o proxy Nginx

// Estado da aplicação
const appState = {
    currentBoletim: null,
    audioUrl: null,
    isGenerating: false,
    historicoCache: [] 
};

// ========================================
// Inicialização
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sistema de Boletim de Notícias inicializado');
    
    initializeEventListeners();
    initializeKeyboardShortcuts();
    checkApiHealth();
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
// Atalhos de Teclado
// ========================================
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter: Gerar boletim
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn-gerar').click();
        }
        
        // Ctrl + E: Editar texto
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            const btnEditar = document.getElementById('btn-editar-texto');
            if (btnEditar && !btnEditar.closest('[hidden]')) {
                btnEditar.click();
            }
        }
        
        // Ctrl + D: Download
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            const btnDownload = document.getElementById('btn-download');
            if (btnDownload && !btnDownload.closest('[hidden]')) {
                btnDownload.click();
            }
        }
        
        // Alt + 1-4: Navegação
        if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const sections = ['gerar', 'historico', 'configuracoes', 'ajuda'];
            const index = parseInt(e.key) - 1;
            navigateToSection(sections[index]);
        }
    });
}

// ========================================
// Navegação
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

    const tld = document.getElementById('config-tld-select').value;
    
    return {
        categories,
        num_articles: numArticles,
        style,
        include_intro: includeIntro,
        include_outro: includeOutro,
        tld: tld 
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
    const resultadoDiv = document.getElementById('resultado');
    const textoTextarea = document.getElementById('texto-gerado');
    const audioPlayer = document.getElementById('audio-player');
    const audioElement = document.getElementById('audio-element');
    
    console.log('=== DEBUG: Resultado para Exibição ===');
    console.log(JSON.stringify(result, null, 2));
    
    resultadoDiv.hidden = false;
    
    textoTextarea.value = result.summary;
    textoTextarea.readOnly = true;
    document.getElementById('btn-editar-texto').textContent = 'Editar Texto (Ctrl+E)';
    
    const audioFile = result.audio_filename;
    const audioUrl = result.audio_url;
    
    const isMP3 = audioFile && audioFile.endsWith('.mp3');
    
    if (isMP3) {
        let fullUrl = audioUrl.startsWith('http') ? audioUrl : `${API_BASE_URL}${audioUrl}`;
        fullUrl += `?t=${Date.now()}`;
        
        audioElement.pause();
        audioElement.src = '';
        audioElement.load();
        
        audioElement.src = fullUrl;
        audioElement.load();
        
        audioPlayer.hidden = false;
        audioPlayer.style.display = 'block';
        
        appState.audioUrl = fullUrl.split('?')[0];
        
        showStatus('Áudio MP3 disponível!', 'success');
        accessibility.announceToScreenReader('Áudio gerado com sucesso, player disponível');
        
    } else {
        console.warn('✗ Áudio não é MP3 ou não existe. O player ficará oculto.');
        audioPlayer.hidden = true;
        
        if (audioFile && audioFile.endsWith('.txt')) {
            showStatus('Boletim gerado (modo texto, falha no áudio)', 'warning');
        } else {
            showStatus('Áudio não gerado', 'warning');
        }
    }
    
    resultadoDiv.querySelector('h3').setAttribute('tabindex', '-1');
    resultadoDiv.querySelector('h3').focus();
}

// ========================================
// Edição de Texto e Cópia
// ========================================
function handleEditarTexto() {
    const textarea = document.getElementById('texto-gerado');
    const btnEditar = document.getElementById('btn-editar-texto');
    
    if (textarea.readOnly) {
        textarea.readOnly = false;
        textarea.focus();
        btnEditar.textContent = 'Salvar Edição';
        showStatus('Modo de edição ativado', 'info');
        accessibility.announceToScreenReader('Modo de edição ativado');
    } else {
        textarea.readOnly = true;
        btnEditar.textContent = 'Editar Texto (Ctrl+E)';
        showStatus('Edições salvas', 'success');
        accessibility.announceToScreenReader('Edições salvas');
        
        if (appState.currentBoletim) {
            appState.currentBoletim.summary_text = textarea.value;
        }
    }
}

function handleCopiarTexto() {
    const textarea = document.getElementById('texto-gerado');
    const textToCopy = textarea.value;

    if (!textToCopy) {
        showStatus('Não há texto para copiar.', 'error');
        accessibility.announceToScreenReader('Não há texto para copiar');
        return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        showStatus('Texto copiado para a área de transferência!', 'success');
        accessibility.announceToScreenReader('Texto copiado');
    }).catch(err => {
        console.error('Erro ao copiar texto: ', err);
        showStatus('Falha ao copiar texto.', 'error');
        accessibility.announceToScreenReader('Falha ao copiar texto');
    });
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
        const tld = document.getElementById('config-tld-select').value;
        
        const response = await fetch(`${API_BASE_URL}/api/generate-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text, tld: tld }) 
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Falha ao gerar áudio');
        }
        
        if (result.success && result.download_url) {
            const audioElement = document.getElementById('audio-element');
            const audioPlayer = document.getElementById('audio-player');
            audioPlayer.hidden = false;
            audioPlayer.style.display = 'block';
            
            let fullUrl = `${API_BASE_URL}${result.download_url}?t=${Date.now()}`;
            
            audioElement.src = fullUrl;
            audioElement.load();
            appState.audioUrl = fullUrl.split('?')[0];
            
            showStatus('Áudio regenerado!', 'success');
            accessibility.announceToScreenReader('Áudio regenerado com sucesso');
        } else {
            throw new Error('Resposta da API de áudio inválida');
        }
        
    } catch (error) {
        console.error('Erro ao regenerar áudio:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        accessibility.announceToScreenReader(`Erro ao regenerar áudio: ${error.message}`);
    } finally {
        hideLoading();
        appState.isGenerating = false;
    }
}

// ========================================
// Download
// ========================================
function handleDownloadAudio() {
    if (!appState.audioUrl) {
        showStatus('Nenhum áudio disponível', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = appState.audioUrl;
    link.download = `boletim_${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('Download iniciado', 'success');
    accessibility.announceToScreenReader('Download iniciado');
}

// ========================================
// Utilidades UI
// ========================================
function handleLimparForm() {
    const form = document.getElementById('boletim-form');
    form.reset();
    
    document.getElementById('cat-politica').checked = true;
    document.getElementById('style-jornalistico').checked = true;
    document.getElementById('include-intro').checked = true;
    document.getElementById('include-outro').checked = true;
    
    showStatus('Formulário limpo', 'info');
    accessibility.announceToScreenReader('Formulário limpo');
}

function showLoading(message) {
    const loading = document.getElementById('loading');
    const loadingMessage = document.getElementById('loading-message');
    
    loadingMessage.textContent = message;
    loading.hidden = false;
    loading.setAttribute('tabindex', '-1');
    loading.focus();
}

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.hidden = true;
}

function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('status-bar');
    const statusMessage = document.getElementById('status-message');
    
    statusMessage.textContent = message;
    statusBar.className = `status-bar ${type}`;
    
    accessibility.announceToScreenReader(message, 'assertive');
    
    if (type !== 'error') {
        setTimeout(() => {
            if (statusMessage.textContent === message) {
                statusMessage.textContent = 'Sistema pronto';
                statusBar.className = 'status-bar';
            }
        }, 5000);
    }
}

// ========================================
// Health Check
// ========================================
async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✓ API conectada');
            showStatus('Sistema pronto', 'success');
        } else {
            throw new Error('API não respondeu');
        }
    } catch (error) {
        console.error('✗ Erro ao conectar com API:', error);
        showStatus('Atenção: API offline', 'error');
    }
}

// ========================================
// Funções de Debug
// ========================================
async function testAudioPlayer() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/historico`);
        if (!response.ok) {
            showAudioDebug();
            return;
        }
        
        const data = await response.json();
        if (data && data.length > 0) {
            const lastAudio = data[0].audio_filename;
            if (lastAudio) {
                const audioUrl = `${API_BASE_URL}/api/download/${lastAudio}?t=${Date.now()}`;
                
                const audioElement = document.getElementById('audio-element');
                const audioPlayer = document.getElementById('audio-player');
                
                audioElement.src = audioUrl;
                audioElement.load();
                audioPlayer.hidden = false;
                
                showStatus(`Testando: ${lastAudio}`, 'info');
                console.log('Áudio de teste carregado:', audioUrl);
            } else {
                showStatus('Último boletim não tem áudio', 'info');
            }
        } else {
            showStatus('Nenhum áudio no histórico', 'info');
        }
    } catch (error) {
        console.error('Erro ao testar áudio:', error);
        showAudioDebug();
    }
}

function showAudioDebug() {
    const audioElement = document.getElementById('audio-element');
    const audioPlayer = document.getElementById('audio-player');
    
    console.log('=== DEBUG ÁUDIO ===');
    console.log('Player hidden:', audioPlayer.hidden);
    console.log('Audio src:', audioElement.src);
    console.log('Audio readyState:', audioElement.readyState);
    console.log('Audio networkState:', audioElement.networkState);
    console.log('Audio error:', audioElement.error);
    console.log('appState.audioUrl:', appState.audioUrl);
    console.log('==================');
    
    audioPlayer.hidden = false;
    
    showStatus('Debug info no console (F12)', 'info');
}

// ========================================
// Funções Removidas
// ========================================
async function loadOllamaModels() {
    // Esta função foi intencionalmente esvaziada.
}

async function handleSaveModel() {
    // Esta função foi intencionalmente esvaziada.
}


// ========================================
// Funções do Histórico (Fase 2)
// ========================================
async function loadHistorico() {
    const loadingDiv = document.getElementById('historico-loading');
    const table = document.getElementById('history-table');
    loadingDiv.hidden = false;
    table.hidden = true;
    accessibility.announceToScreenReader('Carregando histórico...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/historico`);
        if (!response.ok) {
            throw new Error('Falha ao buscar histórico');
        }
        const boletins = await response.json();
        
        appState.historicoCache = boletins; 
        
        renderHistorico(boletins);
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showStatus('Erro ao carregar histórico.', 'error');
        document.getElementById('historico-tabela-corpo').innerHTML = 
            '<tr><td colspan="4">Falha ao carregar histórico.</td></tr>';
    } finally {
        loadingDiv.hidden = true;
        table.hidden = false;
    }
}

function renderHistorico(boletins) {
    const tabelaCorpo = document.getElementById('historico-tabela-corpo');
    
    tabelaCorpo.innerHTML = '';
    
    if (boletins.length === 0) {
        tabelaCorpo.innerHTML = '<tr><td colspan="4">Nenhum boletim encontrado no histórico.</td></tr>';
        return;
    }

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    boletins.forEach(boletim => {
        const row = document.createElement('tr');
        row.dataset.id = boletim.id; 
        
        const dataFormatada = dateFormatter.format(new Date(boletim.timestamp));
        const resumoCurto = (boletim.summary_text || '').substring(0, 50) + '...';
        const categorias = (boletim.categories || 'N/A').replace(/,/g, ', ');
        const audioDisabled = !boletim.audio_filename;

        row.innerHTML = `
            <td data-label="Data">${dataFormatada}</td>
            <td data-label="Categorias">${categorias}</td>
            <td data-label="Resumo">${resumoCurto}</td>
            <td data-label="Ações">
                <div class="button-group-vertical">
                    <button class="btn btn-secondary btn-sm" data-action="listen" data-filename="${boletim.audio_filename}" ${audioDisabled ? 'disabled' : ''} aria-label="Ouvir boletim ${boletim.id}">
                        Ouvir
                    </button>
                    <button class="btn btn-secondary btn-sm" data-action="copy" data-id="${boletim.id}" aria-label="Copiar texto do boletim ${boletim.id}">
                        Copiar Texto
                    </button>
                    <button class="btn btn-success btn-sm" data-action="download" data-filename="${boletim.audio_filename}" ${audioDisabled ? 'disabled' : ''} aria-label="Baixar áudio do boletim ${boletim.id}">
                        Baixar
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-id="${boletim.id}" aria-label="Excluir boletim ${boletim.id}">
                        Excluir
                    </button>
                </div>
            </td>
        `;
        tabelaCorpo.appendChild(row);
    });
}

function handleHistoricoActions(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    const filename = target.dataset.filename;

    if (action === 'listen') {
        const audioUrl = `${API_BASE_URL}/api/download/${filename}?t=${Date.now()}`;
        const player = document.getElementById('historico-audio-element');
        const playerContainer = document.getElementById('historico-audio-player');
        
        player.src = audioUrl;
        player.load();
        player.play();
        playerContainer.hidden = false;
        accessibility.announceToScreenReader('Iniciando reprodução do áudio.');
    }
    
    if (action === 'download') {
        const audioUrl = `${API_BASE_URL}/api/download/${filename}`;
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showStatus('Download do histórico iniciado.', 'success');
    }

    if (action === 'copy') {
        const boletim = appState.historicoCache.find(b => b.id == id);
        if (boletim && boletim.summary_text) {
            navigator.clipboard.writeText(boletim.summary_text).then(() => {
                showStatus('Texto do histórico copiado!', 'success');
                accessibility.announceToScreenReader('Texto copiado');
            }).catch(err => {
                showStatus('Falha ao copiar texto.', 'error');
            });
        } else {
            showStatus('Texto não encontrado.', 'error');
        }
    }
    
    if (action === 'delete') {
        if (confirm(`Tem certeza que deseja excluir o boletim ID ${id}? Esta ação não pode ser desfeita.`)) {
            handleDeleteBoletim(id);
        }
    }
}

async function handleDeleteBoletim(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/historico/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Falha ao excluir');
        }

        showStatus(`Boletim ID ${id} excluído com sucesso!`, 'success');
        accessibility.announceToScreenReader('Boletim excluído com sucesso');
        
        loadHistorico();

    } catch (error) {
        console.error('Erro ao excluir boletim:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        accessibility.announceToScreenReader(`Erro ao excluir: ${error.message}`);
    }
}

// ========================================
// Funções da Fase 3 (Configurações)
// ========================================

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

        // Preenche os campos do formulário
        
        // Chave de API (mostra o valor mascarado)
        const apiKeyInput = document.getElementById('config-api-key');
        if (config.GNEWS_API_KEY) {
            apiKeyInput.value = config.GNEWS_API_KEY; // Ex: "9c66... (Salva)"
            // Armazena o valor mascarado para saber se foi alterado
            apiKeyInput.dataset.maskedValue = config.GNEWS_API_KEY; 
        } else {
            apiKeyInput.placeholder = "Chave de API não definida";
            apiKeyInput.dataset.maskedValue = "";
        }

        // Sotaque da Voz (TLD)
        document.getElementById('config-tld-select').value = config.TTS_ENGINE || 'com.br';
        
        // Interruptor do Ollama (informativo)
        document.getElementById('config-enable-ollama').checked = (config.ENABLE_OLLAMA === 'true');

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

    const apiKeyInput = document.getElementById('config-api-key');
    const tld = document.getElementById('config-tld-select').value;
    
    let apiKey = apiKeyInput.value;

    // Se o valor da API Key for o mesmo valor mascarado (ex: "9c66..."),
    // ou se estiver vazio, significa que o usuário não a alterou. Enviamos 'null'.
    if (apiKey === apiKeyInput.dataset.maskedValue || apiKey === "") {
        apiKey = null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gnews_api_key: apiKey,
                tts_engine: tld
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Falha ao salvar');
        }
        
        showStatus('Configurações salvas com sucesso!', 'success');
        accessibility.announceToScreenReader('Configurações salvas com sucesso');

        // Recarrega os valores (para atualizar a chave mascarada)
        loadConfiguracoes();

    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        accessibility.announceToScreenReader(`Erro ao salvar: ${error.message}`);
    }
}
