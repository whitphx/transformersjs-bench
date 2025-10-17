/**
 * Simple logger utility that adds timestamps to console output
 */

function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const logger = {
  log: (...args: any[]) => {
    console.log(`[${formatTimestamp()}]`, ...args);
  },

  info: (...args: any[]) => {
    console.info(`[${formatTimestamp()}]`, ...args);
  },

  warn: (...args: any[]) => {
    console.warn(`[${formatTimestamp()}]`, ...args);
  },

  error: (...args: any[]) => {
    console.error(`[${formatTimestamp()}]`, ...args);
  },
};
