"""Application configuration"""
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Novel Reading Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # API
    API_PREFIX: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./novel.db"
    
    # LegadoParser path
    LEGADO_PARSER_PATH: Path = Path(__file__).parent.parent.parent / "LegadoParser" / "LegadoParser-main"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

