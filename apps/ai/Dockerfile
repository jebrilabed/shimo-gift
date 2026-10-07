FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /service

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --system --create-home --uid 10001 farasha
COPY --chown=farasha:farasha app ./app

USER farasha
EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn app.main:app --host \"${AI_HOST:-0.0.0.0}\" --port \"${PORT:-${AI_PORT:-8000}}\""]
