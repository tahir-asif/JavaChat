import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class UserService {
  private base = environment.apiUrl + '/api/auth';

  constructor(private http: HttpClient) { }

  search(query: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/users/search?q=${query}`);
  }
}
