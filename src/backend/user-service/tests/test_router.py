import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport

from shared.config.settings import settings
from shared.database import get_db
from main import app
import json
# --------------------------------------------------------------------------- #
# Shared PostgreSQL engine for all HTTP tests in this module
# --------------------------------------------------------------------------- #

_engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
_TestSession = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with _TestSession() as session:
        yield session

@pytest_asyncio.fixture
async def db():
    async with _TestSession() as session:
        yield session



@pytest_asyncio.fixture
async def client():
    async with _engine.begin() as conn:

        app.dependency_overrides[get_db] = _override_get_db
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_search_without_query_returns_400(client):
    resp = await client.get("/search")
    assert resp.status_code == 400
    resp = await client.get("/search?q")
    assert resp.status_code == 400
    resp = await client.get("/search?q=")
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_search_with_search_query_returns_200(client):

    resp = await client.get("/search?q=a")
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_search_with_search_query_returns_schema(client):

    resp = await client.get("/search?q=a")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert isinstance(data.get('results'), list)
    assert isinstance(data.get('total'), int)
    assert isinstance(data.get('page'), int)
    assert isinstance(data.get('per_page'), int)
    assert isinstance(data.get('last_page'), int)

    resp = await client.get("/search?q=abc")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert isinstance(data.get('results'), list)
    assert isinstance(data.get('total'), int)
    assert isinstance(data.get('page'), int)
    assert isinstance(data.get('per_page'), int)
    assert isinstance(data.get('last_page'), int)
    if len(data.get('results')) > 0:
           element = data.get('results')[0]
           assert isinstance(element.get('id'), int)
           assert isinstance(element.get('username'), str)
           assert isinstance(element.get('avatar_url'), (str, type(None)))
           assert isinstance(element.get('status'), str)
    else:
        print('WARNING testing with empty database, skiped some assertions')

@pytest.mark.asyncio
async def test_search_with_limit_query_one_returns_at_most_one_element(client):

    limit = 1
    resp = await client.get(f"/search?q=a&limit={limit}")
    assert resp.status_code == 200
    data = resp.json()
    results = data.get('results')
    assert results is not None
    assert len(results) == 0
    assert data.get('page') == 0
    assert data.get('per_page') == 0

    resp = await client.get(f"/search?q=test&limit={limit}")
    assert resp.status_code == 200
    data = resp.json()
    results = data.get('results')
    assert results is not None
    assert len(results) <= 1
    assert data.get('page') == 0
    assert data.get('per_page') == 1

@pytest.mark.asyncio
async def test_search_with_page_query(client):
    limit = 1
    previous = []
    for page in range(3):
        resp = await client.get(f"/search?q=al&limit={limit}&page={page}")
        assert resp.status_code == 200
        data = resp.json()
        results = data.get('results')
        assert results is not None
        assert len(results) == 1
        assert data.get('page') == page
        assert data.get('per_page') == 1
        username = data.get('results')[0].get('username')
        assert username not in previous
        previous.append(username)

@pytest.mark.asyncio
async def test_search_max_limit(client):
    limit = 100
    page = 0
    previous = []
    resp = await client.get(f"/search?q=al&limit={limit}&page={page}")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get('per_page') == 50

@pytest.mark.asyncio
@pytest.mark.parametrize("query,order,assertion_fun", [
    ("tesob", "asc", lambda date, previous_date: date >= previous_date),
    ("al", "desc", lambda date, previous_date: date <= previous_date)
])
async def test_search_with_page_sort_created_at(query, order, assertion_fun, client, db):
    limit = 1
    previous_dates = []
    for page in range(3):

        resp = await client.get(f"/search?q={query}&limit={limit}&page={page}&order=created_at:{order}")
        assert resp.status_code == 200
        data = resp.json()
        print(json.dumps(data, indent=4))
        results = data.get('results')
        assert results is not None
        assert len(results) == limit
        assert data.get('page') <= page
        assert data.get('per_page') == limit
        username = data.get('results')[0].get('username')
        created_at_result = \
            await db.execute(text("SELECT created_at FROM users WHERE username = :username"),
                                  {'username': username})
        date = created_at_result.scalar()
        if len(previous_dates) > 0:
            previous_date = previous_dates[-1]
            assert assertion_fun(date, previous_date)
        previous_dates.append(date)
