# Diagrama UML / ER — Base de Datos Geest API

Este documento detalla el modelo de datos relacional de **Geest API**, incluyendo el diagrama UML/ER en formato Mermaid, los tipos de datos, restricciones, claves primarias/foráneas y relaciones.

---

## 1. Diagrama Entidad-Relación / UML (Mermaid)

```mermaid
erDiagram
    USERS {
        uuid id PK "UUID (gen_random_uuid())"
        varchar(255) name "Nombre del usuario"
        varchar(255) last_name "Apellido del usuario"
        varchar(255) email UK "Correo electrónico único"
        timestamp created_at "Fecha de creación"
        timestamp updated_at "Fecha de actualización"
    }

    TASKS {
        uuid id PK "UUID (gen_random_uuid())"
        varchar(255) title "Título de la tarea"
        text description "Descripción opcional"
        varchar(50) status "'open' | 'archived'"
        timestamp created_at "Fecha de creación"
        timestamp updated_at "Fecha de actualización"
    }

    TASK_ASSIGNMENTS {
        uuid id PK "UUID (gen_random_uuid())"
        uuid task_id FK "Referencia a TASKS(id) ON DELETE CASCADE"
        uuid user_id FK "Referencia a USERS(id) ON DELETE CASCADE"
        boolean is_completed "Estado de avance del usuario (default: false)"
        timestamp completed_at "Fecha en que completó su parte"
        timestamp created_at "Fecha de asignación"
        timestamp updated_at "Fecha de actualización"
    }

    TASK_NOTIFICATIONS {
        uuid id PK "UUID (gen_random_uuid())"
        uuid task_id FK "Referencia a TASKS(id) ON DELETE CASCADE"
        varchar(50) status "'sent' | 'failed' | 'pending'"
        int attempt_number "Número de intento (1..3)"
        int http_status "Código de respuesta HTTP"
        text details "Mensaje de éxito o detalle del error"
        timestamp created_at "Fecha del intento"
        timestamp updated_at "Fecha de actualización"
    }

    IDEMPOTENCY_KEYS {
        varchar(255) key PK "Clave UUID de idempotencia"
        varchar(255) request_path "Endpoint invocado (ej. /tasks)"
        varchar(10) request_method "Método HTTP (POST)"
        varchar(64) request_hash "Hash SHA-256 canónico del payload"
        int status_code "Código HTTP de respuesta (ej. 200, 201)"
        text response_body "Cuerpo de respuesta cacheado en JSON"
        jsonb headers "Cabeceras HTTP de respuesta"
        timestamp created_at "Fecha de registro"
        timestamp updated_at "Fecha de actualización"
    }

    %% Relaciones
    USERS ||--o{ TASK_ASSIGNMENTS : "1 usuario tiene muchas asignaciones"
    TASKS ||--o{ TASK_ASSIGNMENTS : "1 tarea asignada a múltiples usuarios"
    TASKS ||--o{ TASK_NOTIFICATIONS : "1 tarea registra múltiples intentos de notificación"
```

---

## 2. Diagrama de Clases UML (Estructura de Entidades)

```mermaid
classDiagram
    class User {
        +UUID id
        +String name
        +String lastName
        +String email
        +Date createdAt
        +Date updatedAt
    }

    class Task {
        +UUID id
        +String title
        +String description
        +TaskStatus status
        +Date createdAt
        +Date updatedAt
    }

    class TaskAssignment {
        +UUID id
        +UUID taskId
        +UUID userId
        +Boolean isCompleted
        +Date completedAt
        +Date createdAt
        +Date updatedAt
    }

    class TaskNotification {
        +UUID id
        +UUID taskId
        +NotificationStatus status
        +Integer attemptNumber
        +Integer httpStatus
        +String details
        +Date createdAt
        +Date updatedAt
    }

    class IdempotencyRecord {
        +String key
        +String requestPath
        +String requestMethod
        +String requestHash
        +Integer statusCode
        +String responseBody
        +Object headers
        +Date createdAt
        +Date updatedAt
    }

    User "1" <-- "*" TaskAssignment : assignedTo
    Task "1" <-- "*" TaskAssignment : belongsTo
    Task "1" <-- "*" TaskNotification : triggers
```

