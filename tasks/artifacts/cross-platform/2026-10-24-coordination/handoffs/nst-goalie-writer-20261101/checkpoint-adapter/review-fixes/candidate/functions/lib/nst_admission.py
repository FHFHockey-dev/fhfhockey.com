"""Global NST admission; bounded bursts require shared rolling headroom.

Every network attempt consumes a permit, including retries and repeated URLs.
Requires the separately deployed nst_admit_attempt_v1 RPC.
"""
import os
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps
import inspect
from urllib.parse import urlparse
import requests


class NstAdmissionError(RuntimeError):
    pass


_job = ContextVar("nst_job", default=None)


def _job_rpc(name, body, deadline_at):
    origin = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    parsed = urlparse(origin)
    remaining = min(5, deadline_at - time.monotonic())
    if not key or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or remaining <= 0:
        raise NstAdmissionError("NST lifecycle configuration or deadline unavailable.")
    response = requests.post(origin.rstrip("/") + "/rest/v1/rpc/" + name, json=body, timeout=remaining,
        headers={"apikey": key, "Authorization": "Bearer " + key}, allow_redirects=False)
    if response.status_code != 200:
        raise NstAdmissionError("NST lifecycle acknowledgement unavailable.")
    return response.json()


def assert_nst_job_active():
    job = _job.get()
    if job is None:
        if os.environ.get("NST_JOB_LIFECYCLE_ENABLED") == "true":
            raise NstAdmissionError("This NST operation requires an enclosing job.")
        return
    if job["closed"] or job.get("uncertain") or time.monotonic() >= job["deadline"]:
        raise NstAdmissionError("NST job is closed, uncertain or expired.")


def mark_nst_job_uncertain():
    job = _job.get()
    if job is not None:
        job["uncertain"] = True


def nst_job_scope(owner, timeout_seconds=3600):
    """Explicit whole-entrypoint scope; no per-fetch finish or implicit resume."""
    if not 0 < timeout_seconds <= 3600:
        raise ValueError("NST job scope must be bounded to at most one hour.")
    def decorate(work):
        if inspect.iscoroutinefunction(work):
            @wraps(work)
            async def asynchronous(*args, **kwargs):
                with nst_job(owner, time.monotonic() + timeout_seconds):
                    return await work(*args, **kwargs)
            return asynchronous
        @wraps(work)
        def synchronous(*args, **kwargs):
            with nst_job(owner, time.monotonic() + timeout_seconds):
                return work(*args, **kwargs)
        return synchronous
    return decorate


@contextmanager
def nst_job(owner, deadline_at=None):
    """Enclose all requests AND awaited output writes. Exception/expiry holds.
    Callers that return an error payload must raise before leaving this scope.
    Disabled until the reviewed cross-language caller inventory is deployed.
    """
    if os.environ.get("NST_JOB_LIFECYCLE_ENABLED") != "true":
        yield
        return
    if _job.get() is not None:
        raise NstAdmissionError("Nested NST job requires its parent lease.")
    deadline_at = deadline_at if deadline_at is not None else time.monotonic() + 220
    remaining = deadline_at - time.monotonic()
    if not isinstance(owner, str) or not owner.strip() or len(owner) > 128 or not 0 < remaining <= 3600:
        raise NstAdmissionError("Invalid NST job bounds.")
    token = str(uuid.uuid4())
    from datetime import datetime, timezone
    deadline = datetime.fromtimestamp(time.time() + remaining, timezone.utc).isoformat()
    receipt = _job_rpc("nst_job_begin_v1", {"p_token": token, "p_owner": owner, "p_deadline_at": deadline}, deadline_at)
    if not isinstance(receipt, dict) or receipt.get("status") != "started" or receipt.get("token") != token:
        raise NstAdmissionError("NST job begin is unacknowledged; no work started.")
    state = {"kind": "direct", "token": token, "deadline": deadline_at, "closed": False}
    context = _job.set(state)
    try:
        yield
        state["closed"] = True
        if state.get("uncertain") or time.monotonic() >= deadline_at:
            raise NstAdmissionError("NST job expired; reconciliation required.")
        receipt = _job_rpc("nst_job_finish_v1", {"p_token": token}, deadline_at)
        if not isinstance(receipt, dict) or receipt.get("status") != "finished" or receipt.get("token") != token:
            raise NstAdmissionError("NST job finish is unacknowledged.")
    except BaseException:
        state["closed"] = True
        try:
            _job_rpc("nst_job_hold_v1", {"p_token": token, "p_reason": "Unacknowledged enclosing job outcome"}, time.monotonic() + 5)
        except Exception:
            pass  # The active/expired durable row still blocks clearance.
        raise
    finally:
        state["closed"] = True
        _job.reset(context)


