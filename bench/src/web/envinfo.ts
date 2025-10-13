export interface BrowserEnvInfo {
  userAgent: string;
  platform: string;
  cpuCores: number;
  memory?: {
    deviceMemory?: number; // GB
  };
  gpu?: {
    vendor?: string;
    renderer?: string;
    webgpuAdapter?: string;
  };
}

export async function getBrowserEnvInfo(): Promise<BrowserEnvInfo> {
  const info: BrowserEnvInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    cpuCores: navigator.hardwareConcurrency || 0,
  };

  // Memory info (Chrome only)
  if ('deviceMemory' in navigator) {
    info.memory = {
      deviceMemory: (navigator as any).deviceMemory,
    };
  }

  // GPU info
  const gpu: BrowserEnvInfo['gpu'] = {};

  // Try to get WebGL renderer info
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpu.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        gpu.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch (e) {
    // WebGL not available or blocked
  }

  // Try to get WebGPU adapter info
  if ('gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter?.info) {
        gpu.webgpuAdapter = adapter.info.description ||
                            adapter.info.vendor ||
                            'WebGPU Available';
      } else if (adapter) {
        gpu.webgpuAdapter = 'WebGPU Available';
      }
    } catch (e) {
      // WebGPU not available
    }
  }

  if (Object.keys(gpu).length > 0) {
    info.gpu = gpu;
  }

  return info;
}
