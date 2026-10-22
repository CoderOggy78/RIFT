from typing import Literal, Union, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


class DeleteFileArguments(BaseModel):
    path: str = Field(..., description="Relative path of file to delete")

    @field_validator("path")
    @classmethod
    def validate_path(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Path cannot be empty")
        if ".." in v or v.startswith("/") or v.startswith("\\"):
            raise ValueError("Invalid path syntax or directory traversal detected")
        return v.strip()


class WriteFileArguments(BaseModel):
    path: str = Field(..., description="Relative destination path")
    content: str = Field(default="", description="Text content to write (max 1MB)")

    @field_validator("path")
    @classmethod
    def validate_path(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Path cannot be empty")
        if ".." in v or v.startswith("/") or v.startswith("\\"):
            raise ValueError("Invalid path syntax or directory traversal detected")
        return v.strip()

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 1024 * 1024:
            raise ValueError("File content exceeds 1MB limit")
        return v


class MoveFileArguments(BaseModel):
    source: str = Field(..., description="Relative source path")
    destination: str = Field(..., description="Relative destination path")

    @field_validator("source", "destination")
    @classmethod
    def validate_paths(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Path cannot be empty")
        if ".." in v or v.startswith("/") or v.startswith("\\"):
            raise ValueError("Invalid path syntax or directory traversal detected")
        return v.strip()


class RunValidationArguments(BaseModel):
    validator_id: Literal["fixture-integrity"] = Field(
        ...,
        description="ID of pre-registered deterministic validator"
    )


SUPPORTED_OPERATIONS = Literal["delete_file", "write_file", "move_file", "run_validation"]


class TypedOperation(BaseModel):
    operation: SUPPORTED_OPERATIONS
    arguments: Dict[str, Any]

    def validate_and_parse_args(self) -> Union[DeleteFileArguments, WriteFileArguments, MoveFileArguments, RunValidationArguments]:
        if self.operation == "delete_file":
            return DeleteFileArguments(**self.arguments)
        elif self.operation == "write_file":
            return WriteFileArguments(**self.arguments)
        elif self.operation == "move_file":
            return MoveFileArguments(**self.arguments)
        elif self.operation == "run_validation":
            return RunValidationArguments(**self.arguments)
        raise ValueError(f"Unsupported operation: '{self.operation}'")
