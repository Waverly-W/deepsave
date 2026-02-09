from app.core.security import create_access_token, hash_password, verify_password
from app.exceptions import UnauthorizedError
from app.models.user import User
from app.repositories.user_repo import UserRepository


class AuthService:
    def __init__(self, session) -> None:
        self._users = UserRepository(session)

    async def login(self, password: str) -> str:
        user = await self._users.get_first()
        if user is None:
            raise UnauthorizedError("No admin user configured")
        if not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid credentials")
        return create_access_token(str(user.id))

    async def setup_admin(self, password: str) -> str:
        if await self._users.count_users() > 0:
            raise ValueError("Admin user already configured")

        user = User(password_hash=hash_password(password))
        await self._users.create(user)
        return create_access_token(str(user.id))
