import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface MangoImage {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    date_joined: string;
  };
  image: string;
  image_url?: string; // Add this for template compatibility
  original_filename: string;
  uploaded_at: string;
  upload_date?: string; // Add this for template compatibility
  predicted_class: string;
  disease_classification?: string; // Add this for template compatibility
  confidence_score: number;
  disease_type: 'leaf' | 'fruit';
  image_size: string;
  processing_time: number;
  client_ip: string;
  is_verified?: boolean; // Add this for template compatibility
  notes?: string; // Add this for template compatibility
}

export interface DiseaseStats {
  total_images: number;
  healthy_images: number;
  diseased_images: number;
  leaf_images: number;
  fruit_images: number;
  diseases_breakdown: {
    [key: string]: number; // Your API returns numbers, not objects
  };
  recent_uploads: number;
  monthly_uploads: number;
  verification_stats: {
    verified: number;
    unverified: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MangoDiseaseService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) { }

  // Get disease statistics - handle your API's success/data wrapper
  getDiseaseStatistics(): Observable<DiseaseStats> {
    return this.http.get<{success: boolean, data: DiseaseStats}>(`${this.apiUrl}/disease-statistics/`)
      .pipe(
        map(response => {
          console.log('Raw API response:', response);
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('Invalid API response format');
        }),
        catchError(error => {
          console.error('Error fetching disease statistics:', error);
          // Return fallback data
          return of({
            total_images: 0,
            healthy_images: 0,
            diseased_images: 0,
            leaf_images: 0,
            fruit_images: 0,
            diseases_breakdown: {},
            recent_uploads: 0,
            monthly_uploads: 0,
            verification_stats: {
              verified: 0,
              unverified: 0
            }
          });
        })
      );
  }

  // Get classified images - handle your API's success/data wrapper
  getClassifiedImages(page: number = 1, pageSize: number = 20, filters?: any): Observable<{
    images: MangoImage[];
    pagination: {
      page: number;
      page_size: number;
      total_count: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
  }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());

    // Add filters if provided
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key].toString());
        }
      });
    }

    return this.http.get<{
      success: boolean;
      data: {
        images: MangoImage[];
        pagination: {
          page: number;
          page_size: number;
          total_count: number;
          total_pages: number;
          has_next: boolean;
          has_previous: boolean;
        };
      };
    }>(`${this.apiUrl}/classified-images/`, { params })
      .pipe(
        map(response => {
          console.log('Raw images API response:', response);
          if (response.success && response.data) {
            // Transform images to add missing properties for template compatibility
            const transformedImages = response.data.images.map(image => ({
              ...image,
              image_url: image.image,
              disease_classification: image.predicted_class,
              upload_date: image.uploaded_at,
              is_verified: false, // Default value since your API doesn't provide this
              notes: '' // Default value since your API doesn't provide this
            }));

            return {
              images: transformedImages,
              pagination: response.data.pagination
            };
          }
          throw new Error('Invalid API response format');
        }),
        catchError(error => {
          console.error('Error fetching classified images:', error);
          return of({
            images: [],
            pagination: {
              page: 1,
              page_size: 20,
              total_count: 0,
              total_pages: 0,
              has_next: false,
              has_previous: false
            }
          });
        })
      );
  }

  // Update image verification status
  updateImageVerification(imageId: number, isVerified: boolean, notes?: string): Observable<MangoImage> {
    const updateData = {
      is_verified: isVerified,
      notes: notes || ''
    };

    return this.http.patch<MangoImage>(`${this.apiUrl}/classified-images/${imageId}/`, updateData)
      .pipe(
        catchError(error => {
          console.error('Error updating image verification:', error);
          throw error;
        })
      );
  }

  // Delete image
  deleteImage(imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/classified-images/${imageId}/`)
      .pipe(
        catchError(error => {
          console.error('Error deleting image:', error);
          throw error;
        })
      );
  }

  // Bulk update images
  bulkUpdateImages(imageIds: number[], updates: Partial<MangoImage>): Observable<any> {
    const bulkData = {
      image_ids: imageIds,
      updates: updates
    };

    return this.http.post<any>(`${this.apiUrl}/classified-images/bulk-update/`, bulkData)
      .pipe(
        catchError(error => {
          console.error('Error bulk updating images:', error);
          throw error;
        })
      );
  }

  // Test connection
  testConnection(): Observable<any> {
    return this.http.get(`${this.apiUrl}/test-model/`)
      .pipe(
        catchError(error => {
          console.error('Error testing connection:', error);
          return of({ success: false, error: error.message });
        })
      );
  }

  // Export dataset
  exportDataset(format: 'csv' | 'json' = 'json'): Observable<Blob> {
    let params = new HttpParams().set('format', format);

    return this.http.get(`${this.apiUrl}/export-dataset/`, { 
      params: params,
      responseType: 'blob'
    })
      .pipe(
        catchError(error => {
          console.error('Error exporting dataset:', error);
          throw error;
        })
      );
  }
}