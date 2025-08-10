import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';

@Component({
  selector: 'app-unverified-diseases',
  templateUrl: './unverified-diseases.component.html',
  styleUrls: ['./unverified-diseases.component.css'],
  standalone: false
})
export class UnverifiedDiseasesComponent implements OnInit {
  images: MangoImage[] = [];
  loading = true;
  error: string | null = null;
  availableDiseases: string[] = [];
  selectedDisease = 'all';

  constructor(
    private mangoDiseaseService: MangoDiseaseService
  ) {}

  ngOnInit() {
    this.loadImages();
  }

  async loadImages() {
    try {
      this.loading = true;
      this.error = null;

      const params: any = {
        verified: false
      };

      if (this.selectedDisease !== 'all') {
        params.disease = this.selectedDisease;
      }

      const response = await this.mangoDiseaseService.getImages(params).toPromise();

      if (response?.success) {
        this.images = response.data;
        
        // Extract available diseases
        this.availableDiseases = [...new Set(this.images.map((img: MangoImage) => img.predicted_class).filter(Boolean))].sort() as string[];
      }
    } catch (error) {
      console.error('Error loading images:', error);
      this.error = 'Failed to load unverified diseases. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async verifyImage(image: MangoImage) {
    try {
      this.mangoDiseaseService.verifyImage(image.id).subscribe({
        next: (response: any) => {
          if (response.success) {
            // Remove image from unverified list
            this.images = this.images.filter(img => img.id !== image.id);
          }
        },
        error: (error: any) => {
          console.error('Error verifying image:', error);
          this.error = 'Failed to verify image. Please try again.';
        }
      });
    } catch (error) {
      console.error('Error verifying image:', error);
      this.error = 'Failed to verify image. Please try again.';
    }
  }

  onFilterChange() {
    this.loadImages();
  }
}
