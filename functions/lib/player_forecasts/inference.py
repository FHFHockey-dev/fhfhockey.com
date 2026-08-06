from dataclasses import asdict
from typing import Any

from .contracts import InferenceJob
from .runtime import run_deterministic_inference


def run_inference_contract(job: InferenceJob) -> dict[str, Any]:
    """Return an auditable receipt without inventing a statistical model.

    The Deep Research Report must define targets, feature eligibility, model
    families, distributions, and calibration before this boundary can emit
    forecast outputs.
    """
    if job.execution_mode == "inference":
        return run_deterministic_inference(job)
    return {
        "success": True,
        "mode": "contract_only",
        "researchGate": "approved",
        "outputs": [],
        "job": asdict(job),
        "message": (
            "Inference contract validated. Statistical output remains blocked "
            "until an approved model artifact and feature snapshot are supplied."
        ),
    }
