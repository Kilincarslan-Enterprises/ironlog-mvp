import { Hono } from "hono";
import type { Env } from "../env";

const training = new Hono<{ Bindings: Env }>();

training.get("/exercises", async (c) => {
  return c.json({ exercises: [] });
});

export default training;
