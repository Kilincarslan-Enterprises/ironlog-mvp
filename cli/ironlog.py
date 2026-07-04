#!/usr/bin/env python3
"""
IronLog CLI wrapper for agent-driven operations.
Reads IRONLOG_API_KEY and IRONLOG_BASE_URL from the environment.
"""
import os
import sys
import json
import argparse
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from urllib.error import HTTPError

DEFAULT_BASE_URL = "http://localhost:8000/v1"


def env(name, default=None):
    return os.environ.get(name, default)


def api_key():
    key = env("IRONLOG_API_KEY")
    if not key:
        print("IRONLOG_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    return key


def base_url():
    return env("IRONLOG_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def request(method, path, body=None):
    url = urljoin(base_url() + "/", path.lstrip("/"))
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "Authorization": f"Bearer {api_key()}",
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        payload = e.read().decode("utf-8")
        try:
            err = json.loads(payload)
        except json.JSONDecodeError:
            err = {"error": str(e.code), "message": payload}
        print(json.dumps(err, indent=2), file=sys.stderr)
        sys.exit(e.code)


def cmd_dashboard(_args):
    print(json.dumps(request("GET", "/agent/dashboard"), indent=2))


def cmd_log(args):
    if args.data:
        raw = args.data
    else:
        raw = sys.stdin.read()
    parsed = json.loads(raw)
    if isinstance(parsed, dict):
        body = parsed
    elif isinstance(parsed, list):
        body = {"entries": parsed}
    else:
        print("Log payload must be a JSON object or array of entries", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(request("POST", "/agent/logs", body), indent=2))


def cmd_preset_list(args):
    qs = []
    if args.q:
        qs.append(f"q={args.q}")
    path = "/agent/presets"
    if qs:
        path += "?" + "&".join(qs)
    print(json.dumps(request("GET", path), indent=2))


def cmd_preset_create(args):
    body = json.loads(args.data)
    print(json.dumps(request("POST", "/agent/presets", body), indent=2))


def cmd_plan_propose(args):
    body = json.loads(args.data)
    print(json.dumps(request("POST", "/agent/plans/propose", body), indent=2))


def main():
    parser = argparse.ArgumentParser(prog="ironlog", description="IronLog agent CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("dashboard", help="Read the user dashboard")

    log = sub.add_parser("log", help="Write workout log entries")
    log.add_argument("-d", "--data", help="Inline JSON payload")

    preset_list = sub.add_parser("preset-list", help="List presets")
    preset_list.add_argument("--q", help="Search query")

    preset_create = sub.add_parser("preset-create", help="Create a routine preset")
    preset_create.add_argument("-d", "--data", required=True, help="JSON preset payload")

    plan_propose = sub.add_parser("plan-propose", help="Propose a workout plan")
    plan_propose.add_argument("-d", "--data", required=True, help="JSON constraints payload")

    args = parser.parse_args()
    handlers = {
        "dashboard": cmd_dashboard,
        "log": cmd_log,
        "preset-list": cmd_preset_list,
        "preset-create": cmd_preset_create,
        "plan-propose": cmd_plan_propose,
    }
    handlers[args.command](args)


if __name__ == "__main__":
    main()
