// ================================================
// BOLETIM ON AIR — app.js
// Interface unificada com Assistente IA
// ================================================

'use strict';

// ── CONFIGURAÇÃO ─────────────────────────────────
const API_BASE     = 'http://192.168.15.23:8000';
const CHAT_URL     = '/chat';
const STATUS_URL   = '/llm-status';
const LIMITE_HIST  = 10;   // pares de mensagens antes do aviso

// ── ESTADO ───────────────────────────────────────
let historicoIA   = [];   // [{role, content}]
let playerAtivo   = null; // referência ao audio element ativo

// ── ELEMENTOS ────────────────────────────────────
const elMessages      = document.getElementById('messages');
const elChatInput     = document.getElementById('chatInput');
const elBtnEnviar     = document.getElementById('btnEnviar');
const elBtnLimpar     = document.getElementById('btnLimpar');
const elBtnConfig     = document.getElementById('btnConfig');
const elBtnFechar     = document.getElementById('btnFecharSidebar');
const elBtnLimparSide = document.getElementById('btnLimparSidebar');
const elSidebar       = document.getElementById('sidebar');
const elOverlay       = document.getElementById('sidebarOverlay');
const elStatusDot     = document.getElementById('statusDot');
const elStatusTexto   = document.getElementById('statusTexto');
const elInputAviso    = document.getElementById('inputAviso');
const elLoading       = document.getElementById('loadingOverlay');
const elBtnSalvar     = document.getElementById('btnSalvar');
const elBtnZoomIn    = document.getElementById('btnZoomIn');
const elBtnZoomOut   = document.getElementById('btnZoomOut');
const elInfoModelo    = document.getElementById('infoModelo');

// Config inputs
const elTtsEngine    = document.getElementById('ttsEngine');
const elElevenKey    = document.getElementById('elevenLabsKey');
const elSummaryMode  = document.getElementById('summaryMode');
const elGroqKey      = document.getElementById('groqKey');
const elGnewsKey     = document.getElementById('gnewsKey');

// ── INICIALIZAÇÃO ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  verificarStatus();
  carregarConfig();
  iniciarZoom();
  elChatInput.focus();
});

// ── EVENT LISTENERS ───────────────────────────────
function setupEventListeners() {
  // Envio de mensagem
  elBtnEnviar.addEventListener('click', enviarMensagem);
  elChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });

  // Auto-resize do textarea
  elChatInput.addEventListener('input', () => {
    elChatInput.style.height = 'auto';
    elChatInput.style.height = Math.min(elChatInput.scrollHeight, 120) + 'px';
  });

  // Sidebar
  elBtnConfig.addEventListener('click', abrirSidebar);
  elBtnFechar.addEventListener('click', fecharSidebar);
  elOverlay.addEventListener('click', fecharSidebar);

  // Limpar conversa
  elBtnLimpar.addEventListener('click', confirmarLimpar);
  elBtnLimparSide.addEventListener('click', confirmarLimpar);

  // Salvar config
  elBtnSalvar.addEventListener('click', salvarConfig);

  // Escape fecha sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharSidebar();
  });

  // Zoom
  if (elBtnZoomIn)  elBtnZoomIn.addEventListener('click', () => {
    const atual = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--zoom') || '1');
    aplicarZoom(Math.round((atual + 0.1) * 10) / 10);
  });
  if (elBtnZoomOut) elBtnZoomOut.addEventListener('click', () => {
    const atual = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--zoom') || '1');
    aplicarZoom(Math.round((atual - 0.1) * 10) / 10);
  });
}

