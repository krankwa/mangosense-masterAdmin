import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router'; // Add this import
import { AdminRoutingModule } from './admin-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageDetailComponent } from './image-detail/image-detail.component';
import { UploadImagesComponent } from './upload-images/upload-images.component';
import { ModelSettingsComponent } from './model-settings/model-settings.component';
import { UnverifiedImagesComponent } from './unverified-images/unverified-images.component';
import { VerifiedImagesComponent } from './verified-images/verified-images.component';
import { UserConfirmationsComponent } from './user-confirmations/user-confirmations.component';
import { UnverifiedDiseasesComponent } from './unverified-diseases/unverified-diseases.component';
import { VerifiedDiseasesComponent } from './verified-diseases/verified-diseases.component';
import { UserManagementComponent } from './user-management/user-management.component';

@NgModule({
  declarations: [
    DashboardComponent,
    ImageDetailComponent,
    UploadImagesComponent,
    ModelSettingsComponent,
    UnverifiedImagesComponent,
    VerifiedImagesComponent,
    UserConfirmationsComponent,
    UnverifiedDiseasesComponent,
    VerifiedDiseasesComponent,
    UserManagementComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule, // Add this to imports
    AdminRoutingModule
  ]
})
export class AdminModule { }