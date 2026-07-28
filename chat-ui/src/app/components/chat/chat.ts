import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { HttpClient } from '@angular/common/http';

import { WebSocketService, ChatMessage } from '../../services/websocket';
import { UserService } from '../../services/user';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

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

  private messageSub!: Subscription;
  private presenceSub!: Subscription;

  constructor(
    private wsService: WebSocketService,
    private userService: UserService,
    public auth: Auth,
    private ngZone: NgZone,
    private http: HttpClient,
    private router: Router,
  ) {
    this.currentUser = this.auth.getUsername() || '';
  }

  ngOnInit(): void {
    this.loadContacts();
    this.wsService.connect();

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
  }

  ngOnDestroy(): void {
    this.messageSub?.unsubscribe();
    this.presenceSub?.unsubscribe();
    this.wsService.disconnect();
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

  addContact(user: string): void {
    if (!this.contacts.find(c => c.username === user)) {
      // Add with default offline status
      const newContact = { username: user, online: false };
      this.contacts.push(newContact);
      this.contacts = this._contacts;

      // Immediately fetch the real online status from Auth Service
      this.http.get<{ online: boolean }>(`http://localhost:8080/api/auth/users/${user}/online`)
        .subscribe({
          next: (res) => {
            const contact = this.contacts.find(c => c.username === user);
            if (contact) {
              contact.online = res.online;
            }
          },
          error: () => { /* ignore – user might not exist */ }
        });
    }
    this.searchResults = [];
    this.searchQuery = '';
    this.selectContact(user);
  }

  selectContact(user: string): void {
    this.selectedContact = user;
    this.messages = [];
    // Fetch chat history from the REST endpoint
    this.http.get<ChatMessage[]>(`http://localhost:8080/api/messages/${user}?size=50&page=0`)
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