// ── STATUS DO SISTEMA ─────────────────────────────
async function verificarStatus() {
  try {
    const [rStatus, rConfig] = await Promise.all([
      fetch(STATUS_URL, { signal: AbortSignal.timeout(5000) }),
      fetch('/api/config', { signal: AbortSignal.timeout(5000) }).catch(() => null)
    ]);
    const d = await rStatus.json();
    const c = rConfig?.ok ? await rConfig.json() : {};
    const online = d.api_boletim === 'online';

    elStatusDot.className   = 'status-dot ' + (online ? 'online' : 'offline');
    elStatusTexto.textContent = online
      ? `${d.modelo || '...'} · online`
      : 'API offline';

    if (elInfoModelo) {
      const ttsLabel     = { gtts: 'Google TTS', elevenlabs: 'ElevenLabs' }[c.TTS_ENGINE] || c.TTS_ENGINE || '—';
      const resumoLabel  = { groq: 'Groq (Llama)', local: 'Ollama local', none: 'Sem resumo' }[c.AI_SUMMARY_MODE] || c.AI_SUMMARY_MODE || '—';
      elInfoModelo.innerHTML = `
        <strong>Modelo chat: ${d.modelo || '—'}</strong>
        Modo LLM: ${d.llm_modo || '—'}<br>
        ${d.tools ? d.tools.length : 0} ferramentas disponíveis<br>
        API Boletim: ${online ? '✓ online' : '✗ offline'}<br>
        <br>
        <strong>Configuração do boletim:</strong><br>
        Voz: ${ttsLabel}<br>
        Resumo IA: ${resumoLabel}
      `;
    }
  } catch {
    elStatusDot.className   = 'status-dot offline';
    elStatusTexto.textContent = 'Assistente offline';
    if (elInfoModelo) {
      elInfoModelo.innerHTML = '<strong>Não disponível</strong>Verifique se interface_locutor.py está rodando.';
    }
  }
}

// ── RENDERIZAÇÃO DE MENSAGENS ─────────────────────
function adicionarMsg(role, conteudo) {
  const wrap = document.createElement('div');
  wrap.className = `msg msg-${role}`;

  if (role === 'user' || role === 'ai') {
    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = role === 'user' ? 'Você' : 'Assistente';
    wrap.appendChild(label);
  }

  if (role === 'waiting') {
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = '<span class="dot-anim"></span><span class="dot-anim"></span><span class="dot-anim"></span>';
    wrap.appendChild(bubble);
    elMessages.appendChild(wrap);
    elMessages.scrollTop = elMessages.scrollHeight;
    return wrap;
  }

  if (typeof conteudo === 'string') {
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = conteudo;
    wrap.appendChild(bubble);
  } else {
    // conteudo é um elemento DOM (card de boletim)
    wrap.appendChild(conteudo);
  }

  elMessages.appendChild(wrap);
  elMessages.scrollTop = elMessages.scrollHeight;
  return wrap;
}

// ── CARD DE BOLETIM ───────────────────────────────
function criarCardBoletim(id, filename, texto, categorias) {
  const cardId = `card-${Date.now()}`;

  const card = document.createElement('div');
  card.className = 'card-boletim';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `Boletim gerado ID ${id}`);

  // Header
  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `<span>📻 Boletim #${id || '—'}</span><span>${categorias || ''}</span>`;
  card.appendChild(header);

  // Texto guardado no dataset para o botão copiar (não exibido — já aparece na bolha)
  card.dataset.texto = texto || '';

  // Player
  if (filename) {
    const audioUrl = `/audio/${filename}?t=${Date.now()}`;
    const audio    = document.createElement('audio');
    audio.src      = audioUrl;
    audio.preload  = 'metadata';

    const playerDiv = document.createElement('div');
    playerDiv.className = 'card-player';

    const playBtn = document.createElement('button');
    playBtn.className   = 'play-btn';
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play/Pause');

    const progressWrap = document.createElement('div');
    progressWrap.className = 'player-progress-wrap';

    const bar = document.createElement('div');
    bar.className = 'player-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');

    const fill = document.createElement('div');
    fill.className = 'player-fill';
    bar.appendChild(fill);

    const time = document.createElement('div');
    time.className = 'player-time';
    time.innerHTML = '<span class="cur">0:00</span><span class="dur">0:00</span>';

    progressWrap.appendChild(bar);
    progressWrap.appendChild(time);

    const dlBtn = document.createElement('button');
    dlBtn.className = 'download-btn';
    dlBtn.textContent = '⬇';
    dlBtn.setAttribute('aria-label', 'Download do áudio');

    playerDiv.appendChild(playBtn);
    playerDiv.appendChild(progressWrap);
    playerDiv.appendChild(dlBtn);
    playerDiv.appendChild(audio);
    card.appendChild(playerDiv);

    // Eventos do player
    playBtn.addEventListener('click', () => {
      if (playerAtivo && playerAtivo !== audio) {
        playerAtivo.pause();
      }
      if (audio.paused) {
        audio.play();
        playBtn.textContent = '⏸';
        playerAtivo = audio;
      } else {
        audio.pause();
        playBtn.textContent = '▶';
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      time.querySelector('.dur').textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
      time.querySelector('.cur').textContent = formatTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      playBtn.textContent = '▶';
      fill.style.width = '0%';
    });

    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const pct  = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * audio.duration;
    });

    dlBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href     = audioUrl;
      a.download = filename;
      a.click();
    });
  }

  // Botão copiar
  const acoes = document.createElement('div');
  acoes.className = 'card-acoes';

  const btnCopiar = document.createElement('button');
  btnCopiar.className = 'btn-copiar';
  btnCopiar.innerHTML = '📋 Copiar texto';
  btnCopiar.setAttribute('aria-label', 'Copiar texto do boletim para a área de transferência');

  btnCopiar.addEventListener('click', async () => {
    const t = card.dataset.texto || '';
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(t);
      } else {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      btnCopiar.innerHTML = '✓ Copiado!';
      btnCopiar.classList.add('copiado');
      setTimeout(() => {
        btnCopiar.innerHTML = '📋 Copiar texto';
        btnCopiar.classList.remove('copiado');
      }, 2500);
    } catch {
      btnCopiar.textContent = 'Erro ao copiar';
    }
  });

  acoes.appendChild(btnCopiar);
  card.appendChild(acoes);

  return card;
}

