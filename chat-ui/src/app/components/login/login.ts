import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment.prod';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '../../services/auth';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterModule
  ],
  template: `
    <div class="auth-container">
      <mat-card>
        <mat-card-title>Login</mat-card-title>
        <mat-card-content>
          <form (ngSubmit)="onSubmit()">
            <mat-form-field appearance="fill">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="username" name="username" required>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required>
            </mat-form-field>
            <button mat-raised-button color="primary" type="submit">Login</button>
            <button mat-button type="button" routerLink="/register">Register</button>
          </form>
        </mat-card-content>
        <div *ngIf="isLoading" style="text-align: center; margin-top: 16px;">
          <mat-spinner diameter="30"></mat-spinner>
          <p style="font-size: 12px; color: gray;">Waking up server… this can take up to 2 minutes on Render free tier.</p>
        </div>
        <div *ngIf="serverMessage" style="text-align: center; margin-top: 12px; font-size: 13px; color: #c62828;">
          {{ serverMessage }}
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f5f5f5;
    }
    mat-card {
      width: 350px;
      padding: 24px;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  isLoading = false;
  isBackendReady = false;
  serverMessage = '';

  constructor(
    private authService: Auth,
    private router: Router,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.authService.waitUntilReady().then(ready => {
      this.isBackendReady = ready;
    });
  }

  onSubmit() {
    this.isLoading = true;
    if (this.isBackendReady) {
      this.doLogin();
    } else {
      this.serverMessage = 'Waking up the server, this can take up to 2 minutes…';
      this.authService.waitUntilReady().then(ready => {
        if (ready) {
          this.isBackendReady = true;
          this.doLogin();
        } else {
          this.serverMessage = 'The server is taking too long to wake up. Please try again in a minute.';
          this.isLoading = false;
        }
      });
    }
  }

  private doLogin(): void {
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.wakeChatService();
        this.router.navigate(['/chat'])
      },
      error: (err) => this.onLoginError(err),
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private onLoginError(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.serverMessage = 'Invalid username or password.';
      this.isLoading = false;
    } else if (err.status === 502 || err.status === 504) {
      this.serverMessage = 'Server is still starting, retrying…';
      setTimeout(() => this.doLogin(), 3000);
    } else {
      this.serverMessage = 'Something went wrong. Please try again.';
      this.isLoading = false;
    }
  }

  private wakeChatService(): void {
    // Sends an authenticated request to the Chat Service to trigger its cold start.
    // The request may fail (404/401) – we don’t care, we just want Render to spin it up.
    this.http.get(`${environment.apiUrl}/api/messages/wakeup?page=0&size=1`)
      .subscribe({ error: () => { } });
  }
}
