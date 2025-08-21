import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationData } from '../../services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notification-panel',
  imports: [CommonModule],
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.css'
})
export class NotificationPanel implements OnInit {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() notificationClick = new EventEmitter<NotificationData>();

  notifications: NotificationData[] = [];
  selectedNotification: NotificationData | null = null;
  showModal = false;

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
  }

  onBackClick(): void {
    this.close.emit();
  }

  onNotificationClick(notification: NotificationData): void {
    this.selectedNotification = notification;
    this.showModal = true;
    
    // Mark as read
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id);
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedNotification = null;
  }

  onDetailsClick(): void {
    if (this.selectedNotification) {
      this.closeModal();
      this.close.emit();
      // Navigate to image details page
      this.router.navigate(['/admin/image-details', this.selectedNotification.imageId]);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
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

  getDiseaseIcon(diseaseType: string): string {
    // Return appropriate icon based on disease type
    switch (diseaseType.toLowerCase()) {
      case 'anthracnose':
        return '🦠';
      case 'bacterial canker':
        return '🍂';
      case 'cutting weevil':
        return '🪲';
      case 'die back':
        return '💀';
      case 'gall midge':
        return '🐛';
      case 'healthy':
        return '✅';
      case 'powdery mildew':
        return '☁️';
      case 'sooty mould':
        return '⚫';
      default:
        return '🔍';
    }
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }
}
