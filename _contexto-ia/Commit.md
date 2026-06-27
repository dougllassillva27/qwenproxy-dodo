feat(proxy): merge cirúrgico v1.12.4 upstream e proteção Dodo intacta

Este commit integra as atualizações oficiais do repositório qwenproxy (versões v1.12.2 a v1.12.4), realizando a fusão estrita e preservando 100% das blindagens de WAF locais (Dodo Shields).

**🐳 Docker e Infraestrutura (1.12.3 & 1.12.4)**
- Instalação do pacote `gosu` no `Dockerfile` e criação do script `docker-entrypoint.sh`.
- Implementação da função `ensure_writable_dir` para curar erros de permissão (`chown`) em diretórios montados, tornando o container tolerante a falhas em ambientes Docker Swarm.
- Refatoração no `README.md` alterando mounts em bind para volumes nomeados estritos (`qwenproxy_data` e `qwenproxy_profiles`).

**🧠 Handler de Ferramentas e Sistema Anti-Alucinação (1.12.2)**
- Adição das lógicas de detecção `isFileMutationTool` e `appendMissingFileMutationTools` em `tool-handler.ts`. O proxy agora força ativamente a inclusão de ferramentas de manipulação de arquivo providenciadas pelo IDE no contexto do LLM.
- O System Prompt foi adaptado para repreender o Qwen em caso de alucinação de nomes genéricos (como "edit_file" ou "apply_patch"), obrigando o modelo a usar os nomes exatos mapeados pelo cliente.

**🧩 Parser Tolerante a Falhas**
- Injeção das funções `findToolEndMatch` e `matchesCaseInsensitiveAt` no `parser.ts` para detecção de encerramentos parciais/inválidos de tags XML enviados pela IDE, idêntico à proteção base já utilizada no ecossistema Anthropic.

**🛡️ Auditoria de Blindagens Locais (Status: Intactas)**
- Verificado em profundidade que o upstream não sobrepôs os arquivos núcleo do bypass de segurança.
- **Iframe Hack** Bypass (`stream-bridge.ts`) permanece blindado.
- **Atraso Anti-Tarpit** (`warm-pool.ts`) operante.
- Evasões gráficas (`stealth.ts` e bloqueio de mídia em `browser-manager.ts`) continuam forçando economia de CPU/RAM.
- Controle de alocação de memória do Playwright (`--max-old-space-size=256`) protegido com sucesso.

**📦 Manutenção**
- Incremento da versão do `package.json` diretamente de `1.12.1` para `1.12.4`.
- Validado sem falhas com `npm run typecheck`.