// ── PARSE DA RESPOSTA DO ASSISTENTE ──────────────
function parsearResposta(texto) {
  // Só renderiza player quando o assistente confirma geração de um boletim novo.
  // Evita disparar em respostas de listagem que também contêm nomes de arquivo .mp3.
  if (!texto.includes('Boletim gerado com sucesso')) return null;

  const matchFilename = texto.match(/boletim_(\d{8}_\d{6})\.mp3/);
  const matchId       = texto.match(/ID:\s*(\d+)/i);

  if (!matchFilename) return null;

  const filename   = `boletim_${matchFilename[1]}.mp3`;
  const id         = matchId ? matchId[1] : '—';

  // Extrai texto do boletim (tudo após a linha do áudio)
  const linhas = texto.split('\n');
  const idxAudio = linhas.findIndex(l => l.includes('.mp3'));
  let textoBoletim = '';
  let categorias   = '';

  if (idxAudio !== -1) {
    textoBoletim = linhas.slice(idxAudio + 1).join('\n').trim();
    // Tenta extrair categoria
    const matchCat = texto.match(/categoria[s]?[:\s]+([^\n.]+)/i);
    if (matchCat) categorias = matchCat[1].trim();
  }

  return { id, filename, texto: textoBoletim, categorias };
}

// ── ENVIO DE MENSAGEM ─────────────────────────────
async function enviarMensagem() {
  const pergunta = elChatInput.value.trim();
  if (!pergunta || elBtnEnviar.disabled) return;

  // Adiciona mensagem do usuário
  adicionarMsg('user', pergunta);
  elChatInput.value = '';
  elChatInput.style.height = 'auto';

  // Desabilita durante processamento
  elBtnEnviar.disabled = true;
  elChatInput.disabled = true;
  elLoading.removeAttribute('hidden');

  // Adiciona bolha de espera
  const aguarde = adicionarMsg('waiting', '');

  try {
    const r = await fetch(CHAT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pergunta, historico: historicoIA })
    });

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    aguarde.remove();

    const resposta = d.resposta || 'Sem resposta.';

    // Atualiza histórico
    historicoIA.push({ role: 'user',      content: pergunta  });
    historicoIA.push({ role: 'assistant', content: resposta  });

    // Aviso de contexto longo
    const pares = historicoIA.length / 2;
    if (pares >= LIMITE_HIST) {
      elInputAviso.classList.add('visivel');
      // Remove par mais antigo para manter o limite
      historicoIA = historicoIA.slice(2);
    }

    // Tenta criar card de boletim
    const boletim = parsearResposta(resposta);
    if (boletim && boletim.texto) {
      // Mostra resposta textual do assistente
      const textoSemBoletim = resposta.split('\n')
        .filter(l => !l.includes('.mp3') && !l.startsWith('ID:'))
        .join('\n').trim();

      if (textoSemBoletim) adicionarMsg('ai', textoSemBoletim);

      // Cria e adiciona o card
      const card = criarCardBoletim(boletim.id, boletim.filename, boletim.texto, boletim.categorias);
      const msgWrap = document.createElement('div');
      msgWrap.className = 'msg msg-ai';
      msgWrap.appendChild(card);
      elMessages.appendChild(msgWrap);
      elMessages.scrollTop = elMessages.scrollHeight;
    } else {
      adicionarMsg('ai', resposta);
    }

  } catch (err) {
    aguarde.remove();
    adicionarMsg('ai', 'Erro ao comunicar com o assistente. Verifique se interface_locutor.py está rodando.');
    console.error(err);
  } finally {
    elBtnEnviar.disabled = false;
    elChatInput.disabled = false;
    elLoading.setAttribute('hidden', '');
    elChatInput.focus();
  }
}

