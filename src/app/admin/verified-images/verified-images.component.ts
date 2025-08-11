import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { DownloadService } from '../../services/download.service';
import { AuthService } from '../../services/auth.service';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface VerifiedDiseaseFolder {
  disease: string;
  count: number;
  images: MangoImage[];
  expanded: boolean;
  diseaseType: 'leaf' | 'fruit' | 'unknown';
  downloading: boolean;
  verificationStatus?: 'all' | 'verified' | 'unverified';
}

interface MainFolder {
  name: string;
  count: number;
  expanded: boolean;
  subFolders: VerifiedDiseaseFolder[];
  originalSubFolders: VerifiedDiseaseFolder[]; // Store original unfiltered data
  type: 'all' | 'verified' | 'unverified';
}

@Component({
  selector: 'app-verified-images',
  templateUrl: './verified-images.component.html',
  styleUrls: ['./verified-images.component.css'],
  standalone: false
})
export class VerifiedImagesComponent implements OnInit {
  mainFolders: MainFolder[] = [];
  diseaseFolders: VerifiedDiseaseFolder[] = [];
  loading = true;
  error: string | null = null;
  totalVerifiedCount = 0;
  totalUnverifiedCount = 0;
  totalAllCount = 0;
  selectedImages: Set<number> = new Set();
  downloadingAll = false;
  updatingSelected = false;
  
