"""Python twin of the BeakDoc IR and the schema types it references.

Mirrors ``packages/ir/src/types.ts`` and ``packages/schema/src/types.ts``.
Field names are snake_case; JSON keys are the camelCase TypeScript names
(``grid_span`` <-> ``gridSpan``). For typed fields, ``None`` means "absent" in
both directions: ``to_dict`` drops it and ``from_dict`` leaves it unset, so an
explicit JSON ``null`` on a typed field is read as absent. Free-form dicts
(``source.props``, ``container_props``, ``raw``, ``custom``) keep their nulls.

Style sheet and numbering definitions are kept as plain dicts (``Dict[str, Any]``),
since the IR never inspects them beyond lookups.

Requires Python 3.10+ (``kw_only`` dataclasses). Standard library only.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field, fields, is_dataclass
from typing import Any, Dict, List, Optional, Union, get_args, get_origin, get_type_hints

IR_VERSION = 1

# --------------------------------------------------------------------------- #
# Schema: paragraph and run properties                                        #
# --------------------------------------------------------------------------- #


@dataclass(kw_only=True)
class NumberingRef:
    num_id: Optional[str] = None
    level: Optional[int] = None


@dataclass(kw_only=True)
class SpacingProps:
    before_pt: Optional[float] = None
    after_pt: Optional[float] = None
    line: Optional[float] = None
    line_rule: Optional[str] = None


@dataclass(kw_only=True)
class IndentProps:
    left_pt: Optional[float] = None
    hanging_pt: Optional[float] = None
    first_line_pt: Optional[float] = None


@dataclass(kw_only=True)
class TabStop:
    pos_pt: Optional[float] = None
    kind: Optional[str] = None
    leader: Optional[str] = None


@dataclass(kw_only=True)
class ParaProps:
    style_id: Optional[str] = None
    numbering: Optional[NumberingRef] = None
    spacing: Optional[SpacingProps] = None
    indent: Optional[IndentProps] = None
    align: Optional[str] = None
    keep_next: Optional[bool] = None
    keep_lines: Optional[bool] = None
    page_break_before: Optional[bool] = None
    widow_control: Optional[bool] = None
    tabs: Optional[List[TabStop]] = None


@dataclass(kw_only=True)
class RunProps:
    font: Optional[str] = None
    size_pt: Optional[float] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    strike: Optional[bool] = None
    vert_align: Optional[str] = None
    color: Optional[str] = None
    highlight: Optional[str] = None
    style_id: Optional[str] = None
    shading: Optional[str] = None


# --------------------------------------------------------------------------- #
# Schema: page setup and document properties                                  #
# --------------------------------------------------------------------------- #


@dataclass(kw_only=True)
class PageSize:
    width_twips: Optional[int] = None
    height_twips: Optional[int] = None


@dataclass(kw_only=True)
class PageMargins:
    top: Optional[int] = None
    right: Optional[int] = None
    bottom: Optional[int] = None
    left: Optional[int] = None
    header: Optional[int] = None
    footer: Optional[int] = None
    gutter: Optional[int] = None


@dataclass(kw_only=True)
class PageColumns:
    count: Optional[int] = None
    space_twips: Optional[int] = None


@dataclass(kw_only=True)
class PageSetup:
    size: Optional[PageSize] = None
    orientation: Optional[str] = None
    margins: Optional[PageMargins] = None
    columns: Optional[PageColumns] = None


@dataclass(kw_only=True)
class DocumentProperties:
    title: Optional[str] = None
    doc_number: Optional[str] = None
    revision: Optional[str] = None
    effective_date: Optional[str] = None
    owner: Optional[str] = None
    lab: Optional[str] = None
    language: Optional[str] = None
    custom: Optional[Dict[str, str]] = None


# --------------------------------------------------------------------------- #
# IR: provenance                                                              #
# --------------------------------------------------------------------------- #


@dataclass(kw_only=True)
class IRListMembership:
    role: str
    level: int
    container_id: Optional[str] = None
    container_type: Optional[str] = None
    container_props: Optional[Dict[str, Any]] = None


@dataclass(kw_only=True)
class IRRaw:
    content: Optional[List[Any]] = None
    children: Optional[List[Any]] = None


@dataclass(kw_only=True)
class IRSource:
    block_type: str
    block_id: str
    props: Optional[Dict[str, Any]] = None
    list: Optional[IRListMembership] = None
    raw: Optional[IRRaw] = None


# --------------------------------------------------------------------------- #
# IR: inline content                                                          #
# --------------------------------------------------------------------------- #


@dataclass(kw_only=True)
class IRRevision:
    kind: str
    id: str
    at: str
    author: Optional[str] = None
    author_id: Optional[str] = None
    ai_generated: Optional[bool] = None


@dataclass(kw_only=True)
class IRLink:
    href: str
    title: Optional[str] = None
    target: Optional[str] = None


@dataclass(kw_only=True)
class IRRun:
    text: str
    props: RunProps = field(default_factory=RunProps)
    type: str = "run"
    revision: Optional[IRRevision] = None
    link: Optional[IRLink] = None


@dataclass(kw_only=True)
class IRField:
    field_type: str
    instr: str
    cached_text: str
    type: str = "field"
    name: Optional[str] = None
    format: Optional[str] = None
    fallback: Optional[str] = None


@dataclass(kw_only=True)
class IRBreak:
    kind: str
    type: str = "break"


@dataclass(kw_only=True)
class IRInlineImage:
    src: str
    type: str = "image"
    width_pt: Optional[float] = None
    height_pt: Optional[float] = None
    alt: Optional[str] = None


@dataclass(kw_only=True)
class IRFootnoteRef:
    id: str
    type: str = "footnoteRef"


@dataclass(kw_only=True)
class IRIcon:
    icon: str
    symbol: str
    type: str = "icon"
    size: Optional[float] = None


@dataclass(kw_only=True)
class IRCustomInline:
    inline_type: str
    props: Dict[str, Any] = field(default_factory=dict)
    text: str = ""
    type: str = "custom"
    content: Optional[List["IRInline"]] = None


IRInline = Union[IRRun, IRField, IRBreak, IRInlineImage, IRFootnoteRef, IRIcon, IRCustomInline]

# --------------------------------------------------------------------------- #
# IR: blocks                                                                  #
# --------------------------------------------------------------------------- #


@dataclass(kw_only=True)
class IRTableLook:
    header_row: Optional[bool] = None
    banded_rows: Optional[bool] = None
    first_column: Optional[bool] = None
    last_row: Optional[bool] = None


@dataclass(kw_only=True)
class IRTableProps:
    style_id: Optional[str] = None
    width_mode: Optional[str] = None
    width_value: Optional[float] = None
    look: Optional[IRTableLook] = None


@dataclass(kw_only=True)
class IRRowProps:
    is_header: Optional[bool] = None
    cant_split: Optional[bool] = None
    height_twips: Optional[int] = None
    id: Optional[str] = None


@dataclass(kw_only=True)
class IRCellProps:
    grid_span: int = 1
    v_merge: Optional[str] = None
    borders: Optional[Dict[str, Any]] = None
    shading: Optional[str] = None
    v_align: Optional[str] = None
    width_twips: Optional[int] = None
    id: Optional[str] = None


@dataclass(kw_only=True)
class IRParagraph:
    props: ParaProps = field(default_factory=ParaProps)
    runs: List[IRInline] = field(default_factory=list)
    type: str = "paragraph"
    source: Optional[IRSource] = None


@dataclass(kw_only=True)
class IRTableCell:
    props: IRCellProps = field(default_factory=IRCellProps)
    blocks: List[IRBlock] = field(default_factory=list)
    source: Optional[IRSource] = None


@dataclass(kw_only=True)
class IRTableRow:
    props: IRRowProps = field(default_factory=IRRowProps)
    cells: List[IRTableCell] = field(default_factory=list)
    source: Optional[IRSource] = None


@dataclass(kw_only=True)
class IRTable:
    props: IRTableProps = field(default_factory=IRTableProps)
    grid: List[int] = field(default_factory=list)
    rows: List[IRTableRow] = field(default_factory=list)
    type: str = "table"
    source: Optional[IRSource] = None


@dataclass(kw_only=True)
class IRSdt:
    tag: str
    blocks: List[IRBlock] = field(default_factory=list)
    type: str = "sdt"
    alias: Optional[str] = None
    lock: Optional[str] = None
    source: Optional[IRSource] = None


@dataclass(kw_only=True)
class IRPassthrough:
    xml: str
    type: str = "passthrough"
    preview: Optional[str] = None
    source: Optional[IRSource] = None


@dataclass(kw_only=True)
class IRImageBlock:
    src: str
    type: str = "image"
    width_pt: Optional[float] = None
    height_pt: Optional[float] = None
    alt: Optional[str] = None
    source: Optional[IRSource] = None


IRBlock = Union[IRParagraph, IRTable, IRSdt, IRPassthrough, IRImageBlock]


@dataclass(kw_only=True)
class IRHeaderFooterSet:
    default: Optional[List[IRBlock]] = None
    first: Optional[List[IRBlock]] = None
    even: Optional[List[IRBlock]] = None


@dataclass(kw_only=True)
class IRSection:
    id: str
    page_setup: PageSetup
    body: List[IRBlock] = field(default_factory=list)
    title_page: Optional[bool] = None
    headers: Optional[IRHeaderFooterSet] = None
    footers: Optional[IRHeaderFooterSet] = None


@dataclass(kw_only=True)
class IRDocument:
    properties: DocumentProperties = field(default_factory=DocumentProperties)
    styles: Dict[str, Any] = field(default_factory=dict)
    numbering: Dict[str, Any] = field(default_factory=dict)
    sections: List[IRSection] = field(default_factory=list)
    ir_version: Optional[int] = None
    id: Optional[str] = None


# --------------------------------------------------------------------------- #
# Serialisation                                                               #
# --------------------------------------------------------------------------- #

_INLINE_TYPES: Dict[str, type] = {
    "run": IRRun,
    "field": IRField,
    "break": IRBreak,
    "image": IRInlineImage,
    "footnoteRef": IRFootnoteRef,
    "icon": IRIcon,
    "custom": IRCustomInline,
}

_BLOCK_TYPES: Dict[str, type] = {
    "paragraph": IRParagraph,
    "table": IRTable,
    "sdt": IRSdt,
    "passthrough": IRPassthrough,
    "image": IRImageBlock,
}


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in rest)


def _to_json(value: Any) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        out: Dict[str, Any] = {}
        for item in fields(value):
            entry = getattr(value, item.name)
            if entry is not None:
                out[_camel(item.name)] = _to_json(entry)
        return out
    if isinstance(value, list):
        return [_to_json(entry) for entry in value]
    if isinstance(value, dict):
        # Free-form dicts (source props, raw JSON) keep explicit nulls.
        return {key: _to_json(entry) for key, entry in value.items()}
    return value


def _convert(hint: Any, value: Any) -> Any:
    if value is None:
        return None
    if hint is Any:
        return value
    if hint is IRBlock or hint == IRBlock:
        return block_from_dict(value)
    if hint is IRInline or hint == IRInline:
        return inline_from_dict(value)
    origin = get_origin(hint)
    args = get_args(hint)
    if origin is Union:
        non_none = [arg for arg in args if arg is not type(None)]
        if len(non_none) == 1:
            return _convert(non_none[0], value)
        return value
    if origin in (list, List):
        return [_convert(args[0], entry) for entry in value]
    if origin in (dict, Dict):
        return value
    if isinstance(hint, type) and is_dataclass(hint):
        return from_dict(hint, value)
    return value


def from_dict(cls: type, data: Dict[str, Any]) -> Any:
    """Builds a dataclass of type ``cls`` from its JSON-shaped dict.

    Unknown keys are ignored, so newer IR versions with extra fields still load.
    """
    hints = get_type_hints(cls, globalns=globals())
    kwargs: Dict[str, Any] = {}
    for item in fields(cls):
        key = _camel(item.name)
        if key in data:
            kwargs[item.name] = _convert(hints[item.name], data[key])
    return cls(**kwargs)


def inline_from_dict(data: Dict[str, Any]) -> Any:
    """Parses one inline item. Raises ``ValueError`` for unknown ``type`` values."""
    kind = data.get("type")
    cls = _INLINE_TYPES.get(kind)  # type: ignore[arg-type]
    if cls is None:
        raise ValueError(f"Unknown IR inline type: {kind!r}")
    return from_dict(cls, data)


def block_from_dict(data: Dict[str, Any]) -> Any:
    """Parses one IR block. Raises ``ValueError`` for unknown ``type`` values."""
    kind = data.get("type")
    cls = _BLOCK_TYPES.get(kind)  # type: ignore[arg-type]
    if cls is None:
        raise ValueError(f"Unknown IR block type: {kind!r}")
    return from_dict(cls, data)


def to_dict(obj: Any) -> Dict[str, Any]:
    """Serialises a model to its JSON-shaped dict (camelCase keys, ``None`` omitted)."""
    return _to_json(obj)


def ir_document_from_dict(data: Dict[str, Any]) -> IRDocument:
    """Parses a whole IR document produced by the TypeScript ``documentToIR``."""
    return from_dict(IRDocument, data)  # type: ignore[return-value]
