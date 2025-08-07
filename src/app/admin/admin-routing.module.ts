import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageGalleryComponent } from './image-gallery/image-gallery.component';
import { ImageDetailComponent } from './image-detail/image-detail.component';
import { UploadImagesComponent } from './upload-images/upload-images.component';
import { ModelSettingsComponent } from './model-settings/model-settings.component';
import { UnverifiedImagesComponent } from './unverified-images/unverified-images.component';
import { VerifiedImagesComponent } from './verified-images/verified-images.component';
import { UserConfirmationsComponent } from './user-confirmations/user-confirmations.component';
import { UserManagementComponent } from './user-management/user-management.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'images', component: ImageGalleryComponent }, // Keep for compatibility
  { path: 'image-gallery', component: ImageGalleryComponent },
  { path: 'image-detail/:id', component: ImageDetailComponent },
  { path: 'unverified-images', component: UnverifiedImagesComponent },
  { path: 'verified-images', component: VerifiedImagesComponent },
  { path: 'user-management', component: UserManagementComponent },
  { path: 'upload-images', component: UploadImagesComponent },
  { path: 'model-settings', component: ModelSettingsComponent },
  { path: 'user-confirmations', component: UserConfirmationsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }