from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

# --- Dashboard ---
class DashboardSummary(BaseModel):
    total_workouts: int = 0
    total_volume_kg: float = 0.0
    current_streak_days: int = 0
    last_workout_at: Optional[str] = None

class Goal(BaseModel):
    id: str
    metric: str
    target: float
    deadline: str

class Dashboard(BaseModel):
    user_id: str
    period: str
    summary: DashboardSummary
    recent_logs: List[dict]
    goals: List[Goal] = []

# --- Logs ---
class AgentSet(BaseModel):
    exercise_id: int
    set_number: int = Field(default=1, ge=1)
    reps: int = Field(ge=0)
    weight_kg: Optional[float] = None
    rpe: Optional[int] = Field(default=None, ge=1, le=10)
    notes: Optional[str] = None

class AgentLogEntry(BaseModel):
    name: str
    date: str
    notes: Optional[str] = None
    template_id: Optional[int] = None
    sets: List[AgentSet]

class LogWriteRequest(BaseModel):
    idempotency_key: Optional[str] = Field(default=None, min_length=8)
    entries: List[AgentLogEntry]

class LogWriteResponse(BaseModel):
    created_ids: List[int]
    created_at: str

# --- Presets (agents call exercises/templates presets) ---
class PresetExerciseCreate(BaseModel):
    name: str
    category: Optional[str] = None
    equipment: Optional[str] = None
    muscle_group: Optional[str] = None
    notes: Optional[str] = None

class PresetTemplateExerciseCreate(BaseModel):
    exercise_id: int
    sets_target: int = 3
    reps_target: Optional[str] = None
    weight_default: Optional[float] = None
    rest_seconds: int = 90
    order_index: int

class PresetTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = False
    exercises: List[PresetTemplateExerciseCreate] = []

class PresetTemplate(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: Optional[str]
    exercises: List[dict]

class PresetList(BaseModel):
    exercises: List[dict]
    routines: List[PresetTemplate]

# --- Plans ---
class PlanConstraints(BaseModel):
    sessions_per_week: int = Field(ge=1, le=7)
    duration_minutes: int
    focus: List[str] = []
    equipment: List[str] = []
    injuries: List[str] = []
    preferred_split: Optional[str] = None

class PlanUserContext(BaseModel):
    experience_level: Optional[str] = "beginner"
    recent_maxes: List[AgentSet] = []

class PlanProposeRequest(BaseModel):
    constraints: PlanConstraints
    user_context: Optional[PlanUserContext] = None

class PlannedExercise(BaseModel):
    exercise_id: int
    exercise_name: Optional[str] = None
    sets: int
    reps: str
    rest_seconds: int = 90

class PlannedSession(BaseModel):
    day: int = Field(ge=1)
    focus: str
    exercises: List[PlannedExercise]

class Plan(BaseModel):
    id: str
    status: str = "proposed"
    rationale: Optional[str] = None
    sessions: List[PlannedSession]
