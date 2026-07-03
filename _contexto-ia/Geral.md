# Relatório de Atualização e Merge Cirúrgico - QwenProxy

Este documento detalha o processo de merge cirúrgico estrito realizado para incorporar a atualização de upstream (versão mainstream `1.12.9`) à nossa versão de produção do `qwenproxy`, preservando integralmente todas as customizações, blindagens e otimizações contidas no manifesto `alterações-dodo.md`.

---

## 1. Visão Geral da Atualização do Upstream (Versão 1.12.9)
A atualização do mainstream trouxe melhorias no tratamento de streaming de deltas SSE, suporte a chamadas de ferramentas de forma mais robusta, novo teste de histórico de sessões (`session-parent-tracking`), e modularização de tratamento de prompts longos.

---

## 2. Estratégia de Merge e Integração das Blindagens do Dodo
A integração foi feita arquivo por arquivo na modalidade de **merge cirúrgico estrito**. As blindagens e regras do Dodo foram priorizadas sobre as mudanças do upstream (a regra do manifesto dita que a nova versão deve acomodar as blindagens, e não o contrário).

Abaixo estão os detalhes de cada arquivo modificado e a estratégia aplicada:

### A. Configuração e Limites Globais de Processo
*   **`.env` e `Dockerfile`**
    *   *Mudança do Upstream:* Nenhuma.
    *   *Blindagem Integrada:* Injeção da variável de ambiente `NODE_OPTIONS` limitando a memória heap da V8 para 512MB e expondo a coleta manual de lixo (`--max-old-space-size=512 --expose-gc --max-semi-space-size=16`) para evitar vazamentos de memória e sobrecarga do Garbage Collector em containers ou execução local.
*   **`package.json`**
    *   *Mudança do Upstream:* Atualizada a versão para `1.12.9`.
    *   *Integração:* Versão unificada no arquivo de produção.
*   **`tsconfig.build.json`**
    *   *Mudança do Upstream:* Arquivo recém-criado para configurar a compilação do TypeScript de forma isolada, ignorando arquivos de testes do build final.
    *   *Integração:* Copiado diretamente na raiz do projeto.
*   **`src/core/database.ts`**
    *   *Mudança do Upstream:* Ajustes na criação de conexões SQLite.
    *   *Blindagem Integrada:* Preservada a redução agressiva de cache do SQLite de 64MB para 8MB (`cache_size = -8000`), mitigando o uso excessivo de RAM no host.

### B. Otimização de Buffers e Streaming
*   **`src/utils/qwen-stream-parser.ts`**
    *   *Mudança do Upstream:* Ajustes finos no parser de deltas de streaming de raciocínio.
    *   *Blindagem Integrada:* Alterado o estado para usar um array de chunks (`reasoningChunks: string[]`) em vez da concatenação de strings original (`reasoningBuffer += chunk`). A conversão final é feita sob demanda pelo getter `reasoningBuffer`, poupando a V8 de alocações repetitivas de string na memória Heap.
*   **`src/routes/stream-handler.ts`**
    *   *Mudança do Upstream:* Controle de keep-alive em conexões de stream HTTP e processamento de payloads.
    *   *Blindagem Integrada:* Unificado o fluxo de streaming do upstream com as otimizações de Array do `_reasoningChunks` no fluxo streaming e `finalContentChunks.join('')` em respostas sem streaming.

### C. Otimização de Uploads e Segurança de Streams
*   **`src/routes/upload.ts`**
    *   *Mudança do Upstream:* Upload de arquivos para o repositório OSS oficial da Qwen.
    *   *Blindagem Integrada:* Reescrevemos o upload de arquivos para processar o multipart via stream Web nativo (`Readable.fromWeb(file.stream())`) e transferi-lo via `client.putStream` no client `ali-oss`. Isso elimina o consumo indevido de carregar o buffer do arquivo inteiro na RAM durante o upload (muito comum em uploads de mídias pesadas como vídeos de 100MB).
*   **`src/services/stream-bridge.ts`**
    *   *Mudança do Upstream:* Gerenciamento de streams obtidos de páginas Chromium.
    *   *Blindagem Integrada:* Injetado um temporizador TTL de segurança rígido de **10 minutos** (`safetyTimeout`) em `browserStreamFetch`. Ele garante que, caso uma stream ou aba do navegador perca a conexão ou trave, os callbacks e abort controllers associados sejam limpos do Garbage Collector, prevenindo vazamentos crônicos.

### D. Controle de Ciclo de Vida e Instâncias do Playwright
*   **`src/services/stealth.ts`**
    *   *Mudança do Upstream:* Scripts injetados nas páginas para contornar proteções anti-bot (Cloudflare/Baxia).
    *   *Blindagem Integrada:* A string maciça do script stealth foi isolada em uma variável singleton (`cachedStealthScript`), evitando alocações sucessivas e repetitivas de strings gigantes a cada requisição de contexto do browser.
*   **`src/services/browser-manager.ts`**
    *   *Mudança do Upstream:* Inicialização do Playwright e criação de instâncias de browser.
    *   *Blindagem Integrada:*
        1.  **Posição da Janela:** Mantidos os argumentos para respeitar a posição da janela original do launcher (`LAUNCHER_WINDOW_X` e `LAUNCHER_WINDOW_Y`), evitando que novas janelas de Chromium sobreponham monitores incorretos.
        2.  **Otimização do Mutex:** Acoplado o callback `onIdle` no `Mutex` para deletar a si mesmo do mapa `uiMutexes` assim que a fila de locks esvaziar, resolvendo o vazamento crônico de chaves órfãs do manager.
        3.  **Tuning V8 do Chrome:** Injetada a flag `--js-flags=--max-old-space-size=128` no lançamento do navegador para limitar a RAM interna do interpretador de JS de cada aba do Chromium.
        4.  **Monitor de Ociosidade:** Criado o monitor de plano de fundo que verifica as atividades das abas a cada 60 segundos e destrói contextos inativos que excedam **15 minutos** sem tráfego (`startIdleContextMonitor`), desocupando RAM desnecessária.
*   **`src/services/stream-creator.ts`**
    *   *Mudança do Upstream:* Ponto de entrada de geração de completions por browser ou API.
    *   *Blindagem Integrada:*
        1.  **Tratamento de Erro Chromium:** Captura erros de fechamento repentino ou perda de contexto do Playwright no bloco `catch` do `browserStreamFetch` e os converte em `RetryableQwenStreamError`. Isso dispara a rotação nativa de contas e fallback para o proxy no roteador `/chat/completions`.
        2.  **Recuperação de ID do Pai:** Implementada a resolução real de `actualParentId` buscando a chave anterior no `sessionStates` com base no `chatId`. Isso conserta o teste de histórico de sessão (`session-parent-tracking`) que falhava na versão crua do upstream.
        3.  **Mutex Stream Auto-limpante:** Modificado `getAccountStreamMutex` para anexar o callback `onIdle` e excluir a chave do mutex do mapa `accountStreamMutexes` de forma automática ao esvaziar a fila.

---

## 3. Estado Atual do Projeto e Sanidade
*   **Compilação:** O projeto compila 100% sem erros via `npm run typecheck` e `npm run build`.
*   **Testes:** Teste unitário crítico (`session-parent-tracking`) validado e passando com sucesso (`✔ session-parent-tracking: appends messages using response message_id as parent`).
*   **Código:** Todo o histórico de commits e alterações locais está limpo e pronto para rodar.