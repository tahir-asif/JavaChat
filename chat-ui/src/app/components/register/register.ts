import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
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
        <mat-card-title>Register</mat-card-title>
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
export class RegisterComponent {
  username = '';
  password = '';
  isLoading = false;

  constructor(
    private auth: Auth,
    private router: Router,
    private http: HttpClient
  ) { }

  onSubmit() {
    this.auth.register(this.username, this.password).subscribe({
      next: () => {
        this.wakeChatService();
        this.router.navigate(['/chat'])
      },
      error: (err) => alert(err.error?.error || 'Registration failed'),
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
