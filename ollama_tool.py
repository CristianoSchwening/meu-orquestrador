from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable
from urllib import request


@dataclass
class OllamaTool:
    """Tool simples para chamar um modelo local via API HTTP do Ollama."""

    model: str = "llama3.2:3b"
    base_url: str = "http://localhost:11434"
    timeout_seconds: float = 30.0
    requester: Callable[[str, bytes, float], dict[str, Any]] | None = None

    name: str = "ollama_generate"

    def run(self, **kwargs: Any) -> str:
        prompt = kwargs.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("'prompt' deve ser uma string não vazia")

        model = kwargs.get("model", self.model)
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": kwargs.get("options", {}),
        }

        requester = self.requester or self._default_requester
        data = requester(f"{self.base_url}/api/generate", json.dumps(payload).encode("utf-8"), self.timeout_seconds)

        response = data.get("response")
        if not isinstance(response, str):
            raise RuntimeError("Resposta inválida do Ollama: campo 'response' ausente")
        return response

    @staticmethod
    def _default_requester(url: str, body: bytes, timeout_seconds: float) -> dict[str, Any]:
        req = request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with request.urlopen(req, timeout=timeout_seconds) as resp:  # nosec B310
            raw = resp.read().decode("utf-8")
        return json.loads(raw)
