# NeatFleet MVP

NeatFleet is a cloud-hosted route planning and dispatch MVP inspired by field-service route management workflows.

Live application: <https://mybolzich.github.io/NeatFleet_mvp/>

## Operational MVP flows

- Authenticated, company-scoped workspaces
- Persistent jobs, vehicles, routes, route stops, and dispatch events in Supabase
- Create and filter jobs
- Assign jobs to routes
- Optimize work across available routes
- Dispatch routes and update vehicle/job status
- Mark live stops arrived or completed
- Review overview, jobs, live operations, team/fleet, notifications, timeline, and audit activity
- Automatic deployment through GitHub Actions

## Local development

Copy `.env.example` to `.env.local`, configure the public Supabase variables, then run:

```bash
npm install
npm run dev
```

Local setup is only for development. Reviewers use the live GitHub Pages URL.
