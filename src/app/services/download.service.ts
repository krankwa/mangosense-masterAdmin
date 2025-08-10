import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Download a single image by URL
   * @param imageUrl - The URL of the image to download
   * @param filename - The filename to save as
   */
  downloadImageByUrl(imageUrl: string, filename: string): void {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    link.target = '_blank';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download image using fetch to handle CORS and authentication
   * @param imageUrl - The URL of the image to download
   * @param filename - The filename to save as
   */
  async downloadImageWithFetch(imageUrl: string, filename: string): Promise<void> {
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback to direct download
      this.downloadImageByUrl(imageUrl, filename);
    }
  }

  /**
   * Download image by ID using the API endpoint
   * @param imageId - The ID of the image to download
   * @param filename - The filename to save as
   */
  downloadImageById(imageId: number, filename: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-image/${imageId}/`, {
      responseType: 'blob'
    });
  }

  /**
   * Download multiple images as a ZIP file
   * @param imageIds - Array of image IDs to download
   * @param zipFilename - The filename for the ZIP file
   */
  downloadImagesAsZip(imageIds: number[], zipFilename: string = 'images.zip'): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/download-images-zip/`, 
      { image_ids: imageIds },
      { responseType: 'blob' }
    );
  }

  /**
   * Handle the blob response and trigger download
   * @param blob - The blob to download
   * @param filename - The filename to save as
   */
  handleBlobDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get the filename from an image object
   * @param image - The image object
   * @returns A clean filename
   */
  getImageFilename(image: any): string {
    if (image.original_filename) {
      return image.original_filename;
    }
    
    // Extract filename from URL
    if (image.image_url || image.image) {
      const url = image.image_url || image.image;
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      // If no extension, add .jpg as default
      if (!filename.includes('.')) {
        return `${filename}.jpg`;
      }
      
      return filename;
    }
    
    // Fallback filename
    return `image_${image.id || Date.now()}.jpg`;
  }

  /**
   * Generate a filename for bulk downloads
   * @param prefix - Prefix for the filename
   * @param extension - File extension
   * @returns A timestamp-based filename
   */
  generateBulkFilename(prefix: string = 'download', extension: string = 'zip'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.${extension}`;
  }

  /**
   * Download all user images as ZIP
   * @param userId - The user ID
   * @param username - The username for filename
   */
  downloadUserImages(userId: number, username: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-user-images/${userId}/`, {
      responseType: 'blob'
    });
  }

  /**
   * Download images by disease type
   * @param diseaseType - The disease type to filter by
   * @param diseaseName - The disease name for filename
   */
  downloadImagesByDisease(diseaseType: string, diseaseName: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-disease-images/`, {
      params: { disease_type: diseaseType },
      responseType: 'blob'
    });
  }

  /**
   * Download verified or unverified images
   * @param isVerified - Whether to download verified (true) or unverified (false) images
   */
  downloadImagesByVerification(isVerified: boolean): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-verification-images/`, {
      params: { is_verified: isVerified.toString() },
      responseType: 'blob'
    });
  }

  /**
   * Show download progress (for future enhancement)
   * @param message - Progress message to show
   */
  showDownloadProgress(message: string): void {
    // This could be enhanced with a toast notification service
    console.log(`Download: ${message}`);
  }

  /**
   * Validate image URL before download
   * @param imageUrl - The image URL to validate
   * @returns Whether the URL is valid
   */
  isValidImageUrl(imageUrl: string): boolean {
    if (!imageUrl) return false;
    
    // Check if it's a valid URL format
    const urlPattern = /^(https?:\/\/)|(\/)/;
    return urlPattern.test(imageUrl);
  }

  /**
   * Get image dimensions (for future enhancement)
   * @param imageUrl - The image URL
   * @returns Promise with image dimensions
   */
  getImageDimensions(imageUrl: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }
}