  // Filter options
  filterType: 'all' | 'leaf' | 'fruit' = 'all';
  searchTerm = '';
  sortBy: 'disease' | 'count' | 'date' = 'disease';
  dateRange: 'all' | 'week' | 'month' | 'year' = 'all';

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private downloadService: DownloadService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadAllImages();
  }

  async loadAllImages() {
    try {
      this.loading = true;
      this.error = null;

      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      // Fetch all images (both verified and unverified) with a larger page size
      const response = await this.mangoDiseaseService.getClassifiedImages(1, 5000, { 
        _t: timestamp
      }).toPromise();

      if (response && response.images) {
        console.log('API Response - First few images:', response.images.slice(0, 3).map(img => ({
          id: img.id,
          predicted_class: img.predicted_class,
          model_used: img.model_used,
          disease_type: img.disease_type
        })));
        
        this.totalAllCount = response.images.length;
        
        // Separate verified and unverified images
        const verifiedImages = response.images.filter(img => img.is_verified);
        const unverifiedImages = response.images.filter(img => !img.is_verified);
        
        this.totalVerifiedCount = verifiedImages.length;
        this.totalUnverifiedCount = unverifiedImages.length;
        
        // Create main folder structure
        this.createMainFolders(response.images, verifiedImages, unverifiedImages);
        
        // Force change detection to update UI
        this.cdr.detectChanges();
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading images:', error);
      
      // Only redirect to login on authentication errors
      if (error && (error as any).status === 401) {
        this.authService.logout(); // Clear stored tokens
        this.router.navigate(['/login']);
        return;
      }
      
      this.error = 'Failed to load images. Please try again.';
      this.loading = false;
    }
  }

  createMainFolders(allImages: MangoImage[], verifiedImages: MangoImage[], unverifiedImages: MangoImage[]) {
    const allSubFolders = this.groupImagesByDisease(allImages, 'all');
    const verifiedSubFolders = this.groupImagesByDisease(verifiedImages, 'verified');
    const unverifiedSubFolders = this.groupImagesByDisease(unverifiedImages, 'unverified');
    
    this.mainFolders = [
      {
        name: 'All Images',
        count: allImages.length,
        expanded: false,
        type: 'all',
        subFolders: [...allSubFolders], // Copy for filtering
        originalSubFolders: allSubFolders // Original data
      },
      {
        name: 'Verified Images',
        count: verifiedImages.length,
        expanded: false,
        type: 'verified',
        subFolders: [...verifiedSubFolders], // Copy for filtering
        originalSubFolders: verifiedSubFolders // Original data
      },
      {
        name: 'Unverified Images',
        count: unverifiedImages.length,
        expanded: false,
        type: 'unverified',
        subFolders: [...unverifiedSubFolders], // Copy for filtering
        originalSubFolders: unverifiedSubFolders // Original data
      }
    ];
    
    // For backward compatibility, also populate the old diseaseFolders array with all images
    this.diseaseFolders = this.mainFolders[0].subFolders;
  }

  groupImagesByDisease(images: MangoImage[], verificationStatus: 'all' | 'verified' | 'unverified'): VerifiedDiseaseFolder[] {
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
      const diseaseType = this.getDiseaseType(image);
      
      // Create a unique key that combines disease name and type
      const folderKey = `${disease}_${diseaseType}`;
      
      if (!diseaseMap.has(folderKey)) {
        diseaseMap.set(folderKey, []);
      }
      diseaseMap.get(folderKey)!.push(image);
    });

    const folders = Array.from(diseaseMap.entries()).map(([folderKey, imgs]) => {
      const disease = imgs[0].predicted_class || 'Unknown';
      const diseaseType = this.getDiseaseType(imgs[0]);
      
      // Create display name with type suffix for clarity
      const displayName = diseaseType !== 'unknown' ? 
        `${disease} (${diseaseType.charAt(0).toUpperCase() + diseaseType.slice(1)})` : 
        disease;
      
      return {
        disease: displayName,
        count: imgs.length,
        images: imgs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()),
        expanded: false,
        diseaseType: diseaseType,
        downloading: false,
        verificationStatus
      };
    });

    // Sort folders
    folders.sort((a, b) => {
      switch (this.sortBy) {
        case 'count':
          return b.count - a.count;
        case 'disease':
          return a.disease.localeCompare(b.disease);
        case 'date':
          return new Date(b.images[0]?.uploaded_at || '').getTime() - 
                 new Date(a.images[0]?.uploaded_at || '').getTime();
        default:
          return 0;
      }
    });

    return folders;
  }

  sortFolders() {
    // Update all main folders
    this.mainFolders.forEach(mainFolder => {
      mainFolder.subFolders.sort((a, b) => {
        switch (this.sortBy) {
          case 'count':
            return b.count - a.count;
          case 'disease':
            return a.disease.localeCompare(b.disease);
          case 'date':
            return new Date(b.images[0]?.uploaded_at || '').getTime() - 
                   new Date(a.images[0]?.uploaded_at || '').getTime();
          default:
            return 0;
        }
      });
    });
    
    // Update the main diseaseFolders array for backward compatibility
    if (this.mainFolders.length > 0) {
      this.diseaseFolders = this.mainFolders[0].subFolders;
    }
  }

  toggleFolder(folder: VerifiedDiseaseFolder) {
    folder.expanded = !folder.expanded;
  }

  toggleMainFolder(mainFolder: MainFolder) {
    mainFolder.expanded = !mainFolder.expanded;
    this.cdr.detectChanges();
  }

  selectAllInFolder(folder: VerifiedDiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.add(image.id);
    });
  }

  async verifySelectedImages() {
    if (this.selectedImages.size === 0) {
      alert('No images selected');
      return;
    }

    const confirmation = confirm(`Are you sure you want to verify ${this.selectedImages.size} selected images?`);
    if (!confirmation) {
      return;
    }

    try {
      this.updatingSelected = true;
      const imageIds = Array.from(this.selectedImages);
      
      // Update each image individually using the existing updateImageVerification method
      let successCount = 0;
      let errorCount = 0;
      
      for (const imageId of imageIds) {
        try {
          const response = await this.mangoDiseaseService.updateImageVerification(imageId, true).toPromise();
          
          if (response && response.success) {
            successCount++;
          } else {
            console.error(`Failed to verify image ${imageId}:`, response);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error verifying image ${imageId}:`, error);
          errorCount++;
        }
      }

      // Clear selection and reload data
      this.selectedImages.clear();
      
      // Wait a moment for the backend to process the changes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force a complete reload of the data
      await this.loadAllImages();
      
      if (errorCount === 0) {
        alert(`Successfully verified ${successCount} images`);
      } else {
        alert(`Verified ${successCount} images. Failed to verify ${errorCount} images.`);
      }
    } catch (error) {
      console.error('Error verifying images:', error);
      alert('Failed to verify images. Please try again.');
    } finally {
      this.updatingSelected = false;
    }
  }

  async unverifySelectedImages() {
    if (this.selectedImages.size === 0) {
      alert('No images selected');
      return;
    }

    const confirmation = confirm(`Are you sure you want to unverify ${this.selectedImages.size} selected images?`);
    if (!confirmation) {
      return;
    }

    try {
      this.updatingSelected = true;
      const imageIds = Array.from(this.selectedImages);
      
      // Update each image individually using the existing updateImageVerification method
      let successCount = 0;
      let errorCount = 0;
      
      for (const imageId of imageIds) {
        try {
          const response = await this.mangoDiseaseService.updateImageVerification(imageId, false).toPromise();
          
          if (response && response.success) {
            successCount++;
          } else {
            console.error(`Failed to unverify image ${imageId}:`, response);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error unverifying image ${imageId}:`, error);
          errorCount++;
        }
      }

      // Clear selection and reload data
      this.selectedImages.clear();
      
      // Wait a moment for the backend to process the changes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force a complete reload of the data
      await this.loadAllImages();
      
      if (errorCount === 0) {
        alert(`Successfully unverified ${successCount} images`);
      } else {
        alert(`Unverified ${successCount} images. Failed to unverify ${errorCount} images.`);
      }
    } catch (error) {
      console.error('Error unverifying images:', error);
      alert('Failed to unverify images. Please try again.');
    } finally {
      this.updatingSelected = false;
    }
  }

  async deleteSelectedImages() {
    if (this.selectedImages.size === 0) {
      alert('No images selected');
      return;
    }

    const confirmation = confirm(`Are you sure you want to delete ${this.selectedImages.size} selected images? This action cannot be undone.`);
    if (!confirmation) {
      return;
    }

    try {
      this.updatingSelected = true;
      const imageIds = Array.from(this.selectedImages);
      
      // Delete each image individually
      let successCount = 0;
      let errorCount = 0;
      
      for (const imageId of imageIds) {
        try {
          const response = await this.mangoDiseaseService.deleteImage(imageId).toPromise();
          
          if (response && response.success) {
            successCount++;
          } else {
            console.error(`Failed to delete image ${imageId}:`, response);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error deleting image ${imageId}:`, error);
          errorCount++;
        }
      }

      // Clear selection and reload data
      this.selectedImages.clear();
      
      // Wait a moment for the backend to process the changes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force a complete reload of the data
      await this.loadAllImages();
      
      if (errorCount === 0) {
        alert(`Successfully deleted ${successCount} images`);
      } else {
        alert(`Deleted ${successCount} images. Failed to delete ${errorCount} images.`);
      }
    } catch (error) {
      console.error('Error deleting images:', error);
      alert('Failed to delete images. Please try again.');
    } finally {
      this.updatingSelected = false;
    }
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

  getFilteredMainFolders(): MainFolder[] {
    if (!this.mainFolders || this.mainFolders.length === 0) {
      return [];
    }
    
    // Update the subFolders based on original data and current filters
    this.mainFolders.forEach(mainFolder => {
      // Start with original unfiltered data
      const filteredSubFolders = this.filterSubFolders(mainFolder.originalSubFolders);
      const totalImages = filteredSubFolders.reduce((sum, folder) => sum + folder.count, 0);
      
      // Update the display data while preserving expanded state
      mainFolder.count = totalImages;
      mainFolder.subFolders = filteredSubFolders;
    });
    
    return this.mainFolders;
  }

  filterSubFolders(subFolders: VerifiedDiseaseFolder[]): VerifiedDiseaseFolder[] {
    let filtered = subFolders;

    // Filter by type (leaf/fruit)
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

    // Apply date filtering if needed
    if (this.dateRange !== 'all') {
      // This would require adding timestamp to images, for now we'll skip
      // filtered = this.applyDateFilter(filtered);
    }

    // Apply sorting
    return this.applySorting(filtered);
  }

  applySorting(folders: VerifiedDiseaseFolder[]): VerifiedDiseaseFolder[] {
    const sorted = [...folders];

    switch (this.sortBy) {
      case 'disease':
        return sorted.sort((a, b) => a.disease.localeCompare(b.disease));
      case 'count':
        return sorted.sort((a, b) => b.count - a.count);
      case 'date':
        // For now, sort by disease name as we don't have timestamps
        return sorted.sort((a, b) => a.disease.localeCompare(b.disease));
      default:
        return sorted;
    }
  }

  hasActiveFilters(): boolean {
    return this.filterType !== 'all' || 
           this.searchTerm.trim() !== '' || 
           this.dateRange !== 'all';
  }

  clearAllFilters(): void {
    this.filterType = 'all';
    this.searchTerm = '';
    this.dateRange = 'all';
    this.sortBy = 'disease';
    
    // Force update of filtered data
    this.getFilteredMainFolders();
    this.cdr.detectChanges();
  }

  getFilteredTotals() {
    const filteredFolders = this.getFilteredMainFolders();
    
    const allImagesFolder = filteredFolders.find(f => f.type === 'all');
    const verifiedFolder = filteredFolders.find(f => f.type === 'verified');
    const unverifiedFolder = filteredFolders.find(f => f.type === 'unverified');

    return {
      total: allImagesFolder?.count || 0,
      verified: verifiedFolder?.count || 0,
      unverified: unverifiedFolder?.count || 0,
      isFiltered: this.hasActiveFilters()
    };
  }

  // Download functionality
  async downloadFolderImages(folder: VerifiedDiseaseFolder) {
    try {
      folder.downloading = true;
      
      // Check if there are unverified images in this folder
      const unverifiedImages = folder.images.filter(img => !img.is_verified);
      
      if (unverifiedImages.length > 0) {
        const confirmDownload = confirm(
          `This folder contains ${unverifiedImages.length} unverified image(s). ` +
          `These will be downloaded with "unverified" appended to their filenames. ` +
          `Do you want to continue?`
        );
        
        if (!confirmDownload) {
          folder.downloading = false;
          return; // User cancelled the download
        }
      }
      
      const zip = new JSZip();
      const diseaseType = folder.diseaseType;
      const folderName = `${folder.disease} (${diseaseType})`;
      const diseaseFolder = zip.folder(folderName);

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
          let filename = image.original_filename || `image_${image.id}.jpg`;
          
          // Append "unverified" to filename if image is not verified
          if (!image.is_verified) {
            const fileExtension = filename.substring(filename.lastIndexOf('.'));
            const baseName = filename.substring(0, filename.lastIndexOf('.'));
            filename = `${baseName}_unverified${fileExtension}`;
          }
          
          diseaseFolder.file(filename, blob);
        } catch (error) {
          console.error(`Error downloading image ${image.id}:`, error);
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `${folder.disease}_${diseaseType}_images_${timestamp}.zip`;
      
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

      // Get unique images from currently visible main folders to avoid duplicates
      const uniqueImagesMap = new Map<number, MangoImage>();
      this.getFilteredMainFolders().forEach(mainFolder => {
        mainFolder.subFolders.forEach(subFolder => {
          subFolder.images.forEach(image => {
            uniqueImagesMap.set(image.id, image);
          });
        });
      });

      const allImages = Array.from(uniqueImagesMap.values());
      console.log(`Processing ${allImages.length} unique images for download all`);

      // Check if there are unverified images
      const unverifiedImages = allImages.filter(img => !img.is_verified);
      
      if (unverifiedImages.length > 0) {
        const confirmDownload = confirm(
          `Your download includes ${unverifiedImages.length} unverified image(s). ` +
          `These will be downloaded with "unverified" appended to their filenames. ` +
          `Do you want to continue?`
        );
        
        if (!confirmDownload) {
          this.downloadingAll = false;
          return; // User cancelled the download
        }
      }

      // Group images by disease for folder structure
      const diseaseMap = new Map<string, MangoImage[]>();
      allImages.forEach(image => {
        const disease = image.predicted_class || 'Unknown';
        const diseaseType = this.getDiseaseType(image);
        const folderName = `${disease} (${diseaseType})`;
        
        if (!diseaseMap.has(folderName)) {
          diseaseMap.set(folderName, []);
        }
        diseaseMap.get(folderName)!.push(image);
      });

      console.log(`Grouped into ${diseaseMap.size} disease folders:`, Array.from(diseaseMap.keys()));

      // Create folders for each disease with type
      for (const [folderName, images] of diseaseMap.entries()) {
        const diseaseFolder = zip.folder(folderName);
        
        if (!diseaseFolder) {
          console.error(`Failed to create folder for disease: ${folderName}`);
          continue;
        }

        console.log(`Processing ${images.length} images for disease: ${folderName}`);

        for (const image of images) {
          try {
            const imageUrl = this.getImageUrl(image);
            const response = await fetch(imageUrl);
            
            if (!response.ok) {
              console.warn(`Failed to download image ${image.id}: ${response.statusText}`);
              continue;
            }

            const blob = await response.blob();
            let filename = image.original_filename || `image_${image.id}.jpg`;
            
            // Append "unverified" to filename if image is not verified
            if (!image.is_verified) {
              const fileExtension = filename.substring(filename.lastIndexOf('.'));
              const baseName = filename.substring(0, filename.lastIndexOf('.'));
              filename = `${baseName}_unverified${fileExtension}`;
            }
            
            diseaseFolder.file(filename, blob);
          } catch (error) {
            console.error(`Error downloading image ${image.id}:`, error);
          }
        }
      }

      // Generate and download ZIP
      console.log('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `all_images_${timestamp}.zip`;
      
      console.log(`Saving ZIP file: ${zipFilename} (${content.size} bytes)`);
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

      // Get unique images from selected IDs to avoid duplicates
      // Use a Map to ensure uniqueness by image ID
      const uniqueImagesMap = new Map<number, MangoImage>();
      
      this.mainFolders.forEach(mainFolder => {
        mainFolder.subFolders.forEach(subFolder => {
          subFolder.images.forEach(image => {
            if (this.selectedImages.has(image.id)) {
              uniqueImagesMap.set(image.id, image);
            }
          });
        });
      });

      const selectedImageData = Array.from(uniqueImagesMap.values());
      
      console.log(`Processing ${selectedImageData.length} unique selected images`);
      
      // Check if there are unverified images in the selection
      const unverifiedImages = selectedImageData.filter(img => !img.is_verified);
      
      if (unverifiedImages.length > 0) {
        const confirmDownload = confirm(
          `Your selection includes ${unverifiedImages.length} unverified image(s). ` +
          `These will be downloaded with "unverified" appended to their filenames. ` +
          `Do you want to continue?`
        );
        
        if (!confirmDownload) {
          return; // User cancelled the download
        }
      }

      // Group images by disease for folder structure
      const diseaseMap = new Map<string, MangoImage[]>();
      selectedImageData.forEach(image => {
        const disease = image.predicted_class || 'Unknown';
        const diseaseType = this.getDiseaseType(image);
        const folderName = `${disease} (${diseaseType})`;
        
        if (!diseaseMap.has(folderName)) {
          diseaseMap.set(folderName, []);
        }
        diseaseMap.get(folderName)!.push(image);
      });

      console.log(`Grouped into ${diseaseMap.size} disease folders:`, Array.from(diseaseMap.keys()));

      // Create folders for each disease and download images
      for (const [folderName, images] of diseaseMap.entries()) {
        const diseaseFolder = zip.folder(folderName);
        
        if (!diseaseFolder) {
          console.error(`Failed to create folder for disease: ${folderName}`);
          continue;
        }

        console.log(`Processing ${images.length} images for disease: ${folderName}`);

        for (const image of images) {
          try {
            const imageUrl = this.getImageUrl(image);
            console.log(`Downloading image: ${image.id} from ${imageUrl}`);
            
            const response = await fetch(imageUrl);
            
            if (!response.ok) {
              console.warn(`Failed to download image ${image.id}: ${response.statusText}`);
              continue;
            }

            const blob = await response.blob();
            let filename = image.original_filename || `image_${image.id}.jpg`;
            
            // Append "unverified" to filename if image is not verified
            if (!image.is_verified) {
              const fileExtension = filename.substring(filename.lastIndexOf('.'));
              const baseName = filename.substring(0, filename.lastIndexOf('.'));
              filename = `${baseName}_unverified${fileExtension}`;
            }
            
            console.log(`Adding file to ZIP: ${filename} (${blob.size} bytes)`);
            diseaseFolder.file(filename, blob);
          } catch (error) {
            console.error(`Error downloading image ${image.id}:`, error);
          }
        }
      }

      // Generate and download ZIP
      console.log('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `selected_images_${timestamp}.zip`;
      
      console.log(`Saving ZIP file: ${zipFilename} (${content.size} bytes)`);
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

  deselectAllInFolder(folder: VerifiedDiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.delete(image.id);
    });
  }

  selectAllImages() {
    // Select all images from currently visible (expanded) main folders
    this.getFilteredMainFolders().forEach(mainFolder => {
      if (mainFolder.expanded) {
        mainFolder.subFolders.forEach(subFolder => {
          subFolder.images.forEach(image => {
            this.selectedImages.add(image.id);
          });
        });
      }
    });
    
    // If no main folders are expanded, select from all visible subfolders
    const expandedFolders = this.getFilteredMainFolders().filter(folder => folder.expanded);
    if (expandedFolders.length === 0) {
      this.getFilteredMainFolders().forEach(mainFolder => {
        mainFolder.subFolders.forEach(subFolder => {
          subFolder.images.forEach(image => {
            this.selectedImages.add(image.id);
          });
        });
      });
    }
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

  // Get disease type - use the disease_type field from the API
  getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    console.log('getDiseaseType called with:', {
      id: image.id,
      predicted_class: image.predicted_class,
      disease_type: image.disease_type,
      model_used: image.model_used
    });
    
    // Use the disease_type field from the backend API (most reliable)
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    // Fallback to model_used if available
    if (image.model_used) {
      return image.model_used;
    }
    
    // If neither field is available, return unknown
    return 'unknown';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getDownloadProgress(folder: VerifiedDiseaseFolder): string {
    return folder.downloading ? 'Preparing download...' : '';
  }

  onFilterChange() {
    // Force update of filtered data
    this.getFilteredMainFolders();
    // Trigger change detection to update filtered results
    this.cdr.detectChanges();
  }

  onSortChange() {
    this.sortFolders();
    this.cdr.detectChanges();
  }

  onDateRangeChange() {
    this.loadAllImages();
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
