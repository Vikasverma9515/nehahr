import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1, send_default_pii=False)
from app.services.tenancy import enforce_org_scope
from app.routers import candidates, calls, jobs, webhooks, interviewers, auth, interviews, hr_sender


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Neha HR backend starting...")
    # Start background scheduler for auto-reminders and result calls
    from app.workers.scheduler import run_scheduler
    from app.workers.queue import run_worker
    background = [asyncio.create_task(run_scheduler())]
    # RUN_QUEUE_WORKER=false lets a separate `python -m app.workers.queue`
    # process own the work instead of the web process.
    if settings.run_queue_worker:
        background.append(asyncio.create_task(run_worker()))
    yield
    for t in background:
        t.cancel()
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

# Signed in + every referenced record belongs to the caller's organization.
authed = [Depends(enforce_org_scope)]

app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"], dependencies=authed)
app.include_router(calls.public_router, prefix="/api/calls", tags=["calls"])
app.include_router(calls.router, prefix="/api/calls", tags=["calls"], dependencies=authed)
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"], dependencies=authed)
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(interviewers.router, prefix="/api/interviewers", tags=["interviewers"], dependencies=authed)
app.include_router(interviews.public_router, prefix="/api/interviews", tags=["feedback"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["interviews"], dependencies=authed)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(hr_sender.router, prefix="/api/hr-sender", tags=["hr_sender"], dependencies=authed)

@app.get("/health")
async def health():
    return {"status": "ok", "agent": "neha", "version": "0.3.0"}
