from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db, row_to_dict
from app.models import Workout, WorkoutCreate, SetCreate, Set, SetUpdate
import sqlite3

router = APIRouter(prefix="/workouts", tags=["workouts"])

def db():
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()

def enrich_workout(conn: sqlite3.Connection, workout_id: int) -> dict:
    w = conn.execute("SELECT * FROM workouts WHERE id=?", (workout_id,)).fetchone()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    workout = row_to_dict(w)
    sets = conn.execute(
        """SELECT s.*, e.name as exercise_name
           FROM workout_sets s
           JOIN exercises e ON e.id = s.exercise_id
           WHERE s.workout_id=?
           ORDER BY s.exercise_id, s.set_number""", (workout_id,)).fetchall()
    workout["sets"] = [row_to_dict(r) for r in sets]
    return workout

@router.get("", response_model=List[Workout])
def list_workouts(date: Optional[str] = None, conn: sqlite3.Connection = Depends(db)):
    sql = "SELECT * FROM workouts"
    params = []
    if date:
        sql += " WHERE date=?"
        params.append(date)
    sql += " ORDER BY date DESC, created_at DESC"
    return [row_to_dict(r) for r in conn.execute(sql, params).fetchall()]

@router.post("", response_model=Workout, status_code=201)
def create_workout(payload: WorkoutCreate, conn: sqlite3.Connection = Depends(db)):
    cur = conn.execute(
        """INSERT INTO workouts (workout_template_id, name, date, start_time)
           VALUES (?,?,?,?)""",
        (payload.workout_template_id, payload.name, payload.date, datetime.utcnow().isoformat())
    )
    conn.commit()
    return enrich_workout(conn, cur.lastrowid)

@router.get("/{workout_id}", response_model=Workout)
def get_workout(workout_id: int, conn: sqlite3.Connection = Depends(db)):
    return enrich_workout(conn, workout_id)

@router.patch("/{workout_id}", response_model=Workout)
def update_workout(workout_id: int, payload: dict, conn: sqlite3.Connection = Depends(db)):
    fields = []
    values = []
    if "name" in payload:
        fields.append("name=?")
        values.append(payload["name"])
    if "notes" in payload:
        fields.append("notes=?")
        values.append(payload["notes"])
    if payload.get("completed"):
        fields.append("completed=?")
        values.append(1)
        fields.append("end_time=?")
        values.append(datetime.utcnow().isoformat())
    if not fields:
        return enrich_workout(conn, workout_id)
    values.append(workout_id)
    conn.execute(f"UPDATE workouts SET {','.join(fields)} WHERE id=?", values)
    conn.commit()
    return enrich_workout(conn, workout_id)

@router.delete("/{workout_id}", status_code=204)
def delete_workout(workout_id: int, conn: sqlite3.Connection = Depends(db)):
    conn.execute("DELETE FROM workouts WHERE id=?", (workout_id,))
    conn.commit()
    return None

@router.post("/{workout_id}/sets", response_model=Set, status_code=201)
def add_set(workout_id: int, payload: SetCreate, conn: sqlite3.Connection = Depends(db)):
    ex = conn.execute("SELECT id FROM exercises WHERE id=?", (payload.exercise_id,)).fetchone()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    cur = conn.execute(
        """INSERT INTO workout_sets (workout_id, exercise_id, set_number, reps, weight_kg, rpe, notes)
           VALUES (?,?,?,?,?,?,?)""",
        (workout_id, payload.exercise_id, payload.set_number, payload.reps,
         payload.weight_kg, payload.rpe, payload.notes)
    )
    conn.commit()
    row = conn.execute(
        """SELECT s.*, e.name as exercise_name
           FROM workout_sets s JOIN exercises e ON e.id=s.exercise_id
           WHERE s.id=?""", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)

@router.patch("/{workout_id}/sets/{set_id}", response_model=Set)
def update_set(workout_id: int, set_id: int, payload: SetUpdate, conn: sqlite3.Connection = Depends(db)):
    fields = []
    values = []
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        fields.append(f"{k}=?")
        values.append(v)
    if not fields:
        row = conn.execute("SELECT * FROM workout_sets WHERE id=?", (set_id,)).fetchone()
        return row_to_dict(row)
    values.append(set_id)
    values.append(workout_id)
    conn.execute(f"UPDATE workout_sets SET {','.join(fields)} WHERE id=? AND workout_id=?", values)
    conn.commit()
    row = conn.execute(
        """SELECT s.*, e.name as exercise_name
           FROM workout_sets s JOIN exercises e ON e.id=s.exercise_id
           WHERE s.id=?""", (set_id,)).fetchone()
    return row_to_dict(row)

@router.delete("/{workout_id}/sets/{set_id}", status_code=204)
def delete_set(workout_id: int, set_id: int, conn: sqlite3.Connection = Depends(db)):
    conn.execute("DELETE FROM workout_sets WHERE id=? AND workout_id=?", (set_id, workout_id))
    conn.commit()
    return None

@router.get("/{workout_id}/summary")
def workout_summary(workout_id: int, conn: sqlite3.Connection = Depends(db)):
    w = enrich_workout(conn, workout_id)
    total_sets = len(w["sets"])
    total_reps = sum(s["reps"] or 0 for s in w["sets"])
    total_volume = sum((s["reps"] or 0) * (s["weight_kg"] or 0) for s in w["sets"])
    exercises_done = len({s["exercise_id"] for s in w["sets"]})
    return {"workout_id": workout_id, "total_sets": total_sets, "total_reps": total_reps,
            "total_volume_kg": total_volume, "exercises_done": exercises_done}
