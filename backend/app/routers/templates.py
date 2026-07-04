from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.db.database import get_db, row_to_dict
from app.models import WorkoutTemplate, WorkoutTemplateCreate, TemplateExerciseCreate, TemplateExercise
import sqlite3

router = APIRouter(prefix="/workout-templates", tags=["templates"])

def db():
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()

def enrich_template(conn: sqlite3.Connection, template_id: int) -> dict:
    template = conn.execute("SELECT * FROM workout_templates WHERE id=?", (template_id,)).fetchone()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    t = row_to_dict(template)
    exercises = conn.execute(
        """SELECT te.*, e.name as exercise_name
           FROM workout_template_exercises te
           JOIN exercises e ON e.id = te.exercise_id
           WHERE te.workout_template_id=?
           ORDER BY te.order_index""", (template_id,)).fetchall()
    t["exercises"] = [row_to_dict(r) for r in exercises]
    return t

@router.get("", response_model=List[WorkoutTemplate])
def list_templates(conn: sqlite3.Connection = Depends(db)):
    rows = conn.execute("SELECT * FROM workout_templates ORDER BY created_at DESC").fetchall()
    return [enrich_template(conn, r["id"]) for r in rows]

@router.post("", response_model=WorkoutTemplate, status_code=201)
def create_template(payload: WorkoutTemplateCreate, conn: sqlite3.Connection = Depends(db)):
    cur = conn.execute(
        "INSERT INTO workout_templates (name, description) VALUES (?,?)",
        (payload.name, payload.description)
    )
    conn.commit()
    return enrich_template(conn, cur.lastrowid)

@router.get("/{template_id}", response_model=WorkoutTemplate)
def get_template(template_id: int, conn: sqlite3.Connection = Depends(db)):
    return enrich_template(conn, template_id)

@router.patch("/{template_id}", response_model=WorkoutTemplate)
def update_template(template_id: int, payload: WorkoutTemplateCreate, conn: sqlite3.Connection = Depends(db)):
    conn.execute(
        "UPDATE workout_templates SET name=?, description=? WHERE id=?",
        (payload.name, payload.description, template_id)
    )
    conn.commit()
    return enrich_template(conn, template_id)

@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, conn: sqlite3.Connection = Depends(db)):
    conn.execute("DELETE FROM workout_templates WHERE id=?", (template_id,))
    conn.commit()
    return None

@router.post("/{template_id}/exercises", response_model=TemplateExercise, status_code=201)
def add_exercise_to_template(template_id: int, payload: TemplateExerciseCreate, conn: sqlite3.Connection = Depends(db)):
    ex = conn.execute("SELECT id FROM exercises WHERE id=?", (payload.exercise_id,)).fetchone()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    cur = conn.execute(
        """INSERT INTO workout_template_exercises
           (workout_template_id, exercise_id, sets_target, reps_target, weight_default, rest_seconds, order_index)
           VALUES (?,?,?,?,?,?,?)""",
        (template_id, payload.exercise_id, payload.sets_target, payload.reps_target,
         payload.weight_default, payload.rest_seconds, payload.order_index)
    )
    conn.commit()
    row = conn.execute(
        """SELECT te.*, e.name as exercise_name
           FROM workout_template_exercises te
           JOIN exercises e ON e.id = te.exercise_id
           WHERE te.id=?""", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)

@router.delete("/{template_id}/exercises/{entry_id}", status_code=204)
def remove_exercise_from_template(template_id: int, entry_id: int, conn: sqlite3.Connection = Depends(db)):
    conn.execute(
        "DELETE FROM workout_template_exercises WHERE id=? AND workout_template_id=?",
        (entry_id, template_id)
    )
    conn.commit()
    return None

@router.post("/{template_id}/activate", response_model=WorkoutTemplate)
def activate_template(template_id: int, conn: sqlite3.Connection = Depends(db)):
    conn.execute("UPDATE workout_templates SET is_active=0")
    conn.execute("UPDATE workout_templates SET is_active=1 WHERE id=?", (template_id,))
    conn.commit()
    return enrich_template(conn, template_id)
