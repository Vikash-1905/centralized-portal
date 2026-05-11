# Phase 2 QA Checklist

Use this checklist to quickly verify the phase-2 admin features after changes.

## 1) Baseline Build Validation

Run from project root:

```bash
npm run lint
npm run build
```

Expected:

- `lint` exits clean.
- `build` completes and writes `dist` assets.

## 2) Backend Runtime Smoke

Start backend:

```bash
npm --prefix backend run start
```

In another terminal:

```bash
curl -s http://localhost:5000/api/health
curl -s http://localhost:5000/api/auth/setup-status
```

Expected:

- Health returns `{"ok":true,"mongo":true}`.
- Setup status returns JSON with `hasAdmin` and `requiresAdminSetup` fields.

## 3) Authenticated Admin Workflow QA

Login as admin from the app and run the checks below.

### Settings Page

- Open `/admin/settings`.
- Change one field (for example `School Code`) and save.
- Refresh page and confirm value persisted.
- Revert to original value and save.

Expected:

- Save works without error.
- Persisted value survives refresh.

### Notifications Page

- Open `/admin/notifications`.
- Publish a test notice.
- Confirm notice appears in list.
- Delete the same test notice.

Expected:

- Publish and delete both succeed.
- List reflects latest state immediately.

### Users Page

- Open `/admin/users`.
- Create a temporary CRM user.
- Deactivate the temporary user, then activate again.
- Reset password for the temporary user.
- Delete the temporary user.

Expected:

- Each action succeeds and updates the table.
- Deleted user is no longer present after refresh.

### Classes & Subjects and Students

- Open `/admin/masters`.
- Add one temporary Class and one temporary Section.
- Open `/admin/students`.
- Admit a temporary student by selecting the created Class and Section.
- In Documents step, upload one file (for example Student Photo) and open its `View` link once.
- Edit the same student and upload a replacement file for the same document field.
- Confirm the latest document `View` link works.
- Delete the temporary student.
- Return to `/admin/masters` and delete the temporary Section and Class.

Expected:

- Student admission succeeds only with configured master Class and Section.
- Replacing a student document keeps the latest file linked to the admission.
- Replaced old file is no longer accessible.
- Student appears in list immediately and is removed after delete.
- Student document files are removed after student deletion.
- Class and Section deletion succeeds after dependent student is removed.

## 4) Optional Extra Coverage

- Use `Manage` actions on teacher/student/parent rows to confirm route handoff.
- Verify admin safety guard by trying to deactivate the last active admin (should be blocked).
- Verify strong password policy behavior if enabled in settings.

## 5) Pass Criteria

- No lint/build failures.
- Backend smoke endpoints healthy.
- Settings, Notifications, Users, and Class/Section + Student admission + document replacement actions all succeed end-to-end.
- No unexpected errors in browser console or backend logs.

## 6) Multi-School SaaS Smoke Test (Manual)

Use two isolated sessions to verify tenant separation. Example:

- Session A: normal browser window.
- Session B: incognito/private window.

### Step A: Create School A

- Open `/login` in Session A.
- Click `Sign Up`.
- Register School A with unique admin email.
- After redirect, verify admin lands in admin dashboard.
- Create one test record under School A (for example one Class, one Student, or one Notice).

Expected:

- Signup succeeds and returns authenticated admin session.
- Created records are visible to School A admin.

### Step B: Create School B

- Open `/login` in Session B.
- Click `Sign Up`.
- Register School B with a different admin email.
- After redirect, verify admin lands in admin dashboard.

Expected:

- Signup succeeds for School B independently.
- School B starts with its own isolated dataset.

### Step C: Isolation Verification (Critical)

- In Session B, check lists where School A created test data (Students, Notices, Classes, etc.).
- Confirm School A records are not visible.
- Create one test record in School B.
- Return to Session A and confirm School B record is not visible.

Expected:

- No cross-tenant record visibility in either direction.
- Both sessions remain authenticated only for their own school context.

### Step D: Login Segregation Check

- Logout in both sessions.
- Log in with School A admin in Session A and School B admin in Session B.
- Confirm each admin only sees their own school's dashboard data.

Expected:

- JWT/session maps each user to correct `schoolId`.
- Data fetches remain school-scoped after re-login.

### SaaS Pass Criteria

- School A and School B can sign up independently.
- Each school has separate admin and separate data scope.
- No school can view or mutate the other school's data.
