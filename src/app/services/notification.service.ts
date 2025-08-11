import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface NotificationData {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  imageId: string;
  imageName: string;
  timestamp: string;
  diseaseClassification: string;
  diseaseType: string;
  detectionType?: string; // Added for fruit/leaf detection
  confidence: number;
  isRead: boolean;
  imageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://127.0.0.1:8000/api'; // Your Django API URL
  private notificationsSubject = new BehaviorSubject<NotificationData[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {
    // Initialize with empty array - notifications will be loaded only when refresh is clicked
  }

  loadNotifications(createNew: boolean = false): void {
    const url = createNew 
      ? `${this.apiUrl}/notifications/?create_new=true`
      : `${this.apiUrl}/notifications/`;
      
    this.http.get<any>(url).subscribe({
      next: (response) => {
        // Handle both direct array and paginated response
        const data = response.notifications || response;
        const notifications: NotificationData[] = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          userName: item.user_name || 'Unknown User',
          userEmail: (item.user_email || '').replace(/^@/, ''), // Remove leading @ if present
          imageId: item.image_id,
          imageName: item.image_name,
          timestamp: item.timestamp,
          diseaseClassification: item.disease_classification,
          diseaseType: item.disease_type,
          detectionType: item.detection_type || (item.disease_type && item.disease_type.toLowerCase().includes('fruit') ? 'fruit' : 'leaf'), // Better detection logic
          confidence: typeof item.confidence === 'string' ? parseFloat(item.confidence) : (item.confidence || 0), // Handle both string and number
          isRead: item.is_read || false,
          imageUrl: item.image_url
        }));
        
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  // Public method to manually refresh notifications (without creating new ones)
  refreshNotifications(): void {
    this.loadNotifications(false);  // Don't create new notifications on refresh
  }

  // Public method to scan for new images and create notifications
  scanForNewNotifications(): void {
    this.loadNotifications(true);   // Create new notifications if needed
  }

  markAsRead(notificationId: string): void {
    this.http.patch(`${this.apiUrl}/notifications/${notificationId}/mark-read/`, {}).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllAsRead(): void {
    this.http.patch(`${this.apiUrl}/notifications/mark-all-read/`, {}).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification => ({
          ...notification,
          isRead: true
        }));
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  deleteNotification(notificationId: string): void {
    this.http.delete(`${this.apiUrl}/notifications/${notificationId}/`).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.filter(
          notification => notification.id !== notificationId
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
      }
    });
  }

  deleteSelectedNotifications(notificationIds: string[]): void {
    this.http.post(`${this.apiUrl}/notifications/delete-selected/`, { ids: notificationIds }).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.filter(
          notification => !notificationIds.includes(notification.id)
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error deleting selected notifications:', error);
      }
    });
  }

  private updateUnreadCount(notifications: NotificationData[]): void {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    this.unreadCountSubject.next(unreadCount);
  }

  getNotificationById(id: string): NotificationData | undefined {
    return this.notificationsSubject.value.find(notification => notification.id === id);
  }
}