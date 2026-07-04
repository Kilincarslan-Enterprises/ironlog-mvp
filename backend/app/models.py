from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ExerciseCreate(BaseModel):
    name: str
    category: Optional[str] = None
    equipment: Optional[str] = None
    muscle_group: Optional[str] = None
    notes: Optional[str] = None

class Exercise(ExerciseCreate):
    id: int
    created_at: Optional[str] = None

class WorkoutTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TemplateExerciseCreate(BaseModel):
    exercise_id: int
    sets_target: int = 3
    reps_target: Optional[str] = None
    weight_default: Optional[float] = None
    rest_seconds: int = 90
    order_index: int

class TemplateExercise(TemplateExerciseCreate):
    id: int
    exercise_name: Optional[str] = None

class WorkoutTemplate(WorkoutTemplateCreate):
    id: int
    is_active: bool = False
    created_at: Optional[str] = None
    exercises: List[TemplateExercise] = []

class WorkoutCreate(BaseModel):
    workout_template_id: Optional[int] = None
    name: str
    date: str

class Workout(WorkoutCreate):
    id: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None
    completed: bool = False
    created_at: Optional[str] = None

class SetCreate(BaseModel):
    exercise_id: int
    set_number: int = Field(ge=1)
    reps: int = Field(ge=0)
    weight_kg: Optional[float] = None
    rpe: Optional[int] = Field(default=None, ge=1, le=10)
    notes: Optional[str] = None

class Set(SetCreate):
    id: int
    logged_at: Optional[str] = None
    exercise_name: Optional[str] = None

class SetUpdate(BaseModel):
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    rpe: Optional[int] = None
    notes: Optional[str] = None

class UserOut(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: str = "user"
    created_at: Optional[str] = None

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    scopes: List[str] = Field(default_factory=lambda: ["read"])
    expires_at: Optional[str] = None

class ApiKeyOut(BaseModel):
    id: str
    user_id: str
    name: str
    scopes: List[str]
    prefix: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: Optional[str] = None
    last_used_at: Optional[str] = None
    secret: Optional[str] = None

