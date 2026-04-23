# ViBe Setup and Run Commands (Windows)

## 1) Open project root

```powershell
cd c:\Users\ADMIN\Documents\Projects\vibe-combined-updates
```

## 2) Install dependencies (workspace)

```powershell
pnpm.cmd install
```

## 3) Configure backend environment

Edit `backend/.env` and set a real `DB_URL`.

Example local value:

```env
DB_URL="mongodb://127.0.0.1:27017"
DB_NAME="vibe"
```

## 4) Start frontend + backend together

```powershell
.\run-all.cmd
```

Alternative direct command:

```powershell
pnpm.cmd dev
```

## 5) URLs

- Frontend: http://localhost:5173 (or 5174 if 5173 is occupied)
- Backend: http://localhost:8080
