"""Tests for shared/util/order.py — the parser + whitelist that turns the
public `?order=col:dir,col2:dir` query string into a SQL ORDER BY fragment.

This module is security-critical: `get_order_by_str` is the ONLY guard
preventing SQL injection through the user-controlled `order` query param
on the /leaderboard endpoint. A regression here could expose the database.

These are pure-logic tests — no DB, no HTTP, no async needed.
"""
import pytest
from shared.util.order import get_sort_assoc_from_order_query, get_order_by_str


# --------------------------------------------------------------------------- #
# get_sort_assoc_from_order_query — string parser
# --------------------------------------------------------------------------- #

class TestGetSortAssocFromOrderQuery:
    def test_single_column_with_direction(self):
        assert get_sort_assoc_from_order_query('xp:desc') == [('xp', 'DESC')]

    def test_single_column_without_direction_defaults_to_asc(self):
        # When `:dir` is omitted, the parser returns the column with default 'ASC'
        result = get_sort_assoc_from_order_query('xp')
        assert result == [('xp', 'ASC')]

    def test_multiple_columns_comma_separated(self):
        result = get_sort_assoc_from_order_query('xp:desc,points:asc,user_id:asc')
        assert result == [('xp', 'DESC'), ('points', 'ASC'), ('user_id', 'ASC')]

    def test_direction_is_case_insensitive_uppercased(self):
        # Lowercase `desc` should be normalized to uppercase
        assert get_sort_assoc_from_order_query('xp:desc') == [('xp', 'DESC')]
        assert get_sort_assoc_from_order_query('xp:DESC') == [('xp', 'DESC')]
        assert get_sort_assoc_from_order_query('xp:Desc') == [('xp', 'DESC')]

    def test_column_name_is_lowercased(self):
        # Column names should be normalized to lowercase for whitelist matching
        assert get_sort_assoc_from_order_query('XP:desc') == [('xp', 'DESC')]
        assert get_sort_assoc_from_order_query('User_ID:asc') == [('user_id', 'ASC')]

    def test_whitespace_around_column_and_direction_is_stripped(self):
        result = get_sort_assoc_from_order_query(' xp : desc , points : asc ')
        assert result == [('xp', 'DESC'), ('points', 'ASC')]

    def test_extra_colons_are_ignored_after_first(self):
        # `maxsplit=1` means only the first ':' counts as separator
        result = get_sort_assoc_from_order_query('xp:desc:extra')
        # The 'extra' part becomes part of the direction string; uppercased
        assert result == [('xp', 'DESC:EXTRA')]

    def test_empty_string_returns_one_empty_entry(self):
        # ''.split(',') == [''] → one entry with empty col, default ASC
        result = get_sort_assoc_from_order_query('')
        assert result == [('', 'ASC')]


# --------------------------------------------------------------------------- #
# get_order_by_str — whitelist enforcement (security boundary)
# --------------------------------------------------------------------------- #

VALID_LEADERBOARD_COLUMNS = [
    'rank', 'display_name', 'user_id', 'points', 'total_games', 'wins', 'losses',
    'goals_scored', 'goals_conceded', 'goal_difference',
    'max_streak', 'current_streak', 'xp', 'level',
]


