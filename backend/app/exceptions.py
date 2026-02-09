class AppError(Exception):
    """Base application error."""


class NotFoundError(AppError):
    """Resource not found."""


class UnauthorizedError(AppError):
    """Authentication failed."""
