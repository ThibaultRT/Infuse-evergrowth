import { createServer } from 'node:net';

// Fixed debugging ports can silently attach a capture to an old headless browser.
export async function availableDebugPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function closeBrowser(client, socket, browserProcess, viteProcess) {
  // CDP closes Chromium's whole process tree, including profile file handles.
  if (client) await Promise.race([
    client.send('Browser.close').catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  socket?.close();
  for (const child of [browserProcess, viteProcess]) {
    child?.kill();
    child?.stdout?.destroy();
    child?.stderr?.destroy();
    child?.unref();
  }
}
