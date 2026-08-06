import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs'

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';

import { WebSocketService, ChatMessage } from '../../services/websocket';
import { UserService } from '../../services/user';
import { Auth } from '../../services/auth';
import { environment } from '../../../environments/environment.prod';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
  ],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class ChatComponent implements OnInit, OnDestroy {
  searchQuery = '';
  searchResults: string[] = [];
  private _contacts: { username: string; online: boolean }[] = [];

  private get storageKey(): string {
    return 'contacts_' + this.currentUser;
  }

  get contacts(): { username: string; online: boolean }[] {
    return this._contacts;
  }

  set contacts(value: { username: string; online: boolean }[]) {
    this._contacts = value;
    localStorage.setItem(this.storageKey, JSON.stringify(value));
  }
  selectedContact: string | null = null;
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUser = '';
  sidebarOpened = true;
  sidenavMode: 'over' | 'side' = 'side';
  isMobile = false;

  private messageSub!: Subscription;
  private presenceSub!: Subscription;
  private heartbeatSub!: Subscription;
  private presencePollSub!: Subscription;
  private breakpointSub!: Subscription;

  private onlineUsers = new Set<string>();

  constructor(
    private wsService: WebSocketService,
    private userService: UserService,
    public auth: Auth,
    private ngZone: NgZone,
    private http: HttpClient,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
  ) {
    this.currentUser = this.auth.getUsername() || '';
  }

  ngOnInit(): void {
    this.loadContacts();
    this.wsService.connect();
    this.refreshPresence();

    this.breakpointSub = this.breakpointObserver
      .observe(['(max-width: 750px)'])
      .subscribe(result => {
        this.isMobile = result.matches;
        this.sidenavMode = result.matches ? 'over' : 'side';
        // Collapsed by default on small screens, visible on wide screens.
        this.sidebarOpened = !result.matches;
      });

    this.presencePollSub = interval(25 * 1000).subscribe(() => this.refreshPresence());

    this.messageSub = this.wsService.getMessageStream().subscribe(msg => {
      this.ngZone.run(() => {
        // If the sender is not the current user and not already a contact, add them
        if (msg.senderId !== this.currentUser && !this.contacts.find(c => c.username === msg.senderId)) {
          this.contacts = [...this.contacts, { username: msg.senderId, online: true }];
        }
        if (
          this.selectedContact &&
          ((msg.senderId === this.currentUser && msg.receiverId === this.selectedContact) ||
            (msg.senderId === this.selectedContact && msg.receiverId === this.currentUser))
        ) {
          this.messages.push(msg);
        }
      });
    });

    this.presenceSub = this.wsService.getPresenceStream().subscribe(event => {
      this.ngZone.run(() => {
        console.log('PRESENCE UPDATE IN COMPONENT', event);  // temporary log
        const contact = this.contacts.find(c => c.username === event.username);
        if (contact) {
          contact.online = event.online;
          console.log('Updated contact', contact.username, contact.online);  // temp
        } else {
          console.log('Contact not found for presence:', event.username);
        }
      });
    });

    this.heartbeatSub = interval(5 * 60 * 1000).subscribe(() => {
      this.http.get(`${environment.apiUrl}/api/messages/health`)
        .subscribe({ error: () => { } });
    });
  }

  ngOnDestroy(): void {
    this.messageSub?.unsubscribe();
    this.presenceSub?.unsubscribe();
    this.wsService.disconnect();
    this.heartbeatSub?.unsubscribe();
    this.presencePollSub?.unsubscribe();
    this.breakpointSub?.unsubscribe();
  }

  searchUsers(): void {
    if (!this.searchQuery.trim()) return;
    this.userService.search(this.searchQuery).subscribe({
      next: (users) => {
        this.searchResults = users.filter(u => u !== this.currentUser);
      },
      error: (err) => console.error('Search error', err)
    });
  }

  // Fetches the set of currently-connected users from the Chat Service and
  // marks matching contacts as online. Failures are ignored; the next poll
  // (or a STOMP presence event) will catch up.
  refreshPresence(): void {
    this.http.get<string[]>(`${environment.apiUrl}/api/messages/online`)
      .subscribe({
        next: (users) => {
          this.onlineUsers = new Set(users);
          this._contacts.forEach(c => c.online = this.onlineUsers.has(c.username));
        },
        error: () => { /* ignore – retried on the next poll */ }
      });
  }

  addContact(user: string): void {
    if (!this.contacts.find(c => c.username === user)) {
      // Add with online status from the latest presence poll
      const newContact = { username: user, online: this.onlineUsers.has(user) };
      this.contacts.push(newContact);
      this.contacts = this._contacts;
    }
    this.searchResults = [];
    this.searchQuery = '';
    this.selectContact(user);
  }

  selectContact(user: string): void {
    this.selectedContact = user;
    this.messages = [];
    // On small screens the sidebar floats over the chat; close it so the
    // conversation is fully visible.
    if (this.isMobile) {
      this.sidebarOpened = false;
    }
    // Fetch chat history from the REST endpoint
    this.http.get<ChatMessage[]>(`${environment.apiUrl}/api/messages/${user}?size=50&page=0`)
      .subscribe({
        next: (history) => {
          this.messages = history.reverse(); // API returns newest first; we want oldest at top
        },
        error: (err) => console.error('Failed to load history', err)
      });
  }

  loadContacts() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this._contacts = JSON.parse(saved);
        this._contacts.forEach(c => c.online = false);
      } catch (e) { }
    } else {
      this._contacts = [];
    }
  }

  sendMessage(): void {
    if (!this.selectedContact || !this.newMessage.trim()) return;
    this.wsService.sendMessage(this.selectedContact, this.newMessage.trim());
    this.newMessage = '';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
