import { Hono } from "hono";
import type { Env } from "../env";

const weight = new Hono<{ Bindings: Env }>();

weight.get("/", async (c) => {
  return c.json({ entries: [] });
});

export default weight;
