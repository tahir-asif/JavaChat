import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
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
          <p style="font-size: 12px; color: gray;">Loading... Render free tier may take 30-60 seconds.</p>
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

  constructor(
    private authService: Auth,
    private router: Router,
    private http: HttpClient
  ) { }

  onSubmit() {
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.wakeChatService();
        this.router.navigate(['/chat'])
      },
      error: () => alert('Invalid credentials'),
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  ngOnInit(): void {
    // Pre-wake the backend services when the login page loads
    this.http.get(`${environment.apiUrl}/api/auth/health`, { responseType: 'text' })
      .subscribe({ error: () => { } });
  }

  private wakeChatService(): void {
    // Sends an authenticated request to the Chat Service to trigger its cold start.
    // The request may fail (404/401) – we don’t care, we just want Render to spin it up.
    this.http.get(`${environment.apiUrl}/api/messages/wakeup?page=0&size=1`)
      .subscribe({ error: () => { } });
  }
}
