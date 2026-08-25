# Geest API — Task & Notification Management Service

API REST robusta construida con **Node.js**, **Express**, **TypeScript** y **Arquitectura Hexagonal (Ports & Adapters)** para la gestión de usuarios, tareas colaborativas con asignación múltiple, archivado automático con despacho de notificaciones externas resilientes e idempotencia en operaciones de escritura.

---

## 1. Guía de Ejecución Local

### Prerrequisitos

- **Node.js**: `v22+`
- **pnpm**: `v10+` (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker y Docker Compose** _(opcional, para base de datos o ejecución en contenedores)_

### Paso a paso

1. **Clonar e instalar dependencias:**

   ```bash
   git clone <repo-url> && cd geest-api
   pnpm install
   ```

2. **Configurar variables de entorno:**

   ```bash
   cp .env.default .env
   ```

   _Nota: Por defecto `DB_PROVIDER=postgres`. Si deseas ejecutar en memoria sin base de datos externa para pruebas rápidas, puedes configurar `DB_PROVIDER=none`._

3. **(Opcional) Levantar base de datos PostgreSQL con Docker:**

   ```bash
   docker compose up -d postgres # o tu contenedor local de Postgres en el puerto 5432
   ```

4. **Comandos de desarrollo y validación:**

   ```bash
   # Iniciar en modo desarrollo (con hot-reload)
   pnpm dev

   # Ejecutar suite de pruebas unitarias y de integración
   pnpm test

   # Ejecutar linter y formateador (Biome)
   pnpm run check

   # Compilar a producción
   pnpm run build

   # Iniciar build de producción
   pnpm start
   ```

5. **Ejecución completa con Docker:**
   ```bash
   docker compose build && docker compose up
   ```

> 💡 **Documentación y Recursos:** En la carpeta [`docs/`](./docs) se encuentran:
>
> - [`DATABASE_UML.md`](./docs/DATABASE_UML.md): Diagrama UML / ER completo de la base de datos con tipos de datos, relaciones y diccionario.
> - [`schema.sql`](./docs/schema.sql): Script DDL completo de PostgreSQL para inicializar la base de datos (tablas, índices, claves foráneas y triggers).
> - [`geest-api.postman_collection.json`](./docs/geest-api.postman_collection.json) junto con los entornos [`geest-api.postman_environment.json`](./docs/geest-api.postman_environment.json) (Local) y [`geest-api.prod.postman_environment.json`](./docs/geest-api.prod.postman_environment.json) (Cloud Run Prod: `https://geest-api-467505787185.us-west1.run.app`).

---

## 2. Decisiones Técnicas y Justificación

- **Arquitectura Hexagonal (Puertos y Adaptadores):**
  - **Dominio (`src/hexagonal/domain`):** Entidades, DTOs y contratos (interfaces/puertos) puros, sin dependencias de frameworks ni librerías externas.
  - **Aplicación (`src/hexagonal/application`):** Casos de uso (`TaskUseCase`, `UserUseCase`, `NotificationService`) que orquestan las reglas de negocio.
  - **Infraestructura (`src/hexagonal/infrastructure`):** Implementaciones desacopladas con adaptadores intercambiables (TypeORM/PostgreSQL e In-Memory para testing ultrarrápido).
  - **Presentación (`src/hexagonal/presentation`):** Controladores, middlewares y routers Express.
- **Middleware de Idempotencia por Hash SHA-256:**
  - Evita ejecuciones duplicadas de solicitudes `POST` usando la cabecera `Idempotency-Key`.
  - Almacena el hash SHA-256 del cuerpo de la petición. Si se recibe la misma clave con el mismo payload, retorna la respuesta cacheada; si el payload cambia, rechaza con `409 Conflict`.
- **Servicio de Notificaciones Asíncrono con Reintentos Exponenciales:**
  - El archivado de una tarea desencadena la notificación externa de forma desacoplada y asíncrona (no bloquea el endpoint HTTP del cliente).
  - Estrategia de reintentos: 3 intentos con retroceso exponencial (`1000ms`, `2000ms`, `4000ms`) y registro detallado de cada intento en base de datos. Solo reintenta ante errores de red o `5xx` (descarta errores cliente `4xx`).
- **Seguridad y Resiliencia:**
  - `Helmet` para headers HTTP seguros, `CORS` configurado, `express-rate-limit` para mitigación de abusos y formato unificado de respuestas y errores: `{ "code": "...", "message": "...", "data": ... }` y `{ "error": { "code": "...", "message": "..." } }`.
- **Paginación Avanzada y Flexible (Offset & Cursor):**
  - Todos los endpoints de listado (`GET /api/tasks`, `GET /api/users`, `GET /api/users/:idUser/tasks`, `GET /api/tasks/:idTask/notifications`) soportan `page`, `limit`, `offset`, `order` ('ASC'/'DESC') y navegación por `cursor` opaco (`nextCursor`).
  - La respuesta entrega el cálculo dinámico de `page`, `totalPages`, `totalItems`, `hasNextPage`, `hasPrevPage` y `nextCursor`.

---

## 3. Supuestos Realizados ante Ambigüedades

1. **Condición de Archivado y Notificación:**
   - Una tarea nace con estado `open` y solo pasa a estado `archived` (disparando la notificación externa) cuando **todos los usuarios asignados** han invocado `POST /api/tasks/:idTask/complete`.
   - Si una tarea no tiene usuarios asignados, no puede completarse hasta que se asigne al menos uno.
2. **Concurrencia en Completación de Tareas:**
   - Se manejó la condición de carrera donde dos usuarios asignados completan la tarea casi en simultáneo: la verificación y cambio a `archived` se realiza de manera atómica (`UPDATE tasks SET status = 'archived' WHERE id = :id AND status = 'open'`) para garantizar que la notificación se despache **exactamente una vez**.
3. **Idempotencia con Mismo Key pero Distinto Body:**
   - Reutilizar un `Idempotency-Key` existente con un payload distinto se considera una inconsistencia del cliente, respondiendo con `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
4. **Validación de Identidad y Duplicados:**
   - La asignación de usuarios a una tarea ignora duplicados en la misma petición y valida la existencia previa tanto de la tarea como de cada usuario.

---

## 4. Funcionalidades Recortadas por Alcance

1. **Autenticación y Autorización (JWT / OAuth2 / RBAC):**
   - Actualmente las rutas reciben `userId` en el payload/parámetros. En un entorno productivo esto se extraería de un token Bearer validado.
2. **Métricas y Trazabilidad Distribuida:**
   - Se recortó la instrumentación con Prometheus / OpenTelemetry para métricas de latencia de endpoints y tasa de éxito de webhooks.
