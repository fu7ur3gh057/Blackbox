from typing import AsyncIterator, Protocol


class LogSource(Protocol):
    name: str

    def stream(self) -> AsyncIterator[str]: ...
