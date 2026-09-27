from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    frontend_origin: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_must_be_strong(cls, value):
        if value == "change_me_to_a_random_string" or len(value) < 32:
            raise ValueError(
                "JWT_SECRET is missing, still the placeholder, or too short - "
                "set a real random value of at least 32 characters in .env"
            )
        return value


settings = Settings()
