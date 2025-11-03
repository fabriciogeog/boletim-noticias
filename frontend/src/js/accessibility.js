// ========================================
// Módulo de Acessibilidade
// ========================================

const accessibility = (() => {
    let speechSynthesis = window.speechSynthesis;
    let isSpeechEnabled = true;
    let preferredVoice = null;
    
    // ========================================
    // Inicialização
    // ========================================
    function init() {
        console.log('Módulo de acessibilidade inicializado');
        
        // Detectar preferências do usuário
        detectUserPreferences();
        
        // Configurar vozes disponíveis
        if (speechSynthesis) {
            // Esperar vozes carregarem
            speechSynthesis.addEventListener('voiceschanged', loadVoices);
            loadVoices();
        }
        
        // Adicionar listeners para melhorar navegação
        enhanceKeyboardNavigation();
        
        // Adicionar indicadores visuais de foco
        enhanceFocusIndicators();
    }
    
    // ========================================
    // Síntese de Voz (Feedback Sonoro)
    // ========================================
    function speak(text, options = {}) {
        if (!isSpeechEnabled || !speechSynthesis) {
            return;
        }
        
        // Cancelar fala anterior
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configurar voz em português
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        // Configurações padrão
        utterance.lang = options.lang || 'pt-BR';
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 0.8;
        
        // Falar
        speechSynthesis.speak(utterance);
    }
    
    function loadVoices() {
        const voices = speechSynthesis.getVoices();
        
        // Procurar voz em português brasileiro
        preferredVoice = voices.find(voice => 
            voice.lang === 'pt-BR'
        ) || voices.find(voice => 
            voice.lang.startsWith('pt')
        ) || voices[0];
        
        console.log('Voz selecionada:', preferredVoice?.name || 'Padrão');
    }
    
    function toggleSpeech(enabled) {
        isSpeechEnabled = enabled;
        if (!enabled) {
            speechSynthesis.cancel();
        }
    }
    
    // ========================================
    // Detecção de Preferências
    // ========================================
    function detectUserPreferences() {
        // Movimento reduzido
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        
        if (prefersReducedMotion) {
            console.log('Usuário prefere movimento reduzido');
            document.body.classList.add('reduced-motion');
        }
        
        // Alto contraste
        const prefersHighContrast = window.matchMedia(
            '(prefers-contrast: high)'
        ).matches;
        
        if (prefersHighContrast) {
            console.log('Usuário prefere alto contraste');
            document.body.classList.add('high-contrast');
        }
        
        // Esquema de cores (dark mode)
        const prefersDarkMode = window.matchMedia(
            '(prefers-color-scheme: dark)'
        ).matches;
        
        if (prefersDarkMode) {
            console.log('Usuário prefere modo escuro');
            // Implementar dark mode no futuro
        }
    }
    
    // ========================================
    // Melhorias de Navegação por Teclado
    // ========================================
    function enhanceKeyboardNavigation() {
        // Adicionar indicador visual quando navegando por teclado
        let isUsingKeyboard = false;
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                isUsingKeyboard = true;
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        document.addEventListener('mousedown', () => {
            isUsingKeyboard = false;
            document.body.classList.remove('keyboard-navigation');
        });
        
        // Melhorar navegação em grupos de checkboxes e radios
        enhanceCheckboxNavigation();
        enhanceRadioNavigation();
    }
    
    function enhanceCheckboxNavigation() {
        const checkboxGroups = document.querySelectorAll('.checkbox-group');
        
        checkboxGroups.forEach(group => {
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            
            checkboxes.forEach((checkbox, index) => {
                checkbox.addEventListener('keydown', (e) => {
                    // Setas para navegar entre checkboxes
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const next = checkboxes[index + 1] || checkboxes[0];
                        next.focus();
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prev = checkboxes[index - 1] || checkboxes[checkboxes.length - 1];
                        prev.focus();
                    }
                });
                
                // Feedback sonoro ao marcar/desmarcar
                checkbox.addEventListener('change', (e) => {
                    const label = checkbox.nextElementSibling;
                    const text = label ? label.textContent : 'Opção';
                    const action = checkbox.checked ? 'marcado' : 'desmarcado';
                    speak(`${text} ${action}`, { rate: 1.2, volume: 0.5 });
                });
            });
        });
    }
    
    function enhanceRadioNavigation() {
        const radioGroups = document.querySelectorAll('.radio-group');
        
        radioGroups.forEach(group => {
            const radios = group.querySelectorAll('input[type="radio"]');
            
            radios.forEach((radio, index) => {
                // Feedback sonoro ao selecionar
                radio.addEventListener('change', (e) => {
                    const label = radio.nextElementSibling;
                    const text = label ? label.textContent : 'Opção';
                    speak(`${text} selecionado`, { rate: 1.2, volume: 0.5 });
                });
            });
        });
    }
    
    // ========================================
    // Melhorias de Indicadores de Foco
    // ========================================
    function enhanceFocusIndicators() {
        // Adicionar classe ao elemento focado para melhor controle
        document.addEventListener('focusin', (e) => {
            e.target.classList.add('has-focus');
        });
        
        document.addEventListener('focusout', (e) => {
            e.target.classList.remove('has-focus');
        });
    }
    
    // ========================================
    // Anúncios para Leitores de Tela
    // ========================================
    function announceToScreenReader(message, priority = 'polite') {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        // Remover após anúncio
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
    
    // ========================================
    // Utilitários de Acessibilidade
    // ========================================
    function setPageTitle(title) {
        document.title = title;
        announceToScreenReader(`Página: ${title}`);
    }
    
    function focusElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.focus();
            // Scroll suave até o elemento
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }
    
    // ========================================
    // Testes de Acessibilidade
    // ========================================
    function runAccessibilityTests() {
        console.group('Testes de Acessibilidade');
        
        // Verificar elementos sem labels
        const inputsWithoutLabels = Array.from(
            document.querySelectorAll('input, select, textarea')
        ).filter(input => {
            const id = input.id;
            if (!id) return true;
            const label = document.querySelector(`label[for="${id}"]`);
            return !label && !input.getAttribute('aria-label');
        });
        
        if (inputsWithoutLabels.length > 0) {
            console.warn('Elementos sem label:', inputsWithoutLabels);
        } else {
            console.log('✓ Todos os elementos têm labels');
        }
        
        // Verificar imagens sem alt
        const imagesWithoutAlt = Array.from(
            document.querySelectorAll('img')
        ).filter(img => !img.alt);
        
        if (imagesWithoutAlt.length > 0) {
            console.warn('Imagens sem alt:', imagesWithoutAlt);
        } else {
            console.log('✓ Todas as imagens têm texto alternativo');
        }
        
        // Verificar botões sem texto
        const buttonsWithoutText = Array.from(
            document.querySelectorAll('button')
        ).filter(btn => 
            !btn.textContent.trim() && !btn.getAttribute('aria-label')
        );
        
        if (buttonsWithoutText.length > 0) {
            console.warn('Botões sem texto:', buttonsWithoutText);
        } else {
            console.log('✓ Todos os botões têm texto ou aria-label');
        }
        
        // Verificar contraste (básico)
        console.log('Para testes completos de contraste, use ferramentas como WAVE ou axe DevTools');
        
        console.groupEnd();
    }
    
    // ========================================
    // Interface Pública
    // ========================================
    return {
        init,
        speak,
        toggleSpeech,
        announceToScreenReader,
        setPageTitle,
        focusElement,
        runAccessibilityTests
    };
})();

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', accessibility.init);
} else {
    accessibility.init();
}

// Expor globalmente
window.accessibility = accessibility;

// Adicionar estilos para screen reader only
const style = document.createElement('style');
style.textContent = `
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    }
    
    .keyboard-navigation *:focus {
        outline: 3px solid #2563eb !important;
        outline-offset: 2px !important;
    }
`;
document.head.appendChild(style);
