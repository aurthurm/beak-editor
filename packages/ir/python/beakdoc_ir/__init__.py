"""Python twin of the BeakDoc IR (``@amusendame/beakblock-ir``).

Dataclasses mirror the TypeScript IR and the schema types it uses. Use
:func:`ir_document_from_dict` to load a document exported from TypeScript and
:func:`to_dict` to write one back.

Example::

    import json
    from beakdoc_ir import ir_document_from_dict, to_dict

    with open("document.ir.json", encoding="utf-8") as handle:
        ir = ir_document_from_dict(json.load(handle))
    print(ir.sections[0].id, len(ir.sections[0].body))
    data = to_dict(ir)
"""

from .models import (
    IR_VERSION,
    DocumentProperties,
    IRBlock,
    IRBreak,
    IRCellProps,
    IRCustomInline,
    IRDocument,
    IRField,
    IRFootnoteRef,
    IRHeaderFooterSet,
    IRIcon,
    IRImageBlock,
    IRInline,
    IRInlineImage,
    IRLink,
    IRListMembership,
    IRPassthrough,
    IRParagraph,
    IRRaw,
    IRRevision,
    IRRowProps,
    IRRun,
    IRSdt,
    IRSection,
    IRSource,
    IRTable,
    IRTableCell,
    IRTableLook,
    IRTableProps,
    IRTableRow,
    IndentProps,
    NumberingRef,
    PageColumns,
    PageMargins,
    PageSetup,
    PageSize,
    ParaProps,
    RunProps,
    SpacingProps,
    TabStop,
    block_from_dict,
    from_dict,
    inline_from_dict,
    ir_document_from_dict,
    to_dict,
)

__all__ = [
    "IR_VERSION",
    "DocumentProperties",
    "IRBlock",
    "IRBreak",
    "IRCellProps",
    "IRCustomInline",
    "IRDocument",
    "IRField",
    "IRFootnoteRef",
    "IRHeaderFooterSet",
    "IRIcon",
    "IRImageBlock",
    "IRInline",
    "IRInlineImage",
    "IRLink",
    "IRListMembership",
    "IRPassthrough",
    "IRParagraph",
    "IRRaw",
    "IRRevision",
    "IRRowProps",
    "IRRun",
    "IRSdt",
    "IRSection",
    "IRSource",
    "IRTable",
    "IRTableCell",
    "IRTableLook",
    "IRTableProps",
    "IRTableRow",
    "IndentProps",
    "NumberingRef",
    "PageColumns",
    "PageMargins",
    "PageSetup",
    "PageSize",
    "ParaProps",
    "RunProps",
    "SpacingProps",
    "TabStop",
    "block_from_dict",
    "from_dict",
    "inline_from_dict",
    "ir_document_from_dict",
    "to_dict",
]
