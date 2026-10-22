"""Tests for the Python twin of the BeakDoc IR (stdlib unittest only).

Run from packages/ir/python with: python3 -m unittest
"""

import json
import os
import unittest

from beakdoc_ir import (
    IRBreak,
    IRCellProps,
    IRCustomInline,
    IRDocument,
    IRField,
    IRRun,
    IRSource,
    IRParagraph,
    ParaProps,
    NumberingRef,
    RunProps,
    block_from_dict,
    from_dict,
    inline_from_dict,
    ir_document_from_dict,
    to_dict,
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "rich_sop_ir.json")

# Free-form containers keep explicit nulls; everywhere else null means absent.
FREE_FORM_KEYS = {"containerProps", "raw", "custom", "styles", "numbering"}


def strip_typed_nulls(value, free=False, in_source=False):
    """Mirrors the Python serialisation rule for comparing against TypeScript JSON."""
    if isinstance(value, dict):
        out = {}
        for key, entry in value.items():
            if entry is None and not free:
                continue
            child_free = free or key in FREE_FORM_KEYS or (in_source and key == "props")
            out[key] = strip_typed_nulls(entry, child_free, in_source=(key == "source"))
        return out
    if isinstance(value, list):
        return [strip_typed_nulls(entry, free) for entry in value]
    return value


def load_fixture():
    with open(DATA_PATH, encoding="utf-8") as handle:
        return json.load(handle)


class RoundTripTests(unittest.TestCase):
    def test_rich_fixture_round_trips_exactly(self):
        data = load_fixture()
        ir = ir_document_from_dict(data)
        self.assertIsInstance(ir, IRDocument)
        self.assertEqual(to_dict(ir), strip_typed_nulls(data))

    def test_fixture_structure_is_parsed(self):
        ir = ir_document_from_dict(load_fixture())
        self.assertEqual(ir.ir_version, 1)
        self.assertEqual(len(ir.sections), 2)
        self.assertEqual(ir.sections[1].id, "sb-appendix")
        self.assertEqual(ir.sections[1].page_setup.orientation, "landscape")

        sdt = next(block for block in ir.sections[0].body if block.type == "sdt")
        self.assertEqual(sdt.tag, "sec-scope-1")
        self.assertEqual(sdt.alias, "Scope")

    def test_table_merges_are_parsed(self):
        ir = ir_document_from_dict(load_fixture())
        table = next(
            block
            for block in ir.sections[0].body
            if block.type == "table" and block.source and block.source.block_id == "tbl-1"
        )
        self.assertEqual(table.grid, [3000, 3000])
        restart = table.rows[1].cells[0]
        self.assertEqual(restart.props.v_merge, "restart")
        self.assertEqual(table.rows[2].cells[0].props.v_merge, "continue")

    def test_revision_and_field_inlines_are_parsed(self):
        ir = ir_document_from_dict(load_fixture())
        intro = next(
            block
            for block in ir.sections[0].body
            if isinstance(block, IRParagraph) and block.source and block.source.block_id == "p-intro"
        )
        revisions = [run.revision for run in intro.runs if isinstance(run, IRRun) and run.revision]
        self.assertEqual({rev.kind for rev in revisions}, {"insert", "delete"})
        fields = [run for run in intro.runs if isinstance(run, IRField)]
        self.assertIn("DOCPROPERTY docNumber", [field.instr for field in fields])
        self.assertTrue(any(isinstance(run, IRBreak) and run.kind == "line" for run in intro.runs))


class DispatchTests(unittest.TestCase):
    def test_unknown_inline_type_raises(self):
        with self.assertRaises(ValueError):
            inline_from_dict({"type": "hologram"})

    def test_unknown_block_type_raises(self):
        with self.assertRaises(ValueError):
            block_from_dict({"type": "hologram"})

    def test_unknown_keys_are_ignored(self):
        run = inline_from_dict({"type": "run", "text": "hi", "props": {}, "futureField": 1})
        self.assertIsInstance(run, IRRun)
        self.assertEqual(run.text, "hi")


