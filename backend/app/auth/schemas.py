from datetime import datetime

from pydantic import BaseModel


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    createdAt: datetime


class AuthResponse(BaseModel):
    user: UserResponse
    token: str
