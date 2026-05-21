# SERVIDOR MCP — Boletim de Notícias

**Projeto:** Sistema de Boletim de Notícias  
**Arquivo:** `servidor_mcp.py`  
**Localização:** raiz do projeto (`~/Projetos/Docker/boletim-noticias/`)  
**Versão:** 1.0  
**Data:** Maio 2026  

---

## Visão Geral

O `servidor_mcp.py` é uma camada MCP (Model Context Protocol) construída sobre o backend FastAPI existente do Boletim de Notícias. Ele expõe as funcionalidades do sistema como **primitivos MCP** — Tools, Resources e Prompts — permitindo que hosts compatíveis (Claude Code, Claude Desktop) interajam com o sistema via linguagem natural.

O servidor **não substitui** o backend FastAPI nem o frontend Nginx. Ele convive com ambos como uma terceira interface de acesso ao sistema.

```
Host MCP (Claude Code)
        ↓ stdio
servidor_mcp.py          ← este arquivo
        ↓ HTTP (porta 8000)
FastAPI / Docker
        ↓
GNews → Groq → ElevenLabs/gTTS → áudio
```

---

## Arquitetura

### Transporte

O servidor opera em dois modos, configuráveis via variável de ambiente:

| Variável | Valor | Modo |
|---|---|---|
| `TRANSPORT` | `stdio` (padrão) | Local — uso com Claude Code |
| `TRANSPORT` | `sse` | HTTP remoto — deploy no Render ou outro host |

Em modo `stdio`, o host inicia o processo Python diretamente. Em modo `sse`, o servidor expõe o endpoint `/sse` na porta definida pela variável `PORT`.

### Dependências

```
fastmcp
httpx
python-dotenv
```

Instalação com `uv`:

```bash
uv add fastmcp httpx python-dotenv
```

### Variáveis de ambiente (`.env`)

```
BOLETIM_API_URL=http://localhost:8000   # URL base do FastAPI
TRANSPORT=stdio                          # stdio ou sse
PORT=8001                                # porta HTTP (apenas modo sse)
```

---

## Configuração do Host

### Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "boletim-noticias": {
      "command": "/home/fabricio/Projetos/Docker/boletim-noticias/.venv/bin/python",
      "args": ["/home/fabricio/Projetos/Docker/boletim-noticias/servidor_mcp.py"]
    }
  }
}
```

### Verificar conexão

```bash
cd ~/Projetos/Docker/boletim-noticias
claude
/mcp
```

Saída esperada:
```
Capabilities: tools · resources · prompts
Tools: 6 tools
```

---

## Primitivos

### Tools (6)

Tools são funções executáveis que a IA chama autonomamente com base nas docstrings. A IA decide quando e como chamá-las a partir da conversa em linguagem natural.

---

#### `verificar_api`

Verifica se o sistema está online e retorna o status de cada serviço configurado.

**Parâmetros:** nenhum

**Retorno:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-20T15:30:00",
  "tts_engine": "gtts",
  "summary_mode": "groq",
  "gnews_configurado": true,
  "elevenlabs_configurado": true,
  "groq_configurado": true
}
```

**Quando usar:** antes de gerar boletins, para diagnóstico de problemas, quando o usuário perguntar se o sistema está funcionando.

---

#### `gerar_boletim`

Executa a pipeline completa: busca notícias no GNews, sumariza com Groq (se configurado), sintetiza o áudio com ElevenLabs ou gTTS, e salva no histórico.

**Parâmetros:**

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `categorias` | `list[str]` | `["geral"]` | Categorias do GNews |
| `num_artigos` | `int` | `10` | Número de notícias |
| `estilo` | `str` | `"jornalistico"` | Estilo do roteiro |
| `motor_tts` | `str` | `"gtts"` | `"gtts"` ou `"elevenlabs"` |
| `modo_resumo` | `str` | `"none"` | `"none"` ou `"groq"` |

**Categorias disponíveis:** `geral`, `esportes`, `tecnologia`, `politica`, `economia`, `saude`, `ciencia`, `mundo`, `entretenimento`

