"""Research-gated FHFH Player Forecasts inference package."""

from .contracts import (
    APPROVED_RESEARCH_CONTRACTS,
    RESEARCH_CONTRACT_SHA256,
    RESEARCH_CONTRACT_VERSION,
    InferenceJob,
    validate_inference_job,
)
from .inference import run_inference_contract

__all__ = [
    "InferenceJob",
    "APPROVED_RESEARCH_CONTRACTS",
    "RESEARCH_CONTRACT_SHA256",
    "RESEARCH_CONTRACT_VERSION",
    "validate_inference_job",
    "run_inference_contract",
]
