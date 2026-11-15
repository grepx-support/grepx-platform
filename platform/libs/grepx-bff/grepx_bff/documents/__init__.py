# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""PDF documents every business product prints: money documents (invoice, bill, quote), working reports from a spec,
the business's brand (logo) on them, and the finished file (shown inline or attached to a message)."""
from . import people_docs
from .branding import brand
from .invoice import BillPdf, InvoicePdf, render
from .pdf_file import PdfFile
from .quote import QuotePdf
from .report import ReportPdf

__all__ = ["brand", "BillPdf", "InvoicePdf", "PdfFile", "QuotePdf", "ReportPdf", "people_docs", "render"]
