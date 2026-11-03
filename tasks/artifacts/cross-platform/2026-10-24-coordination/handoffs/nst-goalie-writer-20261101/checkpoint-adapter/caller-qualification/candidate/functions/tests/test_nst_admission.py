from unittest.mock import Mock
import pytest
from lib import nst_admission as admission

@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock")
    monkeypatch.setattr(admission.requests, "get", Mock(side_effect=AssertionError("Unexpected provider request")))
    monkeypatch.setattr(admission.requests, "post", Mock(side_effect=AssertionError("Unmocked admission")))

def receipt(allowed=True, wait=0):
    return {"version":1,"scope":"global-nst","allowed":allowed,"waitMs":wait,"permitTtlMs":1000}

def response(payload):
    return Mock(status_code=200, json=Mock(return_value=payload))

def test_missing_config_never_dispatches(monkeypatch):
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    with pytest.raises(admission.NstAdmissionError, match="not configured"):
        admission.nst_get("https://data.naturalstattrick.com/teamtable.php")
    admission.requests.get.assert_not_called()
    admission.requests.post.assert_not_called()

@pytest.mark.parametrize("payload", [None, {}, {**receipt(), "scope":"local"}, {**receipt(),"allowed":1}, {**receipt(),"waitMs":-1}])
def test_invalid_receipt_never_dispatches(monkeypatch, payload):
    monkeypatch.setattr(admission.requests, "post", Mock(return_value=response(payload)))
    with pytest.raises(admission.NstAdmissionError, match="invalid receipt"):
        admission.nst_get("https://data.naturalstattrick.com/teamtable.php")
    admission.requests.get.assert_not_called()

def test_wait_rechecks_and_each_attempt_consumes_permit(monkeypatch):
    post=Mock(side_effect=[response(receipt(False,22)),response(receipt()),response(receipt())])
    monkeypatch.setattr(admission.requests,"post",post)
    sleep=Mock();monkeypatch.setattr(admission.time,"sleep",sleep)
    get=Mock(return_value=Mock(status_code=200));monkeypatch.setattr(admission.requests,"get",get)
    for _ in range(2): admission.nst_get("https://data.naturalstattrick.com/teamtable.php")
    assert post.call_count == 3 and get.call_count == 2
    assert get.call_args.kwargs["allow_redirects"] is False
    sleep.assert_called_once()

def test_expired_permit_is_consumed_without_dispatch(monkeypatch):
    monkeypatch.setattr(admission.requests,"post",Mock(return_value=response(receipt())))
    monkeypatch.setattr(admission.time,"monotonic",Mock(side_effect=[0,0,0,1.1]))
    with pytest.raises(admission.NstAdmissionError,match="expired"):
        admission.nst_get("https://data.naturalstattrick.com/teamtable.php")
    admission.requests.get.assert_not_called()


@pytest.mark.parametrize("count", [1, 20, 39, 40, 78])
def test_complete_bounded_plans_keep_burst_mode(monkeypatch, count):
    post=Mock(return_value=response(receipt()));monkeypatch.setattr(admission.requests,"post",post)
    get=Mock(return_value=Mock(status_code=200));monkeypatch.setattr(admission.requests,"get",get)
    admission.nst_get("https://data.naturalstattrick.com/teamtable.php",planned_requests=count,min_interval_ms=0)
    assert post.call_args.kwargs["json"] == {"p_burst":True,"p_planned_requests":count}
    assert "planned_requests" not in get.call_args.kwargs

@pytest.mark.parametrize("count", [None, 0, True, 1.5, 79])
def test_invalid_or_large_full_plans_stay_paced(monkeypatch, count):
    post=Mock(return_value=response(receipt()));monkeypatch.setattr(admission.requests,"post",post)
    admission.admit_nst_attempt(planned_requests=count,min_interval_ms=0)
    assert post.call_args.kwargs["json"] == {"p_burst":False,"p_planned_requests":None}

def test_proxy_admission_deadline_prevents_late_provider_dispatch(monkeypatch):
    monkeypatch.setattr(admission.requests,"post",Mock(return_value=response(receipt(False,61001))))
    with pytest.raises(admission.NstAdmissionError,match="deadline"):
        admission.nst_get("https://data.naturalstattrick.com/teamtable.php",planned_requests=40,min_interval_ms=0,deadline_at=admission.time.monotonic()+7)
    admission.requests.get.assert_not_called()


def test_disabled_job_has_no_control_plane_io(monkeypatch):
    monkeypatch.delenv("NST_JOB_LIFECYCLE_ENABLED", raising=False)
    with admission.nst_job("fixture"):
        assert admission._job.get() is None
    admission.requests.post.assert_not_called()


def test_job_finish_follows_provider_and_output(monkeypatch):
    monkeypatch.setenv("NST_JOB_LIFECYCLE_ENABLED", "true")
    events=[]
    def rpc(name, body, deadline):
        events.append(name)
        return {"status":"started" if "begin" in name else "finished", "token":body["p_token"]}
    monkeypatch.setattr(admission, "_job_rpc", rpc)
    post=Mock(return_value=response(receipt()));monkeypatch.setattr(admission.requests,"post",post)
    with admission.nst_job("fixture"):
        token=admission._job.get()["token"]
        admission.admit_nst_attempt(lambda:events.append("body"))
        events.append("output")
    assert events == ["nst_job_begin_v1","body","output","nst_job_finish_v1"]
    assert post.call_args.args[0].endswith("nst_admit_job_attempt_v1")
    assert post.call_args.kwargs["json"]["p_token"] == token
    assert admission._job.get() is None


@pytest.mark.parametrize("failure", ["output", "finish"])
def test_job_unknown_outcome_holds(monkeypatch, failure):
    monkeypatch.setenv("NST_JOB_LIFECYCLE_ENABLED", "true");calls=[]
    def rpc(name, body, deadline):
        calls.append(name)
        if failure == "finish" and "finish" in name:raise RuntimeError("unknown finish")
        return {"status":"started" if "begin" in name else "held", "token":body["p_token"]}
    monkeypatch.setattr(admission,"_job_rpc",rpc)
    with pytest.raises(RuntimeError):
        with admission.nst_job("fixture"):
            if failure == "output":raise RuntimeError("unknown output")
    assert calls[-1] == "nst_job_hold_v1"
    assert admission._job.get() is None


def test_parent_proxy_cannot_finish_whole_job(monkeypatch):
    token="00000000-0000-4000-8000-000000000001"
    post=Mock(return_value=response(receipt()));monkeypatch.setattr(admission.requests,"post",post)
    with admission.nst_parent_job(token,admission.time.monotonic()+10):
        admission.admit_nst_attempt()
    assert post.call_count == 1
    assert post.call_args.args[0].endswith("nst_admit_job_attempt_v1")
    assert post.call_args.kwargs["json"]["p_token"] == token
