# nilepay-go

Use this module from a server-side Go service. `CreateCheckout` requires a saved, stable idempotency key; `VerifyWebhook` verifies the exact body and the five-minute timestamp window. Persist the event ID before fulfillment.
