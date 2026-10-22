from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder

from app.core.config import settings
from app.db.session import engine, Base
from app.api.endpoints import router as api_router
import app.models  # Ensure models are imported for metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist on boot
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Local-First AI Agent Incident Investigation & Observability Platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Format Pydantic schema validation errors with actionable details."""
    errors = []
    sanitized_errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid input")
        errors.append(f"{field}: {msg}")
        sanitized_errors.append({
            "type": err.get("type"),
            "loc": err.get("loc"),
            "msg": msg,
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "; ".join(errors), "errors": sanitized_errors},
    )


# Mount the API router under /api
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["Root"])
def root():
    return {
        "name": "RIFT",
        "tagline": "Between what agents intend and what they do.",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health",
        "status": "/api/system/status",
    }
