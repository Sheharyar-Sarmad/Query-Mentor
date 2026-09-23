"""
Full smoke test for all QueryMentor endpoints.
Run: python test_api.py

Requires the server to be running: python server.py
"""

import json
import sys
import time

import httpx

BASE = "http://localhost:8000"
TIMEOUT = 90.0


# ────────────────────────────────────────────────────────
# Pretty printing
# ────────────────────────────────────────────────────────

def banner(title: str) -> None:
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def show(label: str, response: httpx.Response, elapsed: float) -> None:
    print(f"\n▶ {label}")
    print(f"  Status: {response.status_code} | Time: {elapsed:.2f}s")

    try:
        data = response.json()
    except Exception:
        print(f"  Raw: {response.text[:400]}")
        return

    print(f"  Response:")
    formatted = json.dumps(data, indent=2)
    for line in formatted.split("\n"):
        print(f"    {line}")


def call(client: httpx.Client, method: str, path: str, label: str, **kwargs) -> httpx.Response:
    start = time.time()
    try:
        response = client.request(method, path, **kwargs)
    except Exception as exc:
        print(f"\n▶ {label}")
        print(f"  ❌ Request failed: {type(exc).__name__}: {exc}")
        return httpx.Response(0)
    elapsed = time.time() - start
    show(label, response, elapsed)
    return response


# ────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────

def test_system(client: httpx.Client) -> None:
    banner("SYSTEM TESTS")
    call(client, "GET", "/health", "Health check")
    call(client, "GET", "/api/v1/admin/cache/stats", "Cache stats — BEFORE")


def test_chat(client: httpx.Client) -> None:
    banner("GENERAL CHAT TESTS")

    call(client, "POST", "/api/v1/chat",
         "Chat 1 — greeting",
         json={"message": "hello"})

    call(client, "POST", "/api/v1/chat",
         "Chat 2 — same greeting (cache test → expect L1/L2)",
         json={"message": "hello"})

    call(client, "POST", "/api/v1/chat",
         "Chat 3 — small talk",
         json={"message": "how are you today?"})

    call(client, "POST", "/api/v1/chat",
         "Chat 4 — general SQL concept",
         json={"message": "what is a database index in one sentence?"})


def test_text_to_sql(client: httpx.Client) -> None:
    banner("TEXT → SQL TESTS")

    questions = [
        ("Create a users table with id, email, and created_at",
         "postgres"),
        ("Show me the top 5 customers by total order amount",
         "postgres"),
        ("Find all users who have never placed an order",
         "postgres"),
        ("Calculate the running total of order amounts by date",
         "postgres"),
        ("Write a recursive CTE to show an employee hierarchy",
         "postgres"),
        ("Show me a basic SELECT query for MySQL",
         "mysql"),
        ("Create a simple table in SQLite",
         "sqlite"),
    ]

    for i, (question, dialect) in enumerate(questions, 1):
        call(client, "POST", "/api/v1/text-to-sql",
             f"Text→SQL {i} [{dialect}]: {question}",
             json={"question": question, "dialect": dialect})


def test_sql_to_text(client: httpx.Client) -> None:
    banner("SQL → TEXT TESTS")

    queries = [
        "SELECT * FROM users WHERE is_active = true;",
        (
            "SELECT u.email, COUNT(o.id) AS order_count "
            "FROM users u "
            "LEFT JOIN orders o ON o.user_id = u.user_id "
            "GROUP BY u.email "
            "HAVING COUNT(o.id) > 5;"
        ),
        (
            "WITH monthly AS ("
            "SELECT DATE_TRUNC('month', order_date) AS m, SUM(total_amount) AS rev "
            "FROM orders GROUP BY 1) "
            "SELECT m, rev, LAG(rev) OVER (ORDER BY m) AS prev FROM monthly;"
        ),
        (
            "SELECT category, name, price, "
            "ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn "
            "FROM products;"
        ),
    ]

    for i, sql in enumerate(queries, 1):
        preview = sql.replace("\n", " ")[:60]
        call(client, "POST", "/api/v1/sql-to-text",
             f"SQL→Text {i}: {preview}...",
             json={"sql": sql})


def test_simulate(client: httpx.Client) -> None:
    banner("SIMULATE TESTS")

    cases = [
        ("Valid — simple count",
         "SELECT COUNT(*) FROM orders;",
         "postgres"),
        ("Valid — group by status",
         "SELECT status, COUNT(*) AS n FROM orders GROUP BY status;",
         "postgres"),
        ("Valid — join",
         (
             "SELECT u.email, o.total_amount "
             "FROM users u JOIN orders o ON o.user_id = u.user_id "
             "WHERE o.status = 'delivered';"
         ),
         "postgres"),
        ("Error — typo column",
         "SELECT costumer FROM orders;",
         "postgres"),
        ("Error — missing table",
         "SELECT * FROM nonexistent_table;",
         "postgres"),
        ("Error — syntax",
         "SELCT * FROM users;",
         "postgres"),
    ]

    for label, sql, dialect in cases:
        call(client, "POST", "/api/v1/simulate",
             f"Simulate — {label}",
             json={"sql": sql, "dialect": dialect})


def test_cache_after(client: httpx.Client) -> None:
    banner("CACHE TESTS — AFTER")
    call(client, "GET", "/api/v1/admin/cache/stats", "Cache stats — AFTER")

    # Reword the same question to hit the semantic cache
    call(client, "POST", "/api/v1/text-to-sql",
         "Semantic cache — reworded LEFT JOIN question",
         json={
             "question": "Show me how LEFT JOIN works",
             "dialect": "postgres",
         })

    call(client, "GET", "/api/v1/admin/cache/stats", "Cache stats — after reworded")


def test_errors(client: httpx.Client) -> None:
    banner("ERROR HANDLING TESTS")

    call(client, "POST", "/api/v1/text-to-sql",
         "Empty question (expect 422)",
         json={"question": "", "dialect": "postgres"})

    call(client, "POST", "/api/v1/text-to-sql",
         "Invalid dialect (expect 422)",
         json={"question": "show me users", "dialect": "oracle"})

    call(client, "POST", "/api/v1/sql-to-text",
         "Missing sql field (expect 422)",
         json={})


def test_clear(client: httpx.Client) -> None:
    banner("CLEANUP")
    call(client, "POST", "/api/v1/admin/cache/clear", "Clear cache")
    call(client, "GET", "/api/v1/admin/cache/stats", "Cache stats — after clear")


# ────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────

def main() -> None:
    print(f"\n{'#'*70}")
    print(f"#  QueryMentor API Test Suite")
    print(f"#  Base URL: {BASE}")
    print(f"#  Timeout per request: {TIMEOUT}s")
    print(f"{'#'*70}")

    try:
        with httpx.Client(base_url=BASE, timeout=TIMEOUT) as client:
            test_system(client)
            test_chat(client)
            test_text_to_sql(client)
            test_sql_to_text(client)
            test_simulate(client)
            test_cache_after(client)
            test_errors(client)
            test_clear(client)

        print(f"\n{'#'*70}")
        print(f"#  ✅ Test suite complete.")
        print(f"#  Review each response above for correctness.")
        print(f"{'#'*70}\n")

    except httpx.ConnectError:
        print(f"\n❌ Cannot connect to {BASE}")
        print("   Is the server running? Try: python server.py")
        sys.exit(1)


if __name__ == "__main__":
    main()