import type { Redis } from 'ioredis';

/** How long QUIT may take before the connection is dropped. */
const QUIT_TIMEOUT_MS = 1000;

const closing = new WeakSet<Redis>();

/** Whether `closeRedis()` was called for this connection, or it is closed. */
export function isClosing(client: Redis): boolean {
  return closing.has(client) || client.status === 'end';
}

/**
 * Close a Redis connection without hanging. When it is up: QUIT (pending commands
 * are sent first) and wait until the socket is closed, for at most a second. When
 * Redis does not answer in time, or the connection is not up (still connecting, or
 * retrying a Redis that is down): disconnect right away and stop retrying.
 */
export async function closeRedis(client?: Redis): Promise<void> {
  if (!client) return;
  closing.add(client);
  if (client.status === 'end') return;
  if (client.status === 'ready') {
    const ended = new Promise<void>((resolve) => client.once('end', () => resolve()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), QUIT_TIMEOUT_MS);
    });
    const quit = client.quit().then(
      () => ended.then(() => true),
      () => false,
    );
    const closed = await Promise.race([quit, timedOut]);
    clearTimeout(timer);
    if (closed) return;
  }
  // ioredis destroys the socket if the server does not close it within disconnectTimeout
  client.disconnect();
}
