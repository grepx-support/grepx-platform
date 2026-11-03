"""grepx_service — the shared service kit every GrepX service is built on.

    RequestContext / ActionDispatcher  request/response services (claim → decide → verdict)
    Reactor                            projections and side-effect subscribers
    Emitter                            the one place from_service/to_service are stamped
    Reader                             safe, tenant-aware reads of other tables
    RequestClient                      BFF side: submit a request row and wait for its verdict
    SagaRunner / Saga / Step           orchestrated multi-service transactions with compensation
    CircuitBreaker / Retry / RateLimiter / Bulkhead / Resilient   calls leaving the platform
    dead_letter (dispatcher)           failed handlers land in the dead_letters table
    serve(__file__) (grepx_service.serve)   run a service from its config.yaml
Testing lives in grepx_testkit, configuration in grepx_config, shared value objects in grepx_common.
"""
from .context import RequestContext
from .dispatcher import ActionDispatcher
from .emitter import Emitter
from .reactor import Reactor
from .reader import Reader
from .resilience import Bulkhead, CircuitBreaker, CircuitOpen, RateLimiter, Resilient, Retry
from .saga import Saga, SagaOutcome, SagaRunner, Step
from .request_client import RequestClient, Verdict
from .notify import notify
from .wire import local_today, new_key, now_iso, quote, state_of, today_iso

__all__ = ["Bulkhead", "CircuitBreaker", "CircuitOpen", "RateLimiter", "Resilient", "Retry", "Saga", "SagaOutcome", "SagaRunner", "Step",
           "RequestContext", "ActionDispatcher", "Emitter", "Reactor", "Reader", "RequestClient", "Verdict",
           "local_today", "new_key", "now_iso", "quote", "state_of", "today_iso", "notify"]
