import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-image-gallery',
  templateUrl: './image-gallery.component.html',
  styleUrls: ['./image-gallery.component.css'],
  standalone: false
})
export class ImageGalleryComponent implements OnInit {
  images: MangoImage[] = [];
  filteredImages: MangoImage[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalImages = 0;
  totalPages = 0;
  
  // Filters
  selectedDisease = '';
  selectedDiseaseType = '';
  selectedType = ''; // Add this missing property
  selectedVerification = '';
  searchTerm = '';
  
  // Selection for bulk operations
  selectedImages: number[] = [];
  
  // Available diseases for filter
  availableDiseases: string[] = [];

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private route: ActivatedRoute,
    private router: Router // Add router injection
  ) {}

  ngOnInit() {
    // Check for query parameters
    this.route.queryParams.subscribe(params => {
      if (params['disease']) {
        this.selectedDisease = params['disease'];
      }
    });
    
    this.loadImages();
  }

  async loadImages() {
    try {
      this.loading = true;
      this.error = null;
      
      // Build filters object
      const filters: any = {};
      if (this.selectedDisease) filters.disease_classification = this.selectedDisease;
      if (this.selectedDiseaseType) filters.disease_type = this.selectedDiseaseType;
      if (this.selectedType) filters.disease_type = this.selectedType; // Handle selectedType
      if (this.selectedVerification) filters.is_verified = this.selectedVerification;
      if (this.searchTerm) filters.search = this.searchTerm;
      
      const response = await this.mangoDiseaseService.getClassifiedImages(
        this.currentPage, 
        this.pageSize,
        filters
      ).toPromise();
      
      if (response) {
        this.images = response.images;
        this.totalImages = response.pagination.total_count;
        this.totalPages = response.pagination.total_pages;
        this.filteredImages = [...this.images];
        
        // Extract unique diseases for filter dropdown
        this.availableDiseases = [...new Set(this.images.map(img => img.disease_classification || img.predicted_class))];
      }
      
      this.loading = false;
    } catch (error) {
      console.error('Error loading images:', error);
      this.error = 'Failed to load images. Please try again.';
      this.loading = false;
    }
  }

  onSearch() {
    if (!this.searchTerm.trim()) {
      this.filteredImages = [...this.images];
      return;
    }
    
    const searchLower = this.searchTerm.toLowerCase();
    this.filteredImages = this.images.filter(image => {
      const diseaseClass = image.disease_classification || image.predicted_class;
      const notes = image.notes || '';
      
      return diseaseClass.toLowerCase().includes(searchLower) ||
             notes.toLowerCase().includes(searchLower);
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadImages();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadImages();
  }

  toggleImageSelection(imageId: number) {
    const index = this.selectedImages.indexOf(imageId);
    if (index > -1) {
      this.selectedImages.splice(index, 1);
    } else {
      this.selectedImages.push(imageId);
    }
  }

  // Add missing methods for template
  selectAll() {
    this.selectedImages = this.filteredImages.map(img => img.id);
  }

  selectAllImages() {
    this.selectAll();
  }

  deselectAll() {
    this.selectedImages = [];
  }

  clearSelection() {
    this.selectedImages = [];
  }

  // Add navigation method
  navigateToDashboard() {
    this.router.navigate(['/admin/dashboard']);
  }

  // Add pagination helper methods
  getTotalPages(): number {
    return this.totalPages;
  }

  canGoPrevious(): boolean {
    return this.currentPage > 1;
  }

  canGoNext(): boolean {
    return this.currentPage < this.totalPages;
  }

  // Add method to check if image is selected
  isImageSelected(imageId: number): boolean {
    return this.selectedImages.includes(imageId);
  }

  // Add method to get selected count
  getSelectedCount(): number {
    return this.selectedImages.length;
  }

  async bulkVerify() {
    if (this.selectedImages.length === 0) {
      alert('Please select images to verify.');
      return;
    }
    
    try {
      await this.mangoDiseaseService.bulkUpdateImages(
        this.selectedImages,
        { is_verified: true }
      ).toPromise();
      
      alert(`Successfully verified ${this.selectedImages.length} images.`);
      this.clearSelection();
      this.loadImages();
    } catch (error) {
      console.error('Error bulk verifying images:', error);
      alert('Failed to verify images. Please try again.');
    }
  }

  async bulkDelete() {
    if (this.selectedImages.length === 0) {
      alert('Please select images to delete.');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${this.selectedImages.length} images?`)) {
      return;
    }
    
    try {
      for (const imageId of this.selectedImages) {
        await this.mangoDiseaseService.deleteImage(imageId).toPromise();
      }
      
      alert(`Successfully deleted ${this.selectedImages.length} images.`);
      this.clearSelection();
      this.loadImages();
    } catch (error) {
      console.error('Error bulk deleting images:', error);
      alert('Failed to delete images. Please try again.');
    }
  }

  async toggleVerification(image: MangoImage) {
    try {
      const isVerified = !image.is_verified;
      await this.mangoDiseaseService.updateImageVerification(
        image.id,
        isVerified,
        image.notes || ''
      ).toPromise();
      
      image.is_verified = isVerified;
      alert(`Image ${isVerified ? 'verified' : 'unverified'} successfully.`);
    } catch (error) {
      console.error('Error updating verification:', error);
      alert('Failed to update verification status.');
    }
  }

  // Add the missing updateImageVerification method
  async updateImageVerification(image: MangoImage, isVerified: boolean) {
    try {
      await this.mangoDiseaseService.updateImageVerification(
        image.id,
        isVerified,
        image.notes || ''
      ).toPromise();
      
      image.is_verified = isVerified;
      alert(`Image ${isVerified ? 'verified' : 'unverified'} successfully.`);
    } catch (error) {
      console.error('Error updating verification:', error);
      alert('Failed to update verification status.');
    }
  }

  async deleteImage(imageId: number) {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }
    
    try {
      await this.mangoDiseaseService.deleteImage(imageId).toPromise();
      alert('Image deleted successfully.');
      this.loadImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image.');
    }
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  }

  getConfidenceText(confidence: number): string {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  }
}