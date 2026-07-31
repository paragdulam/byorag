from fastapi.testclient import TestClient


def test_signup_creates_account_and_session(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup", json={"email": "new-user@example.com", "password": "hunter22"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "new-user@example.com"
    assert "id" in body["user"]
    assert "password" not in body["user"]
    assert "passwordHash" not in body["user"]
    assert isinstance(body["token"], str) and len(body["token"]) > 0


def test_signup_duplicate_email_is_rejected(client: TestClient) -> None:
    client.post("/api/auth/signup", json={"email": "dup@example.com", "password": "hunter22"})

    response = client.post(
        "/api/auth/signup", json={"email": "dup@example.com", "password": "different"}
    )

    assert response.status_code == 409


def test_login_with_correct_credentials_returns_a_token(client: TestClient) -> None:
    client.post("/api/auth/signup", json={"email": "login-ok@example.com", "password": "hunter22"})

    response = client.post(
        "/api/auth/login", json={"email": "login-ok@example.com", "password": "hunter22"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "login-ok@example.com"
    assert isinstance(body["token"], str) and len(body["token"]) > 0


def test_login_with_wrong_password_returns_generic_401(client: TestClient) -> None:
    client.post("/api/auth/signup", json={"email": "wrong-pw@example.com", "password": "hunter22"})

    response = client.post(
        "/api/auth/login", json={"email": "wrong-pw@example.com", "password": "not-it"}
    )

    assert response.status_code == 401
    wrong_password_detail = response.json()["detail"]

    unknown_email_response = client.post(
        "/api/auth/login", json={"email": "no-such-account@example.com", "password": "hunter22"}
    )
    assert unknown_email_response.status_code == 401
    # Same generic message either way — FR-002 never reveals which part was wrong.
    assert unknown_email_response.json()["detail"] == wrong_password_detail


def test_logout_revokes_the_session_and_is_idempotent(client: TestClient) -> None:
    signup = client.post(
        "/api/auth/signup", json={"email": "logout-me@example.com", "password": "hunter22"}
    )
    token = signup.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    first_logout = client.post("/api/auth/logout", headers=headers)
    assert first_logout.status_code == 204

    me_after_logout = client.get("/api/auth/me", headers=headers)
    assert me_after_logout.status_code == 401

    second_logout = client.post("/api/auth/logout", headers=headers)
    assert second_logout.status_code == 204


def test_me_returns_user_for_valid_token_and_401_otherwise(
    client: TestClient, anonymous_client: TestClient
) -> None:
    signup = client.post(
        "/api/auth/signup", json={"email": "me-check@example.com", "password": "hunter22"}
    )
    token = signup.json()["token"]

    valid = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert valid.status_code == 200
    assert valid.json()["email"] == "me-check@example.com"

    missing = anonymous_client.get("/api/auth/me")
    assert missing.status_code == 401

    invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert invalid.status_code == 401


def test_me_and_signup_and_login_responses_include_created_at(client: TestClient) -> None:
    signup = client.post(
        "/api/auth/signup", json={"email": "created-at@example.com", "password": "hunter22"}
    )
    assert isinstance(signup.json()["user"]["createdAt"], str) and signup.json()["user"]["createdAt"]

    token = signup.json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["createdAt"] == signup.json()["user"]["createdAt"]

    login = client.post(
        "/api/auth/login", json={"email": "created-at@example.com", "password": "hunter22"}
    )
    assert login.json()["user"]["createdAt"] == signup.json()["user"]["createdAt"]
