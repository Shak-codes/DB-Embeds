import { supabase } from "../db";

interface PostRow {
  type: string;
  server_id: string;
  user_id: string;
  is_first: boolean;
  image_count: number | null;
  video_count: number | null;
  gif_count: number | null;
}

export interface Tally {
  posts: number;
  twitter: number;
  bluesky: number;
  images: number;
  videos: number;
  gifs: number;
  firsts: number;
}

export const RANKED_METRICS: (keyof Tally)[] = [
  "posts",
  "twitter",
  "bluesky",
  "images",
  "videos",
  "gifs",
  "firsts",
];

const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const blank = (): Tally => ({
  posts: 0,
  twitter: 0,
  bluesky: 0,
  images: 0,
  videos: 0,
  gifs: 0,
  firsts: 0,
});

const accumulate = (tally: Tally, row: PostRow) => {
  tally.posts += 1;
  if (row.type === "Bluesky") tally.bluesky += 1;
  else tally.twitter += 1;
  tally.images += row.image_count ?? 0;
  tally.videos += row.video_count ?? 0;
  tally.gifs += row.gif_count ?? 0;
  if (row.is_first) tally.firsts += 1;
};

const fetchYear = async (year: number): Promise<PostRow[]> => {
  const rows: PostRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("post_stats")
      // Cast the snowflakes to text. PostgREST returns them as raw JSON
      // numbers otherwise, and JSON.parse rounds anything past 2^53.
      .select(
        "type, server_id::text, user_id::text, is_first, image_count, video_count, gif_count"
      )
      .gte("timestamp", `${year}-01-01T00:00:00.000Z`)
      .lt("timestamp", `${year + 1}-01-01T00:00:00.000Z`)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    rows.push(...(data as PostRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
};

const fetchStreaks = async (year: number) => {
  const { data, error } = await supabase
    .from("post_streak_global")
    .select("user_id::text, max_streak")
    .eq("year", year);

  if (error) throw new Error(error.message);

  const streaks = new Map<string, number>();
  for (const row of data ?? []) {
    streaks.set(String(row.user_id), row.max_streak ?? 0);
  }
  return streaks;
};

interface WrappedYear {
  year: number;
  totals: Tally & { posters: number; servers: number };
  topPosters: {
    userId: string;
    posts: number;
    twitter: number;
    bluesky: number;
  }[];
  topServers: { serverId: string; posts: number }[];
  topStreaks: { userId: string; maxStreak: number }[];
  byUser: Map<string, Tally>;
  byServer: Map<string, number>;
  streaks: Map<string, number>;
}

const cache = new Map<number, { at: number; value: WrappedYear }>();

let yearsCache: { at: number; value: number[] } | null = null;

const countYear = async (year: number) => {
  const { count, error } = await supabase
    .from("post_stats")
    .select("id", { count: "exact", head: true })
    .gte("timestamp", `${year}-01-01T00:00:00.000Z`)
    .lt("timestamp", `${year + 1}-01-01T00:00:00.000Z`);

  if (error) throw new Error(error.message);
  return count ?? 0;
};

const edgeYear = async (ascending: boolean) => {
  const { data, error } = await supabase
    .from("post_stats")
    .select("timestamp")
    .order("timestamp", { ascending })
    .limit(1);

  if (error) throw new Error(error.message);
  const stamp = data?.[0]?.timestamp;
  return stamp ? new Date(stamp).getUTCFullYear() : null;
};

export const getYears = async () => {
  if (yearsCache && Date.now() - yearsCache.at < CACHE_TTL_MS) {
    return yearsCache.value;
  }

  const first = await edgeYear(true);
  const last = await edgeYear(false);
  if (first === null || last === null) return [];

  const years: number[] = [];
  for (let year = first; year <= last; year += 1) {
    if ((await countYear(year)) > 0) years.push(year);
  }

  yearsCache = { at: Date.now(), value: years };
  return years;
};

const build = async (year: number): Promise<WrappedYear> => {
  const rows = await fetchYear(year);
  const streaks = await fetchStreaks(year);

  const byUser = new Map<string, Tally>();
  const byServer = new Map<string, number>();
  const totals = blank();

  for (const row of rows) {
    const userId = String(row.user_id);
    const serverId = String(row.server_id);

    if (!byUser.has(userId)) byUser.set(userId, blank());
    accumulate(byUser.get(userId)!, row);
    accumulate(totals, row);

    byServer.set(serverId, (byServer.get(serverId) ?? 0) + 1);
  }

  const topPosters = [...byUser.entries()]
    .sort((a, b) => b[1].posts - a[1].posts)
    .slice(0, 5)
    .map(([userId, tally]) => ({
      userId,
      posts: tally.posts,
      twitter: tally.twitter,
      bluesky: tally.bluesky,
    }));

  const topServers = [...byServer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([serverId, posts]) => ({ serverId, posts }));

  const topStreaks = [...streaks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, maxStreak]) => ({ userId, maxStreak }));

  return {
    year,
    totals: { ...totals, posters: byUser.size, servers: byServer.size },
    topPosters,
    topServers,
    topStreaks,
    byUser,
    byServer,
    streaks,
  };
};

const load = async (year: number) => {
  const hit = cache.get(year);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = await build(year);
  cache.set(year, { at: Date.now(), value });
  return value;
};

const rankOf = (
  byUser: Map<string, Tally>,
  metric: keyof Tally,
  userId: string
) => {
  const mine = byUser.get(userId)?.[metric] ?? 0;
  if (mine === 0) return null;

  let ahead = 0;
  for (const tally of byUser.values()) if (tally[metric] > mine) ahead += 1;
  return ahead + 1;
};

const contenders = (byUser: Map<string, Tally>, metric: keyof Tally) => {
  let count = 0;
  for (const tally of byUser.values()) if (tally[metric] > 0) count += 1;
  return count;
};

const serverStanding = (byServer: Map<string, number>, serverId: string) => {
  const mine = byServer.get(serverId);
  if (!mine) return { serverId, found: false };

  let ahead = 0;
  for (const posts of byServer.values()) if (posts > mine) ahead += 1;

  return {
    serverId,
    found: true,
    posts: mine,
    rank: ahead + 1,
    outOf: byServer.size,
  };
};

export const getWrapped = async (
  year: number,
  userId?: string,
  serverId?: string
) => {
  const wrapped = await load(year);

  const payload: Record<string, unknown> = {
    year: wrapped.year,
    totals: wrapped.totals,
    topPosters: wrapped.topPosters,
    topServers: wrapped.topServers,
    topStreaks: wrapped.topStreaks,
  };

  if (serverId) {
    payload.server = serverStanding(wrapped.byServer, serverId);
  }

  if (!userId) return payload;

  const stats = wrapped.byUser.get(userId);
  if (!stats) {
    payload.user = { userId, found: false };
    return payload;
  }

  const ranks: Record<string, number | null> = {};
  const outOf: Record<string, number> = {};
  for (const metric of RANKED_METRICS) {
    ranks[metric] = rankOf(wrapped.byUser, metric, userId);
    outOf[metric] = contenders(wrapped.byUser, metric);
  }

  payload.user = {
    userId,
    found: true,
    stats,
    ranks,
    outOf,
    maxStreak: wrapped.streaks.get(userId) ?? 0,
  };

  return payload;
};
