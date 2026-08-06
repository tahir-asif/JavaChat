import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-github-link',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <a class="github-link" mat-button href="https://github.com/tahir-asif/JavaChat"
       target="_blank" rel="noopener">
      <mat-icon>link</mat-icon>
      GitHub
    </a>
  `,
  styles: [`
    .github-link {
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background: #ffffff;
      color: #1976d2;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      text-decoration: none;
    }
    .github-link:hover {
      background: #f5f5f5;
    }
    mat-icon {
      margin-right: 4px;
      font-size: 18px;
      height: 18px;
      width: 18px;
      line-height: 18px;
    }
  `]
})
export class GithubLinkComponent {}
