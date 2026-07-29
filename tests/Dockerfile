FROM python:3.12-slim

WORKDIR /workspace

COPY server/requirements.txt /tmp/server-requirements.txt
RUN pip install --no-cache-dir \
    -r /tmp/server-requirements.txt \
    pytest \
    pytest-cov

COPY server ./server
COPY tests ./tests
COPY .coveragerc ./.coveragerc
COPY pytest.ini ./pytest.ini

ENV PYTHONPATH=/workspace/server

CMD ["pytest", "-q", "-m", "postgres", "tests/test_postgres_integration.py"]
