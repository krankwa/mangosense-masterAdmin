import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, DiseaseStats, MangoImage } from '../../services/mango-disease.service';
import { Router } from '@angular/router';

interface DiseaseCategory {
  id: string;
  name: string;
  type: 'leaf' | 'fruit';
  description: string;
  imageCount: number;
  severity: 'low' | 'medium' | 'high';
  color: string;
  lastDetected?: string;
  percentage?: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnInit {
  
  // Current date for display
  currentDate = new Date().toLocaleDateString();
  
  // Loading states
  loading = true;
  error: string | null = null;
  
  // Real data from backend
  stats: DiseaseStats | null = null;
  recentImages: MangoImage[] = [];
  
  // Enhanced disease categories with real data
  leafDiseases: DiseaseCategory[] = [];
  fruitDiseases: DiseaseCategory[] = [];
  
  // Statistics
  totalImages = 0;
  totalLeafImages = 0;
  totalFruitImages = 0;
  healthyImages = 0;
  diseasedImages = 0;

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  async loadDashboardData() {
    try {
      this.loading = true;
      this.error = null;

      console.log('Loading dashboard data...');

      // Test API connectivity first
      const connectionTest = await this.mangoDiseaseService.testConnection().toPromise();
      console.log('Connection test result:', connectionTest);

      // Load statistics
      const stats = await this.mangoDiseaseService.getDiseaseStatistics().toPromise();
      console.log('Statistics loaded:', stats);
      
      if (stats) {
        this.stats = stats;
        this.updateStatistics(stats);
        this.updateDiseaseCategories(stats);
      }

      // Load recent images
      const recentImagesResponse = await this.mangoDiseaseService.getClassifiedImages(1, 10).toPromise();
      console.log('Recent images loaded:', recentImagesResponse);
      
      if (recentImagesResponse) {
        this.recentImages = recentImagesResponse.images; // Fixed: use .images instead of .results
      }

      // If we got here, everything loaded successfully
      this.loading = false;

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.error = 'Failed to load dashboard data. Please try again.';
      this.loading = false;
      
      // Load fallback static data
      this.loadStaticData();
    }
  }

  private updateStatistics(stats: DiseaseStats) {
    this.totalImages = stats.total_images;
    this.healthyImages = stats.healthy_images;
    this.diseasedImages = stats.diseased_images;
    this.totalLeafImages = stats.leaf_images;
    this.totalFruitImages = stats.fruit_images;
  }

  private updateDiseaseCategories(stats: DiseaseStats) {
    const diseaseBreakdown = stats.diseases_breakdown;
    
    // Reset arrays
    this.leafDiseases = [];
    this.fruitDiseases = [];
    
    // Process disease breakdown from your API format (numbers, not objects)
    Object.keys(diseaseBreakdown).forEach(diseaseName => {
      const count = diseaseBreakdown[diseaseName]; // This is a number
      const percentage = (count / this.totalImages * 100);
      
      // Determine if it's leaf or fruit disease
      const isLeafDisease = diseaseName.toLowerCase().includes('leaf') || 
                           diseaseName.toLowerCase().includes('healthy leaf');
      const isFruitDisease = diseaseName.toLowerCase().includes('fruit') || 
                            diseaseName.toLowerCase().includes('healthy fruit');
      
      // Clean up disease name (remove "Leaf" or "Fruit" prefix)
      const cleanName = diseaseName.replace(/^(Leaf|Fruit)\s+/, '');
      
      const diseaseCategory: DiseaseCategory = {
        id: `${cleanName.toLowerCase().replace(/\s+/g, '-')}`,
        name: cleanName,
        type: isLeafDisease ? 'leaf' : 'fruit',
        description: this.getDiseaseDescription(cleanName),
        imageCount: count, // This is directly a number
        severity: this.getDiseaseSeverity(cleanName),
        color: this.getDiseaseColor(cleanName),
        lastDetected: 'Recently', // Your API doesn't provide this
        percentage: percentage
      };
      
      if (isLeafDisease) {
        this.leafDiseases.push(diseaseCategory);
      } else if (isFruitDisease) {
        this.fruitDiseases.push(diseaseCategory);
      }
    });
    
    // Sort by count (descending)
    this.leafDiseases.sort((a, b) => b.imageCount - a.imageCount);
    this.fruitDiseases.sort((a, b) => b.imageCount - a.imageCount);
  }

  private loadStaticData() {
    // Static fallback data
    this.totalImages = 0;
    this.healthyImages = 0;
    this.diseasedImages = 0;
    this.totalLeafImages = 0;
    this.totalFruitImages = 0;
    
    // Empty disease categories
    this.leafDiseases = [];
    this.fruitDiseases = [];
    
    console.log('Using static fallback data');
  }

  private getDiseaseDescription(name: string): string {
    const descriptions: { [key: string]: string } = {
      'Anthracnose': 'Fungal disease causing dark spots on leaves and fruits',
      'Bacterial Canker': 'Bacterial infection causing leaf blight',
      'Cutting Weevil': 'Insect damage to young leaves',
      'Die Back': 'Progressive dying of branches and leaves',
      'Gall Midge': 'Insect galls on leaves and shoots',
      'Healthy': 'Normal healthy mango leaves/fruits',
      'Powdery Mildew': 'Fungal disease with white powdery coating',
      'Sooty Mold': 'Black fungal growth on leaf surfaces',
      'Sooty Mould': 'Black fungal growth on leaf surfaces',
      'Alternaria': 'Fungal disease causing dark spots on fruits',
      'Black Mold Rot': 'Black fungal rot affecting ripe fruits',
      'Black Mould Rot': 'Black fungal rot affecting ripe fruits',
      'Stem end Rot': 'Rot starting from the stem end',
      'Stem End Rot': 'Rot starting from the stem end'
    };
    return descriptions[name] || 'Disease affecting mango plants';
  }

  private getDiseaseSeverity(name: string): 'low' | 'medium' | 'high' {
    const highSeverity = ['Anthracnose', 'Die Back', 'Black Mold Rot', 'Black Mould Rot', 'Alternaria'];
    const mediumSeverity = ['Bacterial Canker', 'Gall Midge', 'Powdery Mildew', 'Sooty Mold', 'Sooty Mould', 'Stem End Rot', 'Stem end Rot'];
    
    if (name === 'Healthy') return 'low';
    if (highSeverity.includes(name)) return 'high';
    if (mediumSeverity.includes(name)) return 'medium';
    return 'low';
  }

  private getDiseaseColor(name: string): string {
    const colors: { [key: string]: string } = {
      'Anthracnose': 'bg-red-500',
      'Bacterial Canker': 'bg-orange-500',
      'Cutting Weevil': 'bg-yellow-500',
      'Die Back': 'bg-red-600',
      'Gall Midge': 'bg-orange-400',
      'Healthy': 'bg-green-500',
      'Powdery Mildew': 'bg-purple-500',
      'Sooty Mold': 'bg-gray-700',
      'Sooty Mould': 'bg-gray-700',
      'Alternaria': 'bg-red-500',
      'Black Mold Rot': 'bg-gray-900',
      'Black Mould Rot': 'bg-gray-900',
      'Stem End Rot': 'bg-orange-600',
      'Stem end Rot': 'bg-orange-600'
    };
    return colors[name] || 'bg-gray-500';
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  getSeverityText(severity: string): string {
    switch (severity) {
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Low Risk';
      default: return 'Unknown';
    }
  }

    // Navigation methods
  navigateToUploadImages() {
    this.router.navigate(['/admin/upload-images']);
  }
  
  navigateToImageGallery(filter?: string) {
    if (filter) {
      this.router.navigate(['/admin/verified-images'], { queryParams: { filter } });
    } else {
      this.router.navigate(['/admin/verified-images']);
    }
  }
  
  navigateToUserManagement() {
    this.router.navigate(['/admin/user-management']);
  }
  
  navigateToModelSettings() {
    // Navigate to model settings when available
    console.log('Navigate to model settings');
  }

  async exportDataset() {
    try {
      const blob = await this.mangoDiseaseService.exportDataset('json').toPromise();
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mango-disease-dataset-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting dataset:', error);
      alert('Failed to export dataset. Please try again.');
    }
  }

  async refreshData() {
    await this.loadDashboardData();
  }
}