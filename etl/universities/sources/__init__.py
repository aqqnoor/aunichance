"""Data source adapters for the universities ETL.

Each module in this package exposes functions for retrieving raw rows
from a particular external service. A raw row is a ``dict`` keyed
consistently across sources with at least the following fields:

* ``source``: a short string identifying the origin (e.g. "hipolabs")
* ``name``: the name of the university
* ``country_code``: a two-letter ISO 3166 code
* ``city``: the city where the university is located, or ``None``
* ``website``: the primary URL of the university, or ``None``
* ``qs_rank``: an integer QS ranking or ``None`` if unknown
* ``the_rank``: an integer Times Higher Education ranking or ``None`` if unknown

By encapsulating external calls in source modules the rest of the
pipeline remains decoupled from the specifics of each API.
"""

__all__ = [
    "hipolabs",
    "scorecard",
]