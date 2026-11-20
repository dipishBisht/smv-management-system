# API reference (base path `/api/v1`)

All endpoints except `POST /auth/login` and `GET /health` need `Authorization: Bearer <jwt>`.
Datetimes are ISO-8601 with offset (`2026-11-16T10:00:00Z`). Errors: `{ "error": { "code", "message", "details?" } }`
(400 validation · 401 · 403 · 404 · 409 state conflict · 422 business rule).

## Auth

| Method | Path          | Who    | Body                                  |
| ------ | ------------- | ------ | ------------------------------------- |
| POST   | `/auth/login` | public | `{email, password}` → `{token, user}` |
| GET    | `/auth/me`    | any    | –                                     |

## Users

| Method | Path         | Who   | Notes                                                    |
| ------ | ------------ | ----- | -------------------------------------------------------- |
| GET    | `/users`     | any   | admin: all · manager: self+team · employee: self+manager |
| POST   | `/users`     | admin | `{name,email,password,role,managerId?}`                  |
| PATCH  | `/users/:id` | admin | `{name?,role?,managerId?,isActive?}`                     |

## Accounts

| Method | Path                             | Who            | Notes                                  |
| ------ | -------------------------------- | -------------- | -------------------------------------- |
| GET    | `/accounts?search=&page=&limit=` | any            |                                        |
| POST   | `/accounts`                      | any            | `{name,address?,industry?,contacts[]}` |
| GET    | `/accounts/:id`                  | any            |                                        |
| PATCH  | `/accounts/:id`                  | manager, admin |                                        |
| POST   | `/accounts/:id/contacts`         | any            | `{name,designation?,email?,phone?}`    |

## Meetings

| Method | Path                                                              | Who                                                            | Body / notes                                                                                                                                                   |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/meetings?status=&assignedTo=&accountId=&from=&to=&page=&limit=` | any (scoped)                                                   | each item carries `allowedActions` for the caller                                                                                                              |
| POST   | `/meetings`                                                       | employee (self) · manager (team/self) · admin (any sales user) | `{accountId, contactId, purpose, scheduledStart, scheduledEnd, location, assignedTo?, notes?}`                                                                 |
| GET    | `/meetings/:id`                                                   | scoped                                                         | includes `visits[]`, `history[]`, `totalOnSiteMinutes`                                                                                                         |
| PATCH  | `/meetings/:id`                                                   | scoped                                                         | `{purpose?, location?, notes?, contactId?}` (locked when completed/cancelled; purpose/location/contact locked while on site)                                   |
| POST   | `/meetings/:id/confirm`                                           | scoped                                                         | Scheduled → Confirmed                                                                                                                                          |
| POST   | `/meetings/:id/reschedule`                                        | scoped                                                         | `{scheduledStart, scheduledEnd, reason?}` Scheduled/Confirmed → Scheduled                                                                                      |
| POST   | `/meetings/:id/cancel`                                            | scoped                                                         | `{reason}` from Scheduled/Confirmed/On Hold                                                                                                                    |
| POST   | `/meetings/:id/check-in`                                          | **assignee**                                                   | `{location:{lat,lng,accuracy?}}` Confirmed/On Hold → Checked In (new visit)                                                                                    |
| POST   | `/meetings/:id/start`                                             | **assignee**                                                   | Checked In → In Progress                                                                                                                                       |
| POST   | `/meetings/:id/check-out`                                         | **assignee**                                                   | `{disposition:"complete", location, outcome, outcomeNotes?, followUp?}` → Completed · or `{disposition:"return_later", location, returnAt, reason?}` → On Hold |
| POST   | `/meetings/:id/complete`                                          | **assignee**                                                   | `{outcome:"unable_to_meet", outcomeNotes?, followUp?}` – no-show without a visit (Confirmed/On Hold)                                                           |
| POST   | `/meetings/:id/reopen`                                            | manager of assignee, admin                                     | `{reason}` Completed → On Hold                                                                                                                                 |

`outcome` ∈ `interested | follow_up_required | proposal_requested | not_interested | unable_to_meet`
`followUp` = `{ownerId, dueDate, description}` (mandatory for `follow_up_required`).

## Follow-ups

| Method | Path                                                                | Who                     | Notes                                           |
| ------ | ------------------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
| GET    | `/follow-ups?status=&overdue=true&ownerId=&meetingId=&page=&limit=` | scoped                  | `overdue` is computed                           |
| POST   | `/follow-ups`                                                       | scoped                  | `{meetingId, ownerId, dueDate, description}`    |
| GET    | `/follow-ups/:id`                                                   | scoped                  |                                                 |
| PATCH  | `/follow-ups/:id`                                                   | scoped                  | `{ownerId?, dueDate?, description?}` while open |
| POST   | `/follow-ups/:id/complete`                                          | owner, manager, admin   | `{note?}`                                       |
| POST   | `/follow-ups/:id/cancel`                                            | creator, manager, admin | `{reason}`                                      |
