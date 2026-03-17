"""Top-level package for universities ETL module.

This package provides utilities for fetching, normalizing and exporting
information about universities from external data sources into a
CSV file compatible with the existing UniChance import mechanism.

The ETL process is organised into three main stages:

* Sources: modules under ``sources`` fetch raw data from APIs
  (e.g. Hipolabs, College Scorecard) and return lists of dictionaries
  with a common schema.
* Transforms: modules under ``transforms`` clean and merge raw rows
  into a canonical representation. This includes generating stable
  UUIDs for each university so repeated runs yield deterministic IDs.
* Writers: modules under ``writers`` output the cleaned data into
  CSV files ready for import by the Go-based CSV loader.
"""

__all__ = []