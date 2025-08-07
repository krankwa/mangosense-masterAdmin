import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { DownloadService } from '../../services/download.service';

interface DiseaseFolder {
  disease: string;
  count: number;
  images: MangoImage[];
  expanded: boolean;
  diseaseType: 'leaf' | 'fruit' | 'unknown';
}

@Component({
  selector: 'app-unverified-images',
  templateUrl: './unverified-images.component.html',
  styleUrls: ['./unverified-images.component.css'],
  standalone: false
})
export class UnverifiedImagesComponent implements OnInit {
  diseaseFolders: DiseaseFolder[] = [];
  loading = true;
  error: string | null = null;
  totalUnverifiedCount = 0;
  selectedImages: Set<number> = new Set();
  
  // Filter options
  filterType: 'all' | 'leaf' | 'fruit' = 'all';
  searchTerm = '';
  sortBy: 'disease' | 'count' | 'date' = 'disease';

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private downloadService: DownloadService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUnverifiedImages();
  }

  async loadUnverifiedImages() {
    try {
      this.loading = true;
      this.error = null;

      // Fetch unverified images
      const response = await this.mangoDiseaseService.getClassifiedImages(1, 1000, { 
        is_verified: false 
      }).toPromise();

      if (response && response.images) {
        this.totalUnverifiedCount = response.images.length;
        this.groupImagesByDisease(response.images);
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading unverified images:', error);
      this.error = 'Failed to load unverified images. Please try again.';
      this.loading = false;
    }
  }

  groupImagesByDisease(images: MangoImage[]) {
    const diseaseMap = new Map<string, MangoImage[]>();

    images.forEach(image => {
      const disease = image.predicted_class || 'Unknown';
      if (!diseaseMap.has(disease)) {
        diseaseMap.set(disease, []);
      }
      diseaseMap.get(disease)!.push(image);
    });

    this.diseaseFolders = Array.from(diseaseMap.entries()).map(([disease, imgs]) => ({
      disease,
      count: imgs.length,
      images: imgs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()),
      expanded: false,
      diseaseType: this.getDiseaseType(imgs[0])
    }));

    this.sortFolders();
  }

  sortFolders() {
    this.diseaseFolders.sort((a, b) => {
      switch (this.sortBy) {
        case 'count':
          return b.count - a.count;
        case 'disease':
          return a.disease.localeCompare(b.disease);
        case 'date':
          const latestA = Math.max(...a.images.map(img => new Date(img.uploaded_at).getTime()));
          const latestB = Math.max(...b.images.map(img => new Date(img.uploaded_at).getTime()));
          return latestB - latestA;
        default:
          return 0;
      }
    });
  }

  toggleFolder(folder: DiseaseFolder) {
    folder.expanded = !folder.expanded;
  }

  getFilteredFolders(): DiseaseFolder[] {
    let filtered = this.diseaseFolders;

    // Filter by type
    if (this.filterType !== 'all') {
      filtered = filtered.filter(folder => folder.diseaseType === this.filterType);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(folder => 
        folder.disease.toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  toggleImageSelection(imageId: number) {
    if (this.selectedImages.has(imageId)) {
      this.selectedImages.delete(imageId);
    } else {
      this.selectedImages.add(imageId);
    }
  }

  selectAllInFolder(folder: DiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.add(image.id);
    });
  }

  deselectAllInFolder(folder: DiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.delete(image.id);
    });
  }

  async bulkVerifySelected() {
    if (this.selectedImages.size === 0) return;

    if (confirm(`Are you sure you want to verify ${this.selectedImages.size} selected images?`)) {
      try {
        const imageIds = Array.from(this.selectedImages);
        await this.mangoDiseaseService.bulkUpdateImages(imageIds, { is_verified: true }).toPromise();
        
        this.selectedImages.clear();
        this.loadUnverifiedImages(); // Reload the data
      } catch (error) {
        console.error('Error bulk verifying images:', error);
        this.error = 'Failed to verify selected images. Please try again.';
      }
    }
  }

  async bulkDeleteSelected() {
    if (this.selectedImages.size === 0) return;

    if (confirm(`Are you sure you want to delete ${this.selectedImages.size} selected images? This action cannot be undone.`)) {
      try {
        const deletePromises = Array.from(this.selectedImages).map(id => 
          this.mangoDiseaseService.deleteImage(id).toPromise()
        );
        await Promise.all(deletePromises);
        
        this.selectedImages.clear();
        this.loadUnverifiedImages(); // Reload the data
      } catch (error) {
        console.error('Error bulk deleting images:', error);
        this.error = 'Failed to delete selected images. Please try again.';
      }
    }
  }

  viewImageDetails(imageId: number) {
    this.router.navigate(['/admin/image-detail', imageId]);
  }

  getImageUrl(image: MangoImage): string {
    const baseUrl = 'http://127.0.0.1:8000'; // Use environment config
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

  getDiseaseTypeIcon(diseaseType: 'leaf' | 'fruit' | 'unknown' | undefined): string {
    if (!diseaseType || diseaseType === 'unknown') return '🥭'; // Default icon for mango/unknown
    return diseaseType === 'leaf' ? '🍃' : '🥭';
  }

  getDiseaseTypeClass(diseaseType: 'leaf' | 'fruit' | 'unknown' | undefined): string {
    if (!diseaseType || diseaseType === 'unknown') return 'text-orange-600'; // Default color for mango/unknown
    return diseaseType === 'leaf' ? 'text-green-600' : 'text-orange-600';
  }

  // Get disease type - trust the model's output
  getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    // First priority: Use the model_used field from the backend API
    if (image.model_used) {
      return image.model_used;
    }
    
    // Second priority: Trust the model's classification from the API
    if (image?.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    // Enhanced fallback classification with more comprehensive disease mapping
    if (image?.disease_classification || image?.predicted_class) {
      const diseaseName = (image.disease_classification || image.predicted_class).toLowerCase();
      
      // Leaf diseases (typically affect leaves, shoots, branches)
      const leafDiseases = [
        'anthracnose', 'powdery mildew', 'sooty mould', 'die back', 
        'bacterial canker', 'gall midge', 'cutting weevil', 'alternaria',
        'leaf spot', 'blight', 'leaf', 'mildew', 'canker', 'wilt'
      ];
      
      // Fruit diseases (typically affect fruits during ripening/storage)
      const fruitDiseases = [
        'black mould rot', 'stem end rot', 'fruit rot', 'fruit',
        'rot', 'mold', 'mould', 'decay'
      ];
      
      // Check for leaf disease patterns
      for (const leafPattern of leafDiseases) {
        if (diseaseName.includes(leafPattern)) {
          return 'leaf';
        }
      }
      
      // Check for fruit disease patterns
      for (const fruitPattern of fruitDiseases) {
        if (diseaseName.includes(fruitPattern)) {
          return 'fruit';
        }
      }

      // Special handling for "Healthy" - default to leaf
      if (diseaseName.includes('healthy')) {
        return 'leaf';
      }
    }
    
    // Default fallback
    return 'unknown';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  onFilterChange() {
    // Trigger re-filtering when filters change
  }

  onSortChange() {
    this.sortFolders();
  }

  // Download methods
  async downloadImage(image: MangoImage) {
    try {
      const imageUrl = this.getImageUrl(image);
      await this.downloadService.downloadImageWithFetch(imageUrl, image.original_filename);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  }

  async downloadFolderImages(folder: DiseaseFolder) {
    try {
      if (folder.images.length === 0) {
        alert('No images found in this folder.');
        return;
      }

      const diseaseFilename = folder.disease.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${diseaseFilename}_unverified_images.zip`;
      
      // Use the mango disease service method
      const blob = await this.downloadService.downloadImagesByDisease(folder.disease, diseaseFilename).toPromise();
      if (blob) {
        await this.downloadService.handleBlobDownload(blob, filename);
      }
    } catch (error) {
      console.error('Error downloading folder images:', error);
      alert('Failed to download folder images. Please try again.');
    }
  }

  async downloadAllUnverifiedImages() {
    try {
      const totalImages = this.diseaseFolders.reduce((total, folder) => total + folder.count, 0);
      if (totalImages === 0) {
        alert('No unverified images found to download.');
        return;
      }

      const confirmed = confirm(`This will download ${totalImages} unverified images. Continue?`);
      if (!confirmed) return;

      const blob = await this.downloadService.downloadImagesByVerification(false).toPromise();
      if (blob) {
        await this.downloadService.handleBlobDownload(blob, 'all_unverified_images.zip');
      }
    } catch (error) {
      console.error('Error downloading all unverified images:', error);
      alert('Failed to download images. Please try again.');
    }
  }

  async downloadSelectedImages() {
    try {
      if (this.selectedImages.size === 0) {
        alert('No images selected.');
        return;
      }

      const selectedImageArray = Array.from(this.selectedImages);
      await this.downloadService.downloadImagesAsZip(selectedImageArray, 'selected_unverified_images.zip');
    } catch (error) {
      console.error('Error downloading selected images:', error);
      alert('Failed to download selected images. Please try again.');
    }
  }
}
