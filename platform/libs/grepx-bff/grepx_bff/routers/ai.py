# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""AI in every product, one router. The product gives:
  facts(k)            a compact snapshot of the business's own numbers (what the AI may know)
  brief(k)            (facts, plain words) for the morning brief - the plain words show at once and when AI is off
  drafts(k, body)     (facts, plain message, what to write) for a message to a customer (optional)
  context             the product's own context: what it is, its words, its screens (catalog/ai_context.md)
  model               its model on the local engine (grepx-<product>, built from that context by platform/ai-engine)
ai-service keeps the jobs, the chats and the count; a model can take a while, so every answer is a job the screen
polls (GET /ai/jobs/{id}, or the chat). Each business switches AI on or off and has a monthly limit (business
settings ai_enabled / ai_monthly_limit)."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any, Callable

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.errors import ApiError, register_copy

WHY = {"AI_OFF": "AI is switched off for this business (Setup).", "NO_KEY": "The AI engine is not running on this server yet.",
       "LIMIT_REACHED": "This month's AI answers are used up.", "MODEL_FAILED": "The AI did not answer just now - try again.",
       "BUSY": "Still answering your last message.", "UNKNOWN_CHAT": "That chat is gone."}

register_copy(WHY)


def settings(k) -> dict:
    biz = k.one(gc.business.BUSINESSES, k.tenant) or {}
    return {**biz, **(biz.get("settings") or {})}


def context_of(path: str | Path | None) -> str:
    try:
        return Path(path).read_text(encoding="utf-8") if path else ""
    except OSError:
        return ""


def reason_of(exc: ApiError) -> str:
    return exc.detail.get("reason", "") if isinstance(exc.detail, dict) else str(exc.detail)