// ── SIDEBAR ───────────────────────────────────────
function abrirSidebar() {
  elSidebar.classList.add('aberta');
  elOverlay.classList.add('visivel');
  elOverlay.removeAttribute('aria-hidden');
  elBtnFechar.focus();
}

function fecharSidebar() {
  elSidebar.classList.remove('aberta');
  elOverlay.classList.remove('visivel');
  elOverlay.setAttribute('aria-hidden', 'true');
  elBtnConfig.focus();
}

// ── LIMPAR CONVERSA ───────────────────────────────
function confirmarLimpar() {
  if (!confirm('Limpar toda a conversa?')) return;
  limparConversa();
  fecharSidebar();
}

function limparConversa() {
  historicoIA = [];
  elInputAviso.classList.remove('visivel');
  elMessages.innerHTML = `
    <div class="msg msg-system">
      <div class="msg-bubble">Conversa limpa. Pronto para novas solicitações.</div>
    </div>`;
  if (playerAtivo) { playerAtivo.pause(); playerAtivo = null; }
}

// ── CONFIGURAÇÕES ─────────────────────────────────
async function carregarConfig() {
  try {
    const r = await fetch('/api/config');
    if (!r.ok) return;
    const c = await r.json();
    if (elTtsEngine   && c.TTS_ENGINE)      elTtsEngine.value   = c.TTS_ENGINE;
    if (elSummaryMode && c.AI_SUMMARY_MODE) elSummaryMode.value = c.AI_SUMMARY_MODE;
  } catch { /* silencioso */ }
}

async function salvarConfig() {
  const originalText = elBtnSalvar.textContent;
  elBtnSalvar.textContent = 'Salvando...';
  elBtnSalvar.disabled = true;

  try {
    const payload = {
      ai_summary_mode:    elSummaryMode?.value || 'none',
      tts_engine:         elTtsEngine?.value   || 'gtts',
      groq_api_key:       elGroqKey?.value     || null,
      elevenlabs_api_key: elElevenKey?.value   || null,
      gnews_api_key:      elGnewsKey?.value    || null
    };

    const r = await fetch('/api/config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (r.ok) {
      elBtnSalvar.textContent = '✓ Salvo!';
      // Atualiza o painel de info e recarrega os selects para confirmar ao usuário
      await Promise.all([verificarStatus(), carregarConfig()]);
    } else {
      elBtnSalvar.textContent = '✗ Erro';
    }
    setTimeout(() => {
      elBtnSalvar.textContent = originalText;
      elBtnSalvar.disabled    = false;
    }, 2000);
  } catch {
    elBtnSalvar.textContent = '✗ Erro de conexão';
    setTimeout(() => {
      elBtnSalvar.textContent = originalText;
      elBtnSalvar.disabled    = false;
    }, 2000);
  }
}

// ── UTILITÁRIOS ───────────────────────────────────
function formatTime(s) {
  if (isNaN(s) || s === Infinity) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── ZOOM ─────────────────────────────────────────
function iniciarZoom() {
  const salvo = parseFloat(localStorage.getItem('boletim-zoom') || '1');
  aplicarZoom(salvo);
}

function aplicarZoom(v) {
  v = Math.max(0.8, Math.min(1.6, v));
  document.documentElement.style.setProperty('--zoom', v);
  localStorage.setItem('boletim-zoom', v);

  // Feedback acessível no título dos botões
  const pct = Math.round(v * 100);
  if (elBtnZoomIn)  elBtnZoomIn.title  = `Aumentar fonte (atual: ${pct}%)`;
  if (elBtnZoomOut) elBtnZoomOut.title = `Diminuir fonte (atual: ${pct}%)`;
}

// Atualiza status a cada 60s
setInterval(verificarStatus, 60000);