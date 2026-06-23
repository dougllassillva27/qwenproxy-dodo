import dotenv from 'dotenv';
dotenv.config({ override: true });

// Aumentando exponencialmente o timeout nativo do Node.js (undici) para 2 horas
// Isso previne o erro UND_ERR_HEADERS_TIMEOUT em prompts massivos (ex: /compact com 1M de tokens)
// onde a Qwen leva mais de 5 minutos apenas processando o prompt antes de devolver o 1º token.
try {
  // @ts-ignore - Ignorando erros de tipagem caso o ambiente não suporte a declaração
  import('undici').then(({ setGlobalDispatcher, Agent }) => {
    setGlobalDispatcher(new Agent({
      headersTimeout: 7200000, // 2 horas
      bodyTimeout: 7200000,    // 2 horas
      connectTimeout: 60000    // 1 minuto
    }));
  }).catch(() => {});
} catch (e) {}

function getTimestamp() {
  const t = new Date();
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  return `[${pad2(t.getDate())}/${pad2(t.getMonth() + 1)}/${t.getFullYear()} ${pad2(t.getHours())}:${pad2(t.getMinutes())}]`;
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => originalLog(getTimestamp(), ...args);
console.warn = (...args) => originalWarn(getTimestamp(), ...args);
console.error = (...args) => originalError(getTimestamp(), ...args);

import('./api/server.js').then(({ startServer }) => {
  startServer().catch((error: any) => {
    console.error('Failed to start server:', error)
    process.exit(1)
  })
})
