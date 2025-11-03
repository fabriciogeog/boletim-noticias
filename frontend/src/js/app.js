// ========================================
// Configuração e Constantes
// ========================================
const API_BASE_URL = 'http://localhost:8000';  // API direta, não via proxy

// Estado da aplicação
const appState = {
    currentBoletim: null,
    audioUrl: null,
    isGenerating: false
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
    
    // Botão regenerar áudio
    const btnRegenerar = document.getElementById('btn-regenerar-audio');
    btnRegenerar.addEventListener('click', handleRegenerarAudio);
    
    // Botão download
    const btnDownload = document.getElementById('btn-download');
    btnDownload.addEventListener('click', handleDownloadAudio);
    
    // Configurações
    const btnRefreshModels = document.getElementById('btn-refresh-models');
    btnRefreshModels.addEventListener('click', loadOllamaModels);
    
    const btnSaveModel = document.getElementById('btn-save-model');
    btnSaveModel.addEventListener('click', handleSaveModel);
    
    // Navegação
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
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
            if (!btnEditar.hidden) {
                btnEditar.click();
            }
        }
        
        // Ctrl + D: Download
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            const btnDownload = document.getElementById('btn-download');
            if (!btnDownload.hidden) {
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
        targetSection.focus();
        
        // Se for configurações, carregar modelos
        if (sectionId === 'configuracoes') {
            loadOllamaModels();
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
        speakMessage('Erro: Selecione pelo menos uma categoria');
        return;
    }
    
    // Limpar resultado anterior
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
    
    return {
        categories,
        num_articles: numArticles,
        style,
        include_intro: includeIntro,
        include_outro: includeOutro
    };
}

