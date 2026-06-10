import dotenv from 'dotenv';
dotenv.config({ override: true });

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

import { startServer } from './api/server.js'

startServer().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
