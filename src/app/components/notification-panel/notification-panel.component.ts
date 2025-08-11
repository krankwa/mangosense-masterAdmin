import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationData } from '../../services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-panel.component.html',
  styleUrls: ['./notification-panel.component.css']
})
export class NotificationPanelComponent implements OnInit {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() notificationClick = new EventEmitter<NotificationData>();

  notifications: NotificationData[] = [];
  selectedNotification: NotificationData | null = null;
  showModal = false;
  selectedNotifications: Set<string> = new Set();
  isSelectionMode = false;
  expandedNotificationId: string | null = null;

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });
    // Load existing notifications initially when component opens (don't create new ones)
    this.refreshNotifications();
  }

  onBackClick(): void {
    this.close.emit();
  }

  refreshNotifications(): void {
    this.notificationService.refreshNotifications();  // This won't recreate deleted notifications
  }

  scanForNewNotifications(): void {
    this.notificationService.scanForNewNotifications();  // This will create notifications for new images
  }

  onNotificationClick(notification: NotificationData): void {
    if (this.isSelectionMode) {
      this.toggleNotificationSelection(notification.id);
      return;
    }

    // Mark as read immediately when clicked (regardless of expansion)
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id);
    }

    // Toggle expansion - if clicking on same notification, collapse it
    if (this.expandedNotificationId === notification.id) {
      this.expandedNotificationId = null;
    } else {
      this.expandedNotificationId = notification.id;
      this.selectedNotification = notification;
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedNotification = null;
  }

  onDetailsClick(): void {
    if (this.selectedNotification) {
      this.close.emit();
      // Navigate to image details page - fix the route
      this.router.navigate(['/admin/image-detail', this.selectedNotification.imageId]);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  toggleSelectionMode(): void {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selectedNotifications.clear();
    }
  }

  toggleNotificationSelection(notificationId: string): void {
    if (this.selectedNotifications.has(notificationId)) {
      this.selectedNotifications.delete(notificationId);
    } else {
      this.selectedNotifications.add(notificationId);
    }
  }

  selectAll(): void {
    this.selectedNotifications.clear();
    this.notifications.forEach(notification => {
      this.selectedNotifications.add(notification.id);
    });
  }

  clearSelection(): void {
    this.selectedNotifications.clear();
  }

  deleteSelected(): void {
    if (this.selectedNotifications.size === 0) return;

    const selectedIds = Array.from(this.selectedNotifications);
    this.notificationService.deleteSelectedNotifications(selectedIds);
    this.selectedNotifications.clear();
    this.isSelectionMode = false;
  }

  isNotificationSelected(notificationId: string): boolean {
    return this.selectedNotifications.has(notificationId);
  }

  get selectedCount(): number {
    return this.selectedNotifications.size;
  }

  get allSelected(): boolean {
    return this.notifications.length > 0 && this.selectedNotifications.size === this.notifications.length;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  formatFullTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  getDetectionTypeIcon(detectionType: string): string {
    const type = detectionType?.toLowerCase();
    
    if (type?.includes('fruit') || type === 'fruit') {
      // Orange fruit icon
      return `<svg class="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C10.343 2 9 3.343 9 5C9 6.657 10.343 8 12 8C13.657 8 15 6.657 15 5C15 3.343 13.657 2 12 2ZM12 10C8.134 10 5 13.134 5 17C5 20.866 8.134 24 12 24C15.866 24 19 20.866 19 17C19 13.134 15.866 10 12 10Z"/>
      </svg>`;
    } else if (type?.includes('leaf') || type === 'leaf') {
      // Green leaf icon
      return `<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M21,6V8L19,9V15A4,4 0 0,1 15,19H9A4,4 0 0,1 5,15V9L3,8V6H21Z"/>
      </svg>`;
    } else {
      // Default image icon
      return `<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>`;
    }
  }

  // Helper method to get detection type for proper icon display
  getDetectionType(notification: NotificationData): string {
    return notification.detectionType || notification.diseaseType || 'unknown';
  }

  getDiseaseIcon(diseaseType: string): string {
    // Return appropriate SVG icon classes based on disease type
    switch (diseaseType.toLowerCase()) {
      case 'anthracnose':
        return 'virus';
      case 'bacterial canker':
        return 'leaf';
      case 'cutting weevil':
        return 'bug';
      case 'die back':
        return 'skull';
      case 'gall midge':
        return 'bug';
      case 'healthy':
        return 'check-circle';
      case 'powdery mildew':
        return 'cloud';
      case 'sooty mould':
        return 'circle';
      default:
        return 'search';
    }
  }

  getDiseaseIconSvg(diseaseType: string): string {
    const iconType = this.getDiseaseIcon(diseaseType);
    switch (iconType) {
      case 'virus':
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>`;
      case 'leaf':
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
        </svg>`;
      case 'bug':
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;
      case 'skull':
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>`;
      case 'check-circle':
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;
      case 'cloud':
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
        </svg>`;
      case 'circle':
        return `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
        </svg>`;
      default:
        return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>`;
    }
  }

  formatConfidence(confidence: number): string {
    const conf = typeof confidence === 'string' ? parseFloat(confidence) : (confidence || 0);
    
    // If confidence is already in percentage format (0-100), use as is
    // If confidence is in decimal format (0-1), convert to percentage
    const percentage = conf > 1 ? conf : conf * 100;
    return percentage.toFixed(1) + '%';
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  isNotificationExpanded(notificationId: string): boolean {
    return this.expandedNotificationId === notificationId;
  }

  collapseNotification(): void {
    this.expandedNotificationId = null;
    this.selectedNotification = null;
  }
}