---

## 3. Especificación Detallada de Tablas

### `users`
| Campo | Tipo | Nulo | Default | Restricciones / Notas |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria (PK) |
| `name` | `VARCHAR(255)` | NO | - | Nombre de usuario |
| `last_name` | `VARCHAR(255)` | NO | - | Apellido |
| `email` | `VARCHAR(255)` | NO | - | Único (`UNIQUE`), Índice `idx_users_email` |
| `created_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Actualizado vía Trigger |

---

### `tasks`
| Campo | Tipo | Nulo | Default | Restricciones / Notas |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria (PK) |
| `title` | `VARCHAR(255)` | NO | - | Título de la tarea |
| `description` | `TEXT` | SÍ | `NULL` | Detalle o contexto opcional |
| `status` | `VARCHAR(50)` | NO | `'open'` | `CHECK (status IN ('open', 'archived'))`, Índice `idx_tasks_status` |
| `created_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Actualizado vía Trigger |

---

### `task_assignments`
| Campo | Tipo | Nulo | Default | Restricciones / Notas |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria (PK) |
| `task_id` | `UUID` | NO | - | FK &rarr; `tasks(id)` `ON DELETE CASCADE` |
| `user_id` | `UUID` | NO | - | FK &rarr; `users(id)` `ON DELETE CASCADE` |
| `is_completed` | `BOOLEAN` | NO | `FALSE` | Bandera de progreso del usuario |
| `completed_at` | `TIMESTAMP` | SÍ | `NULL` | Fecha en que el usuario completó su parte |
| `created_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Actualizado vía Trigger |

* **Constraint única:** `UNIQUE (task_id, user_id)` (un usuario no puede estar asignado repetidamente a la misma tarea).
* **Índices:** `idx_task_assignments_task_id`, `idx_task_assignments_user_id`, `idx_task_assignments_status (user_id, is_completed)`.

---

### `task_notifications`
| Campo | Tipo | Nulo | Default | Restricciones / Notas |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria (PK) |
| `task_id` | `UUID` | NO | - | FK &rarr; `tasks(id)` `ON DELETE CASCADE` |
| `status` | `VARCHAR(50)` | NO | `'sent'` | `CHECK (status IN ('sent', 'failed', 'pending'))` |
| `attempt_number` | `INT` | NO | `1` | Intento actual (1, 2 o 3) |
| `http_status` | `INT` | SÍ | `NULL` | Código de estado HTTP retornado por `NOTIFY_URL` |
| `details` | `TEXT` | SÍ | `NULL` | Detalle o mensaje de error en caso de fallo |
| `created_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de ejecución del intento |
| `updated_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Actualizado vía Trigger |

---

### `idempotency_keys`
| Campo | Tipo | Nulo | Default | Restricciones / Notas |
|---|---|---|---|---|
| `key` | `VARCHAR(255)` | NO | - | Clave Primaria (PK) enviada en header `Idempotency-Key` |
| `request_path` | `VARCHAR(255)` | NO | - | Ruta de la petición |
| `request_method` | `VARCHAR(10)` | NO | - | Método (`POST`) |
| `request_hash` | `VARCHAR(64)` | NO | - | Hash SHA-256 del cuerpo |
| `status_code` | `INT` | NO | - | Código HTTP retornado |
| `response_body`| `TEXT` | NO | - | Payload serializado devuelto |
| `headers` | `JSONB` | SÍ | `NULL` | Cabeceras adicionales si aplica |
| `created_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Índice `idx_idempotency_keys_created_at` |
| `updated_at`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Actualizado vía Trigger |
