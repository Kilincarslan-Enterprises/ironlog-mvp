from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.db.database import get_db, row_to_dict
from app.models import Exercise, ExerciseCreate
import sqlite3

router = APIRouter(prefix="/exercises", tags=["exercises"])

def db():
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()

@router.get("", response_model=List[Exercise])
def list_exercises(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    conn: sqlite3.Connection = Depends(db)
):
    sql = "SELECT * FROM exercises WHERE 1=1"
    params = []
    if q:
        sql += " AND name LIKE ?"
        params.append(f"%{q}%")
    if category:
        sql += " AND category = ?"
        params.append(category)
    sql += " ORDER BY name"
    rows = conn.execute(sql, params).fetchall()
    return [row_to_dict(r) for r in rows]

@router.post("", response_model=Exercise, status_code=201)
def create_exercise(payload: ExerciseCreate, conn: sqlite3.Connection = Depends(db)):
    try:
        cur = conn.execute(
            "INSERT INTO exercises (name, category, equipment, muscle_group, notes) VALUES (?,?,?,?,?)",
            (payload.name, payload.category, payload.equipment, payload.muscle_group, payload.notes)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Exercise name already exists")
    return row_to_dict(conn.execute("SELECT * FROM exercises WHERE id=?", (cur.lastrowid,)).fetchone())

@router.get("/{exercise_id}", response_model=Exercise)
def get_exercise(exercise_id: int, conn: sqlite3.Connection = Depends(db)):
    row = conn.execute("SELECT * FROM exercises WHERE id=?", (exercise_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return row_to_dict(row)

@router.patch("/{exercise_id}", response_model=Exercise)
def update_exercise(exercise_id: int, payload: ExerciseCreate, conn: sqlite3.Connection = Depends(db)):
    row = conn.execute("SELECT * FROM exercises WHERE id=?", (exercise_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exercise not found")
    conn.execute(
        "UPDATE exercises SET name=?, category=?, equipment=?, muscle_group=?, notes=? WHERE id=?",
        (payload.name, payload.category, payload.equipment, payload.muscle_group, payload.notes, exercise_id)
    )
    conn.commit()
    return row_to_dict(conn.execute("SELECT * FROM exercises WHERE id=?", (exercise_id,)).fetchone())

@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, conn: sqlite3.Connection = Depends(db)):
    conn.execute("DELETE FROM exercises WHERE id=?", (exercise_id,))
    conn.commit()
    return None

@router.get("/{exercise_id}/history")
def exercise_history(exercise_id: int, conn: sqlite3.Connection = Depends(db)):
    rows = conn.execute(
        """SELECT s.*, w.date, e.name as exercise_name
           FROM workout_sets s
           JOIN workouts w ON w.id = s.workout_id
           JOIN exercises e ON e.id = s.exercise_id
           WHERE s.exercise_id = ?
           ORDER BY w.date DESC, s.logged_at DESC""", (exercise_id,)).fetchall()
    return [row_to_dict(r) for r in rows]

@router.get("/{exercise_id}/prs")
def exercise_prs(exercise_id: int, conn: sqlite3.Connection = Depends(db)):
    max_weight = conn.execute(
        "SELECT MAX(weight_kg) as value FROM workout_sets WHERE exercise_id=? AND weight_kg IS NOT NULL",
        (exercise_id,)).fetchone()["value"]
    max_volume = conn.execute(
        """SELECT MAX(reps * weight_kg) as value
           FROM workout_sets WHERE exercise_id=? AND weight_kg IS NOT NULL AND reps IS NOT NULL""",
        (exercise_id,)).fetchone()["value"]
    max_reps = conn.execute(
        "SELECT MAX(reps) as value FROM workout_sets WHERE exercise_id=? AND weight_kg IS NOT NULL",
        (exercise_id,)).fetchone()["value"]
    return {"max_weight_kg": max_weight, "max_volume_set_kg": max_volume, "max_reps_at_weight": max_reps}
