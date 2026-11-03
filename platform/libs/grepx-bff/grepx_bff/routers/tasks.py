"""Planning board over the common task-service."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, gateway, require
from grepx_bff.views import clean

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
def board(scope: str = "mine", ref: str = "", user: Principal = Depends(require()), gw=Depends(gateway)):
    tasks = gw.rows(gc.task.TASKS, ref_id=ref) if ref else gw.rows(gc.task.TASKS)   # ref = what the tasks belong to (an event, a project …)
    if not (scope == "all" and user.can("manage_tasks")):
        tasks = [t for t in tasks if user.user_id in (t.get("assignee_id"), t.get("created_by")) or not t.get("assignee_id")]
    return [clean(t) for t in sorted(tasks, key=lambda t: t.get("due_at") or "9999")]


def _assignee(gw, body: dict) -> dict:
    person = gw.one(gw.people, body.get("assignee_id", ""))
    return {"assignee_name": person.get("name", ""), "assignee_email": person.get("email", ""), "assignee_phone": person.get("phone", "")} if person else {}


@router.post("")
def create(body: dict, user: Principal = Depends(require()), gw=Depends(gateway)):
    return gw.command(gc.task.REQUESTS, gc.task.SERVICE, {"action": "CREATE", "actor_id": user.user_id, **body, **_assignee(gw, body)}).fields


@router.post("/{task_id}/{op}")
def op(task_id: str, op: str, body: dict, user: Principal = Depends(require()), gw=Depends(gateway)):
    """op: update | status | claim | delete"""
    action = {"update": "UPDATE", "status": "CHANGE_STATUS", "claim": "CLAIM", "delete": "DELETE"}[op]
    extra = _assignee(gw, body) if op == "update" else ({"assignee_name": "", **_assignee(gw, {"assignee_id": user.user_id})} if op == "claim" else {})
    return gw.command(gc.task.REQUESTS, gc.task.SERVICE, {"action": action, "task_id": task_id, "actor_id": user.user_id,
                                                        "actor_is_manager": user.can("manage_tasks"), **body, **extra}).fields
