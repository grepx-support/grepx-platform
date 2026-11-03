"""The product vocabulary: generic services' words in, the product's words out."""
from grepx_bff.vocabulary import TranslatingReader, Vocabulary

VOCAB = Vocabulary({"bookings"}, fields={"event_id": "drive_id", "person_id": "donor_id"},
                   values={"state": {"attended": "donated"}}, reasons={"UNKNOWN_EVENT": "UNKNOWN_DRIVE"},
                   nested={"stats": {"attended": "donated"}})


class FakeReader:
    client = None

    def __init__(self):
        self.seen = None

    def accepted(self, table, criteria="", **eq):
        self.seen = (table, criteria, eq)
        return [{"_key": "b1", "event_id": "e1", "person_id": "p1", "state": "attended", "stats": {"attended": 2}}]

    def accepted_one(self, table, key):
        return {"_key": key, "event_id": "e1"}


def test_rows_come_back_in_product_words():
    row = VOCAB.row_out({"event_id": "e1", "person_id": "p1", "state": "attended", "stats": {"attended": 3}, "name": "Ann"})
    assert row == {"drive_id": "e1", "donor_id": "p1", "state": "donated", "stats": {"donated": 3}, "name": "Ann"}


def test_commands_go_out_in_generic_words():
    assert VOCAB.fields_in({"action": "MARK", "drive_id": "e1", "state": "donated"}) == {"action": "MARK", "event_id": "e1", "state": "attended"}
    assert VOCAB.fields_out({"reason": "UNKNOWN_EVENT", "event_id": "e1"}) == {"reason": "UNKNOWN_DRIVE", "drive_id": "e1"}


def test_criteria_rename_fields_and_values_but_not_free_text():
    assert VOCAB.criteria_in("drive_id = 'x' AND state = 'donated' AND name = 'drive_id'") == \
        "event_id = 'x' AND state = 'attended' AND name = 'drive_id'"


def test_reader_translates_only_the_tables_it_speaks_for():
    inner = FakeReader()
    reader = TranslatingReader(inner, VOCAB)
    rows = reader.accepted("bookings", donor_id="p1", state="donated")
    assert inner.seen == ("bookings", "", {"person_id": "p1", "state": "attended"})
    assert rows[0]["drive_id"] == "e1" and rows[0]["state"] == "donated"
    assert reader.accepted("donors")[0]["event_id"] == "e1"          # untouched: not a generic table
    assert reader.accepted_one("bookings", "b1") == {"_key": "b1", "drive_id": "e1"}
