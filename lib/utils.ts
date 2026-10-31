import type { Redis } from 'ioredis';

/**
 * Close a Redis connection without hanging. When it is up: QUIT (pending commands
 * are sent first) and wait until the socket is closed. Otherwise (still connecting,
 * or reconnecting to a Redis that is down): disconnect right away and stop retrying.
 */
export async function closeRedis(client?: Redis): Promise<void> {
  if (!client || client.status === 'end') return;
  if (client.status === 'ready') {
    const ended = new Promise((resolve) => client.once('end', resolve));
    try {
      await client.quit();
      // QUIT is answered before the socket is closed
      await ended;
      return;
    } catch {
      // fall through to disconnect()
    }
  }
  client.disconnect();
}
