import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
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

  constructor(private auth: Auth, private router: Router) { }

  onSubmit() {
    this.auth.register(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/chat']),
      error: (err) => alert(err.error?.error || 'Registration failed')
    });
  }
}
