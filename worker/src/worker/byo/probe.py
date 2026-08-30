"""POST a Chat Completions body at the BYO-LLM shim and check the shape."""

from __future__ import annotations

import json
import sys

from fastapi.testclient import TestClient

from worker.admin.store import connect, resolve_active_persona
from worker.config import load_settings
from worker.main import app
from worker.persistence.sessions import create_session
from worker.schema import SESSION_CHANNEL_TEXT
from worker.turn.openai_completion import iter_sse_chunks
from worker.turn.openai_messages import last_user_text


def _extract_cases(settings) -> int:
    user_role = settings.byo_llm_user_role
    part = settings.byo_llm_text_part_type
    cases: list[tuple[str, list[dict[str, object]], str]] = [
        (
            "last_user_wins",
            [
                {"role": user_role, "content": "first"},
                {"role": settings.byo_llm_assistant_role, "content": "mid"},
                {"role": user_role, "content": "second"},
            ],
            "second",
        ),
        (
            "string_parts",
            [
                {
                    "role": user_role,
                    "content": [{part: "no"}, {"type": part, "text": "ok"}],
                }
            ],
            "ok",
        ),
        (
            "empty_when_no_user",
            [{"role": settings.byo_llm_assistant_role, "content": "only assistant"}],
            "",
        ),
        (
            "empty_content",
            [{"role": user_role, "content": None}],
            "",
        ),
    ]
    failed = 0
    for name, messages, want in cases:
        got = last_user_text(
            messages,
            user_role=user_role,
            text_part_type=part,
        )
        ok = got == want
        print(f"extract_{name} got={got!r} expect={want!r} {'ok' if ok else 'FAIL'}")
        if not ok:
            failed += 1
    return failed


def _sse_cases(settings) -> int:
    chunks = list(
        iter_sse_chunks(
            settings,
            completion_id="id-1",
            created=1,
            model=settings.openai_model,
            content="hello",
        )
    )
    failed = 0
    if not chunks[-1].strip() == f"data: {settings.byo_llm_sse_done}":
        print("sse_done=FAIL", file=sys.stderr)
        failed += 1
    else:
        print("sse_done=ok")
    payloads = [
        json.loads(line[len("data: ") :])
        for line in chunks[:-1]
        if line.startswith("data: ")
    ]
    objects = {item.get("object") for item in payloads}
    if objects != {settings.byo_llm_chunk_object}:
        print(f"sse_object=FAIL {objects}", file=sys.stderr)
        failed += 1
    else:
        print("sse_object=ok")
    contents = [
        choice.get("delta", {}).get("content")
        for item in payloads
        for choice in item.get("choices", [])
    ]
    if "hello" not in contents:
        print("sse_content=FAIL", file=sys.stderr)
        failed += 1
    else:
        print("sse_content=ok")
    return failed


def _assert_completion(body: object, settings) -> None:
    if not isinstance(body, dict):
        raise AssertionError("response is not an object")
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise AssertionError("choices missing")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        raise AssertionError("message missing")
    if message.get("role") != settings.byo_llm_assistant_role:
        raise AssertionError("assistant role mismatch")
    if body.get("object") != settings.byo_llm_completion_object:
        raise AssertionError("object mismatch")
    content = message.get("content")
    if not isinstance(content, str):
        raise AssertionError("content must be a string")


