import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export interface LocationPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly LOCATION_TIMEOUT = 10000; // 10 seconds
  private readonly HIGH_ACCURACY_OPTIONS = {
    enableHighAccuracy: true,
    timeout: this.LOCATION_TIMEOUT,
    maximumAge: 300000 // 5 minutes
  };

  constructor() {}

  /**
   * Check if geolocation is supported by the browser
   */
  isGeolocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check current permission status for geolocation
   */
  async checkPermissionStatus(): Promise<LocationPermissionStatus> {
    if (!this.isGeolocationSupported()) {
      return { granted: false, denied: true, prompt: false };
    }

    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return {
          granted: permission.state === 'granted',
          denied: permission.state === 'denied',
          prompt: permission.state === 'prompt'
        };
      }
    } catch (error) {
      console.warn('Permission API not supported:', error);
    }

    // Fallback: assume prompt state if permissions API is not supported
    return { granted: false, denied: false, prompt: true };
  }

  /**
   * Request user permission and get current location
   */
  getCurrentLocation(): Observable<LocationData> {
    return new Observable(observer => {
      if (!this.isGeolocationSupported()) {
        observer.error(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          // Try to get address information
          try {
            const addressInfo = await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            );
            Object.assign(locationData, addressInfo);
          } catch (error) {
            console.warn('Reverse geocoding failed:', error);
          }

          observer.next(locationData);
          observer.complete();
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          observer.error(new Error(errorMessage));
        },
        this.HIGH_ACCURACY_OPTIONS
      );
    });
  }

  /**
   * Watch user location changes
   */
  watchLocation(): Observable<LocationData> {
    return new Observable(observer => {
      if (!this.isGeolocationSupported()) {
        observer.error(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          // Try to get address information
          try {
            const addressInfo = await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            );
            Object.assign(locationData, addressInfo);
          } catch (error) {
            console.warn('Reverse geocoding failed:', error);
          }

          observer.next(locationData);
        },
        (error) => {
          let errorMessage = 'Failed to watch location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          observer.error(new Error(errorMessage));
        },
        this.HIGH_ACCURACY_OPTIONS
      );

      // Return cleanup function
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    });
  }

  /**
   * Reverse geocode coordinates to address
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<Partial<LocationData>> {
    try {
      // Using OpenStreetMap Nominatim API (free reverse geocoding)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MangoSense-Admin-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding request failed');
      }

      const data = await response.json();
      
      if (data && data.address) {
        return {
          address: data.display_name,
          city: data.address.city || data.address.town || data.address.village,
          region: data.address.state || data.address.province || data.address.region,
          country: data.address.country
        };
      }

      return {};
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {};
    }
  }

  /**
   * Format location for display
   */
  formatLocation(location: LocationData): string {
    const parts = [];
    
    if (location.city) parts.push(location.city);
    if (location.region) parts.push(location.region);
    if (location.country) parts.push(location.country);
    
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  /**
   * Get distance between two locations in kilometers
   */
  getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if location is accurate enough
   */
  isLocationAccurate(location: LocationData, requiredAccuracy: number = 100): boolean {
    return location.accuracy <= requiredAccuracy;
  }

  /**
   * Get location accuracy description
   */
  getAccuracyDescription(accuracy: number): string {
    if (accuracy <= 5) return 'Very High';
    if (accuracy <= 20) return 'High';
    if (accuracy <= 100) return 'Medium';
    if (accuracy <= 500) return 'Low';
    return 'Very Low';
  }
}
