APP_MODULE=app.main:app
HOST=${IRONLOG_HOST:-0.0.0.0}
PORT=${IRONLOG_PORT:-8000}
cd "$(dirname "$0")"
exec uvicorn "$APP_MODULE" --host "$HOST" --port "$PORT" --reload