class SerialisationTests(unittest.TestCase):
    def test_none_fields_are_omitted_and_keys_are_camel_case(self):
        self.assertEqual(to_dict(IRRun(text="x")), {"type": "run", "text": "x", "props": {}})
        self.assertEqual(
            to_dict(IRCellProps(grid_span=2, v_merge="restart")),
            {"gridSpan": 2, "vMerge": "restart"},
        )

    def test_free_form_dicts_keep_nulls(self):
        source = IRSource(block_type="heading", block_id="h", props={"lockReason": None, "level": 2})
        self.assertEqual(
            to_dict(source),
            {"blockType": "heading", "blockId": "h", "props": {"lockReason": None, "level": 2}},
        )

    def test_numbering_and_para_props_round_trip(self):
        props = ParaProps(numbering=NumberingRef(num_id="3", level=1), align="center", keep_next=True)
        data = to_dict(props)
        self.assertEqual(data, {"numbering": {"numId": "3", "level": 1}, "align": "center", "keepNext": True})
        self.assertEqual(to_dict(from_dict(ParaProps, data)), data)

    def test_field_round_trip(self):
        data = {"type": "field", "fieldType": "SEQ", "instr": "SEQ Figure \\* ARABIC", "name": "Figure", "cachedText": "1"}
        self.assertEqual(to_dict(inline_from_dict(data)), data)

    def test_run_props_round_trip(self):
        props = RunProps(bold=True, size_pt=11.5, style_id="Code")
        self.assertEqual(to_dict(props), {"bold": True, "sizePt": 11.5, "styleId": "Code"})

    def test_document_from_minimal_json(self):
        ir = ir_document_from_dict(
            {
                "properties": {"docNumber": "SOP-9"},
                "styles": {"paragraph": {}, "character": {}, "table": {}},
                "numbering": {"abstract": {}, "instances": {}},
                "sections": [
                    {
                        "id": "s1",
                        "pageSetup": {"size": {"widthTwips": 11906, "heightTwips": 16838}, "orientation": "portrait",
                                      "margins": {"top": 1440, "right": 1440, "bottom": 1440, "left": 1440,
                                                  "header": 720, "footer": 720, "gutter": 0}},
                        "body": [
                            {"type": "paragraph", "props": {"styleId": "Heading1"},
                             "runs": [{"type": "run", "text": "Purpose", "props": {}}],
                             "source": {"blockType": "heading", "blockId": "h1", "props": {"level": 1}}},
                            {"type": "image", "src": "a.png", "widthPt": 120.0},
                        ],
                    }
                ],
            }
        )
        self.assertEqual(ir.properties.doc_number, "SOP-9")
        self.assertIsInstance(ir.sections[0].body[0], IRParagraph)
        self.assertEqual(ir.sections[0].body[1].width_pt, 120.0)
        self.assertEqual(ir.sections[0].body[0].source.props, {"level": 1})



class CustomInlineTests(unittest.TestCase):
    def test_custom_inline_parses_and_serialises_exactly(self):
        data = {
            "type": "custom",
            "inlineType": "footnote",
            "props": {"text": "Vendor note"},
            "text": "see note",
            "content": [{"type": "run", "text": "see note", "props": {}}],
        }
        inline = inline_from_dict(data)
        self.assertIsInstance(inline, IRCustomInline)
        self.assertEqual(inline.inline_type, "footnote")
        self.assertEqual(inline.content[0].text, "see note")
        self.assertEqual(to_dict(inline), data)

    def test_custom_atom_has_no_content(self):
        inline = inline_from_dict({"type": "custom", "inlineType": "inlineEquation", "props": {"latex": "x"}, "text": ""})
        self.assertIsNone(inline.content)
        self.assertNotIn("content", to_dict(inline))


if __name__ == "__main__":
    unittest.main()
