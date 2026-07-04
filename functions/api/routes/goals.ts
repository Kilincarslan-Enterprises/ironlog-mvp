import { Hono } from "hono";
import type { Env } from "../env";

const goals = new Hono<{ Bindings: Env }>();

goals.get("/", async (c) => {
  return c.json({ goals: [] });
});

export default goals;
