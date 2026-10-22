from .fixture_integrity import check_fixture_integrity

VALIDATOR_REGISTRY = {
    "fixture-integrity": check_fixture_integrity,
}

__all__ = ["check_fixture_integrity", "VALIDATOR_REGISTRY"]
