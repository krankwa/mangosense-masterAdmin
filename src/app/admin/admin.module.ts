import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router'; // Add this import
import { AdminRoutingModule } from './admin-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageGalleryComponent } from './image-gallery/image-gallery.component';
import { UploadImagesComponent } from './upload-images/upload-images.component';
import { ModelSettingsComponent } from './model-settings/model-settings.component';

@NgModule({
  declarations: [
    DashboardComponent,
    ImageGalleryComponent,
    UploadImagesComponent,
    ModelSettingsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule, // Add this to imports
    AdminRoutingModule
  ]
})
export class AdminModule { }