import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly baseUrl = 'http://localhost:8080/api/auth';  // gateway

  constructor(private http: HttpClient) { }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, { username, password })
      .pipe(tap(res => this.setToken(res.token)));
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, { username, password })
      .pipe(tap(res => this.setToken(res.token)));
  }

  logout(): void {
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUsername(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub;   // the JWT subject (username)
    } catch {
      return null;
    }
  }

  private setToken(token: string): void {
    localStorage.setItem('token', token);
  }
}
