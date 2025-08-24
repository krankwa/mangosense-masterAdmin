import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MangoDiseaseService, MangoImage, ApiResponse, UserConfirmation } from '../../services/mango-disease.service';
import { environment } from '../../../environments/environment';

export interface PredictionData {
  success: boolean;
  message: string;
  data: {
    primary_prediction: {
      disease: string;
      confidence: string;
      confidence_score: number;
      confidence_level: string;
      treatment: string;
      detection_type: string;
    };
    top_3_predictions: Array<{
      disease: string;
      confidence: string;
      confidence_score: number;
      confidence_level: string;
      treatment: string;
      detection_type: string;
    }>;
    prediction_summary: {
      most_likely_disease: string;
      confidence_level: string;
      total_diseases_checked: number;
    };
    saved_image_id: number;
    model_used: string;
    model_path: string;
    debug_info: {
      model_loaded: boolean;
      image_size: string;
      processed_size: string;
    };
  };
  timestamp: string;
}

export interface ImageDetailData extends MangoImage {
  prediction_data?: PredictionData;
  verified_date?: string | null;
  filename?: string;
  image_type?: string;
  disease_detected?: string;
  confidence?: number;
}

@Component({
  selector: 'app-image-detail',
  templateUrl: './image-detail.component.html',
  styleUrls: ['./image-detail.component.css'],
  standalone: false
})
export class ImageDetailComponent implements OnInit {
  imageId: number = 0;
  imageData: ImageDetailData | null = null;
  predictionData: ApiResponse<any> | null = null;
  userConfirmation: UserConfirmation | null = null;
  loading = true;
  error: string | null = null;
  
  // UI state
  activeTab: 'overview' | 'prediction' | 'technical' | 'history' | 'feedback' = 'overview';
  showFullImage = false;
  updating = false;
  imageError = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private mangoDiseaseService: MangoDiseaseService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.imageId = +params['id'];
      if (this.imageId) {
        this.loadImageDetails();
      }
    });
  }

  async loadImageDetails() {
    try {
      this.loading = true;
      this.error = null;

      // Load basic image data
      const imageResponse = await this.mangoDiseaseService.getImageDetails(this.imageId).toPromise();
      if (imageResponse && imageResponse.success) {
        this.imageData = imageResponse.data;
      }

      // Load prediction details
      const predictionResponse = await this.mangoDiseaseService.getImagePredictionDetails(this.imageId).toPromise();
      console.debug('DEBUG predictionResponse (from service):', predictionResponse);
      if (predictionResponse && predictionResponse.success) {
        this.predictionData = predictionResponse;
      }

      // Load user confirmation for this image
      try {
        this.userConfirmation = await this.mangoDiseaseService.getUserConfirmationForImage(this.imageId).toPromise() || null;
        if (this.userConfirmation) {
          console.log('✅ User confirmation loaded:', this.userConfirmation);
        } else {
          console.log('❌ No confirmation found for image_id:', this.imageId);
        }
      } catch (confirmationError) {
        console.warn('Could not load user confirmation data:', confirmationError);
        // Don't show error for missing confirmation - it's optional
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading image details:', error);
      this.error = 'Failed to load image details. Please try again.';
      this.loading = false;
    }
  }

  setActiveTab(tab: 'overview' | 'prediction' | 'technical' | 'history' | 'feedback') {
    this.activeTab = tab;
  }

  toggleFullImage() {
    this.showFullImage = !this.showFullImage;
  }

  async updateVerificationStatus(isVerified: boolean) {
    if (!this.imageData) return;

    try {
      this.updating = true;
      const response = await this.mangoDiseaseService.updateImageVerification(this.imageData.id, isVerified).toPromise();
      
      if (response && response.success) {
        this.imageData.is_verified = isVerified;
        this.imageData.verified_date = isVerified ? new Date().toISOString() : null;
      }
    } catch (error) {
      console.error('Error updating verification:', error);
    } finally {
      this.updating = false;
    }
  }

  async deleteImage() {
    if (!this.imageData) return;

    if (confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      try {
        this.updating = true;
        const response = await this.mangoDiseaseService.deleteImage(this.imageData.id).toPromise();
        
        if (response && response.success) {
          this.location.back();
        }
      } catch (error) {
        console.error('Error deleting image:', error);
        this.error = 'Failed to delete image. Please try again.';
      } finally {
        this.updating = false;
      }
    }
  }

  navigateBack() {
    this.location.back();
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  getConfidenceBgColor(confidence: number): string {
    if (confidence >= 80) return 'bg-green-100';
    if (confidence >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  }

  getImageUrl(): string {
    if (!this.imageData) return '';
    
    // Use environment configuration for base URL
    const baseUrl = environment.apiUrl.replace('/api', '');
    const originalUrl = this.imageData.image_url || this.imageData.image;
    
    console.log('🔍 Image URL Debug:', {
      baseUrl,
      originalUrl,
      environment: environment.apiUrl,
      imageData: this.imageData
    });
    
    if (!originalUrl) {
      const fallbackUrl = `${baseUrl}/api/media/mango_images/${this.imageData.original_filename}`;
      console.log('🔗 Using fallback URL:', fallbackUrl);
      return fallbackUrl;
    }
    
    if (originalUrl.startsWith('http')) {
      console.log('✅ Already absolute URL:', originalUrl);
      return originalUrl;
    }
    
    // Use custom media endpoint
    let filePath = '';
    if (originalUrl.startsWith('/media/')) {
      filePath = originalUrl.substring(7);
    } else if (originalUrl.startsWith('media/')) {
      filePath = originalUrl.substring(6);
    } else if (originalUrl.includes('mango_images/')) {
      const mangoIndex = originalUrl.indexOf('mango_images/');
      filePath = originalUrl.substring(mangoIndex);
    } else {
      filePath = originalUrl.startsWith('/') ? originalUrl.substring(1) : originalUrl;
    }
    
    const finalUrl = `${baseUrl}/api/media/${filePath}`;
    console.log('🎯 Final image URL:', finalUrl);
    return finalUrl;
  }

  formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  getGPSQuality(accuracy: number): string {
    if (accuracy <= 10) return 'Excellent';
    if (accuracy <= 50) return 'Good';
    return 'Poor';
  }

  onImageError(event: any) {
    console.error('❌ Image failed to load:', event);
    console.error('❌ Failed URL:', this.getImageUrl());
    this.imageError = true;
  }

  onImageLoad(event: any) {
    console.log('✅ Image loaded successfully:', this.getImageUrl());
    this.imageError = false;
  }

  getDiseaseType(): 'leaf' | 'fruit' | 'unknown' {
    // Use the disease_type field from the API
    const image = this.imageData;
    if (!image) return 'unknown';
    
    console.log(`Image Detail - Image ${image.id}:`, {
      model_used: image.model_used,
      disease_type: image.disease_type,
      predicted_class: image.predicted_class
    });
    
    // Use the disease_type field from the backend API (most reliable)
    if (image.disease_type && image.disease_type !== 'unknown') {
      console.log(`Image Detail - Using disease_type: ${image.disease_type}`);
      return image.disease_type;
    }
    
    // Fallback to model_used if available
    if (image.model_used) {
      console.log(`Image Detail - Using model_used: ${image.model_used}`);
      return image.model_used;
    }
    
    console.log('Image Detail - No disease_type or model_used field, returning unknown');
    // If neither field is available, return unknown
    return 'unknown';
  }
}
