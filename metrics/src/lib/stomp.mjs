import { Client } from '@stomp/stompjs';
import WebSocket from 'ws';

export class StompClient {
  constructor({ url, token, onMessage, onPresence, connectTimeoutMs = 15000 }) {
    this.url = url;
    this.token = token;
    this.onMessage = onMessage;
    this.onPresence = onPresence;
    this.connectTimeoutMs = connectTimeoutMs;
    this.client = null;
    this.connected = false;
    this.closing = false;
  }

  connect() {
    if (this.client) throw new Error('STOMP client already created');

    return new Promise((resolve, reject) => {
      const client = new Client({
        webSocketFactory: () => new WebSocket(this.url),
        connectHeaders: { Authorization: `Bearer ${this.token}` },
        reconnectDelay: 0,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: () => {}
      });
      this.client = client;

      const timer = setTimeout(() => reject(new Error('STOMP connect timeout')), this.connectTimeoutMs);
      const fail = (error) => {
        clearTimeout(timer);
        if (!this.connected) reject(error instanceof Error ? error : new Error(String(error)));
      };

      client.onConnect = () => {
        clearTimeout(timer);
        this.connected = true;

        client.subscribe('/user/queue/messages', (frame) => {
          if (!this.onMessage) return;
          try {
            this.onMessage(JSON.parse(frame.body), frame);
          } catch {
            // Malformed frames are not part of the measurement.
          }
        });

        if (this.onPresence) {
          client.subscribe('/topic/presence', (frame) => {
            try {
              this.onPresence(JSON.parse(frame.body), frame);
            } catch {
              // Malformed frames are not part of the measurement.
            }
          });
        }

        resolve();
      };

      client.onStompError = (frame) => fail(new Error(frame.headers?.message ?? 'STOMP error'));
      client.onWebSocketError = (event) => fail(event instanceof Error ? event : new Error('WebSocket error'));
      client.onWebSocketClose = (event) => {
        this.connected = false;
        if (!this.closing) fail(new Error(`WebSocket closed (${event.code})`));
      };

      client.activate();
    });
  }

  send(receiverId, content) {
    if (!this.connected || !this.client) throw new Error('STOMP client is not connected');
    this.client.publish({
      destination: '/app/chat',
      body: JSON.stringify({ receiverId, content })
    });
  }

  get bufferedAmount() {
    return this.client?.webSocket?.bufferedAmount ?? 0;
  }

  async disconnect() {
    this.closing = true;
    this.connected = false;
    if (this.client) await this.client.deactivate();
  }
}