**Retorno:**
```json
{
  "id": 154,
  "audio": "boletim_20260520_160000.mp3",
  "categorias": "tecnologia",
  "texto_preview": "Primeiros 300 caracteres...",
  "status": "boletim gerado com sucesso"
}
```

**Quando usar:** quando o usuário pedir para gerar, criar ou produzir um boletim.

---

#### `regenerar_audio`

Gera um novo arquivo de áudio a partir de um texto fornecido, sem buscar novas notícias.

**Parâmetros:**

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `texto` | `str` | obrigatório | Texto a ser narrado |
| `motor_tts` | `str` | `"gtts"` | `"gtts"` ou `"elevenlabs"` |

**Retorno:**
```json
{
  "audio": "boletim_20260520_161000.mp3",
  "url": "/api/download/boletim_20260520_161000.mp3",
  "status": "áudio gerado com sucesso"
}
```

**Quando usar:** quando o usuário quiser ouvir um texto específico, renarrar com voz diferente, ou converter texto em fala.

---

#### `listar_historico`

Retorna todos os boletins gerados, em ordem decrescente de criação.

**Parâmetros:** nenhum

**Retorno:** lista de objetos com `id`, `data`, `categorias`, `audio` e `preview` (150 caracteres do texto).

**Quando usar:** quando o usuário perguntar sobre boletins anteriores, quiser ver o histórico ou precisar do id de um boletim.

---

#### `deletar_boletim`

Remove um boletim do banco de dados e exclui o arquivo de áudio associado do disco.

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `int` | Id do boletim a remover |

**Retorno:**
```json
{
  "success": true,
  "message": "Boletim ID 154 excluído."
}
```

**Quando usar:** quando o usuário pedir para apagar, remover ou excluir um boletim. Usar `listar_historico()` antes se o id não for conhecido.

---

#### `confirmar_audio`

Verifica via requisição HEAD se um arquivo de áudio existe e está acessível no servidor. Não baixa o arquivo.

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `filename` | `str` | Nome do arquivo MP3 |

**Retorno:**
```json
{
  "existe": true,
  "filename": "boletim_20260520_160000.mp3",
  "tamanho_bytes": "798000",
  "url": "http://localhost:8000/audio/boletim_20260520_160000.mp3",
  "status": "áudio disponível"
}
```

**Quando usar:** após gerar um boletim para validar que o áudio está disponível. Usada internamente pelo Prompt `gerar_boletim_guiado`.

---

### Resources (2)

Resources são conteúdos que a IA pode ler via URI. Não executam ações nem têm efeitos colaterais. São acessados quando a IA precisa de contexto ou quando o usuário referencia explicitamente o resource.

---

#### `categorias://disponiveis`

Retorna a lista de categorias de notícias disponíveis no sistema.

**URI:** `categorias://disponiveis`

**Tipo:** estático

**Conteúdo:** texto descritivo com as 6 categorias principais e suas descrições.

**Quando é usado:** quando o usuário não especifica uma categoria e a IA precisa sugerir opções; quando o host não tem acesso ao código-fonte do projeto.

---

#### `boletim://{id}/texto`

Retorna o texto completo de um boletim específico do histórico.

**URI:** `boletim://{id}/texto` — onde `{id}` é o identificador numérico do boletim.

**Tipo:** dinâmico (template de URI)

**Exemplos de URI:** `boletim://154/texto`, `boletim://42/texto`

**Conteúdo:** texto integral do boletim conforme salvo no banco de dados.

**Quando é usado:** quando o usuário quer reler, analisar ou reprocessar o conteúdo de um boletim anterior. Usado pelo Prompt `analisar_boletim`.

---

### Prompts (3)

Prompts são templates de instrução que o host injeta na conversa ao serem invocados. Eles padronizam fluxos e comportamentos, evitando que o usuário precise repetir instruções complexas.

**Como invocar no Claude Code:**
```
/mcp__boletim-noticias__nome_do_prompt
```

---

#### `gerar_boletim_guiado`

Inicia o fluxo completo de geração com verificação prévia da API e relatório final estruturado.

**Parâmetros:**

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `categoria` | `str` | `"geral"` | Categoria do boletim |
| `num_noticias` | `int` | `5` | Número de notícias |

