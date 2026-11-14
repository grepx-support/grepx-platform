# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""notify(): one request row per channel with a recipient; files ride along only when given."""
from grepx_service import notify


class Recorder:
    def __init__(self):
        self.rows = []

    def request(self, table, key, fields, service):
        self.rows.append((table, key, fields, service))


def test_one_row_per_channel_with_a_recipient_and_files_only_when_given():
    r = Recorder()
    keys = notify(r, "slip", email="a@b.c", phone="", channels=["email", "whatsapp"], ref="x")
    assert len(keys) == 1 and "attachments" not in r.rows[0][2]
    files = [{"name": "a.pdf", "mime": "application/pdf", "data_b64": "JVBERg==", "url": "https://x/a.pdf"}]
    notify(r, "slip", email="a@b.c", phone="+6591", channels=["email", "whatsapp"], ref="y", attachments=files)
    assert [row[2]["attachments"] for row in r.rows[1:]] == [files, files]
