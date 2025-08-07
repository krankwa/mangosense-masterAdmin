import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { DownloadService } from '../../services/download.service';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface VerifiedDiseaseFolder {
  disease: string;
  count: number;
  images: MangoImage[];
  expanded: boolean;
  diseaseType: 'leaf' | 'fruit' | 'unknown';
  downloading: boolean;
}

@Component({
  selector: 'app-verified-images',
  templateUrl: './verified-images.component.html',
  styleUrls: ['./verified-images.component.css'],
  standalone: false
})
export class VerifiedImagesComponent implements OnInit {
  diseaseFolders: VerifiedDiseaseFolder[] = [];
  loading = true;
  error: string | null = null;
  totalVerifiedCount = 0;
  selectedImages: Set<number> = new Set();
  downloadingAll = false;
  
  // Filter options
  filterType: 'all' | 'leaf' | 'fruit' = 'all';
  searchTerm = '';
  sortBy: 'disease' | 'count' | 'date' = 'disease';
  dateRange: 'all' | 'week' | 'month' | 'year' = 'all';

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private downloadService: DownloadService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadVerifiedImages();
  }

  async loadVerifiedImages() {
    try {
      this.loading = true;
      this.error = null;

      // Fetch verified images
      const response = await this.mangoDiseaseService.getClassifiedImages(1, 1000, { 
        is_verified: true 
      }).toPromise();

      if (response && response.images) {
        this.totalVerifiedCount = response.images.length;
        this.groupImagesByDisease(response.images);
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading verified images:', error);
      this.error = 'Failed to load verified images. Please try again.';
      this.loading = false;
    }
  }

  groupImagesByDisease(images: MangoImage[]) {
    const diseaseMap = new Map<string, MangoImage[]>();

    // Filter by date range if specified
    let filteredImages = images;
    if (this.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (this.dateRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filteredImages = images.filter(img => 
        new Date(img.uploaded_at) >= cutoffDate
      );
    }

    filteredImages.forEach(image => {
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
      diseaseType: this.getDiseaseType(imgs[0]),
      downloading: false
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

  toggleFolder(folder: VerifiedDiseaseFolder) {
    folder.expanded = !folder.expanded;
  }

  getFilteredFolders(): VerifiedDiseaseFolder[] {
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

  // Download functionality
  async downloadFolderImages(folder: VerifiedDiseaseFolder) {
    try {
      folder.downloading = true;
      const zip = new JSZip();
      const diseaseFolder = zip.folder(folder.disease);

      if (!diseaseFolder) {
        throw new Error('Failed to create folder in ZIP');
      }

      // Download each image and add to ZIP
      for (const image of folder.images) {
        try {
          const imageUrl = this.getImageUrl(image);
          const response = await fetch(imageUrl);
          
          if (!response.ok) {
            console.warn(`Failed to download image: ${image.original_filename}`);
            continue;
          }

          const blob = await response.blob();
          const filename = image.original_filename || `image_${image.id}.jpg`;
          
          diseaseFolder.file(filename, blob);
        } catch (error) {
          console.error(`Error downloading image ${image.id}:`, error);
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `${folder.disease}_images_${timestamp}.zip`;
      
      saveAs(content, zipFilename);
      
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      this.error = 'Failed to download images. Please try again.';
    } finally {
      folder.downloading = false;
    }
  }

  async downloadAllVerifiedImages() {
    try {
      this.downloadingAll = true;
      const zip = new JSZip();

      // Create folders for each disease
      for (const folder of this.getFilteredFolders()) {
        const diseaseFolder = zip.folder(folder.disease);
        
        if (!diseaseFolder) continue;

        for (const image of folder.images) {
          try {
            const imageUrl = this.getImageUrl(image);
            const response = await fetch(imageUrl);
            
            if (!response.ok) continue;

            const blob = await response.blob();
            const filename = image.original_filename || `image_${image.id}.jpg`;
            
            diseaseFolder.file(filename, blob);
          } catch (error) {
            console.error(`Error downloading image ${image.id}:`, error);
          }
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `all_verified_images_${timestamp}.zip`;
      
      saveAs(content, zipFilename);
      
    } catch (error) {
      console.error('Error creating master ZIP file:', error);
      this.error = 'Failed to download all images. Please try again.';
    } finally {
      this.downloadingAll = false;
    }
  }

  async downloadSelectedImages() {
    if (this.selectedImages.size === 0) return;

    try {
      const zip = new JSZip();
      const selectedFolder = zip.folder('selected_images');

      if (!selectedFolder) {
        throw new Error('Failed to create folder in ZIP');
      }

      // Get selected images from all folders
      const allImages = this.diseaseFolders.flatMap(folder => folder.images);
      const selectedImageData = allImages.filter(img => this.selectedImages.has(img.id));

      for (const image of selectedImageData) {
        try {
          const imageUrl = this.getImageUrl(image);
          const response = await fetch(imageUrl);
          
          if (!response.ok) continue;

          const blob = await response.blob();
          const filename = image.original_filename || `image_${image.id}.jpg`;
          
          selectedFolder.file(filename, blob);
        } catch (error) {
          console.error(`Error downloading image ${image.id}:`, error);
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `selected_images_${timestamp}.zip`;
      
      saveAs(content, zipFilename);
      
    } catch (error) {
      console.error('Error creating selected images ZIP:', error);
      this.error = 'Failed to download selected images. Please try again.';
    }
  }

  toggleImageSelection(imageId: number) {
    if (this.selectedImages.has(imageId)) {
      this.selectedImages.delete(imageId);
    } else {
      this.selectedImages.add(imageId);
    }
  }

  selectAllInFolder(folder: VerifiedDiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.add(image.id);
    });
  }

  deselectAllInFolder(folder: VerifiedDiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.delete(image.id);
    });
  }

  selectAllImages() {
    this.getFilteredFolders().forEach(folder => {
      folder.images.forEach(image => {
        this.selectedImages.add(image.id);
      });
    });
  }

  deselectAllImages() {
    this.selectedImages.clear();
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

  getDownloadProgress(folder: VerifiedDiseaseFolder): string {
    return folder.downloading ? 'Preparing download...' : '';
  }

  onFilterChange() {
    this.groupImagesByDisease(
      this.diseaseFolders.flatMap(folder => folder.images)
    );
  }

  onSortChange() {
    this.sortFolders();
  }

  onDateRangeChange() {
    this.loadVerifiedImages();
  }

  // Individual image download using DownloadService
  async downloadImage(image: MangoImage) {
    try {
      const imageUrl = this.getImageUrl(image);
      await this.downloadService.downloadImageWithFetch(imageUrl, image.original_filename);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  }
}