**Fluxo executado:**
1. `verificar_api()` — confirma que o sistema está online
2. `gerar_boletim()` — gera o boletim com os parâmetros informados
3. `confirmar_audio()` — valida que o arquivo de áudio foi criado

**Saída esperada:** tabela com id, arquivo de áudio, tamanho, categoria e prévia das manchetes.

---

#### `modo_locutor`

Configura o assistente especificamente para uso pelo locutor cego, estabelecendo o contexto e listando as capacidades disponíveis de forma clara.

**Parâmetros:** nenhum

**Comportamento:** injeta duas mensagens na conversa — uma do usuário solicitando o modo especializado e uma resposta do assistente confirmando as capacidades disponíveis.

**Quando usar:** no início de uma sessão de trabalho com o sistema de boletins.

---

#### `analisar_boletim`

Instrui a IA a ler o texto completo de um boletim e produzir uma análise estruturada.

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `int` | Id do boletim a analisar |

**Resource usado internamente:** `boletim://{id}/texto`

**Saída esperada:**
- Resumo em 2 frases
- Tabela com os principais temas abordados
- Estimativa de duração de leitura em voz alta (130 palavras/minuto)

---

## Tratamento de Erros

Todas as tools retornam mensagens de erro descritivas em vez de levantar exceções. Isso permite que a IA comunique o problema ao usuário e sugira ações corretivas.

| Situação | Retorno |
|---|---|
| Docker não está rodando | `"Não foi possível conectar à API. Verifique se o Docker está rodando."` |
| API retornou erro HTTP | `"API retornou status 404: ..."` |
| Id não encontrado | `"Boletim id=999 não encontrado."` |
| Texto vazio | `"O texto não pode ser vazio."` |
| Arquivo de áudio não existe | `"Arquivo não encontrado (status 404)"` |

---

## Segurança

### `.claudeignore`

O arquivo `.claudeignore` na raiz do projeto impede que o Claude Code acesse conteúdo sensível ou irrelevante:

```
.env
.env.*
/audio
/audio/**
/data
/data/**
/.venv
__pycache__/
*.db
*.tar.gz
```

### Credenciais

As chaves de API ficam no `.env` da raiz do projeto e são lidas via `load_dotenv()`. O `.env` está listado no `.gitignore` e no `.claudeignore`.

**Nunca commitar credenciais no repositório.**

---

## Deploy Remoto (Render)

Para expor o servidor via HTTP e permitir acesso de qualquer máquina:

**1. Configure o `.env`:**
```
TRANSPORT=sse
PORT=8001
```

**2. No `docker-compose.yml`, adicione o serviço MCP:**
```yaml
mcp:
  build: .
  command: python servidor_mcp.py
  ports:
    - "8001:8001"
  environment:
    - TRANSPORT=sse
    - PORT=8001
    - BOLETIM_API_URL=http://api:8000
```

**3. Atualize o `.mcp.json` para URL remota:**
```json
{
  "mcpServers": {
    "boletim-noticias": {
      "url": "https://boletim-mcp.onrender.com/sse"
    }
  }
}
```

---

## Referência Rápida

| Primitivo | Nome | Tipo | Descrição curta |
|---|---|---|---|
| Tool | `verificar_api` | ação | Status do sistema |
| Tool | `gerar_boletim` | ação | Pipeline completa |
| Tool | `regenerar_audio` | ação | Texto → áudio |
| Tool | `listar_historico` | ação | Histórico de boletins |
| Tool | `deletar_boletim` | ação | Remove boletim e áudio |
| Tool | `confirmar_audio` | ação | Valida existência do MP3 |
| Resource | `categorias://disponiveis` | leitura | Lista de categorias |
| Resource | `boletim://{id}/texto` | leitura | Texto completo por id |
| Prompt | `gerar_boletim_guiado` | workflow | Fluxo completo guiado |
| Prompt | `modo_locutor` | workflow | Modo especializado |
| Prompt | `analisar_boletim` | workflow | Análise estruturada |

---

## Histórico de Versões

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | Mai 2026 | Versão inicial — 6 tools, 2 resources, 3 prompts |
