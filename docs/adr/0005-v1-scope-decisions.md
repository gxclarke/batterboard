# 0005. v1 scope: one project, gate tracing on small screens

Date: 2026-09-18. Status: accepted.

## Decisions

- **One project.** The app autosaves a single current project to IndexedDB. Sharing and backup are export/import of a project file. The schema keeps `id` and `name` so a project list can arrive later without a migration.
- **Small screens.** Tracing and calibration are gated below tablet width with a message to come back on a laptop. The 3D viewport and parameter panel work everywhere.
- **Hip roofs on masses** are restricted to rectangular footprints and the UI says so (from the plan, restated here so it is not lost).
