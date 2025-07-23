import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageGalleryComponent } from './image-gallery/image-gallery.component';
import { UploadImagesComponent } from './upload-images/upload-images.component';
import { ModelSettingsComponent } from './model-settings/model-settings.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'image-gallery', component: ImageGalleryComponent },
  { path: 'upload-images', component: UploadImagesComponent },
  { path: 'model-settings', component: ModelSettingsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }