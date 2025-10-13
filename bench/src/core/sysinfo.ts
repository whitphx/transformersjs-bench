import os from "os";

export interface SystemInfo {
  cpu: {
    model: string;
    cores: number;
    threads: number;
  };
  memory: {
    total: string;
    available: string;
  };
  platform: string;
  arch: string;
  nodeVersion: string;
}

export function getSystemInfo(): SystemInfo {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  return {
    cpu: {
      model: cpus[0]?.model || "Unknown",
      cores: os.cpus().length,
      threads: os.cpus().length, // In Node.js, this is the same as logical cores
    },
    memory: {
      total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      available: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
    },
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
  };
}
