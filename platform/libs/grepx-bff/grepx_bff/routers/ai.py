# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""AI in every product, one router: the product gives what the AI may know (`facts(k)` - a compact snapshot of the
business's own numbers), the morning brief's facts and words without AI (`brief(k) -> (facts, text)`), and who may
ask (`dep`). ai-service talks to the model and counts calls; each business switches AI on or off and has a monthly
limit (business settings ai_enabled / ai_monthly_limit). Without AI (off, no key, limit reached) every endpoint still
answers from the product's own rules, saying why."""
from __future__ import annotations

import time
from datetime import date
from typing import Any, Callable

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.errors import ApiError

WHY = {"AI_OFF": "AI is switched off for this business (Setup).", "NO_KEY": "AI is not connected on this server yet.",
       "LIMIT_REACHED": "This month's AI answers are used up.", "MODEL_FAILED": "The AI did not answer just now - try again."}


def settings(k) -> dict:
    biz = k.one(gc.business.BUSINESSES, k.tenant) or {}
    return {**biz, **(biz.get("settings") or {})}


def ask(k, feature: str, question: str, data: Any = None, instructions: str = "", product: str = "GrepX", max_tokens: int = 700) -> dict:
    """{answer} from the model, or {answer: "", why} when AI cannot answer now (the caller falls back)."""
    s = settings(k)
    try:
        out = k.cmd(gc.ai.REQUESTS, gc.ai.SERVICE, {"action": "ASK", "feature": feature, "question": question, "data": data, "instructions": instructions,
                                                    "product": product, "business": s.get("name", ""), "currency": s.get("currency", ""),
                                                    "today": date.today().isoformat(), "enabled": s.get("ai_enabled", True) is not False,
                                                    "limit": int(s.get("ai_monthly_limit") or 300), "max_tokens": max_tokens})
        return {"answer": out["answer"], "ai": True, "used": out.get("used"), "limit": out.get("limit")}
    except ApiError as exc:
        reason = exc.detail.get("reason", "") if isinstance(exc.detail, dict) else str(exc.detail)
        return {"answer": "", "ai": False, "why": WHY.get(reason, WHY["MODEL_FAILED"]), "reason": reason}


BRIEFS: dict[str, tuple[float, dict]] = {}       # tenant -> (when, brief): one model call per business per half hour


def router(dep: Callable, facts: Callable, brief: Callable, product: str, drafts: Callable | None = None) -> APIRouter:
    r = APIRouter(prefix="/ai", tags=["ai"])

    @r.get("/status")
    def status(k=Depends(dep)):
        s = settings(k)
        use = k.cmd(gc.ai.REQUESTS, gc.ai.SERVICE, {"action": "USAGE", "limit": int(s.get("ai_monthly_limit") or 300)})
        return {"enabled": s.get("ai_enabled", True) is not False, "used": use["usage"]["calls"], "limit": use["limit"], "by_feature": use["usage"]["by_feature"]}

    @r.post("/ask")
    def ask_anything(body: dict, k=Depends(dep)):
        """A question in plain words, answered from this business's own data."""
        q = str(body.get("question") or "").strip()
        if not q:
            raise ApiError("NO_QUESTION", 400)
        out = ask(k, "ask", q, facts(k), "Answer in at most 6 short lines; use bullet points for lists; name the numbers.", product)
        return out if out["answer"] else {**out, "answer": out["why"]}

    @r.get("/brief")
    def morning_brief(k=Depends(dep)):
        """The day in a few lines: what the numbers say and what to do first. The plain version is always there."""
        hit = BRIEFS.get(k.tenant)
        if hit and time.time() - hit[0] < 1800:
            return hit[1]
        data, plain = brief(k)
        out = ask(k, "brief", "Write today's brief for the owner: 3-5 short lines - how business is going, what needs action first, one opportunity.",
                  data, "No greeting, no headings. Each line starts with an emoji-free verb or a number.", product, 350)
        made = {"text": out["answer"] or plain, "plain": plain, "ai": out["ai"], "why": out.get("why", ""), "facts": data}
        if out["ai"]:
            BRIEFS[k.tenant] = (time.time(), made)
        return made

    @r.post("/draft")
    def draft(body: dict, k=Depends(dep)):
        """A message to send (follow-up, reminder, offer) written from the facts given by the product's own `drafts`."""
        if drafts is None:
            raise ApiError("NOT_FOUND", 404)
        data, plain, task = drafts(k, body)
        out = ask(k, "draft", task, data, "Write the message only, ready to send on WhatsApp: friendly, under 60 words, the shop's name at the end.", product, 250)
        return {"text": out["answer"] or plain, "ai": out["ai"], "why": out.get("why", "")}

    return r


__all__ = ["ask", "router", "settings"]