def router(dep: Callable, facts: Callable, brief: Callable, product: str, drafts: Callable | None = None, context: str = "", model: str = "",
           about: Callable | None = None) -> APIRouter:
    r = APIRouter(prefix="/ai", tags=["ai"])

    def common(k, max_tokens: int = 700) -> dict:
        s = settings(k)
        return {"product": product, "business": s.get("name", ""), "currency": s.get("currency", ""), "today": date.today().isoformat(),
                "context": context, "model": model, "enabled": s.get("ai_enabled", True) is not False, "limit": int(s.get("ai_monthly_limit") or 300),
                "max_tokens": max_tokens}

    def data_for(k, body: dict) -> Any:
        """The business's facts, plus - when the person picked some records first ("Ask AI" on a selection) - those
        records in full: {kind, ids} -> the product's about(k, kind, ids). Only what this person may see."""
        base = facts(k)
        pick = body.get("about") or {}
        if about and isinstance(pick, dict) and pick.get("kind") and pick.get("ids"):
            ids = [str(i) for i in pick["ids"]][:50]
            return {**base, "selected": {"kind": str(pick["kind"])[:30], "records": about(k, str(pick["kind"]), ids)},
                    "note": "The person selected these records and asks about them first."}
        return base

    def start(k, feature: str, question: str, data: Any, instructions: str, max_tokens: int = 700) -> dict:
        """{job_id} when the AI took it, else {why}: the screen shows the product's own words instead."""
        try:
            out = k.cmd(gc.ai.REQUESTS, gc.ai.SERVICE, {"action": "ASK", "feature": feature, "question": question, "data": data, "instructions": instructions,
                                                        **common(k, max_tokens)})
            return {"job_id": out["job"]["job_id"]}
        except ApiError as exc:
            return {"why": WHY.get(reason_of(exc), WHY["MODEL_FAILED"]), "reason": reason_of(exc)}

    def job_view(k, job_id: str) -> dict:
        j = k.one(gc.ai.AI_JOBS, job_id)
        if j is None or j.get("tenant_id") != k.tenant:
            raise ApiError("NOT_FOUND", 404)
        return {"job_id": job_id, "state": j.get("state", ""), "answer": j.get("answer", ""), "feature": j.get("feature", ""),
                "why": WHY.get(j.get("reason", ""), "") if j.get("state") == "failed" else ""}

    @r.get("/status")
    def status(k=Depends(dep)):
        s = settings(k)
        use = k.cmd(gc.ai.REQUESTS, gc.ai.SERVICE, {"action": "USAGE", "limit": int(s.get("ai_monthly_limit") or 300)})
        return {"enabled": s.get("ai_enabled", True) is not False, "used": use["usage"]["calls"], "limit": use["limit"], "by_feature": use["usage"]["by_feature"],
                "model": model}

    @r.get("/jobs/{job_id}")
    def one_job(job_id: str, k=Depends(dep)):
        return job_view(k, job_id)

    @r.post("/ask")
    def ask_anything(body: dict, k=Depends(dep)):
        """A question in plain words, answered from this business's own data: a job to poll."""
        q = str(body.get("question") or "").strip()
        if not q:
            raise ApiError("NO_QUESTION", 400)
        return start(k, "ask", q, data_for(k, body), "Answer in at most 6 short lines; use bullet points for lists; name the numbers.")

    @r.get("/brief")
    def morning_brief(k=Depends(dep)):
        """The day in a few lines. The plain words at once; today's AI brief when it is ready (asked once a day)."""
        data, plain = brief(k)
        today = date.today().isoformat()
        mine = sorted((j for j in k.rows(gc.ai.AI_JOBS, feature="brief") if str(j.get("asked_at", ""))[:10] == today), key=lambda j: j.get("asked_at", ""))
        done = next((j for j in reversed(mine) if j.get("state") == "done" and j.get("answer")), None)
        if done:
            return {"text": done["answer"], "plain": plain, "ai": True, "facts": data}
        waiting = next((j for j in mine if j.get("state") == "thinking"), None)
        started = {"job_id": waiting["_key"]} if waiting else (start(k, "brief", "Write today's brief for the owner: 3-5 short lines - how business is going, "
                                                                          "what needs action first, one opportunity.", data,
                                                                          "No greeting, no headings. Each line starts with a verb or a number.", 350)
                                                                    if not any(j.get("state") == "failed" for j in mine) else {"why": WHY["MODEL_FAILED"]})
        return {"text": plain, "plain": plain, "ai": False, "facts": data, **started}

    @r.post("/draft")
    def draft(body: dict, k=Depends(dep)):
        """A message to send (follow-up, reminder, offer): the plain version now, the AI one as a job."""
        if drafts is None:
            raise ApiError("NOT_FOUND", 404)
        data, plain, task = drafts(k, body)
        return {"text": plain, **start(k, "draft", task, data, "Write the message only, ready to send on WhatsApp: friendly, under 60 words, the shop's name at the end.", 250)}

    # ---- chat: a person's own conversations, ChatGPT-style, with today's business data each time ----
    @r.get("/chats")
    def chats(k=Depends(dep)):
        rows = [c for c in k.rows(gc.ai.AI_CHATS, user_id=k.user.user_id) if not c.get("deleted")]
        rows.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
        return {"chats": [{"chat_id": c["_key"], "title": c.get("title", ""), "updated_at": c.get("updated_at", ""), "thinking": bool(c.get("thinking"))}
                          for c in rows[:100]], "model": model}

    @r.get("/chats/{chat_id}")
    def chat_one(chat_id: str, k=Depends(dep)):
        c = k.one(gc.ai.AI_CHATS, chat_id)
        if c is None or c.get("user_id") != k.user.user_id or c.get("deleted"):
            raise ApiError("UNKNOWN_CHAT", 404)
        return {"chat_id": chat_id, "title": c.get("title", ""), "thinking": bool(c.get("thinking")),
                "messages": [{"role": m["role"], "content": m.get("content", ""), "at": m.get("at", ""), "failed": WHY.get(m.get("failed", ""), "") if m.get("failed") else ""}
                             for m in c.get("messages") or []]}

    @r.post("/chat")
    def chat(body: dict, k=Depends(dep)):
        text = str(body.get("message") or "").strip()
        if not text:
            raise ApiError("NO_QUESTION", 400)
        try:
            out = k.cmd(gc.ai.REQUESTS, gc.ai.SERVICE, {"action": "CHAT", "chat_id": str(body.get("chat_id") or ""), "message": text, "data": data_for(k, body),
                                                        "instructions": "Format answers in short paragraphs or bullet points. Name the numbers.", **common(k)})
        except ApiError as exc:
            if reason_of(exc) in WHY:
                raise ApiError(reason_of(exc), 409) from exc
            raise
        return {"chat_id": out["chat"]["chat_id"], "title": out["chat"]["title"], "thinking": True}

    @r.delete("/chats/{chat_id}")
    def chat_delete(chat_id: str, k=Depends(dep)):
        return k.cmd(gc.ai.REQUESTS, gc.ai.SERVICE, {"action": "CHAT_DELETE", "chat_id": chat_id})

    return r


__all__ = ["context_of", "router", "settings"]
