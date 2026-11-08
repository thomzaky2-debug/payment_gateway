import hashlib
import hmac
import json
import time
import requests

class NilePayClient:
    def __init__(self, api_key, base_url="https://nilepay-api.runasp.net", session=None):
        if not api_key: raise ValueError("api_key is required")
        self.api_key, self.base_url, self.session = api_key, base_url.rstrip("/"), session or requests.Session()
    def create_checkout(self, payload, idempotency_key):
        if not idempotency_key: raise ValueError("Persist and provide an idempotency key")
        return self._request("POST", "/api/v1/checkout/create", payload, {"Idempotency-Key": idempotency_key})
    def get_checkout(self, session_id):
        return self._request("GET", "/api/v1/checkout/status", params={"sessionId": session_id})
    def _request(self, method, path, payload=None, headers=None, params=None):
        response = self.session.request(method, self.base_url + path, json=payload, params=params, headers={"Authorization": f"Bearer {self.api_key}", **(headers or {})}, timeout=15)
        if not response.ok: raise requests.HTTPError(response.text, response=response)
        return response.json()

def verify_webhook(raw_body, event_id, timestamp, signature, secret, now=None):
    if not all((event_id, timestamp, signature, secret)) or not isinstance(signature, str): return False
    if isinstance(raw_body, str): raw_bytes = raw_body.encode("utf-8")
    elif isinstance(raw_body, (bytes, bytearray)): raw_bytes = bytes(raw_body)
    else: return False
    try: timestamp_value = int(timestamp)
    except (ValueError, TypeError): return False
    if abs((now or time.time()) - timestamp_value) > 300: return False
    received = signature.removeprefix("v1=")
    try:
        received_bytes = bytes.fromhex(received)
    except ValueError:
        return False
    if len(received_bytes) != 32: return False
    expected = hmac.new(secret.encode("utf-8"), str(timestamp).encode("utf-8") + b"." + raw_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(received_bytes, expected): return False
    try:
        parsed = json.loads(raw_bytes.decode("utf-8"))
        if isinstance(parsed, dict) and isinstance(parsed.get("eventId"), str) and parsed["eventId"] != event_id:
            return False
    except Exception:
        return False
    return True
