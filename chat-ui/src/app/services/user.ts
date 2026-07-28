import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private base = 'http://localhost:8080/api/auth';

  constructor(private http: HttpClient) { }

  search(query: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/users/search?q=${query}`);
  }
}