class TestGetOrderByStr:
    def test_none_input_returns_none(self):
        # Caller signals "use default sort" by passing None
        assert get_order_by_str(None, VALID_LEADERBOARD_COLUMNS) is None

    def test_empty_assoc_returns_none(self):
        # No sort keys → no ORDER BY fragment (caller falls back to default)
        assert get_order_by_str([], VALID_LEADERBOARD_COLUMNS) is None

    def test_single_valid_column_returns_fragment(self):
        result = get_order_by_str([('xp', 'DESC')], VALID_LEADERBOARD_COLUMNS)
        assert result == 'xp DESC'

    def test_multiple_valid_columns_joined_with_comma(self):
        result = get_order_by_str(
            [('xp', 'DESC'), ('points', 'ASC')],
            VALID_LEADERBOARD_COLUMNS,
        )
        assert result == 'xp DESC, points ASC'

    def test_invalid_column_is_silently_dropped(self):
        # Unknown columns must be dropped — never echoed into SQL
        result = get_order_by_str(
            [('xp', 'DESC'), ('not_a_column', 'ASC')],
            VALID_LEADERBOARD_COLUMNS,
        )
        assert result == 'xp DESC'
        assert 'not_a_column' not in result

    def test_all_invalid_columns_returns_none(self):
        result = get_order_by_str(
            [('foo', 'DESC'), ('bar', 'ASC')],
            VALID_LEADERBOARD_COLUMNS,
        )
        assert result is None

    def test_direction_other_than_desc_normalized_to_asc(self):
        # Only the literal string 'DESC' (case-insensitive) is honored as DESC.
        # Any other value (including malicious SQL) becomes 'ASC'.
        for evil_dir in ['ASCENDING', '; DROP TABLE users; --', '', 'random']:
            result = get_order_by_str([('xp', evil_dir)], VALID_LEADERBOARD_COLUMNS)
            assert result == 'xp ASC', (
                f"direction {evil_dir!r} should normalize to ASC, got {result!r}"
            )

    def test_column_case_must_match_lowercased_whitelist(self):
        # The key is lowercased before lookup; whitelist entries are lowercase.
        result = get_order_by_str([('XP', 'DESC')], VALID_LEADERBOARD_COLUMNS)
        assert result == 'xp DESC'

    # ── SQL injection attempts (the security bar) ────────────────────────── #

    def test_sql_injection_via_column_name_is_blocked(self):
        # Classic injection attempts in the column slot
        for evil_col in [
            'xp; DROP TABLE users; --',
            '1=1',
            "xp'; DELETE FROM matches; --",
            'xp UNION SELECT password FROM credentials',
            '*',
        ]:
            result = get_order_by_str([(evil_col, 'DESC')], VALID_LEADERBOARD_COLUMNS)
            assert result is None, (
                f"injection {evil_col!r} should be blocked, got {result!r}"
            )

    def test_sql_injection_via_direction_is_neutralized(self):
        # Even with a valid column, direction is force-normalized
        result = get_order_by_str(
            [('xp', "DESC; DROP TABLE users")],
            VALID_LEADERBOARD_COLUMNS,
        )
        # 'DESC; DROP TABLE users'.upper() != 'DESC' (it has trailing chars),
        # so the normalizer falls through to 'ASC'
        assert result == 'xp ASC'
        assert 'DROP' not in result

    def test_mixed_valid_and_invalid_keeps_only_valid(self):
        result = get_order_by_str(
            [
                ('xp', 'DESC'),
                ('attacker_col', 'DESC'),
                ('points', 'ASC'),
                ("'; DROP", 'DESC'),
            ],
            VALID_LEADERBOARD_COLUMNS,
        )
        assert result == 'xp DESC, points ASC'


# --------------------------------------------------------------------------- #
# End-to-end: query string → SQL fragment (the path used by /leaderboard)
# --------------------------------------------------------------------------- #

class TestParserAndWhitelistTogether:
    def test_typical_frontend_request(self):
        # What Leaderboard.jsx actually sends after the tie-breaker fix
        order_str = 'xp:desc,points:desc,goal_difference:desc,user_id:asc'
        assoc = get_sort_assoc_from_order_query(order_str)
        sql = get_order_by_str(assoc, VALID_LEADERBOARD_COLUMNS)
        assert sql == 'xp DESC, points DESC, goal_difference DESC, user_id ASC'

    def test_attacker_query_string_is_neutralized(self):
        attack = "xp:desc'; DROP TABLE users; --"
        assoc = get_sort_assoc_from_order_query(attack)
        sql = get_order_by_str(assoc, VALID_LEADERBOARD_COLUMNS)
        # Whatever the parser produced, the whitelist ensures no DROP / -- leaks through
        assert sql is None or 'DROP' not in sql
        assert sql is None or '--' not in sql
