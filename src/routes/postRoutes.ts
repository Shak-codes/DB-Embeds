import express, { Router } from "express";
import {
  insertDiscordPost,
  updateServerStreak,
  updateGlobalStreak,
} from "../services/postService";
import { PostStats } from "../types";

const router: Router = express.Router();

router.post("/insert", async (require, res) => {
  const post: PostStats = require.body;
  console.log(post);

  if (!post || !post.serverId || !post.userId || !post.timestamp) {
    console.log("Missing parameter");
    return res.status(400).json({ error: "Missing required post fields" });
  }

  try {
    const insertedPost = await insertDiscordPost(post);
    if (!insertedPost) {
      return res.status(500).json({ error: "Failed to insert post" });
    }

    const updatedServerStreak = await updateServerStreak(post);
    if (!updatedServerStreak) {
      return res.status(500).json({ error: "Failed to update server streak" });
    }

    const updatedGlobalStreak = await updateGlobalStreak(post);
    if (!updatedGlobalStreak) {
      return res.status(500).json({ error: "Failed to update global streak" });
    }

    console.log("Successfully inserted into database!");

    return res.status(200).json({
      post: insertedPost,
      serverStreak: updatedServerStreak,
      globalStreak: updatedGlobalStreak,
    });
  } catch (err: any) {
    console.error("Error inserting post or updating streak:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
