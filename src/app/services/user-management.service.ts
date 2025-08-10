import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { MangoImage } from './mango-disease.service';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_active: boolean;
  is_staff: boolean;
  last_login?: string;
  total_images?: number;
  verified_images?: number;
  unverified_images?: number;
  recent_activity?: string;
}

export interface UserWithImages {
  user: User;
  images: MangoImage[];
  imageStats: {
    total: number;
    verified: number;
    unverified: number;
    healthy: number;
    diseased: number;
    leaf: number;
    fruit: number;
  };
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  staff_users: number;
  recent_registrations: number;
  top_uploaders: {
    user: User;
    upload_count: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Get all users with basic stats
  getUsers(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    is_staff?: boolean;
  }): Observable<{
    users: User[];
    pagination: {
      page: number;
      page_size: number;
      total_count: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
  }> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<any>(`${this.apiUrl}/users/`, { params: httpParams })
      .pipe(
        map(response => {
          console.log('Raw users API response:', response);
          if (response.success && response.data) {
            return response.data;
          }
          // If API doesn't have users endpoint yet, generate from image data
          return this.getUsersFromImages();
        }),
        catchError(error => {
          console.error('Error fetching users, falling back to image data:', error);
          return this.getUsersFromImages();
        })
      );
  }

  // Fallback method to extract users from image data
  private getUsersFromImages(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/classified-images/?page_size=1000`)
      .pipe(
        map(response => {
          const images = response.success ? response.data.images : [];
          const userMap = new Map<number, User>();
          
          images.forEach((image: MangoImage) => {
            if (!userMap.has(image.user.id)) {
              userMap.set(image.user.id, {
                id: image.user.id,
                username: image.user.username,
                email: image.user.email,
                first_name: image.user.first_name,
                last_name: image.user.last_name,
                date_joined: image.user.date_joined,
                is_active: true,
                is_staff: false,
                total_images: 0,
                verified_images: 0,
                unverified_images: 0
              });
            }
            
            const user = userMap.get(image.user.id)!;
            user.total_images = (user.total_images || 0) + 1;
            if (image.is_verified) {
              user.verified_images = (user.verified_images || 0) + 1;
            } else {
              user.unverified_images = (user.unverified_images || 0) + 1;
            }
          });

          return {
            users: Array.from(userMap.values()),
            pagination: {
              page: 1,
              page_size: userMap.size,
              total_count: userMap.size,
              total_pages: 1,
              has_next: false,
              has_previous: false
            }
          };
        }),
        catchError(error => {
          console.error('Error fetching images for user data:', error);
          return of({
            users: [],
            pagination: {
              page: 1,
              page_size: 0,
              total_count: 0,
              total_pages: 0,
              has_next: false,
              has_previous: false
            }
          });
        })
      );
  }

  // Get detailed user information with images
  getUserWithImages(userId: number): Observable<UserWithImages> {
    // First try to get user details, then get their images
    return this.http.get<any>(`${this.apiUrl}/classified-images/?page_size=1000`)
      .pipe(
        map(response => {
          const allImages = response.success ? response.data.images : [];
          const userImages = allImages.filter((image: MangoImage) => image.user.id === userId);
          
          if (userImages.length === 0) {
            throw new Error('User not found or has no images');
          }

          const user = userImages[0].user;
          const stats = this.calculateImageStats(userImages);

          return {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              date_joined: user.date_joined,
              is_active: true,
              is_staff: false,
              total_images: userImages.length,
              verified_images: stats.verified,
              unverified_images: stats.unverified
            },
            images: userImages,
            imageStats: stats
          };
        }),
        catchError(error => {
          console.error('Error fetching user images:', error);
          throw error;
        })
      );
  }

  // Calculate image statistics for a user
  private calculateImageStats(images: MangoImage[]) {
    const stats = {
      total: images.length,
      verified: 0,
      unverified: 0,
      healthy: 0,
      diseased: 0,
      leaf: 0,
      fruit: 0
    };

    images.forEach(image => {
      if (image.is_verified) {
        stats.verified++;
      } else {
        stats.unverified++;
      }

      const disease = (image.disease_classification || image.predicted_class || '').toLowerCase();
      if (disease.includes('healthy')) {
        stats.healthy++;
      } else {
        stats.diseased++;
      }

      // Use the same disease type logic as other components
      const diseaseType = this.getDiseaseType(image);
      if (diseaseType === 'leaf') {
        stats.leaf++;
      } else if (diseaseType === 'fruit') {
        stats.fruit++;
      }
    });

    return stats;
  }

  // Helper method to determine disease type (same logic as other components)
  private getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    // First priority: Use the model_used field from the backend API
    if (image.model_used) {
      return image.model_used;
    }
    
    // Second priority: Use the disease_type field from the backend
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    // Fallback: classify based on disease name
    const disease = image.disease_classification || image.predicted_class;
    if (!disease) return 'unknown';
    
    const diseaseLower = disease.toLowerCase();
    
    const leafDiseases = [
      'die back', 'dieback', 'anthracnose', 'powdery mildew', 'bacterial canker',
      'sooty mold', 'sooty mould', 'cutting weevil', 'gall midge'
    ];
    
    const fruitDiseases = [
      'black mould rot', 'stem end rot', 'alternaria'
    ];
    
    if (leafDiseases.some(leafDisease => diseaseLower.includes(leafDisease))) {
      return 'leaf';
    }
    
    if (fruitDiseases.some(fruitDisease => diseaseLower.includes(fruitDisease))) {
      return 'fruit';
    }
    
    return 'unknown';
  }

  // Get user statistics
  getUserStats(): Observable<UserStats> {
    return this.getUsers({ page_size: 1000 })
      .pipe(
        map(response => {
          const users = response.users;
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

          const stats: UserStats = {
            total_users: users.length,
            active_users: users.filter(u => u.is_active).length,
            inactive_users: users.filter(u => !u.is_active).length,
            staff_users: users.filter(u => u.is_staff).length,
            recent_registrations: users.filter(u => new Date(u.date_joined) > weekAgo).length,
            top_uploaders: users
              .filter(u => u.total_images && u.total_images > 0)
              .sort((a, b) => (b.total_images || 0) - (a.total_images || 0))
              .slice(0, 5)
              .map(user => ({
                user,
                upload_count: user.total_images || 0
              }))
          };

          return stats;
        }),
        catchError(error => {
          console.error('Error calculating user stats:', error);
          return of({
            total_users: 0,
            active_users: 0,
            inactive_users: 0,
            staff_users: 0,
            recent_registrations: 0,
            top_uploaders: []
          });
        })
      );
  }

  // Update user status
  updateUserStatus(userId: number, isActive: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/`, { is_active: isActive })
      .pipe(
        catchError(error => {
          console.error('Error updating user status:', error);
          throw error;
        })
      );
  }

  // Delete user (if needed)
  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}/`)
      .pipe(
        catchError(error => {
          console.error('Error deleting user:', error);
          throw error;
        })
      );
  }
}
