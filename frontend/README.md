# Optronix Visits: frontend

Next.js 15 (App Router) + TypeScript. Talks to the Express API in `../backend`.

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                    # http://localhost:3000
```
Start the backend first (`npm run seed && npm run dev` in `../backend`). Sign in with a demo account, password `Password@123`:
`ravi@optronix.test` (sales), `manager1@optronix.test` (manager of Ravi and Sana), `admin@optronix.test`.

## Screens
| Route | Purpose |
|---|---|
| `/login` | Sign in |
| `/meetings` | Day-grouped list; Upcoming / Today / Earlier / All; status and employee filters; "you are on site" banner |
| `/meetings/new` | Schedule against an account and contact; managers/admins can assign to someone else |
| `/meetings/[id]` | Lifecycle actions, **scheduled-vs-actual ruler**, details, notes, follow-ups, audit history |
| `/follow-ups` | Open / Overdue / Done, mark done or cancel |
| `/accounts` | Accounts and contacts |
| `/team` | Manager/admin: team list; admin: add and deactivate users |

## How it follows the backend
* **The server decides what you can do.** The meeting page renders buttons from `meeting.allowedActions`, so the UI never re-implements lifecycle or permission rules. The API still enforces everything and its error messages are shown in the dialogs.
* **Check-in / check-out** capture GPS with the browser Geolocation API. If it is denied or unavailable (e.g. a desktop), coordinates can be typed so the flow is never blocked. Timestamps are not sent: the server stamps them.
* **The "come back later" case** is the *Check out* dialog: choose "The customer asked me to come back" and pick the return time. The meeting becomes *Awaiting return*; the ruler shows the first visit as a bar and a marker at the return time. Checking in again adds a second bar, and amber means the visit started late.
* **Completing** requires an outcome; "Follow-up required" reveals a required follow-up form (owner limited to the assignee, their manager or an admin, matching the API).
* Dates are shown in the browser's time zone and sent to the API as ISO-8601 with offset.

## Structure
```
src/app/            routes ((app) group = authenticated shell)
src/components/     Shell, Modal (native <dialog>), MeetingModals, VisitRuler, LocationPicker, ui helpers
src/lib/            api client, auth context (JWT in localStorage), useFetch, formatting, types
```

## Trade-offs
* JWT in `localStorage` is simple but exposed to XSS; production should use httpOnly cookies (needs a same-site API or a Next route proxy).
* Plain `fetch` + a small hook; no cache or optimistic updates (React Query/SWR is the next step).
* No offline queue for check-in/out on poor connections, and no browser end-to-end tests yet (Playwright would cover the scenario flow).
* The UI was type-checked, production-built and every route served, but it has not been exercised in a real browser in this environment.
