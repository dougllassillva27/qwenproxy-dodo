# 🔀 Manual de Merge Dodo — QwenProxy

> **Versão:** 1.0 · **Atualizado em:** 20/08/2026  
> **Objetivo:** Garantir que nenhuma blindagem Dodo seja perdida ao integrar atualizações do upstream.

---

## 📖 Índice

1. [O Problema e a Solução](#1-o-problema-e-a-solução)
2. [Visão Geral da Estratégia](#2-visão-geral-da-estratégia)
3. [Setup Inicial — Fazer Uma Única Vez](#3-setup-inicial--fazer-uma-única-vez)
4. [Fluxo de Atualização — Passo a Passo](#4-fluxo-de-atualização--passo-a-passo)
5. [Resolvendo Conflitos Git](#5-resolvendo-conflitos-git)
6. [Checklist de Sobrevivência Pós-Merge](#6-checklist-de-sobrevivência-pós-merge)
7. [Rollback de Emergência](#7-rollback-de-emergência)
8. [Referência Rápida de Comandos](#8-referência-rápida-de-comandos)

---

## 1. O Problema e a Solução

### ❌ Como era antes

Cada atualização do upstream era um processo manual:
- Baixar os arquivos novos
- Comparar visualmente arquivo por arquivo
- Tentar lembrar/reler o histórico de blindagens e reinjetar tudo na mão
- Alta chance de esquecer algo → funcionalidade perdida → remendo pós-update

### ✅ Como é agora

Utilizamos uma **estratégia de dois branches Git**:

| Branch | Dono | Descrição |
|--------|------|-----------|
| `upstream` | Código do dono do projeto | Recebe o upstream puro, **nunca editamos aqui** |
| `main` | Nosso código de produção | Tem TODAS as blindagens Dodo, é o branch que roda |

Quando chega um update: fazemos `git merge upstream` no `main`.  
O Git mostra **somente os conflitos reais** — os pontos onde o upstream tocou em algo que também customizamos.  
Isso transforma horas de comparação manual em minutos de revisão focada.

---

## 2. Visão Geral da Estratégia

```
[Upstream Original]
       │
       │ (novo release)
       ▼
[branch: upstream] ── espelho limpo, sem toques Dodo
       │
       │ git merge upstream
       ▼
[branch: main] ── produção com TODAS as blindagens
       │
       │ (é daqui que o Proxy Launcher roda)
       ▼
[Servidor em Produção]
```

**Regra de ouro:** Nunca edite código no branch `upstream`. Ele deve sempre ser idêntico ao código que o dono do projeto entregou.

---

## 3. Setup Inicial — Fazer Uma Única Vez

Caso o branch `upstream` local ainda não exista no repositório:

```powershell
# Cria o branch upstream a partir do commit base
git branch upstream
```

---

## 4. Fluxo de Atualização — Passo a Passo

> Este é o fluxo que você seguirá **a cada nova atualização** do upstream.

---

### 🔵 ETAPA 1 — Atualizar o branch `upstream` com a versão nova

Você baixou os arquivos do upstream novo na pasta `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy`.

```powershell
# 1. Vai para o branch espelho limpo
git checkout upstream

# 2. Copia os arquivos novos por cima (exclui o que não deve vir do upstream)
robocopy "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy" "." /E /XD ".git" "node_modules" "data" "qwen_profiles" "data-test" "_contexto-ia" "docs" /XF ".env" "resumo-de-trabalho.md"

# 3. Veja o que mudou
git status
git diff --stat HEAD

# 4. Commita a versão upstream limpa
git add -A
git commit -m "upstream: atualização vX.X.X (DD/MM/AAAA)"
```

---

### 🟢 ETAPA 2 — Mergear no `main`

```powershell
# 1. Volta para produção
git checkout main

# 2. Inicia o merge
git merge upstream
```

**Cenário A — Merge limpo (sem conflitos):**
```
Merge made by the 'ort' strategy.
 package.json | 2 +-
```
O Git conseguiu integrar tudo automaticamente. Pule para a Etapa 3.

**Cenário B — Conflitos detectados:**
```
CONFLICT (content): Merge conflict in src/services/playwright.ts
Automatic merge failed; fix conflicts and then commit the result.
```
Vá para a [Seção 5 — Resolvendo Conflitos](#5-resolvendo-conflitos-git).

---

### 🟡 ETAPA 3 — Checklist de Sobrevivência

Mesmo em merges limpos, **sempre verifique** os pontos críticos. Ver [Seção 6](#6-checklist-de-sobrevivência-pós-merge).

---

### ✅ ETAPA 4 — Finalizar e registrar

```powershell
# Commita o merge (se ainda não foi commitado)
git add -A
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"

# Envia para o remoto
git push origin main

# Instala dependências novas se o package.json mudou
npm install
```

---

## 5. Resolvendo Conflitos Git

Quando há conflitos, o Git marca os arquivos com blocos como este:

```typescript
<<<<<<< main
  // 🛡️ BLINDAGEM DODO: Cache SQLite limitado a 8MB
  db.pragma("cache_size = -8000");
=======
  // Upstream: cache padrão
  db.pragma("cache_size = -64000");
>>>>>>> upstream
```

### Como resolver:

1. **Abra o arquivo** no VS Code / editor
2. **Leia os dois lados** — o `main` (nosso) e o `upstream` (deles)
3. **Decida o que fica:**
   - Se for uma blindagem Dodo → **Accept Current Change** (mantém o nosso)
   - Se for funcionalidade nova que não colide → **Accept Incoming Change** (pega o upstream)
   - Se precisamos de ambos → **Accept Both Changes** e ajuste manualmente
4. Salva o arquivo

### Após resolver todos os conflitos:

```powershell
# Verifica se ainda tem arquivos em conflito
git diff --check

# Adiciona os arquivos resolvidos e commita
git add -A
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
```

---

## 6. Checklist de Sobrevivência Pós-Merge

> Execute após **todo merge**, mesmo que tenha sido limpo (sem conflitos).  
> Conflitos limpos não significam que o merge foi semanticamente correto.

---

### ☑️ 1. Cache SQLite Reduzido — `src/core/database.ts` ou `src/database.ts`

```powershell
grep -rn "cache_size" src/
```
**Deve retornar:** `-8000` (8MB de cache).

---

### ☑️ 2. Limite de RAM Playwright — `src/services/playwright.ts` ou `src/browser-manager.ts`

```powershell
grep -rn "max-old-space-size" src/
```
**Deve conter a flag `--js-flags=--max-old-space-size=256` (ou `128`) no Chromium launch.**

---

### ☑️ 3. Bloqueio de Mídia / Imagens — `src/services/playwright.ts`

```powershell
grep -rn "route.abort" src/
```
**Deve existir o bloqueio de requisições de mídia/imagem para economizar banda e RAM.**

---

### ☑️ 4. Idle Context Cleaner — Gerenciamento de Ociosidade

```powershell
grep -rn "startIdleContextMonitor|idleContext" src/
```
**Deve retornar a rotina que fecha contextos inativos após 15 minutos.**

---

### ☑️ 5. Resolução de Captcha com Fallback Vision — `src/services/captcha-solver.ts`

```powershell
grep -rn "captcha" src/services/
```
**Deve conter o fallback resiliente de resolução de captcha.**

---

### ☑️ 6. Otimização de Garbage Collection nos Buffers de Reasoning

```powershell
grep -rn "_reasoningChunks|reasoningChunks" src/
```
**Deve utilizar arrays (`.push()` / `.join("")`) em vez de concatenação contínua de strings.**

---

### ☑️ 7. Uploads via Streams Web — `src/services/upload.ts`

```powershell
grep -rn "putStream|Readable.fromWeb" src/
```
**Deve manter o stream direto para o OSS sem carregar buffers inteiros na RAM.**

---

## 7. Rollback de Emergência

```powershell
# Ver histórico recente
git log --oneline -10

# Voltar para o commit anterior ao merge (substitua HASH)
git reset --hard HASH

# Empurrar o rollback para o remoto (se necessário)
git push origin main --force
```

---

## 8. Referência Rápida de Comandos

### Fluxo de update completo (resumo executivo)

```powershell
# 1. Atualiza espelho upstream
git checkout upstream
robocopy "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy" "." /E /XD ".git" "node_modules" "data" "qwen_profiles" "data-test" "_contexto-ia" "docs" /XF ".env" "resumo-de-trabalho.md"
git add -A; git commit -m "upstream: vX.X.X"

# 2. Mergea na produção
git checkout main
git merge upstream

# 3. Resolve conflitos (se houver) → ver Seção 5

# 4. Executa checklist → ver Seção 6

# 5. Finaliza
git add -A; git commit -m "merge: vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
git push origin main
npm install
```

---

> 📌 **Lembre-se:** O histórico de trabalho e customizações do `qwenproxy` está registrado em `resumo-de-trabalho.md`. Este guia define **como** executar os merges mantendo a integridade do sistema.
