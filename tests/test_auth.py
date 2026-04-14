"""Tests for auth — signup, login, token validation. No guest access."""


def test_signup(client):
    resp = client.post("/api/auth/signup", json={
        "email": "kaia@test.com",
        "password": "music123",
        "display_name": "Kaia",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["user"]["email"] == "kaia@test.com"
    assert data["user"]["display_name"] == "Kaia"


def test_signup_duplicate_email(client):
    client.post("/api/auth/signup", json={"email": "dup@test.com", "password": "pass123"})
    resp = client.post("/api/auth/signup", json={"email": "dup@test.com", "password": "pass456"})
    assert resp.status_code == 409


def test_signup_short_password(client):
    resp = client.post("/api/auth/signup", json={"email": "short@test.com", "password": "12345"})
    assert resp.status_code == 400


def test_login(client):
    client.post("/api/auth/signup", json={"email": "login@test.com", "password": "secure123"})
    resp = client.post("/api/auth/login", json={"email": "login@test.com", "password": "secure123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["user"]["email"] == "login@test.com"


def test_login_wrong_password(client):
    client.post("/api/auth/signup", json={"email": "wrong@test.com", "password": "correct"})
    resp = client.post("/api/auth/login", json={"email": "wrong@test.com", "password": "incorrect"})
    assert resp.status_code == 401


def test_login_nonexistent_email(client):
    resp = client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "whatever"})
    assert resp.status_code == 401


def test_me_with_token(client):
    resp = client.post("/api/auth/signup", json={"email": "me@test.com", "password": "pass123"})
    token = resp.json()["access_token"]

    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "me@test.com"


def test_me_without_token(client):
    """No guest access — must be signed in."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_bad_token(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer fake.token.here"})
    assert resp.status_code == 401


def test_signup_creates_free_subscription(client):
    resp = client.post("/api/auth/signup", json={"email": "sub@test.com", "password": "pass123"})
    token = resp.json()["access_token"]

    sub_resp = client.get("/api/studio/subscription/status", headers={"Authorization": f"Bearer {token}"})
    assert sub_resp.status_code == 200
    assert sub_resp.json()["tier"] == "free"
