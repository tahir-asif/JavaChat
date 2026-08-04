import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment.prod';
import { RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { OnInit } from '@angular/core';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatButtonModule,
    RouterModule
  ],
  template: `
    <div class="auth-container">
      <mat-card>
        <mat-card-title style="text-align: center; margin: 4px 0 12px 0;">Register</mat-card-title>
        <mat-card-content>
          <form #registerForm="ngForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="fill">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="username" name="username" required>
            </mat-form-field>
            <mat-form-field appearance="fill">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required>
            </mat-form-field>
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="!registerForm.valid">
              Register
            </button>
            <button mat-button type="button" routerLink="/login">
              Back to login
            </button>
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
export class RegisterComponent {
  username = '';
  password = '';
  isLoading = false;
  isBackendReady = false;
  serverMessage = '';
  elapsedSeconds = 0;
  private elapsedTimer?: any;

  constructor(
    private auth: Auth,
    private router: Router,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.auth.waitUntilReady().then(ready => {
      this.isBackendReady = ready;
    });
  }

  onSubmit() {
    this.isLoading = true;
    this.startTimer();
    const doRegister = () => {
      this.auth.register(this.username, this.password).subscribe({
        next: () => {
          this.wakeChatService();
          this.stopTimer();
          this.router.navigate(['/chat'])
        },
        error: (err) => this.onRegisterError(err),
        complete: () => {
          this.isLoading = false;
        }
      });
    };
    if (this.isBackendReady) {
      doRegister();
    } else {
      this.auth.waitUntilReady().then(ready => {
        if (ready) {
          this.isBackendReady = true;
          doRegister();
        } else {
          this.serverMessage = 'The server is taking too long to wake up. Please try again.';
          this.isLoading = false;
          this.stopTimer();
        }
      });
    }
  }

  private onRegisterError(err: HttpErrorResponse): void {
    if (err.status === 400 || err.status === 401) {
      this.serverMessage = err.error?.error || 'Registration failed.';
      this.stopTimer();
    } else if (err.status === 502 || err.status === 504) {
      this.serverMessage = 'Server was still starting. Please press Register again.';
      this.stopTimer();
    } else {
      this.serverMessage = 'Something went wrong. Please try again.';
      this.stopTimer();
    }
    this.isLoading = false;
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
    // Sends an authenticated request to the Chat Service to trigger its cold start.
    // The request may fail (404/401) – we don’t care, we just want Render to spin it up.
    this.http.get(`${environment.apiUrl}/api/messages/wakeup?page=0&size=1`)
      .subscribe({ error: () => { } });
  }

}