def main() -> int:
    settings = load_settings()
    failed = _extract_cases(settings) + _sse_cases(settings)
    client = TestClient(app)
    path = settings.byo_llm_chat_completions_path
    secret = {settings.internal_secret_header: settings.internal_api_secret}

    unauth = client.post(
        path,
        json={"messages": [{"role": settings.byo_llm_user_role, "content": "x"}]},
    )
    if unauth.status_code != 401:
        print(f"unauth status={unauth.status_code} FAIL", file=sys.stderr)
        failed += 1
    else:
        print("unauth=401 ok")

    missing = client.post(
        path,
        headers=secret,
        json={"messages": [{"role": settings.byo_llm_user_role, "content": "x"}]},
    )
    if missing.status_code != 400:
        print(f"missing_headers status={missing.status_code} FAIL", file=sys.stderr)
        failed += 1
    else:
        print("missing_headers=400 ok")

    conn = connect(settings)
    try:
        persona = resolve_active_persona(conn, settings)
        if persona is None:
            print("FAIL: no persona recorded locally", file=sys.stderr)
            return 1
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, engram_user_id
                FROM users
                ORDER BY created_at
                LIMIT 1
                """,
            )
            user = cur.fetchone()
        if user is None:
            print("FAIL: no app user in the database", file=sys.stderr)
            return 1
        session = create_session(
            conn,
            user_id=user["id"],
            persona_id=persona["id"],
            channel=SESSION_CHANNEL_TEXT,
        )
        conn.commit()
        session_id = session["id"]
        print(f"session_id={session_id}")
    finally:
        conn.close()

    headers = {
        **secret,
        settings.byo_llm_app_user_header: str(user["id"]),
        settings.byo_llm_engram_user_header: user["engram_user_id"],
        settings.byo_llm_persona_header: str(persona["id"]),
        settings.byo_llm_session_header: str(session_id),
    }
    empty = client.post(
        path,
        headers=headers,
        json={
            "messages": [
                {"role": settings.byo_llm_assistant_role, "content": "ignore"}
            ]
        },
    )
    if empty.status_code != 200:
        print(
            f"empty_user status={empty.status_code} body={empty.text} FAIL",
            file=sys.stderr,
        )
        failed += 1
    else:
        try:
            _assert_completion(empty.json(), settings)
            content = empty.json()["choices"][0]["message"]["content"]
            if content != "":
                print(f"empty_user content={content!r} FAIL", file=sys.stderr)
                failed += 1
            else:
                print("empty_user=ok")
        except (AssertionError, KeyError, TypeError) as exc:
            print(f"empty_user shape FAIL {exc}", file=sys.stderr)
            failed += 1

    live = client.post(
        path,
        headers=headers,
        json={
            "model": settings.openai_model,
            "messages": [
                {
                    "role": settings.byo_llm_user_role,
                    "content": "Please remember that my shim token is lantern-byo.",
                }
            ],
        },
    )
    if live.status_code != 200:
        print(f"live status={live.status_code} body={live.text} FAIL", file=sys.stderr)
        failed += 1
        print(f"FAIL: {failed} check(s)", file=sys.stderr)
        return 1
    payload = live.json()
    try:
        _assert_completion(payload, settings)
    except AssertionError as exc:
        print(f"live shape FAIL {exc}", file=sys.stderr)
        failed += 1
        return 1
    reply = payload["choices"][0]["message"]["content"]
    print(f"live reply={reply!r}")
    if reply == "":
        print("FAIL: live reply was empty", file=sys.stderr)
        failed += 1

    conn = connect(settings)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ordinal, speaker, text, controller_action
                FROM turns
                WHERE session_id = %s
                ORDER BY ordinal
                """,
                (str(session_id),),
            )
            turns = list(cur.fetchall())
            cur.execute(
                "SELECT engram_session_id FROM sessions WHERE id = %s",
                (str(session_id),),
            )
            stored = cur.fetchone()
    finally:
        conn.close()

    for row in turns:
        print(
            f"row ordinal={row['ordinal']} speaker={row['speaker']} "
            f"action={row['controller_action']} text={row['text']!r}"
        )
    print(f"stored_engram_session_id={stored['engram_session_id'] if stored else None}")
    if len(turns) < 2:
        print("FAIL: expected persisted user and persona turns", file=sys.stderr)
        failed += 1

    if failed:
        print(f"FAIL: {failed} check(s)", file=sys.stderr)
        return 1
    print("PROBE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
