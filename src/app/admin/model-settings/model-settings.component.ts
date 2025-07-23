import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-model-settings',
  templateUrl: './model-settings.component.html',
  styleUrls: ['./model-settings.component.css'],
  standalone: false
})
export class ModelSettingsComponent {
  
  constructor(private router: Router) {}
  
  navigateToDashboard() {
    this.router.navigate(['/admin/dashboard']);
  }
}