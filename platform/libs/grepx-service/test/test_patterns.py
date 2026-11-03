"""Service kit patterns: circuit breaker, retry, rate limiter, saga with compensation, dead letters."""
import pytest
from grepx_service import CircuitBreaker, CircuitOpen, RateLimiter, Retry, Saga, SagaRunner, Step
from grepx_service import ActionDispatcher, RequestContext
from grepx_testkit.harness import FakeCfg, ServiceHarness
from enum import Enum


def test_breaker_should_open_then_half_open():
    now = [0.0]
    breaker = CircuitBreaker("x", failure_threshold=2, reset_seconds=10, clock=lambda: now[0])
    for _ in range(2):
        with pytest.raises(ValueError):
            breaker.call(lambda: (_ for _ in ()).throw(ValueError()))
    with pytest.raises(CircuitOpen):
        breaker.call(lambda: 1)
    now[0] = 11
    assert breaker.call(lambda: 7) == 7 and breaker.state == "closed"


def test_retry_should_retry_then_succeed():
    calls = []
    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise OSError()
        return "ok"
    assert Retry(attempts=3, sleep=lambda s: None).call(flaky) == "ok" and len(calls) == 3


def test_rate_limiter_should_refill():
    now = [0.0]
    limiter = RateLimiter(2, 1.0, clock=lambda: now[0])
    assert limiter.try_acquire() and limiter.try_acquire() and not limiter.try_acquire()
    now[0] = 0.5
    assert limiter.try_acquire()


class A(str, Enum):
    MAKE = "MAKE"
    UNDO = "UNDO"
    BOOM = "BOOM"


def service(h, name, table):
    def make(ctx: RequestContext):
        if ctx.get("fail"):
            return ctx.reject("NOPE")
        ctx.accept({"made": True})
    def boom(ctx):
        raise RuntimeError("bug")
    h.add(FakeCfg(service_name=name), table, ActionDispatcher({A.MAKE: make, A.UNDO: lambda c: c.accept(), A.BOOM: boom}, A, table))


def test_saga_should_compensate_completed_steps():
    h = ServiceHarness()
    service(h, "one", "one_requests")
    service(h, "two", "two_requests")
    saga = Saga("demo", [Step("first", "one_requests", "one", lambda s: {"action": "MAKE"}, compensate=lambda s: {"action": "UNDO"}),
                         Step("second", "two_requests", "two", lambda s: {"action": "MAKE", "fail": True})])
    outcome = SagaRunner(h.requests).run(saga, {}, saga_id="s1")
    assert not outcome.ok and outcome.failed_step == "second" and outcome.compensated == ["first"]
    assert h.read.one("sagas", "s1")["status"] == "COMPENSATED"


def test_handler_crash_should_dead_letter():
    h = ServiceHarness()
    service(h, "one", "one_requests")
    assert h.call("one_requests", "one", {"action": "BOOM"}).reason == "INTERNAL_ERROR"
    assert h.rows("dead_letters")[0]["error"] == "RuntimeError: bug"


def test_trace_should_show_hops_failures_and_stuck_steps():
    from grepx_service.tracing import explain, render
    h = ServiceHarness()
    service(h, "one", "one_requests")
    h.requests.call("one_requests", "one", {"action": "MAKE"}, trace_id="t1")
    h.requests.call("one_requests", "one", {"action": "MAKE", "fail": True}, trace_id="t1")
    h.requests.send("nobody_requests", "ghost", {"action": "X"}, trace_id="t1")
    report = explain("t1", h.client.trace("t1"))
    assert report["failures"][0]["reason"] == "NOPE" and report["stuck"][0]["waiting_for"] == "ghost"
    assert "stuck at nobody_requests" in render(report) and not report["ok"]


def test_owned_state_rows_should_also_land_in_the_service_database():
    from grepx_store import store_for
    h = ServiceHarness()
    cfg = FakeCfg(service_name="one", owns=["things"], database={"url": "memory://one"})
    def make(ctx):
        ctx.emitter.submit("things", "t1", "ACCEPTED", {"name": "x"})
        ctx.accept()
    h.add(cfg, "one_requests", ActionDispatcher({A.MAKE: make}, A, "one_requests"))
    h.call("one_requests", "one", {"action": "MAKE"})
    assert store_for(cfg).get("things", "t1")["name"] == "x"
