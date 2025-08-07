import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';

interface DiseaseGroup {
  disease: string;
  images: MangoImage[];
  count: number;
  expanded: boolean;
}

@Component({
  selector: 'app-verified-diseases',
  templateUrl: './verified-diseases.component.html',
  styleUrls: ['./verified-diseases.component.css'],
  standalone: false
})
export class VerifiedDiseasesComponent implements OnInit {
  diseaseGroups: DiseaseGroup[] = [];
  allImages: MangoImage[] = [];
  loading = true;
  error: string | null = null;
  availableDiseases: string[] = [];
  selectedDisease = 'all';
  dateRange = 'all';
  sortBy = 'disease';
  searchTerm = '';

  constructor(
    private mangoDiseaseService: MangoDiseaseService
  ) {}

  ngOnInit() {
    this.loadImages();
  }

  async loadImages() {
    try {
      this.loading = true;
      this.error = null;

      const params: any = {
        verified: true
      };

      if (this.selectedDisease !== 'all') {
        params.disease = this.selectedDisease;
      }

      const response = await this.mangoDiseaseService.getImages(params).toPromise();

      if (response?.success) {
        this.allImages = response.data;
        
        // Extract available diseases
        this.availableDiseases = [...new Set(this.allImages.map((img: MangoImage) => img.predicted_class).filter(Boolean))].sort() as string[];
        
        this.groupImagesByDisease();
      }
    } catch (error) {
      console.error('Error loading images:', error);
      this.error = 'Failed to load verified diseases. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  groupImagesByDisease() {
    const grouped: { [key: string]: MangoImage[] } = {};
    
    this.allImages.forEach(image => {
      const disease = image.predicted_class;
      if (!grouped[disease]) {
        grouped[disease] = [];
      }
      grouped[disease].push(image);
    });

    this.diseaseGroups = Object.keys(grouped).map(disease => ({
      disease,
      images: grouped[disease],
      count: grouped[disease].length,
      expanded: false
    }));

    this.sortGroups();
  }

  sortGroups() {
    this.diseaseGroups.sort((a, b) => {
      switch (this.sortBy) {
        case 'disease':
          return a.disease.localeCompare(b.disease);
        case 'count':
          return b.count - a.count;
        default:
          return a.disease.localeCompare(b.disease);
      }
    });
  }

  toggleGroup(group: DiseaseGroup) {
    group.expanded = !group.expanded;
  }

  onFilterChange() {
    this.loadImages();
  }

  onSortChange() {
    this.sortGroups();
  }

  getGroupAccuracy(group: DiseaseGroup): number {
    // Placeholder for accuracy calculation
    return 85.5;
  }

  async downloadImages(images: MangoImage[], filename?: string) {
    try {
      const imageIds = images.map(img => img.id);
      const response = await this.mangoDiseaseService.downloadImagesZip(imageIds).toPromise();
      
      if (response) {
        const blob = new Blob([response], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `verified-images-${new Date().toISOString().split('T')[0]}.zip`;
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading images:', error);
      this.error = 'Failed to download images. Please try again.';
    }
  }
}
