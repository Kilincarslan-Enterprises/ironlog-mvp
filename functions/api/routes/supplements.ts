import { Hono } from "hono";
import type { Env } from "../env";

const supplements = new Hono<{ Bindings: Env }>();

supplements.get("/", async (c) => {
  return c.json({ supplements: [] });
});

export default supplements;
