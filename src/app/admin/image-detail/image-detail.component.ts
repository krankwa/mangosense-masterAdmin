import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  predictionData: PredictionData | null = null;
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
      if (predictionResponse && predictionResponse.success) {
        this.predictionData = predictionResponse.data.prediction_data;
      }

      // Load user confirmation for this image
      try {
        const confirmationResponse = await this.mangoDiseaseService.getUserConfirmations().toPromise();
        console.log('🔍 Full confirmation response:', confirmationResponse);
        if (confirmationResponse && confirmationResponse.success) {
          // Find confirmation for this specific image
          console.log('🔍 Looking for image_id:', this.imageId);
          
          // Check if it's using 'results' or 'confirmations' structure
          const confirmations = confirmationResponse.data.results || [];
          console.log('🔍 Available confirmations:', confirmations);
          
          const confirmation = confirmations.find(
            (conf: UserConfirmation) => conf.image_id === this.imageId
          );
          console.log('🔍 Found confirmation:', confirmation);
          
          if (confirmation) {
            this.userConfirmation = confirmation;
            console.log('✅ User confirmation loaded:', this.userConfirmation);
          } else {
            console.log('❌ No confirmation found for image_id:', this.imageId);
          }
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
          this.router.navigate(['/admin/images']);
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
    this.router.navigate(['/admin/images']);
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

  formatDateTime(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  formatFileSize(sizeStr: string): string {
    if (!sizeStr || sizeStr === 'Unknown') return 'Unknown';
    return sizeStr;
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

  getDiseaseType(): string {
    // First try the imageData disease_type
    if (this.imageData?.disease_type) {
      return this.imageData.disease_type;
    }
    
    // If not available, try to get it from prediction data
    if (this.predictionData?.data?.primary_prediction?.detection_type) {
      const detectionType = this.predictionData.data.primary_prediction.detection_type.toLowerCase();
      if (detectionType.includes('leaf')) {
        return 'leaf';
      } else if (detectionType.includes('fruit')) {
        return 'fruit';
      }
    }
    
    // If still not available, try to infer from disease name
    if (this.imageData?.disease_classification || this.imageData?.predicted_class) {
      const diseaseName = (this.imageData.disease_classification || this.imageData.predicted_class).toLowerCase();
      
      // Leaf-related diseases
      if (diseaseName.includes('leaf') || 
          diseaseName.includes('blight') || 
          diseaseName.includes('spot') ||
          diseaseName.includes('mold') ||
          diseaseName.includes('mould') ||
          diseaseName.includes('mildew') ||
          diseaseName.includes('canker') ||
          diseaseName.includes('die back') ||
          diseaseName.includes('dieback') ||
          diseaseName.includes('gall midge') ||
          diseaseName.includes('cutting weevil') ||
          diseaseName.includes('alternaria')) {
        return 'leaf';
      } 
      // Fruit-related diseases
      else if (diseaseName.includes('fruit') || 
               diseaseName.includes('anthracnose') ||
               diseaseName.includes('rot') ||
               diseaseName.includes('stem end')) {
        return 'fruit';
      }
    }
    
    // Default fallback
    return 'mango';
  }
}
