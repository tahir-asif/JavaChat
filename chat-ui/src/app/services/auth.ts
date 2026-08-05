import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment.prod';

export interface AuthResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly baseUrl = environment.apiUrl + '/api/auth';

  isBackendReady = false;
  private readinessPromise: Promise<boolean> | null = null;

  constructor(private http: HttpClient) { }

  // Wakes every sleeping Render service in parallel at t=0. All three targets
  // use the same no-cors fetch, which reliably triggers Render to spin the
  // container up (responses are not read, so CORS is not required).
  warm(): void {
    this.noCorsGet(`${environment.apiUrl}/api/auth/health`);                    // gateway
    this.noCorsGet(`${environment.authUrl}/api/auth/health`);                   // auth
    this.noCorsGet(`${environment.chatUrl}/api/messages/health`); // chat
  }

  // Sends a request that forces Render to spin the service up; the response is
  // intentionally discarded. Rejects only on network failure, which is fine.
  private noCorsGet(url: string): void {
    fetch(url, { mode: 'no-cors' }).catch(() => {});
  }

  // Polls /api/auth/health every intervalMs until it returns 200, or gives up
  // after maxAttempts. Resolves true once the backend is ready.
  // The poll loop is shared: concurrent callers await the same promise.
  waitUntilReady(maxAttempts = 60, intervalMs = 5000): Promise<boolean> {
    if (this.isBackendReady) return Promise.resolve(true);
    if (this.readinessPromise) return this.readinessPromise;
    this.warm();
    this.readinessPromise = new Promise(resolve => {
      let attempts = 0;
      const check = () => {
        if (this.isBackendReady) {
          this.readinessPromise = null;
          return resolve(true);
        }
        if (attempts >= maxAttempts) {
          this.readinessPromise = null;
          return resolve(false);
        }
        attempts += 1;
        this.http.get(`${this.baseUrl}/health`, { responseType: 'text' }).subscribe({
          next: () => { this.isBackendReady = true; this.readinessPromise = null; resolve(true); },
          error: () => setTimeout(check, intervalMs),
        });
      };
      check();
    });
    return this.readinessPromise;
  }

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
