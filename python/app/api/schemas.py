from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class RunJobRequest(BaseModel):
    playbook: str = Field(min_length=1, max_length=255)
    inventory: Optional[str] = Field(default=None, max_length=255)
    extra_vars: Optional[Dict[str, Any]] = None
    limit: Optional[str] = None
    tags: Optional[str] = None
    check_mode: bool = False
    diff_mode: bool = False
