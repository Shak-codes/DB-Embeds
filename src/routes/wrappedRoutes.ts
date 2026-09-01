import express, { Router } from "express";
import { getWrapped, getYears } from "../services/wrappedService";

const router: Router = express.Router();

const FIRST_YEAR = 2023;

router.get("/years", async (_req, res) => {
  try {
    return res.status(200).json({ years: await getYears() });
  } catch (err) {
    console.error("Error listing wrapped years:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:year", async (req, res) => {
  const year = Number(req.params.year);
  const now = new Date().getUTCFullYear();

  if (!Number.isInteger(year) || year < FIRST_YEAR || year > now) {
    return res
      .status(400)
      .json({ error: `Year must be between ${FIRST_YEAR} and ${now}` });
  }

  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const serverId = req.query.serverId ? String(req.query.serverId) : undefined;

  try {
    return res.status(200).json(await getWrapped(year, userId, serverId));
  } catch (err: any) {
    console.error("Error building wrapped:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
