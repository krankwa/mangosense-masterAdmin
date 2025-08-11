import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'MangoSense-masterUI';
  isAuthenticated = false;
  showNavigation = false;
  isMenuOpen = false;
  showNotificationPanel = false;
  unreadNotificationCount = 0;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Subscribe to authentication status
    this.authService.isAuthenticated$.subscribe(
      isAuth => {
        this.isAuthenticated = isAuth;
        this.updateNavigationVisibility();
      }
    );

    // Subscribe to notification count
    this.notificationService.unreadCount$.subscribe(
      count => {
        this.unreadNotificationCount = count;
      }
    );

    // Listen to route changes to update navigation visibility
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateNavigationVisibility();
    });

    // Force check authentication on init
    this.isAuthenticated = this.authService.isLoggedIn();
    this.updateNavigationVisibility();
  }

  updateNavigationVisibility() {
    // Show navigation when authenticated and not on login page
    this.showNavigation = this.isAuthenticated && !this.router.url.includes('/login');
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
    this.isMenuOpen = false; // Close menu after navigation
  }

  navigateToUploadImages() {
    this.router.navigate(['/admin/upload-images']);
    this.isMenuOpen = false;
  }

  navigateToImageGallery() {
    this.router.navigate(['/admin/verified-images']);
    this.isMenuOpen = false;
  }

  navigateToUserManagement() {
    this.router.navigate(['/admin/user-management']);
    this.isMenuOpen = false;
  }

  navigateToModelSettings() {
    this.router.navigate(['/admin/model-settings']);
    this.isMenuOpen = false;
  }

  navigateToNotifications() {
    this.showNotificationPanel = true;
    this.isMenuOpen = false;
  }

  closeNotificationPanel() {
    this.showNotificationPanel = false;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  refreshData() {
    // Refresh the current page/component data
    window.location.reload();
  }

  getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
