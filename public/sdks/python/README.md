# nilepay

Install with `pip install .` from this package directory. Use `NilePayClient.create_checkout(payload, stable_order_key)` from a server only. Use `verify_webhook` with raw request bytes and persist every event ID before fulfillment.
