import { PostStats } from "../types";
import { supabase } from "../db";

export const insertDiscordPost = async (post: PostStats) => {
  try {
    const postDate = new Date(post.timestamp);
    const dayStart = new Date(
      postDate.getUTCFullYear(),
      postDate.getUTCMonth(),
      postDate.getUTCDate()
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const { data: existing, error: fetchError } = await supabase
      .from("post_stats")
      .select("id")
      .eq("type", post.type)
      .gte("timestamp", dayStart.toISOString())
      .lt("timestamp", dayEnd.toISOString())
      .limit(1);

    if (fetchError) {
      console.error("Error checking for existing daily post:", fetchError);
      return null;
    }

    const isFirst = existing.length === 0;

    const { data, error } = await supabase
      .from("post_stats")
      .insert([
        {
          type: post.type,
          server_id: post.serverId,
          user_id: post.userId,
          timestamp: post.timestamp,
          is_first: isFirst,
          image_count: post.imageCount,
          video_count: post.videoCount,
          gif_count: post.gifCount,
        },
      ])
      .select();

    if (error) {
      console.error("Error inserting Discord post:", error);
      return null;
    }

    return data?.[0] || null;
  } catch (err) {
    console.error("Unexpected error inserting Discord post:", err);
    return null;
  }
};

export const updateServerStreak = async (post: PostStats) => {
  try {
    const postDate = new Date(post.timestamp);
    const year = postDate.getUTCFullYear();

    const { data: existing, error: fetchError } = await supabase
      .from("post_streak")
      .select("*")
      .eq("server_id", post.serverId)
      .eq("user_id", post.userId)
      .eq("year", year)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching streak:", fetchError);
      return null;
    }

    let currentStreak = 1;
    let maxStreak = 1;

    if (existing) {
      const lastPost = new Date(existing.last_post);
      const diffDays = Math.floor(
        (postDate.getTime() - lastPost.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return existing;
      } else if (diffDays === 1) {
        currentStreak = existing.current_streak + 1;
      } else {
        currentStreak = 1;
      }

      maxStreak = Math.max(existing.max_streak, currentStreak);
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("post_streak")
      .upsert(
        {
          server_id: post.serverId,
          user_id: post.userId,
          year,
          current_streak: currentStreak,
          max_streak: maxStreak,
          last_post: postDate,
        },
        { onConflict: "server_id,user_id,year" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting streak:", upsertError);
      return null;
    }

    return upserted;
  } catch (err) {
    console.error("Unexpected error updating streak:", err);
    return null;
  }
};

export const updateGlobalStreak = async (post: PostStats) => {
  try {
    const postDate = new Date(post.timestamp);
    const year = postDate.getUTCFullYear();

    const { data: existing, error: fetchError } = await supabase
      .from("post_streak_global")
      .select("*")
      .eq("user_id", post.userId)
      .eq("year", year)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching global streak:", fetchError);
      return null;
    }

    let currentStreak = 1;
    let maxStreak = 1;

    if (existing) {
      const lastPost = new Date(existing.last_post);
      const diffDays = Math.floor(
        (postDate.getTime() - lastPost.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        return existing;
      } else if (diffDays === 1) {
        currentStreak = existing.current_streak + 1;
      } else {
        currentStreak = 1;
      }

      maxStreak = Math.max(existing.max_streak, currentStreak);
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("post_streak_global")
      .upsert(
        {
          user_id: post.userId,
          year,
          current_streak: currentStreak,
          max_streak: maxStreak,
          last_post: postDate,
        },
        { onConflict: "user_id,year" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting global streak:", upsertError);
      return null;
    }

    return upserted;
  } catch (err) {
    console.error("Unexpected error updating global streak:", err);
    return null;
  }
};
