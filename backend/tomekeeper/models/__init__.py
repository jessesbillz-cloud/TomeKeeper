"""Pydantic models for every table.

Naming convention per table:
    <Name>           : full read-row shape (matches DB row)
    <Name>Create     : client-settable fields for INSERT
    <Name>Update     : client-settable fields for UPDATE (all optional)
"""

from .work import Work, WorkCreate, WorkUpdate
from .edition import Edition, EditionCreate, EditionUpdate
from .library_entry import LibraryEntry, LibraryEntryCreate, LibraryEntryUpdate
from .order import Order, OrderCreate, OrderUpdate
from .forwarded_email import ForwardedEmail, ForwardedEmailCreate, ForwardedEmailUpdate
from .flash_sale import FlashSale, FlashSaleCreate, FlashSaleUpdate

__all__ = [
    "Work",
    "WorkCreate",
    "WorkUpdate",
    "Edition",
    "EditionCreate",
    "EditionUpdate",
    "LibraryEntry",
    "LibraryEntryCreate",
    "LibraryEntryUpdate",
    "Order",
    "OrderCreate",
    "OrderUpdate",
    "ForwardedEmail",
    "ForwardedEmailCreate",
    "ForwardedEmailUpdate",
    "FlashSale",
    "FlashSaleCreate",
    "FlashSaleUpdate",
]
