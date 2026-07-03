chore(merge): integra upstream v1.12.9 com blindagens dodo

Mescla a atualizacao mainstream para suporte a novas chamadas de ferramenta e
ajustes finos de streaming. Preserva e estende as otimizacoes de recursos de
producao, incluindo:

- Limites de heap de memoria (512MB RAM global, 128MB RAM Chromium)
- Caching de script stealth em singleton
- Otimizacao do reasoningBuffer usando arrays de chunks
- Upload via stream continuo para ali-oss (putStream)
- Recuperacao automatica de aba fechada do Chromium como erro re-tentavel
- Encerramento de contextos Playwright inativos por mais de 15 minutos
- Timeout de seguranca de 10 minutos para streams Web
- Resolucao correta do parent_id de sessao a partir do historico de chat