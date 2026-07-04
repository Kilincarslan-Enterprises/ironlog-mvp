import os
import uuid
import sqlite3
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from app.auth import require_agent_api_key, get_current_user_from_key
from app.db.database import get_db
from app.agent_models import (
    Dashboard, DashboardSummary, Goal,
    LogWriteRequest, LogWriteResponse,
    PresetList, PresetTemplateCreate, PresetTemplate,
    PlanProposeRequest, Plan,
)

router = APIRouter(prefix="/agent", tags=["agent"])

def get_db_conn():
    return get_db()


@router.get("/dashboard", response_model=Dashboard)
def read_dashboard(
    conn: sqlite3.Connection = Depends(get_db_conn),
    key: dict = Depends(require_agent_api_key),
):
    cur = conn.cursor()

    # summary
    total_workouts = cur.execute("SELECT COUNT(*) FROM workouts").fetchone()[0]
    volume = cur.execute(
        "SELECT COALESCE(SUM(reps * COALESCE(weight_kg, 0)), 0) FROM workout_sets WHERE weight_kg IS NOT NULL"
    ).fetchone()[0]
    last = cur.execute(
        "SELECT MAX(date) FROM workouts WHERE completed = 1"
    ).fetchone()[0]

    streak = 0
    if last:
        d = datetime.strptime(last, "%Y-%m-%d").date()
        today = date.today()
        while d <= today and (today - d).days <= streak + 1:
            row = cur.execute(
                "SELECT 1 FROM workouts WHERE completed = 1 AND date = ?", (d.isoformat(),)
            ).fetchone()
            if row:
                streak = (today - d).days + 1 if d != today else max(streak, 1)
                d -= timedelta(days=1)
            else:
                break

    recent = []
    for row in cur.execute(
        """
        SELECT w.id, w.name, w.date, w.notes, w.completed
        FROM workouts w
        ORDER BY w.date DESC, w.created_at DESC
        LIMIT 10
        """
    ).fetchall():
        sets = cur.execute(
            """
            SELECT s.id, s.exercise_id, e.name as exercise_name, s.set_number, s.reps, s.weight_kg, s.rpe
            FROM workout_sets s
            JOIN exercises e ON e.id = s.exercise_id
            WHERE s.workout_id = ?
            """,
            (row["id"],),
        ).fetchall()
        recent.append(
            {
                "id": row["id"],
                "name": row["name"],
                "date": row["date"],
                "notes": row["notes"],
                "completed": bool(row["completed"]),
                "sets": [dict(s) for s in sets],
            }
        )

    goals: list[Goal] = []

    return Dashboard(
        user_id=key["user_id"],
        period="week",
        summary=DashboardSummary(
            total_workouts=total_workouts,
            total_volume_kg=float(volume),
            current_streak_days=streak,
            last_workout_at=last,
        ),
        recent_logs=recent,
        goals=goals,
    )


