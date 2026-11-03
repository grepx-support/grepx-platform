"""Stored secrets use their own key; values sealed with the old (JWT) key still open."""
from grepx_auth import SecretBox


def test_new_key_seals_and_old_key_still_opens(monkeypatch):
    monkeypatch.delenv("SECRET_BOX_KEY", raising=False)
    monkeypatch.delenv("AUTH_TRANSPORT_KEY", raising=False)
    monkeypatch.setenv("JWT_SECRET", "session-signing-key")
    old = SecretBox.from_env().seal("smtp-password")
    monkeypatch.setenv("SECRET_BOX_KEY", "separate-storage-key")
    box = SecretBox.from_env()
    assert box.open(old) == "smtp-password"
    new = box.seal("smtp-password")
    assert SecretBox("session-signing-key").open(new) == ""          # the session key alone cannot open new values
    assert SecretBox("separate-storage-key").open(new) == "smtp-password"
