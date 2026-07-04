import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { applyMigrations, seedUserAndToken, api, type SeededUser } from "./helpers";

let s: SeededUser;

function auth(extra: Record<string, string> = {}) {
  return { headers: { ...s.authHeaders, "content-type": "application/json", ...extra } };
}

describe("training: exercises + workout sessions + sets", () => {
  let exerciseId: string;
  let sessionId: string;

  beforeAll(async () => {
    await applyMigrations(env);
    s = await seedUserAndToken(env);
  });

  it("creates an exercise", async () => {
    const res = await api(env, "/api/training/exercises", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ name: "Bankdrücken", category: "strength", muscleGroup: "chest" }),
    });
    expect(res.status).toBe(200);
    const { exercise } = await res.json();
    expect(exercise.name).toBe("Bankdrücken");
    expect(exercise.userId).toBe(s.userId);
    exerciseId = exercise.id;
  });

  it("lists own exercises", async () => {
    const res = await api(env, "/api/training/exercises", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const { exercises } = await res.json();
    expect(exercises.length).toBe(1);
    expect(exercises[0].id).toBe(exerciseId);
  });

  it("creates a workout plan referencing the exercise", async () => {
    const res = await api(env, "/api/training/workout-plans", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        name: "Push Day",
        exercises: [{ exerciseId, dayLabel: "A", orderIndex: 0, sets: 3, reps: 8 }],
      }),
    });
    expect(res.status).toBe(200);
    const { plan } = await res.json();
    expect(plan.name).toBe("Push Day");
    expect(plan.exercises.length).toBe(1);
  });

  it("starts a workout session", async () => {
    const res = await api(env, "/api/training/workout-sessions", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ name: "Push Session", startedAt: Date.now() }),
    });
    expect(res.status).toBe(200);
    const { session } = await res.json();
    expect(session.name).toBe("Push Session");
    expect(session.userId).toBe(s.userId);
    sessionId = session.id;
  });

  it("lists today's sessions", async () => {
    const res = await api(env, "/api/training/workout-sessions", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const { sessions } = await res.json();
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe(sessionId);
  });

  it("adds a set to the session (auto set-number)", async () => {
    const res = await api(env, `/api/training/workout-sessions/${sessionId}/sets`, {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ exerciseId, reps: 8, weight: 80, rpe: 8 }),
    });
    expect(res.status).toBe(200);
    const { set } = await res.json();
    expect(set.reps).toBe(8);
    expect(set.weight).toBe(80);
    expect(set.setNumber).toBe(1);

    const list = await api(env, "/api/training/workout-sessions", { headers: s.authHeaders });
    const { sessions } = await list.json();
    expect(sessions[0].sets.length).toBe(1);
  });

  it("adds a second set (set-number advances to 2)", async () => {
    const res = await api(env, `/api/training/workout-sessions/${sessionId}/sets`, {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ exerciseId, reps: 6, weight: 85 }),
    });
    expect(res.status).toBe(200);
    const { set } = await res.json();
    expect(set.setNumber).toBe(2);
  });

  it("patches the session to finish it (duration computed)", async () => {
    const res = await api(env, `/api/training/workout-sessions/${sessionId}`, {
      method: "PATCH",
      ...auth(),
      body: JSON.stringify({ notes: "Felt strong" }),
    });
    expect(res.status).toBe(200);
    const { session } = await res.json();
    expect(session.endedAt).not.toBeNull();
    expect(session.notes).toBe("Felt strong");
    expect(typeof session.durationSeconds).toBe("number");
  });

  it("deletes a set from the session", async () => {
    const list = await api(env, "/api/training/workout-sessions", { headers: s.authHeaders });
    const sets = (await list.json()).sessions[0].sets;
    const firstSetId = sets[0].id;

    const del = await api(env, `/api/training/workout-sessions/${sessionId}/sets/${firstSetId}`, {
      method: "DELETE",
      headers: s.authHeaders,
    });
    expect(del.status).toBe(200);

    const after = await api(env, "/api/training/workout-sessions", { headers: s.authHeaders });
    const afterSets = (await after.json()).sessions[0].sets;
    expect(afterSets.length).toBe(1);
  });
});