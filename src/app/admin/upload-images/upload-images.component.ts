import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-upload-images',
  templateUrl: './upload-images.component.html',
  styleUrls: ['./upload-images.component.css'],
  standalone: false
})
export class UploadImagesComponent {
  
  constructor(private router: Router) {}
  
  navigateToDashboard() {
    this.router.navigate(['/admin/dashboard']);
  }
}