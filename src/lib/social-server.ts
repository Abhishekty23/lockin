import type { createClient } from "@/lib/supabase/server";
import type { BoardRow, Connection } from "@/lib/progress";

type DB = Awaited<ReturnType<typeof createClient>>;
export type Social = { board: BoardRow[]; connections: Connection[] };

/** The leaderboard (me and my friends, summary only) and my friend requests. */
export async function loadSocial(supabase: DB): Promise<Social> {
  const [board, connections] = await Promise.all([supabase.rpc("board"), supabase.rpc("my_connections")]);
  return { board: (board.data ?? []) as BoardRow[], connections: (connections.data ?? []) as Connection[] };
}