# ---------------------------------------------------------------------------
# Write logs
# ---------------------------------------------------------------------------
@router.post("/logs", response_model=LogWriteResponse, status_code=201)
def write_logs(
    req: LogWriteRequest,
    conn: sqlite3.Connection = Depends(get_db_conn),
    key: dict = Depends(require_agent_api_key),
):
    created_ids = []
    now = datetime.utcnow().isoformat()
    cur = conn.cursor()
    for entry in req.entries:
        cur.execute(
            "INSERT INTO workouts (workout_template_id, name, date, notes, completed) VALUES (?, ?, ?, ?, 1)",
            (entry.template_id, entry.name, entry.date, entry.notes),
        )
        workout_id = cur.lastrowid
        for s in entry.sets:
            cur.execute(
                """
                INSERT INTO workout_sets
                (workout_id, exercise_id, set_number, reps, weight_kg, rpe, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    workout_id,
                    s.exercise_id,
                    s.set_number,
                    s.reps,
                    s.weight_kg,
                    s.rpe,
                    s.notes,
                ),
            )
        created_ids.append(workout_id)
    conn.commit()
    return LogWriteResponse(created_ids=created_ids, created_at=now)


# ---------------------------------------------------------------------------
# Presets
# ---------------------------------------------------------------------------
@router.get("/presets", response_model=PresetList)
def list_presets(
    q: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db_conn),
    key: dict = Depends(require_agent_api_key),
):
    cur = conn.cursor()
    exercises = cur.execute(
        "SELECT id, name, category, equipment, muscle_group, notes FROM exercises"
    ).fetchall()
    if q:
        ql = q.lower()
        exercises = [
            e for e in exercises
            if (e["name"] and ql in e["name"].lower())
            or (e["category"] and ql in e["category"].lower())
            or (e["equipment"] and ql in e["equipment"].lower())
            or (e["muscle_group"] and ql in e["muscle_group"].lower())
        ]

    templates: list[PresetTemplate] = []
    for t in cur.execute(
        "SELECT id, name, description, is_active, created_at FROM workout_templates"
    ).fetchall():
        exs = cur.execute(
            """
            SELECT te.id, te.exercise_id, e.name as exercise_name, te.sets_target,
                   te.reps_target, te.weight_default, te.rest_seconds, te.order_index
            FROM workout_template_exercises te
            JOIN exercises e ON e.id = te.exercise_id
            WHERE te.workout_template_id = ?
            ORDER BY te.order_index
            """,
            (t["id"],),
        ).fetchall()
        templates.append(
            PresetTemplate(
                id=t["id"],
                name=t["name"],
                description=t["description"],
                is_active=bool(t["is_active"]),
                created_at=t["created_at"],
                exercises=[dict(e) for e in exs],
            )
        )
    return PresetList(exercises=[dict(e) for e in exercises], routines=templates)


@router.post("/presets", response_model=PresetTemplate, status_code=201)
def create_preset(
    preset: PresetTemplateCreate,
    conn: sqlite3.Connection = Depends(get_db_conn),
    key: dict = Depends(require_agent_api_key),
):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO workout_templates (name, description, is_active) VALUES (?, ?, ?)",
        (preset.name, preset.description, int(preset.is_active)),
    )
    template_id = cur.lastrowid
    for e in preset.exercises:
        cur.execute(
            """
            INSERT INTO workout_template_exercises
            (workout_template_id, exercise_id, sets_target, reps_target, weight_default, rest_seconds, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                template_id,
                e.exercise_id,
                e.sets_target,
                e.reps_target,
                e.weight_default,
                e.rest_seconds,
                e.order_index,
            ),
        )
    conn.commit()
    return list_presets(conn=conn).routines[-1]


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------
@router.post("/plans/propose", response_model=Plan)
def propose_plan(
    req: PlanProposeRequest,
    conn: sqlite3.Connection = Depends(get_db_conn),
    key: dict = Depends(require_agent_api_key),
):
    cur = conn.cursor()
    focus = ",".join(req.constraints.focus) if req.constraints.focus else "full body"
    all_exercises = cur.execute(
        """
        SELECT id, name, category, equipment, muscle_group
        FROM exercises
        WHERE (?1 IS NULL OR muscle_group LIKE '%' || ?1 || '%' OR category LIKE '%' || ?1 || '%')
        LIMIT 20
        """,
        (focus if focus != "full body" else None,),
    ).fetchall()

    sessions = []
    days = min(req.constraints.sessions_per_week, 7)
    for day in range(1, days + 1):
        picked = all_exercises[(day - 1) : (day - 1) + 4]
        sessions.append(
            {
                "day": day,
                "focus": f"Session {day}",
                "exercises": [
                    {
                        "exercise_id": e["id"],
                        "exercise_name": e["name"],
                        "sets": 3,
                        "reps": "8-12",
                        "rest_seconds": 90,
                    }
                    for e in picked
                ],
            }
        )
    return Plan(
        id=str(uuid.uuid4()),
        status="proposed",
        rationale=f"Generated {days}-day plan focusing on {focus}",
        sessions=sessions,
    )
