import { Injectable, OnDestroy } from '@angular/core';
import { Client, IFrame, Message, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { Auth } from './auth';

export interface ChatMessage {
  id?: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  status: string;
}

export interface PresenceEvent {
  username: string;
  online: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private client: Client;
  private messageSubject = new Subject<ChatMessage>();
  private presenceSubject = new Subject<PresenceEvent>();
  private connected = false;

  constructor(private auth: Auth) {
    this.client = new Client({
      webSocketFactory: () => new WebSocket('ws://localhost:8080/ws'),
      connectHeaders: {
        Authorization: 'Bearer ' + this.auth.getToken()
      },
      debug: (msg: string) => console.log(msg),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.client.onConnect = (frame: IFrame) => {
      this.connected = true;
      this.client.subscribe('/user/queue/messages', (msg: Message) => {
        const body: ChatMessage = JSON.parse(msg.body);
        this.messageSubject.next(body);
      });
      this.client.subscribe('/topic/presence', (msg: Message) => {
        const body: PresenceEvent = JSON.parse(msg.body);
        this.presenceSubject.next(body);
      });
    };

    this.client.onStompError = (frame: IFrame) => {
      console.error('STOMP error', frame);
    };
  }

  connect(): void {
    if (!this.connected) {
      this.client.activate();
    }
  }

  disconnect(): void {
    this.client.deactivate();
    this.connected = false;
  }

  sendMessage(receiverId: string, content: string): void {
    if (this.connected) {
      this.client.publish({
        destination: '/app/chat',
        body: JSON.stringify({ receiverId, content })
      });
    }
  }

  getMessageStream(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }

  getPresenceStream(): Observable<PresenceEvent> {
    return this.presenceSubject.asObservable();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