async function generateBoletim(data) {
    appState.isGenerating = true;
    
    showLoading('Coletando notícias...');
    showStatus('Gerando boletim...', 'info');
    speakMessage('Gerando boletim');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-boletim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            appState.currentBoletim = result;
            displayBoletim(result);
            showStatus('Boletim gerado com sucesso!', 'success');
            speakMessage('Boletim gerado com sucesso');
        } else {
            throw new Error('Falha na geração do boletim');
        }
        
    } catch (error) {
        console.error('Erro ao gerar boletim:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        speakMessage(`Erro ao gerar boletim: ${error.message}`);
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
    
    // Mostrar resultado
    resultadoDiv.hidden = false;
    
    // Exibir texto
    textoTextarea.value = result.summary;
    textoTextarea.readOnly = true;
    
    // Configurar áudio
    if (result.audio_file) {
        audioPlayer.hidden = false;
        audioElement.src = result.download_url;
        appState.audioUrl = result.download_url;
    }
    
    // Scroll para resultado
    resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Anunciar para leitores de tela
    resultadoDiv.setAttribute('aria-label', 
        `Boletim gerado com ${result.articles_count} notícias`
    );
}

// ========================================
// Edição de Texto
// ========================================
function handleEditarTexto() {
    const textarea = document.getElementById('texto-gerado');
    const btnEditar = document.getElementById('btn-editar-texto');
    
    if (textarea.readOnly) {
        textarea.readOnly = false;
        textarea.focus();
        btnEditar.textContent = 'Salvar Edição';
        showStatus('Modo de edição ativado', 'info');
        speakMessage('Modo de edição ativado');
    } else {
        textarea.readOnly = true;
        btnEditar.textContent = 'Editar Texto (Ctrl+E)';
        showStatus('Edições salvas', 'success');
        speakMessage('Edições salvas');
        
        // Atualizar o texto no estado
        if (appState.currentBoletim) {
            appState.currentBoletim.summary = textarea.value;
        }
    }
}

async function handleRegenerarAudio() {
    if (!appState.currentBoletim) {
        return;
    }
    
    showLoading('Gerando novo áudio...');
    showStatus('Regenerando áudio...', 'info');
    speakMessage('Regenerando áudio');
    
    try {
        const textarea = document.getElementById('texto-gerado');
        const text = textarea.value;
        
        // Chamar API de TTS
        const response = await fetch(`${API_BASE_URL}/generate-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            throw new Error('Falha ao gerar áudio');
        }
        
        const result = await response.json();
        
        if (result.success) {
            const audioElement = document.getElementById('audio-element');
            audioElement.src = result.download_url;
            appState.audioUrl = result.download_url;
            
            showStatus('Áudio regenerado!', 'success');
            speakMessage('Áudio regenerado com sucesso');
        }
        
    } catch (error) {
        console.error('Erro ao regenerar áudio:', error);
        showStatus(`Erro: ${error.message}`, 'error');
        speakMessage(`Erro ao regenerar áudio: ${error.message}`);
    } finally {
        hideLoading();
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
    link.click();
    
    showStatus('Download iniciado', 'success');
    speakMessage('Download iniciado');
}

// ========================================
// Utilidades UI
// ========================================
function handleLimparForm() {
    const form = document.getElementById('boletim-form');
    form.reset();
    
    // Resetar para valores padrão
    document.getElementById('cat-geral').checked = true;
    document.getElementById('style-jornalistico').checked = true;
    document.getElementById('include-intro').checked = true;
    document.getElementById('include-outro').checked = true;
    
    showStatus('Formulário limpo', 'info');
    speakMessage('Formulário limpo');
}

function showLoading(message) {
    const loading = document.getElementById('loading');
    const loadingMessage = document.getElementById('loading-message');
    
    loadingMessage.textContent = message;
    loading.hidden = false;
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
    
    // Auto-hide após 5 segundos (exceto errors)
    if (type !== 'error') {
        setTimeout(() => {
            statusMessage.textContent = 'Sistema pronto';
            statusBar.className = 'status-bar';
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
// Feedback Sonoro (será implementado em accessibility.js)
// ========================================
function speakMessage(message) {
    // Implementado em accessibility.js
    if (window.accessibility && window.accessibility.speak) {
        window.accessibility.speak(message);
    }
}

// ========================================
// Configurações - Modelos Ollama
// ========================================
async function loadOllamaModels() {
    try {
        showStatus('Carregando modelos disponíveis...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/ollama/models`);
        const data = await response.json();
        
        if (data.success && data.models.length > 0) {
            const select = document.getElementById('model-select');
            const modelInfo = document.getElementById('model-info');
            const currentModelSpan = document.getElementById('current-model');
            
            // Limpar opções
            select.innerHTML = '';
            
            // Adicionar modelos
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                if (model === data.current) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            // Mostrar modelo atual
            currentModelSpan.textContent = data.current;
            modelInfo.hidden = false;
            
            showStatus(`${data.models.length} modelo(s) encontrado(s)`, 'success');
            speakMessage(`${data.models.length} modelos carregados`);
        } else {
            showStatus('Nenhum modelo Ollama encontrado', 'error');
            const select = document.getElementById('model-select');
            select.innerHTML = '<option value="">Nenhum modelo disponível</option>';
        }
    } catch (error) {
        console.error('Erro ao carregar modelos:', error);
        showStatus('Erro ao carregar modelos', 'error');
        speakMessage('Erro ao carregar modelos');
    }
}

async function handleSaveModel() {
    const select = document.getElementById('model-select');
    const selectedModel = select.value;
    
    if (!selectedModel) {
        showStatus('Selecione um modelo', 'error');
        return;
    }
    
    try {
        showStatus('Salvando configuração...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/api/ollama/set-model?model_name=${encodeURIComponent(selectedModel)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus(`Modelo alterado para: ${selectedModel}`, 'success');
            speakMessage(`Modelo alterado para ${selectedModel}`);
            
            // Atualizar display
            document.getElementById('current-model').textContent = selectedModel;
        } else {
            throw new Error('Falha ao salvar configuração');
        }
    } catch (error) {
        console.error('Erro ao salvar modelo:', error);
        showStatus('Erro ao salvar configuração', 'error');
        speakMessage('Erro ao salvar configuração');
    }
}
