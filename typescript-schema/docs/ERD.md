# IronLog Database ERD

> Target: Cloudflare D1 (SQLite) via Drizzle ORM.

## Entities

### users
Core account and profile settings. One row per person.
- `id` TEXT PK
- `email` TEXT UNIQUE NOT NULL
- `name` TEXT
- `avatarUrl` TEXT
- `timezone` TEXT default 'UTC'
- `unitSystem` TEXT CHECK('metric','imperial') default 'metric'
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### goals
User-defined nutrition / body goals per time window.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `type` TEXT CHECK('calories','protein','carbs','fat','weight','bodyFat','water','custom')
- `targetValue` REAL NOT NULL
- `unit` TEXT
- `period` TEXT CHECK('daily','weekly','monthly') default 'daily'
- `startDate` INTEGER
- `endDate` INTEGER
- `isActive` INTEGER default 1
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### foods
Food catalog. Supports global presets and user-owned foods.
- `id` TEXT PK
- `ownerId` TEXT FK -> users.id ON DELETE CASCADE (NULL for global presets)
- `name` TEXT NOT NULL
- `brand` TEXT
- `barcode` TEXT
- `servingSize` REAL default 100
- `servingUnit` TEXT default 'g'
- `caloriesPerServing` REAL NOT NULL
- `proteinPerServing` REAL default 0
- `carbsPerServing` REAL default 0
- `fatPerServing` REAL default 0
- `fiberPerServing` REAL default 0
- `sugarPerServing` REAL default 0
- `sodiumPerServing` REAL default 0
- `isVerified` INTEGER default 0
- `source` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### meals
Daily meal entries. Each row = one food at one meal.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `date` INTEGER NOT NULL (epoch day or ms)
- `mealType` TEXT CHECK('breakfast','lunch','dinner','snack','preworkout','postworkout')
- `foodId` TEXT FK -> foods.id ON DELETE SET NULL
- `presetId` TEXT FK -> meal_presets.id ON DELETE SET NULL
- `quantity` REAL default 1
- `quantityUnit` TEXT default 'serving'
- `note` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### meal_presets
Reusable meal templates / saved dishes.
- `id` TEXT PK
- `ownerId` TEXT FK -> users.id ON DELETE CASCADE
- `name` TEXT NOT NULL
- `items` JSON NOT NULL (array of {foodId, quantity, quantityUnit})
- `isPublic` INTEGER default 0
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### exercises
Exercise library. Global + user-owned custom exercises.
- `id` TEXT PK
- `ownerId` TEXT FK -> users.id ON DELETE CASCADE (NULL for global)
- `name` TEXT NOT NULL
- `category` TEXT CHECK('strength','cardio','hybrid','mobility','sports')
- `muscleGroup` TEXT
- `equipment` TEXT
- `instructions` TEXT
- `videoUrl` TEXT
- `isVerified` INTEGER default 0
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### workout_plans
Structured training programs / routines.
- `id` TEXT PK
- `ownerId` TEXT FK -> users.id ON DELETE CASCADE
- `name` TEXT NOT NULL
- `description` TEXT
- `frequencyDays` INTEGER
- `difficulty` TEXT CHECK('beginner','intermediate','advanced')
- `isPublic` INTEGER default 0
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### workout_plan_exercises
Junction + ordering + default sets/reps per plan.
- `id` TEXT PK
- `planId` TEXT FK -> workout_plans.id ON DELETE CASCADE
- `exerciseId` TEXT FK -> exercises.id ON DELETE CASCADE
- `dayIndex` INTEGER default 1
- `orderIndex` INTEGER default 0
- `defaultSets` INTEGER default 3
- `defaultReps` INTEGER
- `defaultWeightKg` REAL
- `defaultDurationSec` INTEGER
- `restSec` INTEGER
- `note` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### workout_sessions
Logged training session header.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `planId` TEXT FK -> workout_plans.id ON DELETE SET NULL
- `name` TEXT
- `startedAt` INTEGER NOT NULL
- `endedAt` INTEGER
- `durationSec` INTEGER
- `notes` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### workout_session_exercises
Per-exercise log inside a session.
- `id` TEXT PK
- `sessionId` TEXT FK -> workout_sessions.id ON DELETE CASCADE
- `exerciseId` TEXT FK -> exercises.id ON DELETE CASCADE
- `orderIndex` INTEGER default 0
- `note` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### workout_sets
Individual sets with optional failure / tempo flags.
- `id` TEXT PK
- `sessionExerciseId` TEXT FK -> workout_session_exercises.id ON DELETE CASCADE
- `setNumber` INTEGER NOT NULL
- `reps` INTEGER
- `weightKg` REAL
- `durationSec` INTEGER
- `distanceM` REAL
- `rpe` INTEGER CHECK(1-10)
- `isFailure` INTEGER default 0
- `isWarmup` INTEGER default 0
- `note` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### supplements
Supplement library entries + user-defined custom supplements.
- `id` TEXT PK
- `ownerId` TEXT FK -> users.id ON DELETE CASCADE (NULL for global presets)
- `name` TEXT NOT NULL
- `category` TEXT CHECK('vitamin','mineral','protein','creatine','preworkout','omega3','other')
- `unit` TEXT default 'g'
- `defaultDose` REAL
- `frequency` TEXT default 'daily'
- `note` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### supplement_logs
Daily intake tracking.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `supplementId` TEXT FK -> supplements.id ON DELETE CASCADE
- `date` INTEGER NOT NULL
- `dose` REAL NOT NULL
- `takenAt` INTEGER
- `note` TEXT
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### weight_entries
Body weight / composition recordings.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `recordedAt` INTEGER NOT NULL
- `weightKg` REAL NOT NULL
- `bodyFatPercent` REAL
- `muscleMassKg` REAL
- `waterPercent` REAL
- `note` TEXT
- `source` TEXT default 'manual'
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### agent_api_tokens
Scoped API tokens for external agents / integrations.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `name` TEXT NOT NULL
- `tokenHash` TEXT UNIQUE NOT NULL
- `scopes` JSON NOT NULL
- `lastUsedAt` INTEGER
- `expiresAt` INTEGER
- `revokedAt` INTEGER
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

### notifications
In-app and push notification queue.
- `id` TEXT PK
- `userId` TEXT FK -> users.id ON DELETE CASCADE
- `type` TEXT CHECK('reminder','achievement','system','goal')
- `title` TEXT NOT NULL
- `body` TEXT
- `data` JSON
- `readAt` INTEGER
- `sentAt` INTEGER
- `channel` TEXT CHECK('in_app','push','email')
- `createdAt` INTEGER NOT NULL
- `updatedAt` INTEGER NOT NULL

## Relationship Diagram (Mermaid)

```mermaid
users ||--o{ goals : owns
users ||--o{ foods : owns
users ||--o{ meals : logs
users ||--o{ meal_presets : owns
users ||--o{ exercises : owns
users ||--o{ workout_plans : owns
users ||--o{ workout_sessions : performs
users ||--o{ supplements : owns
users ||--o{ supplement_logs : takes
users ||--o{ weight_entries : records
users ||--o{ agent_api_tokens : issues
users ||--o{ notifications : receives

workout_plans ||--o{ workout_plan_exercises : contains
exercises ||--o{ workout_plan_exercises : used_in
workout_sessions ||--o{ workout_session_exercises : contains
exercises ||--o{ workout_session_exercises : logged
workout_session_exercises ||--o{ workout_sets : has

foods ||--o{ meals : eaten_in
meal_presets ||--o{ meals : used_as
supplements ||--o{ supplement_logs : logged_in
```
