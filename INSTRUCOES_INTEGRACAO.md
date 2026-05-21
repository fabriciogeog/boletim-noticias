# Instruções de Integração — Interface de Comandos

## O que foi gerado

Três arquivos para adicionar a interface de comandos ao frontend existente,
sem alterar nada do que já funciona.

---

## Passo 1 — CSS

Abra `frontend/src/css/styles.css` e adicione o conteúdo de
`comandos_adicionar_ao_styles.css` ao **final do arquivo**.

---

## Passo 2 — HTML

Abra `frontend/src/index.html` e localize este trecho:

```html
        <!-- Audio Player -->
        <section class="player-section" ...>
            ...
        </section>

        <!-- Categories -->
        <section class="categories">
```

Insira o conteúdo de `comandos_inserir_no_index.html` **entre** o fechamento
do `</section>` do player e o `<section class="categories">`.

Resultado esperado:

```html
        </section>  ← fim do player

        <!-- INTERFACE DE COMANDOS (novo) -->
        <section class="comando-section" ...>
            ...
        </section>

        <!-- Categories (existente) -->
        <section class="categories">
```

---

## Passo 3 — JavaScript

Abra `frontend/src/js/app.js` e adicione o conteúdo de
`comandos_adicionar_ao_app.js` ao **final do arquivo**.

---

## Passo 4 — Testar

```bash
# Na raiz do projeto boletim-noticias:
docker compose restart frontend

# Acesse no browser (ou smartphone na rede local):
http://192.168.15.23:3001
```

---

## Comandos disponíveis

| Comando | Exemplo | O que faz |
|---|---|---|
| `gerar [categoria] [n]` | `gerar tecnologia 5` | Gera boletim |
| `gerar [cat1] [cat2] [n]` | `gerar esportes politica 3` | Múltiplas categorias |
| `historico` | `historico` | Lista boletins com botão apagar |
| `apagar [id]` | `apagar 154` | Remove boletim e áudio |
| `audio [texto]` | `audio Bom dia ouvintes` | Converte texto em fala |
| `status` | `status` | Verifica se o sistema está online |
| `limpar` | `limpar` | Limpa a tela |
| `ajuda` | `ajuda` | Lista os comandos |

---

## Acessibilidade

- Campo com `aria-label` descritivo para TalkBack/NVDA
- Feedback com `aria-live="polite"` — lido automaticamente pelo leitor de tela
- Enter executa o comando — sem necessidade de clicar no botão
- Esc fecha os painéis auxiliares
- Histórico com botões "Apagar" individualmente acessíveis por teclado
