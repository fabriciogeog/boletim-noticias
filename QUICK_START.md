# 🚀 Guia Rápido de Início

## Instalação em 3 Passos

### 1️⃣ Clone e Entre no Diretório
```bash
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias
```

### 2️⃣ Execute o Setup Automático
```bash
chmod +x setup.sh
./setup.sh
```

### 3️⃣ Acesse o Sistema
Abra no navegador: **http://localhost:3000**

---

## 📖 Primeiro Uso

### Gerando Seu Primeiro Boletim

1. **Selecione Categorias**
   - Marque: ☑ Geral, ☑ Política

2. **Configure Opções**
   - Número de notícias: **8**
   - Estilo: **Jornalístico**
   - ☑ Incluir Introdução
   - ☑ Incluir Encerramento

3. **Gere o Boletim**
   - Clique em "Gerar Boletim" ou pressione `Ctrl+Enter`
   - Aguarde ~30-60 segundos

4. **Revise e Edite**
   - Leia o texto gerado
   - Se necessário, clique em "Editar Texto" (`Ctrl+E`)
   - Corrija nomes, siglas, etc.

5. **Baixe o Áudio**
   - Ouça o preview
   - Clique em "Baixar Áudio" (`Ctrl+D`)
   - Use o MP3 em seu programa!

---

## ⌨️ Atalhos Essenciais

| Atalho | Ação |
|--------|------|
| `Ctrl+Enter` | Gerar boletim |
| `Ctrl+E` | Editar texto |
| `Ctrl+D` | Baixar áudio |
| `Tab` | Navegar |

---

## 🎛️ Comandos Úteis

```bash
make logs          # Ver o que está acontecendo
make stop          # Parar sistema
make start         # Iniciar sistema
make restart       # Reiniciar
make status        # Ver status
```

---

## ❓ Problemas Comuns

### "API não responde"
```bash
make logs-api      # Ver logs
make restart       # Reiniciar
```

### "Ollama não funciona"
```bash
make setup-ollama  # Baixar modelo
make logs-ollama   # Ver logs
```

### "Porta em uso"
Edite `docker-compose.yml` e mude as portas:
```yaml
ports:
  - "3001:80"      # Era 3000
  - "8001:8000"    # Era 8000
```

---

## 💡 Dicas

1. **Primeira geração é mais lenta** (Ollama carrega modelo)
2. **Edite siglas antes de gerar áudio** (STF → Supremo Tribunal Federal)
3. **Use 5-8 notícias** para boletim de ~3-5 minutos
4. **Salve boletins importantes** (clique em Histórico)

---

## 🆘 Precisa de Ajuda?

1. Veja logs: `make logs`
2. Consulte o README.md completo
3. Abra uma issue no GitHub

---

## ✨ Pronto!

Seu sistema está configurado e pronto para uso!

**Próximo passo**: Gere seu primeiro boletim! 📻
