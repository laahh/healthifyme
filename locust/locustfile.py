"""
Load test untuk API Express (server/).

Jalankan server dulu (default PORT 8787), lalu:

  pip install -r locust/requirements.txt
  set LOCUST_SID=...
  set LOCUST_PASSWORD=...
  locust -f locust/locustfile.py --host=http://localhost:8787

Atau tanpa kredensial: hanya /health dan /api/v1/exercises yang bermakna penuh;
endpoint ber-auth akan di-skip.

Headless:

  locust -f locust/locustfile.py --host=http://localhost:8787 ^
    --users 20 --spawn-rate 2 --run-time 1m --headless
"""

from __future__ import annotations

import os
from locust import HttpUser, between, task

API = "/api/v1"


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


class ApiUser(HttpUser):
    """
    Menggabungkan traffic publik (tanpa token) dan terautentikasi (Bearer).
    Login sekali per user virtual di on_start — hindari spam login (rate limit).
    """

    wait_time = between(0.5, 2.5)

    def on_start(self) -> None:
        self.token: str | None = None
        sid = _env("LOCUST_SID")
        password = _env("LOCUST_PASSWORD")
        if not sid or not password:
            return

        with self.client.post(
            f"{API}/auth/login",
            json={"username": sid, "password": password},
            catch_response=True,
            name="POST /api/v1/auth/login",
        ) as response:
            if response.status_code != 200:
                response.failure(f"status {response.status_code}")
                return
            try:
                data = response.json()
            except ValueError as exc:
                response.failure(f"invalid json: {exc}")
                return
            token = data.get("token")
            if not token:
                response.failure("missing token in body")
                return
            self.token = str(token)
            response.success()

    def _auth_headers(self) -> dict[str, str]:
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}

    @task(4)
    def get_health(self) -> None:
        self.client.get("/health", name="GET /health")

    @task(5)
    def get_exercises(self) -> None:
        self.client.get(f"{API}/exercises", name="GET /api/v1/exercises")

    @task(2)
    def get_auth_me(self) -> None:
        if not self.token:
            return
        self.client.get(
            f"{API}/auth/me",
            headers=self._auth_headers(),
            name="GET /api/v1/auth/me",
        )

    @task(2)
    def get_profile(self) -> None:
        if not self.token:
            return
        self.client.get(
            f"{API}/me/profile",
            headers=self._auth_headers(),
            name="GET /api/v1/me/profile",
        )

    @task(2)
    def get_sync(self) -> None:
        if not self.token:
            return
        self.client.get(
            f"{API}/me/sync",
            headers=self._auth_headers(),
            name="GET /api/v1/me/sync",
        )

    @task(1)
    def get_history(self) -> None:
        if not self.token:
            return
        self.client.get(
            f"{API}/me/history",
            headers=self._auth_headers(),
            name="GET /api/v1/me/history",
        )
