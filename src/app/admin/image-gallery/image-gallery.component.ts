import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { DownloadService } from '../../services/download.service';
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
  selectedType: 'all' | 'leaf' | 'fruit' = 'all'; // Image type filter
  selectedVerification = '';
  searchTerm = '';
  
  // Selection for bulk operations
  selectedImages: number[] = [];
  
  // Available diseases for filter
  availableDiseases: string[] = [];

  // Debug and UI state properties
  showDebugInfo = false;
  bulkOperationInProgress = false;
  updatingVerificationId: number | null = null;
  deletingImageId: number | null = null;
  apiUrl = 'http://127.0.0.1:8000/api'; // Add API URL for debug

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private downloadService: DownloadService,
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
      
      // Build filters object for backend filtering
      const filters: any = {};
      if (this.selectedDisease) filters.disease_classification = this.selectedDisease;
      if (this.selectedVerification) filters.is_verified = this.selectedVerification;
      if (this.searchTerm) filters.search = this.searchTerm;
      // Note: We'll handle selectedType filtering on the client side for better performance
      
      const response = await this.mangoDiseaseService.getClassifiedImages(
        this.currentPage, 
        this.pageSize,
        filters
      ).toPromise();
      
      if (response) {
        this.images = response.images;
        this.totalImages = response.pagination.total_count;
        this.totalPages = response.pagination.total_pages;
        this.applyClientSideFilters();
        
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
    this.applyClientSideFilters();
  }

  applyClientSideFilters() {
    let filtered = [...this.images];

    // Filter by image type (leaf/fruit)
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(image => {
        const imageType = this.getDiseaseType(image);
        return imageType === this.selectedType;
      });
    }

    // Filter by search term
    if (this.searchTerm && this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(image => {
        const diseaseClass = image.disease_classification || image.predicted_class;
        const notes = image.notes || '';
        
        return diseaseClass.toLowerCase().includes(searchLower) ||
               notes.toLowerCase().includes(searchLower);
      });
    }

    this.filteredImages = filtered;
  }

  getFilteredImages(): MangoImage[] {
    return this.filteredImages;
  }

  onFilterChange() {
    this.currentPage = 1;
    // Always apply client-side filters after any filter change
    if (this.selectedDisease || this.selectedVerification) {
      // If backend filters changed, reload from server then apply client filters
      this.loadImages();
    } else {
      // If only client-side filters changed, just apply filtering
      this.applyClientSideFilters();
    }
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
    this.selectedImages = this.getFilteredImages().map(img => img.id);
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
      this.bulkOperationInProgress = true;
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
    } finally {
      this.bulkOperationInProgress = false;
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
      this.bulkOperationInProgress = true;
      for (const imageId of this.selectedImages) {
        await this.mangoDiseaseService.deleteImage(imageId).toPromise();
      }
      
      alert(`Successfully deleted ${this.selectedImages.length} images.`);
      this.clearSelection();
      this.loadImages();
    } catch (error) {
      console.error('Error bulk deleting images:', error);
      alert('Failed to delete images. Please try again.');
    } finally {
      this.bulkOperationInProgress = false;
    }
  }

  async toggleVerification(image: MangoImage) {
    try {
      this.updatingVerificationId = image.id;
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
    } finally {
      this.updatingVerificationId = null;
    }
  }

  // Add the missing updateImageVerification method
  async updateImageVerification(image: MangoImage, isVerified: boolean) {
    try {
      this.updatingVerificationId = image.id;
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
    } finally {
      this.updatingVerificationId = null;
    }
  }

  async deleteImage(imageId: number) {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }
    
    try {
      this.deletingImageId = imageId;
      await this.mangoDiseaseService.deleteImage(imageId).toPromise();
      alert('Image deleted successfully.');
      this.loadImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image.');
    } finally {
      this.deletingImageId = null;
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

  getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    // First priority: Use the model_used field from the backend API
    if (image.model_used) {
      return image.model_used;
    }
    
    // Second priority: Use the disease_type field from the backend
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    // Fallback: classify based on disease name when backend returns 'unknown'
    const disease = image.disease_classification || image.predicted_class;
    if (!disease) return 'unknown';
    
    const diseaseLower = disease.toLowerCase();
    
    // Comprehensive leaf disease patterns
    const leafDiseases = [
      'die back', 'dieback', 'die-back',
      'anthracnose', 'antracnose', 'anthracnosis',
      'powdery mildew', 'powderymildew', 'powder mildew',
      'bacterial canker', 'bacterial-canker', 'bacterialcanker',
      'bacterial leaf spot', 'bacterial-leaf-spot', 'bacterialleafspot',
      'leaf spot', 'leaf-spot', 'leafspot',
      'leaf blight', 'leaf-blight', 'leafblight',
      'sooty mold', 'sooty-mold', 'sootymold', 'sooty mould',
      'rust', 'leaf rust', 'leaf-rust',
      'yellowing', 'chlorosis',
      'necrosis', 'leaf necrosis',
      'wilt', 'wilting',
      'scab', 'leaf scab',
      'curl', 'leaf curl',
      'mosaic', 'leaf mosaic',
      'cutting weevil', 'cutting-weevil',
      'gall midge', 'gall-midge'
    ];
    
    const fruitDiseases = [
      'fruit fly', 'fruit-fly', 'fruitfly',
      'fruit rot', 'fruit-rot', 'fruitrot',
      'fruit spot', 'fruit-spot', 'fruitspot',
      'fruit borer', 'fruit-borer', 'fruitborer',
      'fruit canker', 'fruit-canker', 'fruitcanker',
      'black spot', 'black-spot', 'blackspot',
      'brown rot', 'brown-rot', 'brownrot',
      'stem end rot', 'stem-end-rot', 'stemendrot',
      'soft rot', 'soft-rot', 'softrot',
      'bitter pit', 'bitter-pit', 'bitterpit',
      'sunscald', 'sun scald', 'sun-scald',
      'cracking', 'fruit cracking', 'fruit-cracking',
      'splitting', 'fruit splitting',
      'discoloration', 'fruit discoloration',
      'black mold rot', 'black-mold-rot', 'blackmoldrot'
    ];
    
    // Check for leaf diseases
    for (const leafDisease of leafDiseases) {
      if (diseaseLower.includes(leafDisease)) {
        return 'leaf';
      }
    }
    
    // Check for fruit diseases
    for (const fruitDisease of fruitDiseases) {
      if (diseaseLower.includes(fruitDisease)) {
        return 'fruit';
      }
    }
    
    return 'unknown';
  }

  // Debug and utility methods
  toggleDebugInfo() {
    this.showDebugInfo = !this.showDebugInfo;
  }

  getFailedImagesCount(): number {
    return this.images.filter(img => img.hasError).length;
  }

  testBasicUrl() {
    console.log('Testing basic URL construction...');
    // Basic URL test implementation
  }

  testAllImages() {
    console.log('Testing all image URLs...');
    // Test all images implementation
  }

  enableStaticMode() {
    console.log('Enabling static mode...');
    // Static mode implementation
  }

  onTestImageLoad() {
    console.log('Test image loaded successfully');
  }

  onTestImageError(event: any) {
    console.error('Test image failed to load:', event);
  }

  onSearchInput() {
    this.onSearch();
  }

  clearSearch() {
    this.searchTerm = '';
    this.onSearch();
  }

  getImageUrl(image: MangoImage): string {
    const baseUrl = 'http://127.0.0.1:8000';
    const originalUrl = image.image_url || image.image;
    
    if (!originalUrl) {
      return `${baseUrl}/api/media/mango_images/${image.original_filename}`;
    }
    
    if (originalUrl.startsWith('http')) {
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
    
    return `${baseUrl}/api/media/${filePath}`;
  }

  onImageError(event: any, image: MangoImage) {
    console.error('Image failed to load:', image.original_filename, event);
    image.hasError = true;
  }

  onImageLoad(event: any, image: MangoImage) {
    console.log('Image loaded successfully:', image.original_filename);
    image.hasError = false;
  }

  retryImage(image: MangoImage) {
    console.log('Retrying image:', image.original_filename);
    image.hasError = false;
    // Force reload by updating src
  }

  testImageUrl(image: MangoImage) {
    const url = this.getImageUrl(image);
    console.log('Testing URL:', url);
    window.open(url, '_blank');
  }

  viewImageDetails(imageId: number) {
    this.router.navigate(['/admin/image-detail', imageId]);
  }

  // Download Methods
  
  /**
   * Download a single image
   */
  async downloadImage(image: MangoImage): Promise<void> {
    try {
      const filename = this.downloadService.getImageFilename(image);
      const imageUrl = this.getImageUrl(image);
      
      if (this.downloadService.isValidImageUrl(imageUrl)) {
        await this.downloadService.downloadImageWithFetch(imageUrl, filename);
        this.downloadService.showDownloadProgress(`Downloaded: ${filename}`);
      } else {
        console.error('Invalid image URL:', imageUrl);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  }

  /**
   * Download selected images as ZIP
   */
  downloadSelectedImages(): void {
    if (this.selectedImages.length === 0) {
      alert('Please select images to download');
      return;
    }

    this.bulkOperationInProgress = true;
    const zipFilename = this.downloadService.generateBulkFilename('selected_images');

    this.mangoDiseaseService.downloadImagesZip(this.selectedImages).subscribe({
      next: (blob) => {
        this.downloadService.handleBlobDownload(blob, zipFilename);
        this.downloadService.showDownloadProgress(`Downloaded ${this.selectedImages.length} images`);
        this.bulkOperationInProgress = false;
      },
      error: (error) => {
        console.error('Error downloading selected images:', error);
        this.bulkOperationInProgress = false;
        alert('Error downloading images. Please try again.');
      }
    });
  }

  /**
   * Download all filtered images
   */
  downloadAllFilteredImages(): void {
    const imageIds = this.filteredImages.map(img => img.id);
    
    if (imageIds.length === 0) {
      alert('No images to download');
      return;
    }

    if (imageIds.length > 100) {
      const confirmed = confirm(`You are about to download ${imageIds.length} images. This may take a while. Continue?`);
      if (!confirmed) return;
    }

    this.bulkOperationInProgress = true;
    const zipFilename = this.downloadService.generateBulkFilename('filtered_images');

    this.mangoDiseaseService.downloadImagesZip(imageIds).subscribe({
      next: (blob) => {
        this.downloadService.handleBlobDownload(blob, zipFilename);
        this.downloadService.showDownloadProgress(`Downloaded ${imageIds.length} images`);
        this.bulkOperationInProgress = false;
      },
      error: (error) => {
        console.error('Error downloading filtered images:', error);
        this.bulkOperationInProgress = false;
        alert('Error downloading images. Please try again.');
      }
    });
  }

  /**
   * Download images by disease type
   */
  downloadByDisease(diseaseType: string): void {
    this.bulkOperationInProgress = true;
    const filename = this.downloadService.generateBulkFilename(`${diseaseType}_images`);

    this.mangoDiseaseService.downloadImagesByDisease(diseaseType).subscribe({
      next: (blob) => {
        this.downloadService.handleBlobDownload(blob, filename);
        this.downloadService.showDownloadProgress(`Downloaded ${diseaseType} images`);
        this.bulkOperationInProgress = false;
      },
      error: (error) => {
        console.error('Error downloading disease images:', error);
        this.bulkOperationInProgress = false;
        alert('Error downloading disease images. Please try again.');
      }
    });
  }

  /**
   * Download verified or unverified images
   */
  downloadByVerification(isVerified: boolean): void {
    this.bulkOperationInProgress = true;
    const type = isVerified ? 'verified' : 'unverified';
    const filename = this.downloadService.generateBulkFilename(`${type}_images`);

    this.mangoDiseaseService.downloadImagesByVerification(isVerified).subscribe({
      next: (blob) => {
        this.downloadService.handleBlobDownload(blob, filename);
        this.downloadService.showDownloadProgress(`Downloaded ${type} images`);
        this.bulkOperationInProgress = false;
      },
      error: (error) => {
        console.error(`Error downloading ${type} images:`, error);
        this.bulkOperationInProgress = false;
        alert(`Error downloading ${type} images. Please try again.`);
      }
    });
  }
}