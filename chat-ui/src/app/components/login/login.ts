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
        <mat-card-title style="text-align: left; margin: 4px 0 12px 0;">Login</mat-card-title>
        <mat-card-content>
          <form (ngSubmit)="onSubmit()">
            <mat-form-field appearance="fill">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="username" name="username" required [disabled]="isLoading">
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required [disabled]="isLoading">
            </mat-form-field>
            <button mat-raised-button color="primary" type="submit" [disabled]="isLoading">Login</button>
            <button mat-button type="button" routerLink="/register" [disabled]="isLoading">Register</button>
          </form>
        </mat-card-content>
        <div *ngIf="isLoading" style="text-align: center; margin-top: 16px;">
          <div style="display: flex; justify-content: center;">
            <mat-spinner diameter="30"></mat-spinner>
          </div>
          <p style="font-size: 12px; color: gray; margin-top: 8px;">
            Waking up server… this can take up to 5 minutes on Render's free tier. Elapsed time: {{ elapsedSeconds }}s
          </p>
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
  elapsedSeconds = 0;
  private elapsedTimer?: any;
  private loginAttempts = 0;
  private readonly maxLoginAttempts = 5;

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
    if (this.isLoading) return;
    this.isLoading = true;
    this.loginAttempts = 0;
    if (this.isBackendReady) {
      this.doLogin();
    } else {
      this.startTimer();
      this.authService.waitUntilReady().then(ready => {
        if (ready) {
          this.isBackendReady = true;
          this.doLogin();
        } else {
          this.serverMessage = 'The server is taking too long to wake up. Please try again.';
          this.isLoading = false;
          this.stopTimer();
        }
      });
    }
  }

  private doLogin(): void {
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.wakeChatService();
        this.isLoading = false;
        this.stopTimer();
        this.router.navigate(['/chat'])
      },
      error: (err) => this.onLoginError(err),
    });
  }

  private onLoginError(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.serverMessage = 'Invalid username or password.';
      this.isLoading = false;
      this.stopTimer();
    } else if (err.status === 502 || err.status === 504) {
      if (this.loginAttempts < this.maxLoginAttempts) {
        this.loginAttempts += 1;
        setTimeout(() => this.doLogin(), 3000);
      } else {
        this.serverMessage = 'The server is still not responding. Please try again in a minute.';
        this.isLoading = false;
        this.stopTimer();
      }
    } else {
      this.serverMessage = 'Something went wrong. Please try again.';
      this.isLoading = false;
      this.stopTimer();
    }
  }

  private startTimer(): void {
    this.elapsedSeconds = 0;
    clearInterval(this.elapsedTimer);
    this.elapsedTimer = setInterval(() => this.elapsedSeconds++, 1000);
  }

  private stopTimer(): void {
    clearInterval(this.elapsedTimer);
  }

  private wakeChatService(): void {
    // Sends a request to the Chat Service to trigger its cold start.
    // The request may fail (404/401) – we don’t care, we just want Render to spin it up.
    this.http.get(`${environment.apiUrl}/api/messages/health`)
      .subscribe({ error: () => { } });
  }
}
