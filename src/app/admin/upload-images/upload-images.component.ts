import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService } from '../../services/mango-disease.service';
import { LocationService, LocationData } from '../../services/location.service';
import { Subscription } from 'rxjs';

interface UploadImage {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
  result?: any;
  location?: LocationData;
}

@Component({
  selector: 'app-upload-images',
  templateUrl: './upload-images.component.html',
  styleUrls: ['./upload-images.component.css'],
  standalone: false
})
export class UploadImagesComponent implements OnInit, OnDestroy {
  images: UploadImage[] = [];
  dragOver = false;
  uploading = false;
  locationEnabled = false;
  currentLocation: LocationData | null = null;
  locationError: string | null = null;
  locationPermissionStatus: any = null;
  
  private locationSubscription?: Subscription;

  constructor(
    private router: Router,
    private mangoDiseaseService: MangoDiseaseService,
    private locationService: LocationService
  ) {}

  async ngOnInit() {
    await this.checkLocationSupport();
  }

  ngOnDestroy() {
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
  }

  async checkLocationSupport() {
    if (this.locationService.isGeolocationSupported()) {
      this.locationPermissionStatus = await this.locationService.checkPermissionStatus();
    }
  }

  async enableLocation() {
    try {
      this.locationError = null;
      
      this.locationSubscription = this.locationService.getCurrentLocation().subscribe({
        next: (location) => {
          this.currentLocation = location;
          this.locationEnabled = true;
          console.log('Location enabled:', location);
        },
        error: (error) => {
          this.locationError = error.message;
          this.locationEnabled = false;
          console.error('Location error:', error);
        }
      });
    } catch (error) {
      this.locationError = 'Failed to enable location services';
      console.error('Location enable error:', error);
    }
  }

  disableLocation() {
    this.locationEnabled = false;
    this.currentLocation = null;
    this.locationError = null;
    
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelect(event: any) {
    const files = event.target.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  private handleFiles(files: File[]) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const uploadImage: UploadImage = {
          file,
          preview: e.target?.result as string,
          uploading: false,
          uploaded: false,
          error: null,
          location: this.locationEnabled ? this.currentLocation || undefined : undefined
        };
        
        this.images.push(uploadImage);
      };
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number) {
    this.images.splice(index, 1);
  }

  async uploadImage(image: UploadImage) {
    if (image.uploading || image.uploaded) return;

    try {
      image.uploading = true;
      image.error = null;

      const formData = new FormData();
      formData.append('image', image.file);
      
      // Add location data if available
      if (image.location) {
        formData.append('latitude', image.location.latitude.toString());
        formData.append('longitude', image.location.longitude.toString());
        formData.append('location_accuracy', image.location.accuracy.toString());
        
        if (image.location.address) {
          formData.append('location_address', image.location.address);
        }
        if (image.location.city) {
          formData.append('location_city', image.location.city);
        }
        if (image.location.region) {
          formData.append('location_region', image.location.region);
        }
        if (image.location.country) {
          formData.append('location_country', image.location.country);
        }
      }

      const response = await this.mangoDiseaseService.uploadAndClassifyImage(formData).toPromise();
      
      if (response && response.success) {
        image.result = response.data;
        image.uploaded = true;
      } else {
        image.error = 'Upload failed: ' + (response?.message || 'Unknown error');
      }
    } catch (error: any) {
      image.error = 'Upload failed: ' + (error.message || 'Network error');
      console.error('Upload error:', error);
    } finally {
      image.uploading = false;
    }
  }

  async uploadAllImages() {
    if (this.uploading) return;

    this.uploading = true;
    
    const uploadPromises = this.images
      .filter(img => !img.uploaded && !img.uploading)
      .map(img => this.uploadImage(img));
    
    await Promise.all(uploadPromises);
    this.uploading = false;
  }

  clearAllImages() {
    this.images = [];
  }

  getSuccessCount(): number {
    return this.images.filter(img => img.uploaded).length;
  }

  getErrorCount(): number {
    return this.images.filter(img => img.error).length;
  }

  getPendingCount(): number {
    return this.images.filter(img => !img.uploaded && !img.error).length;
  }

  navigateToDashboard() {
    this.router.navigate(['/admin/dashboard']);
  }

  navigateToImages() {
    this.router.navigate(['/admin/verified-images']);
  }

  formatLocation(location: LocationData): string {
    return this.locationService.formatLocation(location);
  }

  getLocationAccuracy(location: LocationData): string {
    return this.locationService.getAccuracyDescription(location.accuracy);
  }
}