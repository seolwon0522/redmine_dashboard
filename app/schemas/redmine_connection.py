"""Redmine 연결 API 스키마."""

from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import RedmineConfig

RedmineAuthType = Literal["api_key", "basic"]
RedmineConnectionSource = Literal["environment", "file", "legacy_config", "cleared", "none"]


class RedmineConnectionRequest(BaseModel):
    base_url: str = Field(..., description="Redmine base URL")
    auth_type: RedmineAuthType = Field(..., description="Authentication method")
    api_key: str | None = Field(default=None, description="Redmine API key")
    username: str | None = Field(default=None, description="Redmine username")
    password: str | None = Field(default=None, description="Redmine password")

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized:
            raise ValueError("Redmine Base URL is required.")

        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Enter a valid Redmine Base URL including http:// or https://.")

        return normalized

    @field_validator("api_key", "username")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_auth_fields(self):
        if self.auth_type == "api_key":
            if not self.api_key:
                raise ValueError("API Key is required when API Key authentication is selected.")
            self.username = None
            self.password = None
        else:
            if not self.username:
                raise ValueError("Username is required when ID / Password authentication is selected.")
            if not self.password:
                raise ValueError("Password is required when ID / Password authentication is selected.")
            self.api_key = None

        return self

    def to_config(self, defaults: RedmineConfig | None = None) -> RedmineConfig:
        timeout = defaults.timeout if defaults is not None else 30
        retry_attempts = defaults.retry_attempts if defaults is not None else 3
        page_size = defaults.page_size if defaults is not None else 100

        return RedmineConfig(
            base_url=self.base_url,
            auth_type=self.auth_type,
            api_key=self.api_key,
            username=self.username,
            password=self.password,
            timeout=timeout,
            retry_attempts=retry_attempts,
            page_size=page_size,
        )


class RedmineConnectionSummary(BaseModel):
    base_url: str
    auth_type: RedmineAuthType
    auth_identity: str
    source: RedmineConnectionSource
    uses_https: bool


class RedmineConnectionStatusResponse(BaseModel):
    configured: bool
    connected: bool
    can_save: bool
    message: str
    warning: str | None = None
    server_user: str | None = None
    connection: RedmineConnectionSummary | None = None


class RedmineConnectionTestResponse(BaseModel):
    success: bool
    message: str
    warning: str | None = None
    server_user: str | None = None
    connection: RedmineConnectionSummary


class RedmineConnectionSaveResponse(BaseModel):
    saved: bool
    message: str
    warning: str | None = None
    server_user: str | None = None
    cleared_cache_keys: int = 0
    connection: RedmineConnectionSummary


class RedmineConnectionDeleteResponse(BaseModel):
    deleted: bool
    message: str
    cleared_cache_keys: int = 0