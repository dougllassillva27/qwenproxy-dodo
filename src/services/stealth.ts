import type { FingerprintProfile } from './fingerprint.js';

let cachedStealthScript: string | null = null;

export function getStealthScript(profile: FingerprintProfile): string {
  if (!cachedStealthScript) {
    cachedStealthScript = `
      function mulberry32(seed) {
        return function() {
          seed |= 0;
          seed = (seed + 0x6d2b79f5) | 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      const canvasRng = mulberry32(PROFILE.canvasNoiseSeed);
      const audioRng = mulberry32(PROFILE.audioNoiseSeed);
      const webglRng = mulberry32(PROFILE.webglNoiseSeed);

      const nativeToString = Function.prototype.toString;
      const spoofedFunctions = new WeakSet();
      
      Function.prototype.toString = function() {
        if (spoofedFunctions.has(this)) {
          return 'function ' + (this.name || '') + '() { [native code] }';
        }
        return nativeToString.call(this);
      };
      spoofedFunctions.add(Function.prototype.toString);

      function defineOnPrototype(obj, prop, value) {
        const proto = Object.getPrototypeOf(obj);
        if (!proto) return;
        
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc && desc.configurable) {
          const getter = typeof value === 'function' ? value : () => value;
          Object.defineProperty(proto, prop, {
            get: getter,
            configurable: true,
            enumerable: desc.enumerable !== false,
          });
          spoofedFunctions.add(getter);
        }
      }

      try {
        const proto = Object.getPrototypeOf(navigator);
        const desc = Object.getOwnPropertyDescriptor(proto, 'webdriver');
        if (desc && desc.configurable) {
          Object.defineProperty(proto, 'webdriver', {
            get: () => undefined,
            configurable: true,
            enumerable: true,
          });
          spoofedFunctions.add(Object.getOwnPropertyDescriptor(proto, 'webdriver').get);
        }
      } catch(e) {}

      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.documentElement.appendChild(iframe);
        
        const iframeNav = iframe.contentWindow.navigator;
        const cleanWebdriver = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(iframeNav), 'webdriver');
        
        if (cleanWebdriver && cleanWebdriver.get) {
          const originalGet = cleanWebdriver.get;
          Object.defineProperty(Object.getPrototypeOf(iframeNav), 'webdriver', {
            get: () => undefined,
            configurable: true,
            enumerable: true,
          });
        }
        
        document.documentElement.removeChild(iframe);
      } catch(e) {}

      defineOnPrototype(navigator, 'userAgent', PROFILE.userAgent);
      defineOnPrototype(navigator, 'appVersion', PROFILE.appVersion);
      defineOnPrototype(navigator, 'platform', 'Win32');

      try {
        const userAgentData = {
          brands: PROFILE.brands,
          mobile: false,
          platform: PROFILE.platform,
          getHighEntropyValues: async (hints) => {
            return {
              brands: PROFILE.fullBrands,
              mobile: false,
              platform: PROFILE.platform,
              platformVersion: PROFILE.platformVersion,
              architecture: PROFILE.architecture,
              bitness: PROFILE.bitness,
              model: '',
              uaFullVersion: PROFILE.chromeVersion,
            };
          }
        };
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => userAgentData,
          configurable: true,
          enumerable: true
        });
        spoofedFunctions.add(Object.getOwnPropertyDescriptor(navigator, 'userAgentData').get);
      } catch(e) {}

      defineOnPrototype(navigator, 'languages', ['pt-BR', 'pt', 'en-US', 'en']);
      defineOnPrototype(navigator, 'language', 'pt-BR');

      try {
        const screenProto = Object.getPrototypeOf(screen);
        defineOnPrototype(screen, 'width', PROFILE.screenWidth || 1920);
        defineOnPrototype(screen, 'height', PROFILE.screenHeight || 1080);
        defineOnPrototype(screen, 'availWidth', PROFILE.screenWidth || 1920);
        defineOnPrototype(screen, 'availHeight', (PROFILE.screenHeight || 1080) - 40);
        defineOnPrototype(screen, 'colorDepth', 24);
        defineOnPrototype(screen, 'pixelDepth', 24);
      } catch(e) {}

      try {
        const pluginData = [
          { name: 'PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
          { name: 'Chrome PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
          { name: 'Chromium PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
          { name: 'Microsoft Edge PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
          { name: 'WebKit built-in PDF', description: 'Portable Document Format', filename: 'internal-pdf-viewer', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }] }
        ];

        const plugins = [];
        const mimeTypes = [];

        pluginData.forEach(p => {
          const mTypes = p.mimeTypes.map(m => {
            const mt = Object.create(MimeType.prototype);
            Object.defineProperties(mt, {
              type: { get: () => m.type },
              suffixes: { get: () => m.suffixes },
              description: { get: () => m.description },
              enabledPlugin: { get: () => pl }
            });
            mimeTypes.push(mt);
            return mt;
          });

          const pl = Object.create(Plugin.prototype);
          Object.defineProperties(pl, {
            name: { get: () => p.name },
            description: { get: () => p.description },
            filename: { get: () => p.filename },
            length: { get: () => mTypes.length },
            item: { value: (index) => mTypes[index] },
            namedItem: { value: (name) => mTypes[name] }
          });
          mTypes.forEach((mt, idx) => {
            Object.defineProperty(pl, idx, { get: () => mt });
            Object.defineProperty(pl, mt.type, { get: () => mt });
          });
          plugins.push(pl);
        });

        const pluginArray = Object.create(PluginArray.prototype);
        Object.defineProperties(pluginArray, {
          length: { get: () => plugins.length },
          item: { value: (index) => plugins[index] },
          namedItem: { value: (name) => plugins.find(p => p.name === name) },
          refresh: { value: () => {} }
        });
        plugins.forEach((pl, idx) => {
          Object.defineProperty(pluginArray, idx, { get: () => pl });
          Object.defineProperty(pluginArray, pl.name, { get: () => pl });
        });

        const mimeTypeArray = Object.create(MimeTypeArray.prototype);
        Object.defineProperties(mimeTypeArray, {
          length: { get: () => mimeTypes.length },
          item: { value: (index) => mimeTypes[index] },
          namedItem: { value: (name) => mimeTypes.find(m => m.type === name) }
        });
        mimeTypes.forEach((mt, idx) => {
          Object.defineProperty(mimeTypeArray, idx, { get: () => mt });
          Object.defineProperty(mimeTypeArray, mt.type, { get: () => mt });
        });

        Object.defineProperty(navigator, 'plugins', { get: () => pluginArray });
        Object.defineProperty(navigator, 'mimeTypes', { get: () => mimeTypeArray });
      } catch(e) {}

      try {
        const hardwareConcurrency = PROFILE.hardwareConcurrency || 8;
        defineOnPrototype(navigator, 'hardwareConcurrency', hardwareConcurrency);
      } catch(e) {}

      try {
        const deviceMemory = PROFILE.deviceMemory || 8;
        defineOnPrototype(navigator, 'deviceMemory', deviceMemory);
      } catch(e) {}

      try {
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return PROFILE.webglVendor || 'Google Inc. (Intel)';
          if (parameter === 37446) return PROFILE.webglRenderer || 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
          return originalGetParameter.call(this, parameter);
        };
        spoofedFunctions.add(WebGLRenderingContext.prototype.getParameter);

        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return PROFILE.webglVendor || 'Google Inc. (Intel)';
          if (parameter === 37446) return PROFILE.webglRenderer || 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
          return originalGetParameter2.call(this, parameter);
        };
        spoofedFunctions.add(WebGL2RenderingContext.prototype.getParameter);
      } catch(e) {}

      try {
        const originalGetShaderPrecisionFormat = WebGLRenderingContext.prototype.getShaderPrecisionFormat;
        WebGLRenderingContext.prototype.getShaderPrecisionFormat = function(shaderType, precisionType) {
          const format = originalGetShaderPrecisionFormat.call(this, shaderType, precisionType);
          if (format) {
            const precisionNoise = (webglRng() - 0.5) * 2;
            const rangeMinNoise = Math.round((webglRng() - 0.5) * 2);
            const rangeMaxNoise = Math.round((webglRng() - 0.5) * 2);
            return {
              rangeMin: format.rangeMin + rangeMinNoise,
              rangeMax: format.rangeMax + rangeMaxNoise,
              precision: format.precision + Math.round(precisionNoise)
            };
          }
          return format;
        };
        spoofedFunctions.add(WebGLRenderingContext.prototype.getShaderPrecisionFormat);
      } catch(e) {}

      try {
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type, encoderOptions) {
          const context = this.getContext('2d');
          if (context) {
            try {
              const width = this.width;
              const height = this.height;
              const imgData = context.getImageData(0, 0, width, height);
              const data = imgData.data;
              for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] > 0) {
                  data[i] = Math.min(255, Math.max(0, data[i] + Math.round((canvasRng() - 0.5) * 2)));
                  data[i+1] = Math.min(255, Math.max(0, data[i+1] + Math.round((canvasRng() - 0.5) * 2)));
                  data[i+2] = Math.min(255, Math.max(0, data[i+2] + Math.round((canvasRng() - 0.5) * 2)));
                }
              }
              context.putImageData(imgData, 0, 0);
            } catch(e) {}
          }
          return originalToDataURL.call(this, type, encoderOptions);
        };
        spoofedFunctions.add(HTMLCanvasElement.prototype.toDataURL);
      } catch(e) {}

      try {
        const originalGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function(channel) {
          const data = originalGetChannelData.call(this, channel);
          const noise = (audioRng() - 0.5) * 1e-7;
          for (let i = 0; i < data.length; i++) {
            data[i] += noise;
          }
          return data;
        };
        spoofedFunctions.add(AudioBuffer.prototype.getChannelData);
      } catch(e) {}

      (function() {
        const originalStartRendering = OfflineAudioContext.prototype.startRendering;
        OfflineAudioContext.prototype.startRendering = async function() {
          try {
            const buffer = await originalStartRendering.call(this);
            const noise = (audioRng() - 0.5) * 1e-7;
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const data = buffer.getChannelData(channel);
              for (let i = 0; i < data.length; i++) {
                data[i] += noise;
              }
            }
            return buffer;
          } catch(e) {
            throw e;
          }
        };
        spoofedFunctions.add(OfflineAudioContext.prototype.startRendering);
      })();

      try {
        const keys = Object.keys(document);
        for (const key of keys) {
          if (key.startsWith('$cdc_') || key.startsWith('$wdc_')) {
            delete document[key];
          }
        }
      } catch(e) {}

      try {
        if (window.performance && window.performance.getEntriesByType) {
          const originalGetEntries = window.performance.getEntriesByType.bind(window.performance);
          window.performance.getEntriesByType = function(type) {
            const entries = originalGetEntries(type);
            if (type === 'resource') {
              return entries.filter(e => !e.name.includes('__injectedScript') && !e.name.includes('addInitScript'));
            }
            return entries;
          };
        }
      } catch(e) {}
    `;
  }

  return `
    (function() {
      const PROFILE = ${JSON.stringify(profile)};
      ${cachedStealthScript}
    })();
  `;
}
