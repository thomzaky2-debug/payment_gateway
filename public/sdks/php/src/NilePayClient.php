<?php
namespace NilePay;

final class NilePayClient {
  public function __construct(private string $apiKey, private string $baseUrl = 'https://nilepay-api.runasp.net') {
    if ($apiKey === '') throw new \InvalidArgumentException('apiKey is required');
  }
  public function createCheckout(array $payload, string $idempotencyKey): array {
    if ($idempotencyKey === '') throw new \InvalidArgumentException('Persist and provide an Idempotency-Key');
    return $this->request('POST', '/api/v1/checkout/create', $payload, ['Idempotency-Key: '.$idempotencyKey]);
  }
  public function getCheckout(string $sessionId): array { return $this->request('GET', '/api/v1/checkout/status?sessionId='.rawurlencode($sessionId)); }
  private function request(string $method, string $path, ?array $body = null, array $headers = []): array {
    $curl = curl_init(rtrim($this->baseUrl, '/').$path);
    curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => array_merge(['Authorization: Bearer '.$this->apiKey, 'Content-Type: application/json'], $headers), CURLOPT_TIMEOUT => 15]);
    if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
    $result = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE); curl_close($curl);
    $decoded = json_decode((string)$result, true);
    if ($status < 200 || $status >= 300) throw new \RuntimeException($decoded['error'] ?? "NilePay API error $status", $status);
    return $decoded;
  }
  public static function verifyWebhook(string $rawBody, string $eventId, string $timestamp, string $signature, string $secret): bool {
    if (!$eventId || !$timestamp || !$signature || !$secret || abs(time() - (int)$timestamp) > 300) return false;
    $expected = hash_hmac('sha256', $timestamp.'.'.$rawBody, $secret);
    return hash_equals($expected, preg_replace('/^v1=/', '', $signature));
  }
}
