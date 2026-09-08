from worker.engram.tenant import is_own_private_pool, private_pool_owner

ORG = "100912164da2419885314c9fdb5358b7"
PERSONA = "3a07018eb5c2483ab80f07e90488b5f4"
MEMBER = "07b2b9f777c9446b86c5d593a374cc80"
OTHER = "8de1b2b278724e0bba19000086f8bef2"


def test_shared_pool_has_no_owner() -> None:
    assert private_pool_owner(f"{ORG}:{PERSONA}") is None
    assert private_pool_owner(None) is None
    assert private_pool_owner("") is None


def test_private_pool_owner_is_the_last_segment() -> None:
    assert private_pool_owner(f"{ORG}:{PERSONA}:{MEMBER}") == MEMBER


def test_private_pool_owner_accepts_a_hyphenated_uuid() -> None:
    hyphenated = "3a07018e-b5c2-483a-b80f-07e90488b5f4"
    assert (
        private_pool_owner(f"{ORG}:{PERSONA}:{hyphenated}")
        == "3a07018eb5c2483ab80f07e90488b5f4"
    )


def test_own_private_pool_only_matches_that_member() -> None:
    tenant = f"{ORG}:{PERSONA}:{MEMBER}"
    assert is_own_private_pool(tenant, engram_user_id=MEMBER) is True
    assert is_own_private_pool(tenant, engram_user_id=OTHER) is False


def test_shared_and_malformed_tenants_are_not_private() -> None:
    assert is_own_private_pool(f"{ORG}:{PERSONA}", engram_user_id=MEMBER) is False
    assert is_own_private_pool(None, engram_user_id=MEMBER) is False
    assert (
        is_own_private_pool(f"{ORG}:{PERSONA}:", engram_user_id=MEMBER) is False
    )
    assert (
        is_own_private_pool(
            f"{ORG}:{PERSONA}:{MEMBER}:extra",
            engram_user_id=MEMBER,
        )
        is False
    )
