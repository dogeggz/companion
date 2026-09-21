import json

from itsdangerous import BadData, URLSafeSerializer


class CheckpointCodec:
    """Signed current-session snapshots. Signing prevents edits; it is not encryption.

    Only give the browser data its authenticated user may read. Keys must come from
    the server's secret configuration. For sensitive/internal context use a host-side
    session store and send only its opaque revision instead.
    """

    def __init__(
        self,
        secret: str,
        *,
        salt: str = "companion-linear-v1",
        max_chars: int = 200_000,
        max_token: int = 196_608,
    ):
        if not secret:
            raise ValueError("A server checkpoint secret is required")
        self.signer = URLSafeSerializer(secret, salt=salt)
        self.max_chars, self.max_token = max_chars, max_token

    def encode(self, owner: str, session_id: str, messages: list[dict]) -> str:
        payload = {"owner": owner, "session_id": session_id, "messages": messages}
        if len(json.dumps(payload, ensure_ascii=False)) > self.max_chars:
            raise ValueError("Conversation is full; start a new conversation.")
        token = self.signer.dumps(payload)
        if len(token) > self.max_token:
            raise ValueError("Conversation is full; start a new conversation.")
        return token

    def decode(self, token: str, owner: str, session_id: str) -> list[dict]:
        if len(token) > self.max_token:
            raise ValueError("Invalid conversation state")
        try:
            payload = self.signer.loads(token)
        except BadData:
            raise ValueError("Invalid conversation state; start a new conversation.") from None
        if payload.get("owner") != owner or payload.get("session_id") != session_id:
            raise ValueError("Conversation state does not belong to this session.")
        return payload["messages"]
