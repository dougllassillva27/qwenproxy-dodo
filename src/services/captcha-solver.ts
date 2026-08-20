import type { Page } from 'playwright';
import { humanDrag } from './human-behavior.js';
import { acquireMouseLock, releaseMouseLock } from './mouse-lock.js';
import { sleep } from '../utils/sleep.js';

export const BAXIA_IFRAME_SELECTOR = 'iframe#baxia-dialog-content, iframe[src*="_____tmd_____/punish"]';

/**
 * Solves the Baxia slidein captcha inside an iframe on the page.
 */
export async function solveBaxiaCaptcha(page: Page): Promise<boolean> {
  const iframeLocator = page.locator(BAXIA_IFRAME_SELECTOR).first();

  if (!(await iframeLocator.isVisible().catch(() => false))) {
    return false;
  }

  while (!acquireMouseLock('captcha-solver')) {
    console.log('[Captcha] Waiting for mouse lock to be released before solving...');
    await sleep(200);
  }

  console.log('[Captcha] Baxia captcha iframe detected. Attempting to solve...');

  try {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const frame = page.frameLocator(BAXIA_IFRAME_SELECTOR);
      const slider = frame.locator('#nc_1_n1z, .btn_slide');

      // Wait for the slider element to be visible inside the frame
      await slider.waitFor({ state: 'visible', timeout: 5000 });

      const sliderBox = await slider.boundingBox();
      if (!sliderBox) {
        console.warn(`[Captcha] Attempt ${attempt}: Slider bounding box not found.`);
        await sleep(1000);
        continue;
      }

      const track = frame.locator('#nc_1_n1t, .nc_scale');
      const trackBox = await track.boundingBox();
      let dragDistance = trackBox ? (trackBox.width - sliderBox.width) : 260;

      // Attempt 2+ uses the captchaResolve microservice via DeepSeek Vision
      if (attempt >= 2) {
        console.log(`[Captcha] Attempt ${attempt}: Using Vision-based captchaResolve...`);
        const containerSelector = '#nc_1_wrapper, .nc-container, #nocaptcha, div[id*="nc_"][id*="_wrapper"], .nc_wrapper';
        const containerElement = frame.locator(containerSelector).first();
        const screenshotBuffer = await containerElement.screenshot().catch((err) => {
          console.error("[Captcha] [ERROR] Screenshot failed:", err.message);
          return null;
        });

        if (screenshotBuffer) {
          const base64Image = screenshotBuffer.toString("base64");
          console.log("[Captcha] Sending screenshot to captchaResolve (http://localhost:50006/resolve)...");
          const resolveResponse = await fetch("http://localhost:50006/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: base64Image,
              accountId: "Account",
            }),
          }).catch(() => null);

          if (resolveResponse && resolveResponse.ok) {
            const resolveData = await resolveResponse.json().catch(() => null) as any;
            if (resolveData && resolveData.success && typeof resolveData.x === "number") {
              dragDistance = resolveData.x;
              console.log(`[Captcha] Coordinate X obtained from DeepSeek Vision: ${dragDistance}px.`);
            } else {
              console.warn("[Captcha] Invalid response from captchaResolve:", resolveData);
            }
          } else {
            console.warn("[Captcha] captchaResolve microservice is not responding.");
          }
        }
      }

      const startX = sliderBox.x + sliderBox.width / 2;
      const startY = sliderBox.y + sliderBox.height / 2;

      console.log(`[Captcha] Attempt ${attempt}: Dragging slider from x=${startX}, y=${startY} by ${dragDistance}px`);
      
      const endX = startX + dragDistance;
      const endY = startY;
      
      await humanDrag(page, startX, startY, endX, endY);

      // Wait a moment for the page to register success and close the dialog
      await sleep(2000);

      // Verify if the captcha is solved: the iframe should be hidden/gone, or we see a success element
      const isGone = !(await iframeLocator.isVisible().catch(() => false));
      if (isGone) {
        console.log('[Captcha] Baxia captcha solved successfully (iframe closed).');
        return true;
      }

      const okElement = frame.locator('.btn_ok, .nc_ok, div#nc-loading-circle');
      const isOkVisible = await okElement.isVisible().catch(() => false);
      if (isOkVisible) {
        console.log('[Captcha] Baxia captcha solved successfully (OK state detected).');
        await sleep(1500); // Wait for transition
        return true;
      }

      console.warn(`[Captcha] Attempt ${attempt} did not solve the captcha. Retrying...`);
      await sleep(1000);
    } catch (err: any) {
      console.error(`[Captcha] Error during attempt ${attempt}:`, err.message);
      await sleep(1000);
    }
  }

  console.error('[Captcha] Failed to solve Baxia captcha after 3 attempts.');
  process.stdout.write("\x07"); // beep
  import('child_process').then(({ exec }) => {
    const psCommand = `powershell -Command "
      Add-Type -AssemblyName PresentationCore,PresentationFramework,WindowsBase;
      Add-Type -AssemblyName System.Windows.Forms;
      \\$type = Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);' -Name 'Win32' -Namespace 'Win32Functions' -PassThru;
      \\$processes = Get-Process | Where-Object { \\$_.MainWindowTitle -match 'qwen' -or \\$_.Name -match 'chrome|msedge' };
      foreach (\\$p in \\$processes) {
        \\$hwnd = \\$p.MainWindowHandle;
        if (\\$hwnd -ne [IntPtr]::Zero) {
          \\$null = \\$type::ShowWindowAsync(\\$hwnd, 9);
          \\$null = \\$type::SetForegroundWindow(\\$hwnd);
        }
      }
      [System.Windows.Forms.MessageBox]::Show(\\"Resolva o captcha manualmente.\\", \\"Captcha Detectado\\");
    "`;
    exec(psCommand, () => {});
  });
  await sleep(25000);
  return false;
  } finally {
    releaseMouseLock('captcha-solver');
  }
}

/**
 * Starts a background loop to watch for and solve Baxia captchas on the page.
 * Returns an object with a stop() method to stop the loop.
 */
export function startCaptchaWatcher(page: Page, timeoutMs: number) {
  let finished = false;
  const promise = (async () => {
    const start = Date.now();
    while (!finished && (Date.now() - start < timeoutMs)) {
      try {
        if (page.isClosed()) break;
        const hasCaptcha = await page.locator(BAXIA_IFRAME_SELECTOR).first().isVisible().catch(() => false);
        if (hasCaptcha) {
          console.log('[Captcha] Baxia captcha detected on page. Solving...');
          await solveBaxiaCaptcha(page);
        }
      } catch {
        // ignore
      }
      await sleep(1000);
    }
  })();

  return {
    stop: () => {
      finished = true;
    },
    promise,
  };
}