@contextmanager
def nst_parent_job(token, deadline_at):
    """Authenticated proxy child reuses its parent's token; never settles it."""
    try:
        if str(uuid.UUID(token)) != token or _job.get() is not None:
            raise ValueError("Invalid parent")
    except (ValueError, TypeError, AttributeError) as error:
        raise NstAdmissionError("Invalid NST parent job token.") from error
    state = {"kind": "direct", "token": token, "deadline": deadline_at, "closed": False}
    context = _job.set(state)
    try:
        yield
    finally:
        state["closed"] = True
        _job.reset(context)


def admit_nst_attempt(dispatch=lambda: None, deadline_at=None, planned_requests=None, min_interval_ms=21000):
    assert_nst_job_active()
    deadline_at = deadline_at if deadline_at is not None else time.monotonic() + 220
    origin = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    parsed = urlparse(origin)
    if not key or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise NstAdmissionError("NST shared admission is not configured; no provider request started.")
    job = _job.get()
    if job and (job["closed"] or time.monotonic() >= job["deadline"]):
        raise NstAdmissionError("NST job is closed or expired.")
    if job:
        deadline_at = min(deadline_at, job["deadline"])
    endpoint = origin.rstrip("/") + "/rest/v1/rpc/" + ("nst_admit_job_attempt_v1" if job else "nst_admit_attempt_v1")
    burst = min_interval_ms == 0 and type(planned_requests) is int and 1 <= planned_requests <= 78
    body = {"p_burst": burst, "p_planned_requests": planned_requests if burst else None}
    if job:
        body.update({"p_kind": job["kind"], "p_token": job["token"]})
    while time.monotonic() < deadline_at:
        assert_nst_job_active()
        started = time.monotonic()
        try:
            response = requests.post(endpoint, json=body, timeout=min(5, deadline_at - started),
                headers={"apikey": key, "Authorization": "Bearer " + key}, allow_redirects=False)
            if response.status_code != 200:
                raise NstAdmissionError("Unavailable")
            receipt = response.json()
        except Exception as error:
            raise NstAdmissionError("NST shared admission unavailable; no provider request started (permit outcome may be unknown).") from error
        if (not isinstance(receipt, dict) or receipt.get("version") != 1 or receipt.get("scope") != "global-nst"
                or receipt.get("permitTtlMs") != 1000 or type(receipt.get("allowed")) is not bool
                or type(receipt.get("waitMs")) is not int or receipt["waitMs"] < 0):
            raise NstAdmissionError("NST shared admission returned an invalid receipt.")
        if receipt["allowed"]:
            if time.monotonic() - started >= 1 or time.monotonic() >= deadline_at:
                raise NstAdmissionError("NST shared permit expired before dispatch; no provider request started.")
            assert_nst_job_active()
            return dispatch()
        wait = max(0.025, receipt["waitMs"] / 1000)
        if time.monotonic() + wait >= deadline_at:
            raise NstAdmissionError("NST shared budget cannot fit inside the run deadline.")
        time.sleep(wait)
    raise NstAdmissionError("NST run deadline reached before admission.")


def nst_get(url, **kwargs):
    assert_nst_job_active()
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in {"data.naturalstattrick.com", "www.naturalstattrick.com", "naturalstattrick.com"}:
        raise NstAdmissionError("NST dispatcher only accepts approved HTTPS provider hosts.")
    planned_requests = kwargs.pop("planned_requests", None)
    min_interval_ms = kwargs.pop("min_interval_ms", 21000)
    deadline_at = kwargs.pop("deadline_at", None)
    kwargs["allow_redirects"] = False
    kwargs.setdefault("timeout", 15)
    response = admit_nst_attempt(lambda: requests.get(url, **kwargs), deadline_at=deadline_at, planned_requests=planned_requests, min_interval_ms=min_interval_ms)
    if 300 <= response.status_code < 400:
        raise NstAdmissionError("NST redirect rejected; no unbudgeted redirect followed.")
    return response
