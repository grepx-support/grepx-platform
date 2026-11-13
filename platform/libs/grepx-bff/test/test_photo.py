# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Profile pictures: only real image data URLs get through to media-service."""
import base64

import pytest

from grepx_bff.errors import ApiError
from grepx_bff.routers.photo import MAX_BYTES, decode_picture


def url(kind: str, data: bytes) -> str:
    return f"data:{kind};base64,{base64.b64encode(data).decode()}"


def test_a_jpeg_data_url_decodes_to_its_bytes():
    assert decode_picture(url("image/jpeg", b"\xff\xd8\xffjpeg")) == b"\xff\xd8\xffjpeg"


@pytest.mark.parametrize("bad", ["", "hello", url("text/html", b"<h1>"), "data:image/png,not-base64", "data:image/png;base64,***"])
def test_anything_else_is_refused(bad):
    with pytest.raises(ApiError) as e:
        decode_picture(bad)
    assert e.value.detail["reason"] == "NOT_AN_IMAGE"


def test_a_huge_picture_is_refused_before_decoding():
    with pytest.raises(ApiError) as e:
        decode_picture("data:image/png;base64," + "A" * (MAX_BYTES * 2))
    assert e.value.detail["reason"] == "TOO_LARGE"
