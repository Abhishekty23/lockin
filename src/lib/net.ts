// Wraps a server call so the screen never waits forever: a lost connection or a
// reply that doesn't arrive within 15 seconds becomes a normal error message.
export async function safe<T>(call: Promise<T>, ms = 15000): Promise<T | { ok: false; error: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ ok: false; error: string }>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: "LockIn is taking too long to answer. Check your connection, then refresh to see what saved." }), ms);
  });
  try {
    return await Promise.race([call, timeout]);
  } catch {
    return { ok: false, error: "Couldn't reach LockIn. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}
