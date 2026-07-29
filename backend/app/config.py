from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str = "dev-secret-change-me"

    class Config:
        env_file = ".env"


settings = Settings()
