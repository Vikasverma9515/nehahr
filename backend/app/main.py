import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import candidates, calls, jobs, webhooks, interviewers, auth, interviews, hr_sender


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Neha HR backend starting...")
    # Start background scheduler for auto-reminders and result calls
    from app.workers.scheduler import run_scheduler
    scheduler_task = asyncio.create_task(run_scheduler())
    yield
    scheduler_task.cancel()
    print("Neha HR backend shutting down...")


app = FastAPI(
    title="Neha AI HR Agent",
    description="Voice & Call-Based HR Automation",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in {"http://localhost:3000", settings.frontend_url} if o],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(interviewers.router, prefix="/api/interviewers", tags=["interviewers"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["interviews"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(hr_sender.router, prefix="/api/hr-sender", tags=["hr_sender"])


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "neha", "version": "0.3.0"}
